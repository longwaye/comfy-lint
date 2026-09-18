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
  from: { node: NodeId; slot: number }
  to: { node: NodeId; slot: number }
  dataType: string | null
}

export type WorkflowGraphFormat = 'ui' | 'api'
/**
 * 工作流图定义
 * 用于描述 ComfyUI 中的工作流，包括其节点、连线等。
 * @param format 图格式，UI 格式或 API 格式
 * @param nodes 节点列表
 * @param links 连线列表
 * @param meta 元数据，如 groups / extra / version 等
 */
export interface WorkflowGraph {
  format: SourceFormat
  nodes: GraphNode[]
  links: GraphLink[]
  meta: Record<string, unknown>
}

/**
 * 邻接索引定义
 * 用于快速查找节点的入边和出边，支持 O(1) 时间复杂度。
 * @param nodeById 节点 ID 映射表，键为节点 ID，值为节点
 * @param outgoing 出边映射表，键为节点 ID，值为该节点的出边 ID 列表
 * @param incoming 入边映射表，键为节点 ID，值为该节点的入边 ID 列表
 */
export interface AdjacencyIndex {
  nodeById: Map<NodeId, GraphNode>
  outgoing: Map<NodeId, GraphLink[]>
  incoming: Map<NodeId, GraphLink[]>
}

/**
 * 构建邻接索引
 * 用于快速查找节点的入边和出边，支持 O(1) 时间复杂度。
 * @param graph 工作流图
 * @returns 邻接索引
 */
export function buildIndex(graph: WorkflowGraph): AdjacencyIndex {
  const nodeById = new Map<NodeId, GraphNode>()
  const outgoing = new Map<NodeId, GraphLink[]>()
  const incoming = new Map<NodeId, GraphLink[]>()

  for (const node of graph.nodes) {
    nodeById.set(node.id, node)
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }

  for (const link of graph.links) {
    outgoing.get(link.from.node)?.push(link)
    incoming.get(link.to.node)?.push(link)
  }

  return { nodeById, outgoing, incoming }
}

/** 按语义名取参数值，找不到返回 undefined */
export function getWidget(node: GraphNode, name: string): unknown {
  return node.widgets.find((w) => w.name === name)?.value
}

/** 按类型名过滤节点 */
export function filterNodesByType(graph: WorkflowGraph, type: string | RegExp): GraphNode[] {
  if (typeof type === 'string') {
    return graph.nodes.filter((n) => n.type === type)
  }
  return graph.nodes.filter((n) => type.test(n.type))
}

function simpleHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
/**
 * 节点内容哈希，用于 diff 阶段的精确匹配。
 * 只算 type + widgets 值，不含 id 和坐标 —— 坐标变化不算业务变更。
 */
export function hashNode(node: GraphNode): string {
  const payload = JSON.stringify([node.type, node.widgets.map((w) => [w.name, w.value])])
  return simpleHash(payload)
}

/**
 * 邻居结构签名，用于 diff 阶段的第二轮匹配（应对 id 变化）。
 * 取前驱和后继节点的类型集合，排序后拼接。
 */
export function neighborSignature(nodeId: NodeId, index: AdjacencyIndex): string {
  const prev = (index.incoming.get(nodeId) ?? []).map((l) => index.nodeById.get(l.from.node)?.type ?? '?').sort()
  const next = (index.outgoing.get(nodeId) ?? []).map((l) => index.nodeById.get(l.to.node)?.type ?? '?').sort()
  return `${prev.join(',')}->${next.join(',')}`
}
