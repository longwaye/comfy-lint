/**
 * 种子注册表：内置常用节点，保证离线可用。
 *
 * 完整表由 `pnpm build:registry` 在构建期从 ComfyUI-Manager 的节点库抓取，
 * 生成 src/core/registry/generated.json，运行时通过 loadRegistry 合并进来。
 *
 * inputs 的顺序必须与 ComfyUI widgets_values 的真实顺序一致，否则参数名会错位。
 * 连线型输入（MODEL / CLIP / LATENT / IMAGE）要写在它实际出现的位置，
 * 解析器会按类型把它们过滤掉。
 */
import type { NodeDef, NodeRegistry } from './types'

const SEED_NODES: Record<string, NodeDef> = {
  CheckpointLoaderSimple: {
    type: 'CheckpointLoaderSimple',
    displayName: 'Load Checkpoint',
    inputs: [{ name: 'ckpt_name', type: ['model.safetensors'] }],
  },
  LoraLoader: {
    type: 'LoraLoader',
    inputs: [
      { name: 'model', type: 'MODEL' },
      { name: 'clip', type: 'CLIP' },
      { name: 'lora_name', type: ['lora.safetensors'] },
      { name: 'strength_model', type: 'FLOAT' },
      { name: 'strength_clip', type: 'FLOAT' },
    ],
  },
  VAELoader: {
    type: 'VAELoader',
    inputs: [{ name: 'vae_name', type: ['vae.safetensors'] }],
  },
  CLIPTextEncode: {
    type: 'CLIPTextEncode',
    inputs: [
      { name: 'clip', type: 'CLIP' },
      { name: 'text', type: 'STRING' },
    ],
  },
  KSampler: {
    type: 'KSampler',
    inputs: [
      { name: 'model', type: 'MODEL' },
      { name: 'positive', type: 'CONDITIONING' },
      { name: 'negative', type: 'CONDITIONING' },
      { name: 'latent_image', type: 'LATENT' },
      { name: 'seed', type: 'INT' },
      { name: 'control_after_generate', type: ['randomize', 'fixed', 'increment', 'decrement'] },
      { name: 'steps', type: 'INT' },
      { name: 'cfg', type: 'FLOAT' },
      { name: 'sampler_name', type: ['euler', 'euler_ancestral', 'dpmpp_2m'] },
      { name: 'scheduler', type: ['normal', 'karras', 'simple'] },
      { name: 'denoise', type: 'FLOAT' },
    ],
  },
  EmptyLatentImage: {
    type: 'EmptyLatentImage',
    inputs: [
      { name: 'width', type: 'INT' },
      { name: 'height', type: 'INT' },
      { name: 'batch_size', type: 'INT' },
    ],
  },
  VAEDecode: {
    type: 'VAEDecode',
    inputs: [
      { name: 'samples', type: 'LATENT' },
      { name: 'vae', type: 'VAE' },
    ],
  },
  SaveImage: {
    type: 'SaveImage',
    inputs: [
      { name: 'images', type: 'IMAGE' },
      { name: 'filename_prefix', type: 'STRING' },
    ],
  },
  LoadImage: {
    type: 'LoadImage',
    inputs: [
      { name: 'image', type: ['example.png'] },
      { name: 'upload', type: 'IMAGEUPLOAD' },
    ],
  },
  UpscaleModelLoader: {
    type: 'UpscaleModelLoader',
    inputs: [{ name: 'model_name', type: ['RealESRGAN_x4.pth'] }],
  },
  ImageUpscaleWithModel: {
    type: 'ImageUpscaleWithModel',
    inputs: [
      { name: 'upscale_model', type: 'UPSCALE_MODEL' },
      { name: 'image', type: 'IMAGE' },
    ],
  },
  ControlNetLoader: {
    type: 'ControlNetLoader',
    inputs: [{ name: 'control_net_name', type: ['controlnet.safetensors'] }],
  },
}

/** 构造种子注册表。每次返回新对象，避免调用方改动污染共享数据。 */
export function createSeedRegistry(): NodeRegistry {
  return {
    version: 'seed',
    generatedAt: new Date(0).toISOString(),
    nodes: SEED_NODES,
  }
}

/**
 * 合并种子表与构建期生成的完整表，生成表优先。
 * 生成文件缺失时降级到种子表，保证离线可用。
 */
export function loadRegistry(generated?: NodeRegistry | null): NodeRegistry {
  const seed = createSeedRegistry()
  if (!generated?.nodes) return seed
  return {
    version: generated.version,
    generatedAt: generated.generatedAt,
    nodes: { ...seed.nodes, ...generated.nodes },
  }
}

/** 查节点定义，未收录时返回 undefined。 */
export function getNodeDef(registry: NodeRegistry, type: string): NodeDef | undefined {
  return registry.nodes[type]
}
