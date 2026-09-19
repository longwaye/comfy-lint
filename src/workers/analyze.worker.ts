/// <reference lib="webworker" />
import { analyze } from '@/core'
import type { AnalyzeRequest, AnalyzeResponse } from './protocol'

/**
 * 解析与规则匹配都是纯 CPU 活，大 workflow 放主线程会让拖拽和滚动掉帧，
 * 因此全部放到 Worker 里执行。
 */
self.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const req = event.data
  if (req?.kind !== 'analyze') return

  try {
    const report = analyze(req.raw, { inventory: req.inventory })
    const res: AnalyzeResponse = { id: req.id, ok: true, report }
    self.postMessage(res)
  } catch (err) {
    const res: AnalyzeResponse = {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    }
    self.postMessage(res)
  }
}
