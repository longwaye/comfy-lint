import { describe, expect, it } from 'vitest'
import { createSeedRegistry } from '../registry'
import { parseWorkflow } from '../parser'
import { BUILTIN_RULES, normalizeModelName, unknownNodeRule } from './builtin'
import { runRules } from './engine'

const registry = createSeedRegistry()

/** 解析一段 workflow 片段，拿不到图就让断言直接炸在 parse 阶段 */
function graphOf(raw: unknown) {
  const { graph } = parseWorkflow(raw, registry)
  return graph!
}

describe('缺失模型检测', () => {
  it('本机没有该模型时，报一条 error', () => {
    const graph = graphOf({
      nodes: [
        {
          id: 4,
          type: 'CheckpointLoaderSimple',
          widgets_values: ['sd_xl_base_1.0.safetensors'],
          inputs: [],
          outputs: [],
        },
      ],
      links: [],
    })

    const diagnostics = runRules(
      {
        graph,
        registry,
        inventory: { models: ['sd_v1-5.safetensors'], nodeTypes: ['CheckpointLoaderSimple'] },
      },
      BUILTIN_RULES,
    )

    const missing = diagnostics.filter((d) => d.ruleId === 'missing-model')
    expect(missing).toHaveLength(1)
    expect(missing[0].severity).toBe('error')
    expect(missing[0].detail).toContain('sd_xl_base_1.0.safetensors')
  })

  it('没提供本机清单时降级为 info，而不是误报缺失', () => {
    const graph = graphOf({
      nodes: [
        {
          id: 4,
          type: 'CheckpointLoaderSimple',
          widgets_values: ['sd_xl_base_1.0.safetensors'],
          inputs: [],
          outputs: [],
        },
      ],
      links: [],
    })

    const diagnostics = runRules({ graph, registry }, BUILTIN_RULES)
    const missing = diagnostics.filter((d) => d.ruleId === 'missing-model')

    expect(missing).toHaveLength(1)
    expect(missing[0].severity).toBe('info')
  })
})

describe('未识别节点检测', () => {
  it('注册表和本机清单里都没有的类型会被报出来', () => {
    const graph = graphOf({
      nodes: [{ id: 1, type: 'ImpactWildcardEncode', widgets_values: [], inputs: [], outputs: [] }],
      links: [],
    })

    const diagnostics = unknownNodeRule.run({ graph, registry })
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].nodeId).toBe('1')
  })

  it('在本机清单里的类型不报错，避免误伤', () => {
    const graph = graphOf({
      nodes: [{ id: 1, type: 'ImpactWildcardEncode', widgets_values: [], inputs: [], outputs: [] }],
      links: [],
    })

    const diagnostics = unknownNodeRule.run({
      graph,
      registry,
      inventory: { nodeTypes: ['ImpactWildcardEncode'] },
    })
    expect(diagnostics).toHaveLength(0)
  })
})

describe('模型名归一化', () => {
  it('路径分隔符和大小写不影响比对', () => {
    expect(normalizeModelName('xl\\SD_XL.safetensors')).toBe('sd_xl.safetensors')
    expect(normalizeModelName('checkpoints/sd_xl.safetensors')).toBe('sd_xl.safetensors')
    expect(normalizeModelName(123)).toBeNull()
  })
})
