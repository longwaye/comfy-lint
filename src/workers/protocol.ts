import type { LocalInventory, Report } from "@/core"

/**
 * 主线程与 Worker 之间的消息协议
 */
export interface AnalyzeRequest {
  /** 递增序号，响应原样带回，用于并发时匹配请求 */
  id: number
  kind: 'analyze'
  /** 待解析的 workflow */
  raw: unknown
  inventory?: Partial<LocalInventory>
}

/** Worker 回传结果。失败时 ok 为 false，error 为错误信息。 */
export type AnalyzeResponse =
  | { id: number; ok: true; report: Report }
  | { id: number; ok: false; error: string }