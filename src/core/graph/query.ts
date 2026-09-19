import type { AdjacencyIndex, GraphLink, GraphNode, NodeId, WorkflowGraph } from './types'

/**
 * 构建邻接表。
 * 图匹配需要反复查询节点的上下游，每次遍历 links 是 O(N²)，预建索引后单次查询 O(1)。
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

/**
 * 按语义名取 widget 值。
 * @returns 取不到时返回 undefined，调用方自行兜底
 */
export function getWidget(node: GraphNode, name: string): unknown {
  return node.widgets.find((w) => w.name === name)?.value
}

/**
 * 按类型过滤节点。
 * @param type 精确类型名，或匹配类型名的正则（自定义节点命名不统一时用正则）
 */
export function findNodesByType(graph: WorkflowGraph, type: string | RegExp): GraphNode[] {
  if (typeof type === 'string') {
    return graph.nodes.filter((n) => n.type === type)
  }
  return graph.nodes.filter((n) => type.test(n.type))
}
