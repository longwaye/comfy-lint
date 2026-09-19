import type { Diagnostic, Rule, RuleContext } from './types'

/** 排序权重，数值越小越靠前 */
const SEVERITY_ORDER: Record<Diagnostic['severity'], number> = {
  error: 0,
  warn: 1,
  info: 2,
}

/**
 * 依次执行规则并汇总诊断结果。
 * 单条规则抛异常时记为一条 info，不影响其余规则执行。
 */
export function runRules(ctx: RuleContext, rules: Rule[]): Diagnostic[] {
  const result: Diagnostic[] = []

  for (const rule of rules) {
    try {
      result.push(...rule.run(ctx))
    } catch (err) {
      result.push({
        ruleId: rule.id,
        severity: 'info',
        title: `规则 ${rule.title} 执行失败`,
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return sortDiagnostics(result)
}

/**
 * 按严重程度分组排序，同级内按 ruleId 字典序，保证输出稳定可比对。
 * 返回新数组，不改动入参。
 */
export function sortDiagnostics(list: Diagnostic[]): Diagnostic[] {
  return [...list].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId),
  )
}

/** 统计各严重程度的条数，UI 头部计数用。 */
export function countBySeverity(list: Diagnostic[]): Record<Diagnostic['severity'], number> {
  const acc: Record<Diagnostic['severity'], number> = { error: 0, warn: 0, info: 0 }
  for (const d of list) acc[d.severity] += 1
  return acc
}
