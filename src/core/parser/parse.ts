import type { SourceFormat, WorkflowGraph } from '../graph'
import type { NodeRegistry } from '../registry'
import { parseUiFormat } from './ui-format'
import { parseApiFormat } from './api-format'

/** 解析结果。graph 为 null 表示格式无法识别，失败原因在 warnings 里。 */
export interface ParseResult {
  /** 解析成功时为图，格式无法识别时为 null */
  graph: WorkflowGraph | null
  /** 识别出的源格式，无法识别时为 null */
  format: SourceFormat | null
  /** 解析过程中的降级说明，需要展示给用户 */
  warnings: string[]
}

/**
 * 嗅探源格式。按结构特征判断而非文件扩展名——导出文件名由用户决定，不可依赖。
 * @returns 两种格式都不匹配时返回 null
 */
export function detectFormat(raw: unknown): SourceFormat | null {
  if (!raw || typeof raw !== 'object') return null

  const doc = raw as Record<string, unknown>

  if (Array.isArray(doc.nodes)) return 'ui'

  const values = Object.values(doc)
  if (values.length > 0 && values.some((v) => isRecord(v) && typeof v.class_type === 'string')) {
    return 'api'
  }

  return null
}

/**
 * 解析任意格式的 workflow。
 *
 * 解析过程中发生的降级（参数名还原失败、格式本身缺少信息）都写进 warnings，
 * 由上层展示——静默降级会让用户误以为结果是完整的。
 */
export function parseWorkflow(raw: unknown, registry?: NodeRegistry): ParseResult {
  const warnings: string[] = []
  const format = detectFormat(raw)

  if (!format) {
    return { graph: null, format: null, warnings: ['无法识别的 workflow 格式'] }
  }

  let graph: WorkflowGraph
  if (format === 'ui') {
    graph = parseUiFormat(raw, registry)
    const unknownName = graph.nodes.filter((n) => n.widgets.some((w) => w.nameSource === 'unknown'))
    if (unknownName.length > 0) {
      warnings.push(
        `有 ${unknownName.length} 个节点的参数名未能从注册表还原，已按 arg_N 兜底，相关检测可能不够精确`,
      )
    }
  } else {
    graph = parseApiFormat(raw)
    warnings.push('API 格式不含坐标与分组信息，可视化 diff 时布局需重新计算')
  }

  if (graph.nodes.length === 0) {
    warnings.push('workflow 中没有任何节点')
  }

  return { graph, format, warnings }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
