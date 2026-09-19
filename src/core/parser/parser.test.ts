import { describe, expect, it } from 'vitest'
import { detectFormat, parseWorkflow } from './index'
import { createSeedRegistry } from '../registry'
import { buildIndex, neighborSignature, hashNode } from '../graph'

const registry = createSeedRegistry()

/** 一份最小可用的 UI 格式 workflow：加载 checkpoint → 采样 → 解码 → 保存 */
const UI_WORKFLOW = {
  last_node_id: 9,
  last_link_id: 9,
  nodes: [
    {
      id: 4,
      type: 'CheckpointLoaderSimple',
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [1] },
        { name: 'CLIP', type: 'CLIP', links: [] },
        { name: 'VAE', type: 'VAE', links: [3] },
      ],
      widgets_values: ['sd_xl_base_1.0.safetensors'],
      properties: { 'Node name for S&R': 'CheckpointLoaderSimple' },
    },
    {
      id: 3,
      type: 'KSampler',
      mode: 0,
      inputs: [
        { name: 'model', type: 'MODEL', link: 1 },
        { name: 'latent_image', type: 'LATENT', link: 2 },
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [4] }],
      widgets_values: [12345, 'randomize', 20, 8, 'euler', 'normal', 1],
      properties: { 'Node name for S&R': 'KSampler' },
    },
    {
      id: 5,
      type: 'EmptyLatentImage',
      mode: 0,
      inputs: [],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [2] }],
      widgets_values: [512, 512, 1],
      properties: { 'Node name for S&R': 'EmptyLatentImage' },
    },
  ],
  links: [
    [1, 4, 0, 3, 0, 'MODEL'],
    [2, 5, 0, 3, 1, 'LATENT'],
    [4, 3, 0, 8, 0, 'LATENT'],
  ],
  version: 0.4,
}

const API_WORKFLOW = {
  '4': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
  },
  '3': {
    class_type: 'KSampler',
    inputs: { seed: 12345, steps: 20, cfg: 8, model: ['4', 0] },
  },
}

describe('格式识别', () => {
  it('能认出 UI 格式', () => {
    expect(detectFormat(UI_WORKFLOW)).toBe('ui')
  })

  it('能认出 API 格式', () => {
    expect(detectFormat(API_WORKFLOW)).toBe('api')
  })

  it('认不出来时返回 null 而不是抛错', () => {
    expect(detectFormat({ foo: 1 })).toBeNull()
    expect(detectFormat(null)).toBeNull()
  })
})

describe('UI 格式解析', () => {
  it('还原出参数名，而不是 arg_N', () => {
    const { graph } = parseWorkflow(UI_WORKFLOW, registry)
    const ksampler = graph!.nodes.find((n) => n.type === 'KSampler')!

    const names = ksampler.widgets.map((w) => w.name)
    expect(names).toContain('seed')
    expect(names).toContain('steps')
    expect(names).toContain('cfg')
  })

  it('参数值按对位置', () => {
    const { graph } = parseWorkflow(UI_WORKFLOW, registry)
    const ksampler = graph!.nodes.find((n) => n.type === 'KSampler')!

    expect(ksampler.widgets.find((w) => w.name === 'steps')?.value).toBe(20)
    expect(ksampler.widgets.find((w) => w.name === 'cfg')?.value).toBe(8)
  })

  it('连线解析成 GraphLink，方向不能反', () => {
    const { graph } = parseWorkflow(UI_WORKFLOW, registry)
    const link = graph!.links.find((l) => l.id === 1)!

    expect(link.from.node).toBe('4')
    expect(link.to.node).toBe('3')
    expect(link.dataType).toBe('MODEL')
  })

  it('注册表查不到的节点，参数名降级为 arg_N 且不崩', () => {
    const raw = {
      nodes: [{ id: 1, type: 'SomeCustomNode', widgets_values: ['abc', 3] }],
      links: [],
    }
    const { graph } = parseWorkflow(raw, registry)
    expect(graph!.nodes[0].widgets.map((w) => w.name)).toEqual(['arg_0', 'arg_1'])
  })
})

describe('API 格式解析', () => {
  it('连线值 [nodeId, slot] 转成 link', () => {
    const { graph } = parseWorkflow(API_WORKFLOW, registry)
    expect(graph!.links).toHaveLength(1)
    expect(graph!.links[0].from.node).toBe('4')
    expect(graph!.links[0].to.node).toBe('3')
  })

  it('非连线值进 widgets', () => {
    const { graph } = parseWorkflow(API_WORKFLOW, registry)
    const ksampler = graph!.nodes.find((n) => n.type === 'KSampler')!
    expect(ksampler.widgets.map((w) => w.name)).toContain('seed')
  })
})

describe('图匹配原语', () => {
  it('邻接索引能查到前后驱', () => {
    const { graph } = parseWorkflow(UI_WORKFLOW, registry)
    const index = buildIndex(graph!)
    expect(index.outgoing.get('4')).toHaveLength(1)
    expect(index.incoming.get('3')!.map((l) => l.from.node).sort()).toEqual(['4', '5'])
  })

  it('节点哈希只算 type 和参数，不含 id', () => {
    const { graph } = parseWorkflow(UI_WORKFLOW, registry)
    const a = graph!.nodes.find((n) => n.type === 'KSampler')!
    const b = { ...a, id: '999' }
    expect(hashNode(a)).toBe(hashNode(b))
  })

  it('邻居签名可用于 id 变化后的二次匹配', () => {
    const { graph } = parseWorkflow(UI_WORKFLOW, registry)
    const index = buildIndex(graph!)
    expect(neighborSignature('3', index)).toContain('CheckpointLoaderSimple')
  })
})
