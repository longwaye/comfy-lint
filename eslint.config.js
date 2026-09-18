import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    // core 层两条铁律：① 零框架依赖（禁止 vue）② 跨子模块只走 barrel
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vue',
              message: 'core 层必须零框架依赖，否则 diff 引擎无法复用'
            }
          ],
          patterns: [
            {
              // core 层不得依赖 Node 内建模块：这套代码要能在 Web Worker 里跑，
              // 未来还可能单独发包。node:fs / node:path / node:url 一旦进 core 就跑不动了。
              // 构建脚本（scripts/、vite.config.ts）不受此限，它们本来就在 Node 里执行。
              group: ['node:*', 'node:*/**'],
              message:
                'core 层禁止依赖 Node 内建模块（要在 Worker / 浏览器里复用）。node: 相关逻辑请放在 scripts/ 或配置脚本里。'
            },
            {
              // 跨子模块 import 必须走该模块的 index.ts barrel，
              // 深挖内部文件会让内部重构波及调用方。
              // 注意：'./types' 这类模块内互引不匹配这些模式，属于允许的范畴。
              group: [
                '**/graph/types',
                '**/registry/types',
                '**/rules/types',
                '**/rules/builtin',
                '**/rules/engine',
                '**/parser/ui-format',
                '**/parser/api-format',
                '**/vram/estimate',
                '**/vram/model-sizes'
              ],
              message:
                "跨子模块请走该模块的 barrel：'../graph' / '../registry' / '../rules' / '../parser' / '../vram'，禁止深挖内部文件。"
            }
          ]
        }
      ]
    }
  },
  {
    // barrel 导出规范（对齐 Vue 3 / Vite 官方入口的写法）：
    // 禁用 export *，要求显式具名导出 + [named]/[type] 注释。
    // 范围不限 index.ts —— 任何位置的 export * 都会让 API 边界失控
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'barrel 禁止 export *：请显式具名导出，让对外 API 一眼可审（对齐 Vue 3 / Vite 官方入口写法）。'
        }
      ]
    }
  },
  {
    // core 之外（workers / components / composables / App）：
    // 跨层导入统一写 '@/core' —— 别名在这里承担「跨越层边界」的语义，
    // 一眼就能区分「app 调 core」和「core 内部互引」。
    // 禁止（'**/core/*' ）。
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/core/*'],
              message: "core 层的唯一出口是 '@/core'，禁止深挖 core 内部路径。"
            },
            {
              // 相对形式的 core  barrel 也禁掉，逼着你养成统一的跨层写法
              group: ['../core', '../../core', './core'],
              message: "跨层请用 '@/core'，相对形式的 core 导入只出现在 core 内部。"
            }
          ]
        }
      ]
    }
  }
)
