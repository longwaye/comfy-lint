import type { AdjacencyIndex, GraphNode, NodeId } from './types'

/**
 * 图匹配原语，用于比对两个 workflow 的差异。
 *
 * 匹配分两轮：
 *   1. hashNode —— 内容完全一致，可直接判定为同一节点
 *   2. neighborSignature —— 内容变了但邻居结构一致，判定为"改了参数或重排了 id"
 *
 * 只靠内容哈希时，改动任一参数就匹配不上；只靠邻居签名时，结构对称的节点
 * 会互相误配。两轮结合才能覆盖 ComfyUI 保存时最常见的两类变化。
 */

/**
 * 节点内容指纹。
 *
 * 只取 type 与 widget 值：坐标变化是摆放调整，id 在重新保存后会被重排，
 * 两者都不属于业务变更，纳入哈希会导致误判为"节点被改过"。
 */
export function hashNode(node: GraphNode): string {
  const payload = JSON.stringify([node.type, node.widgets.map((w) => [w.name, w.value])])
  return simpleHash(payload)
}

/**
 * 节点邻居结构指纹，形如 `CheckpointLoaderSimple->KSampler,VAEDecode`。
 *
 * 两侧邻居都必须排序：links 的顺序不保证稳定，不排序会让同一结构算出
 * 不同签名，第二轮匹配直接失效。
 */
export function neighborSignature(nodeId: NodeId, index: AdjacencyIndex): string {
  const prev = (index.incoming.get(nodeId) ?? [])
    .map((l) => index.nodeById.get(l.from.node)?.type ?? '?')
    .sort()
  const next = (index.outgoing.get(nodeId) ?? [])
    .map((l) => index.nodeById.get(l.to.node)?.type ?? '?')
    .sort()
  return `${prev.join(',')}->${next.join(',')}`
}

/** FNV-1a。非加密哈希，只要求快和短，输出 base36 便于直接放进 diff 结果里展示。 */
function simpleHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
