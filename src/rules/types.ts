import type { WorkflowGraph } from '@/core/graph'
import type { LocalInventory, NodeRegistry } from '@/core/registry/types'

export type Severity = 'error' | 'warn' | 'info'

/**
 * 诊断信息定义
 * 包含规则 ID、严重程度、标题、详细信息、关联节点 ID、建议等。
 */
export interface Diagnostic {
  ruleId: string
  severity: Severity
  title: string
  detail: string
  /** 关联的节点 id，用于 UI 点击定位 */
  nodeId?: string
  suggestion?: string
}

/**
 * 规则上下文定义
 * 包含工作流图、节点注册表、本地资产清单等。
 */
export interface RuleContext {
  graph: WorkflowGraph
  registry: NodeRegistry
  inventory?: Partial<LocalInventory>
}

/**
 * 规则接口定义
 * 包含规则 ID、标题、运行函数等。
 */
export interface Rule {
  id: string
  title: string
  run(ctx: RuleContext): Diagnostic[]
}
