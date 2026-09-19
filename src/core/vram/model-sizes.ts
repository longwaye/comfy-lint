/**
 * 模型体积速查表，单位字节。
 * 数据来自公开模型卡的 fp16 权重体积与本地实测值。
 *
 * 匹配方式：模型名小写后按 keywords 做包含匹配，第一条命中即返回。
 * 因此更具体的规则必须排在前面（如 seedvr2 要排在 seedvr 之前）。
 */

export interface ModelSizeRule {
  /** 小写关键词，任一命中即匹配该规则 */
  keywords: string[]
  bytes: number
  /** 展示用名称 */
  label: string
}

const GB = 1024 ** 3
const MB = 1024 ** 2

export const MODEL_SIZE_RULES: ModelSizeRule[] = [
  // 视频超分 / 视频生成，体积普遍偏大
  { keywords: ['seedvr2', 'seedvr-2'], bytes: 3.5 * GB, label: 'SeedVR2 3B int8' },
  { keywords: ['hunyuanvideo', 'hunyuan_video'], bytes: 25 * GB, label: 'HunyuanVideo fp16' },
  { keywords: ['wan2.2', 'wan_2.2'], bytes: 28 * GB, label: 'Wan 2.2 14B fp16' },
  { keywords: ['wan2.1', 'wan_2.1'], bytes: 14 * GB, label: 'Wan 2.1 14B fp8' },
  { keywords: ['wan1.3', 'wan_1.3'], bytes: 2.6 * GB, label: 'Wan 1.3B' },

  // 底座模型
  { keywords: ['flux1', 'flux.1', 'flux-dev', 'flux-schnell'], bytes: 23.8 * GB, label: 'FLUX.1 fp16' },
  { keywords: ['flux'], bytes: 11.9 * GB, label: 'FLUX fp8' },
  { keywords: ['sd3.5', 'sd3_5'], bytes: 16 * GB, label: 'SD3.5 large fp16' },
  { keywords: ['sd3'], bytes: 4.7 * GB, label: 'SD3 medium fp16' },
  { keywords: ['sdxl', 'sd_xl', 'xl_', '_xl'], bytes: 6.5 * GB, label: 'SDXL fp16' },
  { keywords: ['sd1.5', 'sd15', 'v1-5', 'v1_5'], bytes: 2 * GB, label: 'SD1.5 fp16' },
  { keywords: ['svd', 'stable-video'], bytes: 8 * GB, label: 'SVD fp16' },

  // 小体积：放大模型 / ControlNet / VAE / LoRA
  { keywords: ['4x-ultrasharp', 'ultrasharp'], bytes: 67 * MB, label: '4x-UltraSharp' },
  { keywords: ['realesrgan', 'esrgan', '4x_'], bytes: 64 * MB, label: 'RealESRGAN 类放大模型' },
  { keywords: ['controlnet', 'control_net'], bytes: 1.5 * GB, label: 'ControlNet' },
  { keywords: ['vae'], bytes: 160 * MB, label: 'VAE' },
  { keywords: ['lora', 'lycoris', 'locon'], bytes: 200 * MB, label: 'LoRA' },
]

export interface ModelSizeHit {
  bytes: number
  label: string
  /** 命中的关键词，未命中时为 null */
  matchedBy: string | null
}

/**
 * 按模型名查体积。
 * @param normalizedName 已归一化（basename + 小写）的模型名
 * @returns 未命中返回 null，调用方应据此降级而不是编造数值
 */
export function lookupModelSize(normalizedName: string): ModelSizeHit | null {
  const name = normalizedName.toLowerCase()

  for (const rule of MODEL_SIZE_RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) {
        return { bytes: rule.bytes, label: rule.label, matchedBy: kw }
      }
    }
  }

  return null
}

/** 判断是否 LoRA 类小模型（含 LyCORIS / LoCon 变体）。 */
export function isLoraLike(normalizedName: string): boolean {
  const n = normalizedName.toLowerCase()
  return n.includes('lora') || n.includes('lycoris') || n.includes('locon')
}
