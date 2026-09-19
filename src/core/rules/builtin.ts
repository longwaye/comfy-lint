import { getWidget, type GraphNode } from '../graph'
import type { Diagnostic, Rule } from './types'

/**
 * 节点里可能存放模型文件名的 widget 名，按优先级排列。
 * 提在模块级避免每次调用重建数组。
 */
const MODEL_WIDGET_KEYS = [
  'ckpt_name',
  'lora_name',
  'vae_name',
  'control_net_name',
  'model_name',
  'unet_name',
  'clip_name',
]

/** 加载模型类节点的类型特征。自定义节点命名不统一，用正则兜住变体。 */
const MODEL_NODE_TYPE = /loader|upscalemodel|seedvr/i

/**
 * 检测工作流引用了但注册表和本机都没有的节点类型。
 * ComfyUI 遇到未安装的节点会直接拒绝加载整个工作流，属于必须提前发现的硬错误。
 */
export const unknownNodeRule: Rule = {
  id: 'unknown-node',
  title: '未识别节点',
  run(ctx) {
    const installed = new Set(ctx.inventory?.nodeTypes ?? [])
    const out: Diagnostic[] = []

    for (const node of ctx.graph.nodes) {
      const known = Boolean(ctx.registry.nodes[node.type])
      if (known || installed.has(node.type)) continue

      out.push({
        ruleId: 'unknown-node',
        severity: 'error',
        title: `节点 ${node.type} 可能未安装`,
        detail: `这个节点类型不在注册表里${
          installed.size > 0 ? '，也不在你提供的已安装列表中' : ''
        }，多半来自某个自定义节点包。`,
        nodeId: node.id,
        suggestion: '在 ComfyUI Manager 里搜索该节点名安装对应节点包',
      })
    }

    return out
  },
}

/** 检测必填输入未连线。这类问题运行时才报错，可以在导入阶段提前抓出来。 */
export const unconnectedInputRule: Rule = {
  id: 'unconnected-input',
  title: '未连线输入',
  run(ctx) {
    const out: Diagnostic[] = []

    for (const node of ctx.graph.nodes) {
      const def = ctx.registry.nodes[node.type]
      if (!def?.inputs) continue

      for (const input of def.inputs) {
        // 数组形式的 type 是下拉选项（combo），不是连线输入
        if (Array.isArray(input.type)) continue
        if (input.optional) continue

        const connected = node.inputs.some((i) => i.name === input.name && i.link !== null)
        if (connected) continue

        // 参数名解析失败时无法确认哪个输入对应哪个 widget，跳过以免误报
        if (node.widgets.some((w) => w.nameSource === 'unknown')) continue

        out.push({
          ruleId: 'unconnected-input',
          severity: 'error',
          title: `${node.type} 的 ${input.name} 没有连线`,
          detail: `${input.name} 是必填输入（类型 ${input.type}），当前未连接。`,
          nodeId: node.id,
          suggestion: `把上游节点的 ${input.type} 输出连到 ${input.name}`,
        })
      }
    }

    return out
  },
}

/**
 * 检测节点引用的模型文件在本机是否存在。
 *
 * 提供了本机清单时逐个比对，缺失报 error。没提供清单时只报 info ——
 * 此时无从判断，报 error 属于误报，会直接毁掉工具的可信度。
 */
export const missingModelRule: Rule = {
  id: 'missing-model',
  title: '缺失模型',
  run(ctx) {
    const out: Diagnostic[] = []
    const seen = new Set<string>()

    // 空数组也算提供了清单，含义是"本机没有任何模型"，仍需逐个比对
    const hasInventory = Array.isArray(ctx.inventory?.models)
    const owned = new Set(
      (ctx.inventory?.models ?? []).map(normalizeModelName).filter((x): x is string => x !== null),
    )

    for (const node of ctx.graph.nodes) {
      if (!MODEL_NODE_TYPE.test(node.type)) continue

      for (const name of extractModelNames(node)) {
        // 同一个模型被多个节点引用时只报一条
        if (seen.has(name)) continue
        seen.add(name)

        if (hasInventory && !owned.has(name)) {
          out.push({
            ruleId: 'missing-model',
            severity: 'error',
            title: `缺失模型 ${name}`,
            detail: `节点 ${node.type} 引用的模型「${name}」不在本机清单中。`,
            nodeId: String(node.id),
            suggestion: '按工作流说明下载该模型，放到 ComfyUI 对应的 models 目录',
          })
        } else if (!hasInventory) {
          out.push({
            ruleId: 'missing-model',
            severity: 'info',
            title: '该工作流引用了模型，请确认本机是否已下载',
            detail: `节点 ${node.type} 引用了「${name}」，未提供本机模型清单，无法判断是否已下载。`,
            nodeId: String(node.id),
            suggestion: '在设置里导入本机模型清单后可自动检测',
          })
        }
      }
    }

    return out
  },
}

/**
 * 归一化模型文件名，去掉目录前缀并转小写。
 *
 * 比对双方都要过这个函数：用户清单里是 `xl\SD_XL.safetensors`，
 * workflow 里可能写成 `SD_XL.safetensors`，只有归一到 basename 才对得上。
 *
 * @returns 归一化后的文件名，入参不是非空字符串时返回 null
 */
export function normalizeModelName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  const base = s.split(/[\\/]/).pop() ?? s
  return base.toLowerCase()
}

/**
 * 提取节点引用的模型文件名。
 * 先按已知 widget 名找，找不到就取第一个字符串 widget 兜底。
 *
 * @returns 已归一化的模型名数组，取不到时为空数组
 */
export function extractModelNames(node: GraphNode): string[] {
  for (const key of MODEL_WIDGET_KEYS) {
    const normalized = normalizeModelName(getWidget(node, key))
    if (normalized) return [normalized]
  }

  const fallback = node.widgets.find((w) => w.kind === 'string' && typeof w.value === 'string')
  const normalized = normalizeModelName(fallback?.value)
  return normalized ? [normalized] : []
}

/** 默认启用的规则集合。新增规则在此登记即可，引擎与 barrel 不用改。 */
export const BUILTIN_RULES: Rule[] = [
  unknownNodeRule,
  unconnectedInputRule,
  missingModelRule,
]
