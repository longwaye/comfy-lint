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

/**
 * 节点 UI 控件值定义
 * 用于描述 ComfyUI 中的节点 UI 控件值，包括其名称、类型、值等。
 * @param index 在 widgets_values 数组中的原始下标，兜底定位用
 * @param name 语义名，如 seed / steps / cfg；拿不到 schema 时退化为 arg_0
 * @param value 控件值
 * @param kind 控件类型
 * @param nameSource name 的来源：schema=查表得到，inferred=按类型猜，unknown=完全不知道
 */
export interface WidgetValue {
  index: number
  name: string
  value: unknown
  kind: WidgetKind
  nameSource: 'schema' | 'inferred' | 'unknown'
}

/**
 * 节点输入参数定义
 * 用于描述 ComfyUI 中的节点输入参数，包括其名称、类型、是否可选等。
 * @param name 输入参数名
 * @param dataType 输入参数类型
 * @param link 连线 ID，未连线为 null
 */
export interface NodeInput {
  name: string
  dataType: string | null
  link: LinkId | null
}

/**
 * 节点输出参数定义
 * 用于描述 ComfyUI 中的节点输出参数，包括其名称、类型、是否可选等。
 * @param name 输出参数名
 * @param dataType 输出参数类型
 * @param links 连线 ID 列表
 */
export interface NodeOutput {
  name: string
  dataType: string | null
  links: LinkId[]
}


/**
 * 节点定义
 * 用于描述 ComfyUI 中的节点，包括其类型、显示名称、所属包、输入参数等。
 * @param id 节点唯一标识符
 * @param type 节点类型，如 KSampler / CheckpointLoaderSimple
 * @param title 用户改过的显示名，没改则为 null
 * @param mode 0=正常 2=never 4=mute（沿用 ComfyUI 语义）
 * @param widgets 节点的 UI 控件值
 * @param inputs 节点的输入参数
 * @param outputs 节点的输出参数
 * @param raw 原始节点数据，解析失败兜底与未来兼容用
 */
export interface GraphNode {
  id: NodeId
  type: string
  title: string | null
  mode: number
  widgets: WidgetValue[]
  inputs: NodeInput[]
  outputs: NodeOutput[]
  raw: unknown
}
export interface GraphLink {
  id: LinkId
}

/**
 * 工作流图定义
 * 用于描述 ComfyUI 中的工作流，包括其节点、连线等。
 * @param format 图格式，UI 格式或 API 格式
 * @param nodes 节点列表
 * @param links 连线列表
 */
export type WorkflowGraphFormat = 'ui' | 'api'
export interface WorkflowGraph {
  format: SourceFormat
  nodes: GraphNode[]
  links: GraphLink[]
}
