import type { Diagnostic } from '@/rules/types'
import type { WorkflowGraph } from './graph'
import type { VramEstimate } from './vram'

/** 分析报告
 * @param ok 是否分析成功
 * @param graph 工作流图，分析成功时非 null
 * @param diagnostics 诊断信息，分析成功时非空
 * @param vram 内存占用估计，分析成功时非 null
 * @param warnings 警告信息，分析成功时非空
 * @param stats 分析统计信息，分析成功时非空
 */
export interface Report {
  ok: boolean
  graph: WorkflowGraph | null
  diagnostics: Diagnostic[]
  vram: VramEstimate | null
  warnings: string[]
  stats: { nodeCount: number; linkCount: number; elapsedMs: number }
}

export function analyze(raw: unknown) {
  console.log(raw)
}
