<template>
  <div
    class="card p-3 cursor-pointer hover:shadow-md transition-all duration-200 group flex flex-col"
    :style="noteStyle"
    @click="$emit('click')"
  >
    <!-- Thumbnail image -->
    <div v-if="thumbnailUrl && !note.locked" class="w-full h-28 rounded-lg overflow-hidden mb-2 bg-gray-100 dark:bg-gray-700 shrink-0">
      <img :src="thumbnailUrl" class="w-full h-full object-cover" loading="lazy" @error="$emit('img-error')" />
    </div>

    <!-- Title -->
    <div v-if="note.title" class="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 text-sm">
      <span v-if="note.pinned" class="text-amber-500 mr-1">📌</span>
      <span v-if="note.locked" class="text-amber-500 mr-1">🔒</span>
      {{ note.title }}
    </div>
    <div v-else-if="note.locked" class="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 text-sm">
      <span class="text-amber-500 mr-1">🔒</span>
      已锁定笔记
    </div>

    <!-- Locked placeholder -->
    <div v-if="note.locked" class="text-gray-400 dark:text-gray-500 text-xs mt-1 italic">
      🔒 内容已锁定
    </div>

    <!-- Body preview for NOTE type -->
    <div v-else-if="note.type === 'NOTE' && note.body" class="text-gray-600 dark:text-gray-400 text-xs line-clamp-3 whitespace-pre-line mt-1">
      {{ note.body }}
    </div>

    <!-- Items preview for LIST type -->
    <div v-else-if="note.type === 'LIST' && note.items && note.items.length" class="mt-1 space-y-0.5">
      <div
        v-for="(item, idx) in displayItems"
        :key="idx"
        class="text-xs flex items-start gap-1.5"
      >
        <span class="mt-0.5 flex-shrink-0" :class="item.checked ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'">
          {{ item.checked ? '✓' : '○' }}
        </span>
        <span :class="item.checked ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'" class="truncate">
          {{ item.body }}
        </span>
      </div>
      <div v-if="note.items.length > 3" class="text-xs text-gray-400 dark:text-gray-500 pl-4">
        还有 {{ note.items.length - 3 }} 项...
      </div>
    </div>

    <!-- Spacer to push labels/date down when there's an image -->
    <div class="flex-1"></div>

    <!-- Labels -->
    <div v-if="note.labels && note.labels.length" class="flex flex-wrap gap-1 mt-2">
      <span
        v-for="label in note.labels.slice(0, 2)"
        :key="label"
        class="px-1.5 py-0.5 text-[10px] rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      >
        {{ label }}
      </span>
    </div>

    <!-- Date -->
    <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
      {{ formatDate(note.timestamp) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatDate, getNoteColorStyle } from '../utils/note-parser'

const props = defineProps({
  note: { type: Object, required: true },
  thumbnailUrl: { type: String, default: '' },
})

defineEmits(['click', 'img-error'])

const noteStyle = computed(() => getNoteColorStyle(props.note.color))

const displayItems = computed(() => {
  if (!props.note.items) return []
  return props.note.items.slice(0, 3)
})
</script>
