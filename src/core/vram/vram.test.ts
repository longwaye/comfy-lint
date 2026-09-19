import { describe, expect, it } from 'vitest'
import { createSeedRegistry } from '../registry'
import { parseWorkflow } from '../parser'
import { detectResolution, estimateVram, RUNTIME_OVERHEAD_BYTES } from './estimate'
import { lookupModelSize } from './model-sizes'

const registry = createSeedRegistry()

function graphOf(raw: unknown) {
  const { graph } = parseWorkflow(raw, registry)
  return graph!
}

const GB = 1024 ** 3

describe('模型体积查表', () => {
  it('能从文件名认出 SDXL', () => {
    const hit = lookupModelSize('sd_xl_base_1.0.safetensors')
    expect(hit?.label).toContain('SDXL')
    expect(hit!.bytes).toBeGreaterThan(5 * GB)
  })

  it('认不出来的返回 null，让上层如实说明', () => {
    expect(lookupModelSize('my-custom-finetune-v3.safetensors')).toBeNull()
  })
})

describe('分辨率识别', () => {
  it('从 EmptyLatentImage 取宽高与 batch', () => {
    const graph = graphOf({
      nodes: [
        {
          id: 5,
          type: 'EmptyLatentImage',
          widgets_values: [768, 512, 2],
          inputs: [],
          outputs: [],
        },
      ],
      links: [],
    })

    expect(detectResolution(graph)).toEqual({ width: 768, height: 512, batch: 2 })
  })

  it('没有 EmptyLatentImage 时返回 null', () => {
    const graph = graphOf({
      nodes: [{ id: 1, type: 'KSampler', widgets_values: [], inputs: [], outputs: [] }],
      links: [],
    })
    expect(detectResolution(graph)).toBeNull()
  })
})

describe('显存估算', () => {
  it('512x512 batch=1 的激活值在合理量级', () => {
    const graph = graphOf({
      nodes: [
        {
          id: 5,
          type: 'EmptyLatentImage',
          widgets_values: [512, 512, 1],
          inputs: [],
          outputs: [],
        },
      ],
      links: [],
    })

    const est = estimateVram(graph)
    expect(est.confidence).toBe('high')

    // 量级校验：算错通道数或下采样倍数会偏离这个区间一个数量级以上
    const activation = est.minBytes - RUNTIME_OVERHEAD_BYTES
    expect(activation).toBeGreaterThan(1024 ** 2)
    expect(activation).toBeLessThan(GB)
  })

  it('batch 越大显存越高，不能算反', () => {
    const make = (batch: number) =>
      graphOf({
        nodes: [
          {
            id: 5,
            type: 'EmptyLatentImage',
            widgets_values: [512, 512, batch],
            inputs: [],
            outputs: [],
          },
        ],
        links: [],
      })

    expect(estimateVram(make(1)).minBytes).toBeLessThan(estimateVram(make(4)).minBytes)
  })

  it('认不出分辨率时降级为 medium 并在 notes 里说明', () => {
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

    const est = estimateVram(graph)
    expect(est.confidence).not.toBe('high')
    expect(est.notes.join('\n')).toContain('分辨率')
  })

  it('SDXL 工作流的模型常驻部分超过 6GB', () => {
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

    const resident = estimateVram(graph)
      .breakdown.filter((b) => b.label.includes('SDXL'))
      .reduce((sum, b) => sum + b.bytes, 0)

    expect(resident).toBeGreaterThan(6 * GB)
  })
})
