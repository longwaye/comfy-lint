/**
 * 节点输入参数定义
 * 用于描述 ComfyUI 中的节点输入参数，包括其名称、类型、是否可选等。
 */
export interface NodeInputDef {
  name: string
  /** 'INT' / 'FLOAT' / 'MODEL' / 字符串数组（COMBO 的候选值） */
  type: string | string[]
  optional?: boolean
}
/**
 * 节点定义
 * 用于描述 ComfyUI 中的节点，包括其类型、显示名称、所属包、输入参数等。
 */
export interface NodeDef {
  type: string
  displayName?: string
  /** 所属自定义节点包，如 ComfyUI-Impact-Pack */
  package?: string
  inputs?: NodeInputDef[]
}
/**
 * 节点注册表定义
 * 版本号
 * 生成时间
 * 节点映射表，键为节点类型，值为节点定义
 */
export interface NodeRegistry {
  version: string
  generatedAt: string
  nodes: Record<string, NodeDef>
}

/**
 * 用于分析用户本机的资产，如模型、节点类型、显存容量等。
 *@param models 本地已有的模型文件名列表
 *@param nodeTypes 本地已安装的节点类型列表
 *@param vramGB 显存容量，单位 GB，可选值
 */
export interface LocalInventory {
  /** 本地已有的模型文件名列表 */
  models: string[]
  /** 本地已安装的节点类型列表 */
  nodeTypes: string[]
  /** 显存容量，单位 GB */
  vramGB?: number
}
