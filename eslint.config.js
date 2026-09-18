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
      // 关闭多单词组件名强制
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn'
    }
  },
  {
    // core 层必须保持零框架依赖，禁止从 vue 导入
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
          ]
        }
      ]
    }
  }
)
