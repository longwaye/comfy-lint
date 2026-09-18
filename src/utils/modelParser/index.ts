/** 解析多行文本清洗模型列表 */
export function parseModelLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}
