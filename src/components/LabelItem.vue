<template>
  <div class="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors group" :class="{ 'bg-green-50 dark:bg-green-900/20': active }" @click="$emit('select', label)">
    <span class="w-2 h-2 rounded-full shrink-0" :class="active ? 'bg-green-500' : hidden ? 'bg-gray-300 dark:bg-gray-600' : 'bg-green-400'"></span>
    <span class="text-sm flex-1 truncate" :class="active ? 'text-green-700 dark:text-green-400 font-medium' : hidden ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-600 dark:text-gray-400'">
      {{ label }}
    </span>
    <span v-if="count > 0" class="text-xs text-gray-400 dark:text-gray-500">
      {{ count }}
    </span>
    <button
      @click.stop="$emit('toggleVisibility', label)"
      class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      :title="hidden ? '显示标签' : '隐藏标签'"
    >
      <svg v-if="hidden" class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
      <svg v-else class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
    </button>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  count: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
})

defineEmits(['select', 'toggleVisibility'])
</script>
