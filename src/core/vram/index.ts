/** vram 模块对外出口。外部只从 './vram' 导入。 */

export type { VramEstimate, VramBreakdownItem, VramVerdict } from './estimate'
export { estimateVram, RUNTIME_OVERHEAD_BYTES } from './estimate'

export type { ModelSizeRule, ModelSizeHit } from './model-sizes'
export { lookupModelSize, isLoraLike } from './model-sizes'
