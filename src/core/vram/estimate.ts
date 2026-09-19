import type { WorkflowGraph } from '../graph'
import { findNodesByType, getWidget } from '../graph'
import { extractModelNames } from '../rules'
import { lookupModelSize } from './model-sizes'

/** 显存构成的一项。 */
export interface VramBreakdownItem {
  label: string
  bytes: number
}

/** 针对某个显存档位的判定。一张卡一条，UI 按 verdict 染色。 */
export interface VramVerdict {
  /** 显卡显存容量，单位 GB */
  vramGB: number
  /** ok=装得下 tight=接近上限 fail=大概率 OOM */
  verdict: 'ok' | 'tight' | 'fail'
}

export interface VramEstimate {
  minBytes: number
  maxBytes: number
  /** 估算可信度。存在未能识别的模型时为 low，分辨率未知时为 medium */
  confidence: 'high' | 'medium' | 'low'
  breakdown: VramBreakdownItem[]
  /** 估算过程中降级或无法覆盖的说明，展示给用户 */
  notes: string[]
  verdicts: VramVerdict[]
}

const GB = 1024 ** 3

/** torch + CUDA context 的固定开销。不同版本差异较大，取偏保守的值。 */
export const RUNTIME_OVERHEAD_BYTES = Math.round(1.2 * GB)

/** 常见显卡显存档位 */
const VERDICT_TARGETS = [6, 8, 12, 16, 24, 32]

/** 会加载模型权重的节点类型 */
const LOADER_PATTERN = /loader|upscalemodel|seedvr|checkpoint/i

/** 含视频处理节点时，实际显存会远高于单帧估算 */
const VIDEO_PATTERN = /video|seedvr|wan|frame/i

/**
 * 估算 workflow 运行所需显存。
 *
 * 返回区间而非单值：激活值随架构和采样器差异可达数倍，给确定数字没有意义。
 * 上界另按模型权重 +10% 与激活值 ×1.5 放宽，覆盖 fp32 加载、显存碎片等情况。
 */
export function estimateVram(graph: WorkflowGraph): VramEstimate {
  const breakdown: VramBreakdownItem[] = []
  const notes: string[] = []
  let residentBytes = 0
  let unknownCount = 0

  for (const node of graph.nodes) {
    if (!LOADER_PATTERN.test(node.type)) continue

    for (const name of extractModelNames(node)) {
      const hit = lookupModelSize(name)
      if (!hit) {
        unknownCount += 1
        notes.push(`未能识别模型「${name}」的体积，这部分显存没有计入估算`)
        continue
      }
      residentBytes += hit.bytes
      breakdown.push({ label: `${hit.label} · ${name}`, bytes: hit.bytes })
    }
  }

  breakdown.push({ label: '运行时开销（torch + CUDA）', bytes: RUNTIME_OVERHEAD_BYTES })

  const activation = computeActivationBytes(graph, notes)
  breakdown.push(...activation.items)

  const minBytes = residentBytes + RUNTIME_OVERHEAD_BYTES + activation.low
  const maxBytes =
    Math.round(residentBytes * 1.1) + RUNTIME_OVERHEAD_BYTES + Math.round(activation.high * 1.5)

  const confidence: VramEstimate['confidence'] =
    unknownCount > 0 ? 'low' : activation.confident ? 'high' : 'medium'

  return {
    minBytes,
    maxBytes,
    confidence,
    breakdown,
    notes,
    verdicts: VERDICT_TARGETS.map((vramGB) => ({
      vramGB,
      verdict: judge(minBytes, maxBytes, vramGB * GB),
    })),
  }
}

/**
 * 按容量判定能否跑起来。
 * 上界留出 10% 余量才算 ok——驱动、桌面合成器都会占用一部分显存。
 */
function judge(minBytes: number, maxBytes: number, capacityBytes: number): VramVerdict['verdict'] {
  if (maxBytes <= capacityBytes * 0.9) return 'ok'
  if (minBytes <= capacityBytes * 0.95) return 'tight'
  return 'fail'
}

/**
 * 估算激活值显存（模型权重之外的部分）。
 *
 * @param notes 引用传入，降级说明直接 push 回上层
 * @returns low/high 区间与明细；confident 表示是否拿到了分辨率
 */
function computeActivationBytes(
  graph: WorkflowGraph,
  notes: string[],
): { low: number; high: number; items: VramBreakdownItem[]; confident: boolean } {
  const res = detectResolution(graph)
  if (!res) {
    notes.push('未能确定分辨率，激活值未计入估算')
    return { low: 0, high: 0, items: [], confident: false }
  }

  // 帧数要从视频节点的配置里读，这里取不到，一律按单帧算并如实标注
  const frames = 1
  if (graph.nodes.some((n) => VIDEO_PATTERN.test(n.type))) {
    notes.push('按单帧估算，视频实际会显著更高')
  }

  const { width, height, batch } = res

  // latent 空间：4 通道，宽高各为像素的 1/8（VAE 下采样倍率），fp16 每数值 2 字节
  // 512×512 batch=1 → 4 × 64 × 64 × 1 × 2 = 32KB
  const latent = 4 * Math.ceil(width / 8) * Math.ceil(height / 8) * batch * frames * 2

  // VAE 解码回像素空间：3 通道 × 原始尺寸，同样按 fp16 计
  // 512×512 batch=1 → 3 × 512 × 512 × 1 × 2 ≈ 1.5MB
  const pixel = 3 * width * height * batch * frames * 2

  // 采样过程中的中间激活值随架构差异很大，按 latent 的倍数估一个区间
  const interLow = latent * 2
  const interHigh = latent * 3

  const low = latent + interLow + pixel
  const high = latent + interHigh + pixel

  const items: VramBreakdownItem[] = [
    { label: 'Latent 张量', bytes: latent },
    { label: '采样中间激活（low 估计）', bytes: interLow },
    { label: 'VAE 解码像素缓冲', bytes: pixel },
  ]

  return { low, high, items, confident: true }
}

/**
 * 从 EmptyLatentImage 节点读取宽高与 batch。
 * @returns 取不到有效尺寸时返回 null
 */
export function detectResolution(graph: WorkflowGraph): {
  width: number
  height: number
  batch: number
} | null {
  const nodes = findNodesByType(graph, 'EmptyLatentImage')
  for (const node of nodes) {
    const width = numOr(getWidget(node, 'width'), 512)
    const height = numOr(getWidget(node, 'height'), 512)
    const batch = numOr(getWidget(node, 'batch_size'), 1)
    if (width > 0 && height > 0) return { width, height, batch }
  }
  return null
}

/** widget 值可能缺失或类型不对，取不到时回落默认值 */
function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
