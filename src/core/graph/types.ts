/**
 * 设计约束
 * 1.零框架依赖这里不能出现任何 vue / react / DOM API，因为后续 diff 引擎要直接复用这套结构，还要能跑在 Web Worker 里。
 * 2. 两种源格式（UI 格式、API 格式）都必须能归一化到这里。
 * 3. 字段要能支撑后续图匹配：节点哈希、邻居签名都基于这里的信息。
 */

export type NodeId = string
export type LinkId = number

export type WidgetKind = 'int' | 'float' | 'string' | 'boolean' | 'combo' | 'unknown'

export type SourceFormat = 'ui' | 'api'

export interface WidgetValue {
  /** 在 widgets_values 数组中的原始下标，兜底定位用 */
  index: number
  /** 语义名，如 seed / steps / cfg；拿不到 schema 时退化为 arg_0 */
  name: string
  value: unknown
  kind: WidgetKind
  /** name 的来源：schema=查表得到，inferred=按类型猜，unknown=完全不知道 */
  nameSource: 'schema' | 'inferred' | 'unknown'
}

export interface NodeInput {
  name: string
  dataType: string | null
  /** 未连线为 null */
  link: LinkId | null
}

export interface NodeOutput {
  name: string
  dataType: string | null
  links: LinkId[]
}


export interface GraphNode {
  id: NodeId
  /** 节点类型，如 KSampler / CheckpointLoaderSimple */
  type: string
  /** 用户改过的显示名，没改则为 null */
  title: string | null
  /** 0=正常 2=never 4=mute（沿用 ComfyUI 语义） */
  mode: number
  widgets: WidgetValue[]
  inputs: NodeInput[]
  outputs: NodeOutput[]
  /** 原始节点数据，解析失败兜底与未来兼容用 */
  raw: unknown
}
export interface GraphLink {
  id: LinkId
}

export interface WorkflowGraph {
  format: SourceFormat
  nodes: GraphNode[]
  links: GraphLink[]
}
