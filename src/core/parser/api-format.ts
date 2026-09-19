import type { GraphLink, GraphNode, WidgetKind, WidgetValue, WorkflowGraph } from '../graph'

/**
 * API 格式解析器，对应后端实际执行的 prompt 格式。
 *
 * 结构示意：
 * {
 *   "3": { "class_type": "KSampler", "inputs": { "seed": 1, "steps": 20, "model": ["4", 0] } },
 *   "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "sd_xl.safetensors" } }
 * }
 *
 * 与 UI 格式相比：参数名天然存在，但没有坐标、分组和显示名；
 * 连线写作 [源节点 id, 源槽位]，且没有显式的 outputs，槽位需要反推。
 */

interface RawApiNode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

type RawApiWorkflow = Record<string, RawApiNode>

/** 连线值形如 ["4", 0]，即 [源节点 id, 源槽位]。 */
function isLink(v: unknown): v is [string, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'number'
}

/** 按 JS 类型推断 widget 种类，API 格式没有 schema 可参照。 */
function kindOf(value: unknown): WidgetKind {
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'string'
  return 'unknown'
}

/** 解析 API 格式。跳过结构不合法的节点，不抛异常。 */
export function parseApiFormat(raw: unknown): WorkflowGraph {
  const doc = (raw ?? {}) as RawApiWorkflow
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  let linkSeq = 1

  for (const [id, node] of Object.entries(doc)) {
    if (!node || typeof node !== 'object' || typeof node.class_type !== 'string') continue

    const widgets: WidgetValue[] = []
    const inputs: GraphNode['inputs'] = []

    let widgetIndex = 0
    for (const [name, value] of Object.entries(node.inputs ?? {})) {
      if (isLink(value)) {
        const linkId = linkSeq++
        links.push({
          id: linkId,
          from: { node: String(value[0]), slot: value[1] },
          to: { node: id, slot: inputs.length },
          dataType: null,
        })
        inputs.push({ name, dataType: null, link: linkId })
      } else {
        widgets.push({
          index: widgetIndex++,
          name,
          value,
          kind: kindOf(value),
          nameSource: 'schema',
        })
      }
    }

    nodes.push({
      id,
      type: node.class_type,
      title: node._meta?.title ?? null,
      mode: 0,
      widgets,
      inputs,
      outputs: [],
      raw: node,
    })
  }

  // 同一节点的多个输出在 API 格式里没有槽位编号，按出现顺序补一个
  const slotCounter = new Map<string, number>()
  for (const link of links) {
    const slot = slotCounter.get(link.from.node) ?? 0
    link.from.slot = link.from.slot || slot
    slotCounter.set(link.from.node, link.from.slot + 1)
  }

  return { format: 'api', nodes, links, meta: {} }
}
