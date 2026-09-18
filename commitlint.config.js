// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 关闭 subject 大小写强制（否则中文会报错）
    'subject-case': [0],
    // 自定义 type 白名单
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复bug
        'docs', // 文档
        'style', // 格式（不影响逻辑）
        'refactor', // 重构
        'perf', // 性能优化
        'test', // 测试
        'build', // 构建/依赖
        'ci', // CI配置
        'chore', // 杂项
        'revert', // 回滚
        'add'
      ]
    ],
    // subject 不能为空
    'subject-empty': [2, 'never'],
    // subject 不能以 . 结尾
    'subject-full-stop': [2, 'never', '.'],
    // type 不能为空
    'type-empty': [2, 'never']
  }
}
