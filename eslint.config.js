import nodePath from 'node:path'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

// ─────────────────────────────────────────────────────────────────────────────
// 本地规则：core 跨子模块只能走 barrel
// ─────────────────────────────────────────────────────────────────────────────
const SRC_REL = 'src'
const CORE_REL = 'src/core'

function toPosix(p) {
  return p.split(nodePath.sep).join('/')
}

/** '@/core' -> 'src/core'，与 vite.config.ts / tsconfig 的 alias 保持一致 */
function aliasToRepo(source) {
  return SRC_REL + source.slice(1)
}

function checkCoreImport(filename, source) {
  const isAlias = source.startsWith('@/')
  const isRelative = source.startsWith('.')
  // 裸包（vitest、vue 等）不归这条规则管
  if (!isAlias && !isRelative) return null

  const fromPosix = toPosix(filename)
  const markerAt = fromPosix.lastIndexOf('/' + SRC_REL + '/')
  if (markerAt < 0) return null

  const repoFrom = fromPosix.slice(markerAt + 1) // 例：src/core/parser/parse.ts
  const target = nodePath.posix.normalize(
    isAlias
      ? aliasToRepo(source)
      : nodePath.posix.join(nodePath.posix.dirname(repoFrom), source),
  )

  if (!target.startsWith(CORE_REL + '/')) return null // 落点不在 core，不管

  const relTarget = target.slice(CORE_REL.length + 1) // 例：graph/types
  const parts = relTarget.split('/')

  // 只有一层：要么是 core 根文件（analyze.ts），要么是某个模块的 barrel（src/core/graph）→ 放行
  if (parts.length < 2) return null

  const targetModule = parts[0]
  const targetFile = parts[parts.length - 1]

  // 显式写到 index 也算走 barrel
  if (targetFile === 'index') return null

  const isInsideCore = repoFrom.startsWith(CORE_REL + '/')
  const fromParts = isInsideCore ? repoFrom.slice(CORE_REL.length + 1).split('/') : []
  const fromModule = fromParts.length >= 2 ? fromParts[0] : ''

  // 同模块内部互引：允许（模块内自己怎么组织是自由的）
  if (fromModule && fromModule === targetModule) return null

  return {
    targetModule,
    targetFile,
    source,
    // core 内部用相对 barrel，core 外部一律走 '@/core'
    suggestion: isInsideCore ? `'../${targetModule}'` : `'@/core'`,
  }
}

const coreBarrelOnlyRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'core 层跨子模块 import 必须走该模块的 barrel（index.ts）',
    },
    messages: {
      deepImport:
        "禁止深挖 core 内部文件：'{{source}}' 指向 {{targetModule}}/{{targetFile}}。请改成 {{suggestion}}。",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ''
    return {
      ImportDeclaration(node) {
        const hit = checkCoreImport(filename, node.source.value)
        if (hit) {
          context.report({
            node,
            messageId: 'deepImport',
            data: hit,
          })
        }
      },
      ExportNamedDeclaration(node) {
        // export { x } from '../graph/types' 这种漏网写法同样要拦
        if (!node.source) return
        const hit = checkCoreImport(filename, node.source.value)
        if (hit) {
          context.report({
            node,
            messageId: 'deepImport',
            data: hit,
          })
        }
      },
    }
  },
}

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // core 层三条铁律：
    //   ① 零框架依赖（禁止 vue）
    //   ② 不碰 Node 内建模块（要在 Worker / 浏览器里跑）
    //   ③ 跨子模块只走 barrel（由本地规则 core-barrel-only 强制，白名单式判断）
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vue',
              message: 'core 层必须零框架依赖，否则 diff 引擎无法复用',
            },
          ],
          patterns: [
            {
              // core 层不得依赖 Node 内建模块：这套代码要能在 Web Worker 里跑，
              // 未来还可能单独发包。node:fs / node:path / node:url 一旦进 core 就跑不动了。
              // 构建脚本（scripts/、vite.config.ts）不受此限，它们本来就在 Node 里执行。
              group: ['node:*', 'node:*/**'],
              message:
                'core 层禁止依赖 Node 内建模块（要在 Worker / 浏览器里复用）。node: 相关逻辑请放在 scripts/ 或配置脚本里。',
            },
            {
              // core 内一律用相对路径：'@' 是宿主应用的别名，写了就把 core 绑死在
              // 宿主的 alias 配置上，将来单独发包或给 diff 引擎复用就拎不走了。
              group: ['@/**'],
              message: "core 层请用相对路径导入（'@' 是宿主别名，会破坏 core 的可移植性）。",
            },
          ],
        },
      ],
    },
  },
  {
    // 全局：任何位置都不准深挖 core 内部文件（白名单式判断，别名/相对路径都管）
    files: ['src/**/*.{ts,vue}'],
    plugins: {
      local: { rules: { 'core-barrel-only': coreBarrelOnlyRule } },
    },
    rules: {
      'local/core-barrel-only': 'error',
    },
  },
  {
    // barrel 导出规范（对齐 Vue 3 / Vite 官方入口的写法）：
    // 禁用 export *，要求显式具名导出 + [named]/[type] 注释。
    //
    // 范围只限 barrel（index.ts），不扩到全仓——VueUse / unplugin 证明了
    // 「一个文件一个 API」的聚合型 barrel 用 export * 是正当写法，
    // 一刀切禁掉会在将来加规则/工具集时绑住手脚。
    // 需要收口的是「对外契约」，而对外契约只在 index.ts 上。
    files: ['src/core/**/index.ts', 'src/core/index.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message:
            'barrel 禁止 export *：请显式具名导出，让对外 API 一眼可审（对齐 Vue 3 / Vite 官方入口写法）。',
        },
      ],
    },
  },
  {
    // core 之外（workers / components / composables / App）：
    // 跨层导入统一写 '@/core' —— 别名在这里承担「跨越层边界」的语义，
    // 一眼就能区分「app 调 core」和「core 内部互引」。
    // 仍然禁止深挖 core 内部路径（'**/core/*' 那条）。
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/core/*'],
              message: "core 层的唯一出口是 '@/core'，禁止深挖 core 内部路径。",
            },
            {
              // 相对形式的 core  barrel 也禁掉，统一跨层写法
              group: ['../core', '../../core', './core'],
              message: "跨层请用 '@/core'，相对形式的 core 导入只出现在 core 内部。",
            },
          ],
        },
      ],
    },
  },
)
