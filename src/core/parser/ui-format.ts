import type { NodeRegistry } from '../registry'
import type {
  GraphLink,
  GraphNode,
  WidgetKind,
  WidgetValue,
  WorkflowGraph,
} from '../graph'

/**
 * UI 格式解析器，对应 ComfyUI 画布直接保存的 workflow.json。
 *
 * 结构示意：
 * {
 *   "nodes": [{ "id": 3, "type": "KSampler", "inputs": [...], "outputs": [...],
 *               "widgets_values": [1, "randomize", 20, 8, "euler", "normal", 1],
 *               "properties": { "Node name for S&R": "KSampler" }, "mode": 0 }],
 *   "links": [[1, 4, 0, 3, 0, "MODEL"]]
 * }
 *
 * widgets_values 是无参数名的裸数组，必须查 /object_info 的 schema 才能还原语义名，
 * 查不到时退化为 arg_N 并把 nameSource 标为 unknown，由上层决定是否据此降级。
 */

interface RawUiNode {
  id: number | string
  type: string
  mode?: number
  inputs?: Array<{ name?: string; type?: string; link?: number | null }>
  outputs?: Array<{ name?: string; type?: string; links?: number[]; slot_index?: number }>
  widgets_values?: unknown[]
  properties?: Record<string, unknown>
  title?: string
}

interface RawUiWorkflow {
  nodes?: RawUiNode[]
  links?: Array<[number, number, number, number, number, string?]>
  groups?: unknown[]
  version?: number
  extra?: Record<string, unknown>
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN'])

/** 判断 schema 里的输入是否为 widget（连线输入的 type 是 MODEL 之类的大写标识符）。 */
function isWidgetLike(type: unknown): boolean {
  if (Array.isArray(type)) return true // COMBO 在 object_info 里表现为数组
  if (typeof type !== 'string') return false
  return WIDGET_TYPES.has(type.toUpperCase())
}

/** 优先按 schema 类型判定，取不到时按实际值的 JS 类型推断。 */
function kindOf(value: unknown, schemaType?: unknown): WidgetKind {
  if (Array.isArray(schemaType)) return 'combo'
  if (typeof schemaType === 'string') {
    const t = schemaType.toUpperCase()
    if (t === 'INT') return 'int'
    if (t === 'FLOAT') return 'float'
    if (t === 'BOOLEAN') return 'boolean'
    if (t === 'STRING') return 'string'
  }
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'string'
  return 'unknown'
}

/**
 * 还原 widgets_values 对应的参数名序列。
 * 顺序沿用 ComfyUI 惯例：required 中的 widget 在前，optional 中的在后。
 * @returns 与 widgets_values 下标一一对应的名字数组，查不到 schema 时为空
 */
export function resolveWidgetNames(type: string, registry?: NodeRegistry): string[] {
  const def = registry?.nodes[type]
  if (!def?.inputs) return []
  return def.inputs.filter((i) => isWidgetLike(i.type)).map((i) => i.name)
}

/** 解析 UI 格式。字段缺失时按空值兜底，不抛异常。 */
export function parseUiFormat(raw: unknown, registry?: NodeRegistry): WorkflowGraph {
  const doc = raw as RawUiWorkflow
  const rawNodes = Array.isArray(doc.nodes) ? doc.nodes : []
  const rawLinks = Array.isArray(doc.links) ? doc.links : []

  const nodes: GraphNode[] = rawNodes.map((n) => {
    const type = String(n.type ?? '')
    const names = resolveWidgetNames(type, registry)
    const values = Array.isArray(n.widgets_values) ? n.widgets_values : []

    const widgets: WidgetValue[] = values.map((value, index) => {
      const name = names[index]
      return {
        index,
        name: name ?? `arg_${index}`,
        value,
        kind: kindOf(value, registry?.nodes[type]?.inputs?.find((i) => i.name === name)?.type),
        nameSource: name ? 'schema' : 'unknown',
      }
    })

    const srtTitle = n.properties?.['Node name for S&R']

    return {
      id: String(n.id),
      type,
      title: n.title ?? (typeof srtTitle === 'string' ? srtTitle : null),
      mode: typeof n.mode === 'number' ? n.mode : 0,
      widgets,
      inputs: (n.inputs ?? []).map((i) => ({
        name: i.name ?? '',
        dataType: i.type ?? null,
        link: typeof i.link === 'number' ? i.link : null,
      })),
      outputs: (n.outputs ?? []).map((o) => ({
        name: o.name ?? '',
        dataType: o.type ?? null,
        links: Array.isArray(o.links) ? o.links.filter((x) => typeof x === 'number') : [],
      })),
      raw: n,
    }
  })

  const links: GraphLink[] = rawLinks.map((l) => ({
    id: l[0],
    from: { node: String(l[1]), slot: l[2] },
    to: { node: String(l[3]), slot: l[4] },
    dataType: l[5] ?? null,
  }))

  return {
    format: 'ui',
    nodes,
    links,
    meta: { version: doc.version, extra: doc.extra, groups: doc.groups },
  }
}
