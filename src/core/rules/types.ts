import type { WorkflowGraph } from '../graph'
import type { LocalInventory, NodeRegistry } from '../registry'

/** error 会阻止 workflow 运行，warn 可能影响结果，info 只是提示。 */
export type Severity = 'error' | 'warn' | 'info'

/** 一条诊断结果。规则产出的最小单元，UI 按 severity 分色渲染。 */
export interface Diagnostic {
  /** 产出这条诊断的规则 id，便于按规则过滤和去重 */
  ruleId: string
  severity: Severity
  /** 一句话结论，列表项直接展示 */
  title: string
  /** 展开后的完整说明 */
  detail: string
  /** 关联节点 id，用于 UI 点击定位 */
  nodeId?: string
  /** 修复建议，无建议时省略 */
  suggestion?: string
}

/** 规则执行上下文。由 analyze 组装后传入每条规则，规则只读不写。 */
export interface RuleContext {
  graph: WorkflowGraph
  registry: NodeRegistry
  /** 用户本机环境。未提供时规则应降级为 info，不要在信息不足时报 error */
  inventory?: Partial<LocalInventory>
}

/** 一条检测规则。新增检测项：实现本接口，并注册进 BUILTIN_RULES。 */
export interface Rule {
  /** 稳定标识，会写进 Diagnostic.ruleId */
  id: string
  /** 规则名，展示给用户看 */
  title: string
  /** 返回该规则发现的全部问题，无问题时返回空数组 */
  run(ctx: RuleContext): Diagnostic[]
}
