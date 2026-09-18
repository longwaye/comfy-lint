import type { LocalInventory } from '@/core'
import { ref } from 'vue'

/**
 * 分析流程的异步状态编排：报告、加载中、错误三态。
 */
export function useAnalyzer() {
  const report = ref<Report | null>(null)
  const busy = ref(false)
  const error = ref<string | null>(null)

  /**
   * 分析文件内容，生成分析报告。
   * @param file 要分析的文件
   * @param inventory 本地资产清单，可选值
   */
  async function analyze(file: File, inventory?: Partial<LocalInventory>) {
    busy.value = true
    error.value = null
    report.value = null

    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      // report.value = await analyzeAsync(raw, inventory)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      busy.value = false
    }
  }

  return { report, busy, error, analyze }
}
