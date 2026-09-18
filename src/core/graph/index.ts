/**
 * graph 模块公开出口。
 *
 * 模块内文件互相 import 不受限制，但模块外（包括 core 内其他模块、
 * workers、components）只允许从 './graph' 导入，禁止深挖 './graph/types'。
 * 这条约定让每个模块的对外 API 是显式的——内部重构不会波及调用方。
 */
export * from './types'
