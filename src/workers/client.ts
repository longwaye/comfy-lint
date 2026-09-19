import type { Report, LocalInventory } from '@/core'
import type { AnalyzeRequest, AnalyzeResponse } from './protocol'
import AnalyzeWorker from './analyze.worker?worker'

let worker: Worker | null = null
let seq = 0

/** 复用同一个 Worker 实例，避免每次分析都重新起线程 */
function getWorker(): Worker {
  if (!worker) worker = new AnalyzeWorker()
  return worker
}

/**
 * 把分析丢到 Worker 执行，主线程不阻塞。
 *
 * @param timeoutMs 超时按失败处理，避免主线程无限等待
 * @returns 解析与检测结果；超时或 Worker 报错时 reject
 */
export function analyzeAsync(raw: unknown, inventory?: Partial<LocalInventory>, timeoutMs = 10_000): Promise<Report> {
  const w = getWorker()
  const id = ++seq

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('分析超时'))
    }, timeoutMs)

    const onMessage = (e: MessageEvent<AnalyzeResponse>) => {
      if (e.data.id !== id) return
      cleanup()
      if (e.data.ok) resolve(e.data.report)
      else reject(new Error(e.data.error))
    }

    const onError = (e: ErrorEvent) => {
      cleanup()
      reject(new Error(e.message || 'Worker 执行失败'))
    }

    function cleanup() {
      clearTimeout(timer)
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }

    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)

    const req: AnalyzeRequest = { id, kind: 'analyze', raw, inventory }
    w.postMessage(req)
  })
}
