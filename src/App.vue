<template>
  <div class="mx-auto max-w-4xl p-6">
    <header class="mb-6">
      <h1 class="text-xl font-medium">ComfyUI Doctor</h1>
      <p class="mt-1 text-sm text-gray-600">导入 workflow，告诉你缺什么模型、哪些节点没装、显存够不够跑</p>
    </header>
    <UploadZone @file="onFile" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import UploadZone from '@/components/UploadZone.vue'
import type { LocalInventory } from '@/core'
import { parseModelLines } from '@/utils'
import { useAnalyzer } from '@/composables/useAnalyzer'

const { report, analyze } = useAnalyzer()

/** 本机已有的模型文件名，一行一个。不填也能用，只是检测会降级。 */
const localModelsText = ref('')

// 计算本地资产清单
const inventory = computed<Partial<LocalInventory>>(() => ({
  models: parseModelLines(localModelsText.value)
}))

// 方法
const onFile = (file: File) => {
  // console.log(file, inventory.value)
  void analyze(file, inventory.value)
}

onMounted(() => {})
</script>

<style scoped>
.App {
}
</style>
