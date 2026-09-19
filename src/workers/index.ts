/**
 * workers 模块对外出口。
 *
 * 不导出 `analyze.worker`：Worker 入口只能通过 Vite 的 `?worker` 后缀引用
 * （见 client.ts），由 Vite 单独打包。经 barrel 导出会让主 bundle 把它整份
 * 拉进来，而 worker 顶层的 `self.onmessage = ...` 也会随之在主线程执行。
 */

export { analyzeAsync } from './client'

export type { AnalyzeRequest, AnalyzeResponse } from './protocol'
