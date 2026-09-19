/**
 * vram 模块公开出口。
 *
 * 外部只允许从 './vram' 导入。
 * 模型体积查表（model-sizes）是给 estimate 用的数据层，
 * 单独导出是因为构建期校验脚本和未来 UI 的模型信息面板也要用。
 */

export type { VramEstimate } from './estimate'
