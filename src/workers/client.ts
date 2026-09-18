import type { Report, LocalInventory } from '../core'

/** 把分析丢给 Worker，主线程不等。超时按失败处理，避免页面一直转圈。
 * @param raw 要分析的 JSON 字符串
 * @param inventory 本地资产清单，可选值，包含模型、节点类型、显存容量等信息
 * @param timeout 超时时间，可选值，默认 10 秒
 */
export function analyzeAsync(raw: unknown, inventory?: Partial<LocalInventory>, timeout?: number): Promise<Report> {
  return new Promise((resolve, reject) => {})
}
