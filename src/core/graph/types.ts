/**
 * Graph IR：UI 格式与 API 格式归一化后的统一结构。
 * rules / vram 只依赖这里，后续 diff 能力也基于这套结构做图匹配。
 *
 */

/** 节点 id。UI 格式里是数字，统一转成字符串避免两种格式的 id 类型不一致。 */
export type NodeId = string

/** 连线 id */
export type LinkId = number

/** widget 值的种类，取不到 schema 时归为 unknown */
export type WidgetKind = 'int' | 'float' | 'string' | 'boolean' | 'combo' | 'unknown'

/** 节点的一个参数。UI 格式的裸数组经注册表还原后得到带语义名的结构。 */
export interface WidgetValue {
  /** 在 widgets_values 数组中的原始下标，schema 缺失时用于兜底定位 */
  index: number
  /** 语义名，如 seed / steps / cfg；拿不到 schema 时退化为 arg_0 */
  name: string
  value: unknown
  kind: WidgetKind
  /** name 的来源：schema=查表得到，inferred=按类型推断，unknown=无从判断 */
  nameSource: 'schema' | 'inferred' | 'unknown'
}

/** 节点的一个输入端口。 */
export interface NodeInput {
  name: string
  /** 数据类型，如 MODEL / LATENT / IMAGE；未记录时为 null */
  dataType: string | null
  /** 连到该输入的连线 id，未连线为 null */
  link: LinkId | null
}

/** 节点的一个输出端口。 */
export interface NodeOutput {
  name: string
  dataType: string | null
  /** 从该输出引出的所有连线 id */
  links: LinkId[]
}

/** 归一化后的节点。两种源格式解析后都得到本结构。 */
export interface GraphNode {
  id: NodeId
  /** 节点类型，如 KSampler / CheckpointLoaderSimple */
  type: string
  /** 用户改过的显示名，未改则为 null */
  title: string | null
  /** 0=正常 2=never 4=mute，沿用 ComfyUI 语义 */
  mode: number
  widgets: WidgetValue[]
  inputs: NodeInput[]
  outputs: NodeOutput[]
  /** 原始节点对象，用于兜底取值和兼容未来字段 */
  raw: unknown
}

/** 归一化后的连线。from / to 同时记录节点 id 与插槽序号。 */
export interface GraphLink {
  id: LinkId
  from: { node: NodeId; slot: number }
  to: { node: NodeId; slot: number }
  dataType: string | null
}

/** 源格式标识，决定走哪个解析器 */
export type SourceFormat = 'ui' | 'api'

/** 归一化后的 workflow。rules 与 vram 的唯一输入。 */
export interface WorkflowGraph {
  format: SourceFormat
  nodes: GraphNode[]
  links: GraphLink[]
  /** 暂不解析的字段（groups / extra / version 等），原样保留 */
  meta: Record<string, unknown>
}

/** 邻接表。由图一次性构建，供反复查询，避免每次遍历全图。 */
export interface AdjacencyIndex {
  nodeById: Map<NodeId, GraphNode>
  outgoing: Map<NodeId, GraphLink[]>
  incoming: Map<NodeId, GraphLink[]>
}
