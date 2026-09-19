/** 节点注册表的类型定义。数据来自 ComfyUI 的 /object_info 与 ComfyUI-Manager 的节点库。 */

/** 节点输入的定义。 */
export interface NodeInputDef {
  /** 输入名，与 workflow 中连线或 widget 的名字对应 */
  name: string
  /** 'INT' / 'FLOAT' / 'MODEL' 等类型标识；字符串数组表示 COMBO 的候选值 */
  type: string | string[]
  /** 可省略的输入，未连线时不算错误 */
  optional?: boolean
}

/** 单个节点类型的定义。 */
export interface NodeDef {
  /** 节点类型，如 KSampler，是注册表的键 */
  type: string
  /** 展示名 */
  displayName?: string
  /** 所属自定义节点包，如 ComfyUI-Impact-Pack */
  package?: string
  inputs?: NodeInputDef[]
}

/** 节点注册表。用于把节点类型反查到所属节点包，以及还原参数语义名。 */
export interface NodeRegistry {
  /** 数据来源版本，用于判断是否需要刷新 */
  version: string
  /** 生成时间，ISO 8601 */
  generatedAt: string
  /** 按节点类型索引 */
  nodes: Record<string, NodeDef>
}

/** 用户本机的资产清单。可选提供，提供后检测能区分"缺失"与"未知"。 */
export interface LocalInventory {
  /** 本地已有的模型文件名 */
  models: string[]
  /** 本地已安装的节点类型 */
  nodeTypes: string[]
  /** 显存容量，单位 GB */
  vramGB?: number
}

/** 空注册表，解析时拿不到任何 schema 的兜底值。 */
export const EMPTY_REGISTRY: NodeRegistry = {
  version: 'seed',
  generatedAt: '1970-01-01T00:00:00.000Z',
  nodes: {},
}
