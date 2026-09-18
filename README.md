# comfy-lint

把 workflow.json 拖进来，告诉你：

- **缺什么模型** —— 哪些模型文件本机没有，得去下载
- **哪些节点没装** —— 来自哪个自定义节点包，去哪装
- **显存够不够** —— 预估要吃多少显存，你的 8GB 卡能不能跑，直接给结论

---

## 检查项

| 检测项         | 严重级       | 说明                                           |
| -------------- | ------------ | ---------------------------------------------- |
| 缺失模型       | error / info | 与本机清单比对；没提供清单时降级为提示，不误报 |
| 未识别节点     | error        | 节点类型不在注册表，多半缺自定义节点包         |
| 必填输入未连线 | error        | 运行时必炸的硬伤，提前抓出来                   |
| 显存估算       | verdict      | 按 6/8/12/16/24/32GB 档位给出 能跑/勉强/跑不了 |

支持 ComfyUI 的**两种 workflow 格式**：画布保存的 UI 格式和后端执行的 API 格式，自动识别。

## 技术架构

```
workflow.json
  → detectFormat()        识别 UI / API 格式
  → parser                归一化到 Graph IR（统一数据契约）
  → rules engine          可插拔检测规则，每条规则独立容错
  → vram estimate         权重查表 + 激活值推算，输出区间而非单值
  → Report                Web Worker 计算，主线程只渲染
```

几条核心设计：

- **core 层零框架依赖**（ESLint 强制）：`src/core` 禁止 import vue，纯 TS 计算核心可跑在 Worker / Node / 任何宿主
- **规则可插拔**：加一条检测规则 = 往数组里塞一个对象，不改主流程，社区 PR 友好
- **手写 Worker 通信协议**：消息带自增 id 防串台、超时兜底、监听器清理，不引 Comlink
- **给区间不给单值**：不同模型激活值差好几倍，报精确数字是骗人；输出 min~max + 置信度

## 快速开始

```bash
pnpm install
pnpm dev          # 本地开发
pnpm test         # 测试
pnpm lint         # 代码检查
pnpm typecheck    # 类型检查
pnpm build        # 构建，产物在 dist/
```

Node ≥ 20，pnpm ≥ 10。

## 目录结构

```
src/
├── core/                 零框架依赖的计算核心
│   ├── graph/types.ts    Graph IR，整个项目的地基
│   ├── parser/           UI 格式与 API 格式解析，归一化到 Graph IR
│   ├── registry/         节点注册表：节点类型 → 输入 schema
│   ├── rules/            可插拔规则引擎 + 内置规则
│   ├── vram/             模型体积查表 + 显存估算
│   └── analyze.ts        串起全流程，输出 Report
├── workers/              Worker 通信（手写协议）
├── components/           Vue 组件（诊断列表 + 虚拟滚动）
└── App.vue               界面入口
```

## 路线图

- [x] Graph IR 与双格式解析器
- [x] 规则引擎骨架（未识别节点 / 未连线输入）
- [ ] 缺失模型检测、显存估算、虚拟滚动列表（开发中）
- [ ] 构建期抓取完整节点注册表（ComfyUI-Manager 节点库）
- [ ] **workflow diff** —— 官方核心至今没有版本管理；Graph IR 已为图匹配预留接口
- [ ] MCP server 包装，让 AI 助手也能 lint workflow

## 关于显存估算的准确度

这是估算，不是实测。模型权重部分查表得到，激活值部分按分辨率 / batch / 帧数推算，输出**区间 + 置信度**。遇到查不到的模型，会明确告诉你"这部分没计入"，而不是硬编一个数。

想让它更准？提 PR 补充 `model-sizes.ts` 的查表数据，最好带上你的实测值——不同量化版本的体积差异很大，实测数据比网传的准。

## 参与

欢迎提 Issue 和 PR。最容易的贡献方式：

- **补规则**：往 `src/core/rules/builtin.ts` 加一个规则对象（看现有规则抄结构即可）
- **补模型体积数据**：改 `src/core/vram/model-sizes.ts`，带实测值的优先合并
- **报误报**：附上 workflow JSON（脱敏后）和诊断结果

## License

MIT
