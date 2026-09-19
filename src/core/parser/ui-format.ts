/**
 * UI 格式（从 ComfyUI 画布直接保存的 workflow.json）解析器。
 *
 * 结构示意：
 * {
 *   "nodes": [{ "id": 3, "type": "KSampler", "inputs": [...], "outputs": [...],
 *               "widgets_values": [1, "randomize", 20, 8, "euler", "normal", 1],
 *               "properties": { "Node name for S&R": "KSampler" }, "mode": 0 }],
 *   "links": [[1, 4, 0, 3, 0, "MODEL"]]
 * }
 *
 * widgets_values 是裸数组，没有参数名。
 * 参数名必须查 /object_info 的 schema 才能还原，查不到就退化成 arg_N 并标记 unknown。
 */

import type { WorkflowGraph } from '../graph'
import type { NodeRegistry } from '../registry'

interface RawUiNode {
  id: number | string
  type: string
  mode?: number
  inputs?: Array<{ name?: string; type?: string; link?: number | null }>
  outputs?: Array<{ name?: string; type?: string; links?: number[]; slot_index?: number }>
  widgets_values?: unknown[]
  properties?: Record<string, unknown>
  title?: string
}

interface RawUiWorkflow {
  nodes?: RawUiNode[]
  links?: Array<[number, number, number, number, number, string?]>
  groups?: unknown[]
  version?: number
  extra?: Record<string, unknown>
}

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN'])

export function parseUiFormat(raw: unknown, registry?: NodeRegistry): WorkflowGraph {
  
}
