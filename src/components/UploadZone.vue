<template>
  <div
    class="rounded-xl border-2 border-dashed p-8 text-center transition-colors"
    :class="dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300'"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <p class="text-sm text-gray-600">把 workflow.json 拖到这里，或者</p>
    <label class="mt-3 inline-block cursor-pointer rounded-md border px-4 py-2 text-sm">
      选择文件
      <input type="file" accept=".json,application/json" class="hidden" @change="onPick" />
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const dragging = ref(false)

// Emits
const emit = defineEmits<{ file: [file: File] }>()

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  dragging.value = false
}

const onPick = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('file', file)
}
</script>

<style scoped></style>
