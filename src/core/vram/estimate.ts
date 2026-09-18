
export interface VramBreakdownItem {
  label: string
  bytes: number
}

export interface VramVerdict {
  vramGB: number
  /** ok=能跑 tight=勉强 fail=大概率 OOM */
  verdict: 'ok' | 'tight' | 'fail'
}

/**
 * 内存占用估计定义
 * 包含模型 ID、占用内存（MB）等。
 * 用于描述 ComfyUI 中的模型占用的显存，包括其最小占用、最大占用、置信度、占用组件、备注、判断等。
 */
export interface VramEstimate {
  minBytes: number
  maxBytes: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: VramBreakdownItem[]
  notes: string[]
  verdicts: VramVerdict[]
}
