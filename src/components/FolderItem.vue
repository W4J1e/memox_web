<template>
  <div
    class="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
    :class="active
      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
      : hidden
        ? 'text-gray-400 dark:text-gray-500 line-through'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
    @click="$emit('click')"
    @contextmenu.prevent="$emit('contextmenu', $event, label)"
  >
    <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    <span class="text-sm flex-1 truncate">{{ label }}</span>
    <span v-if="count > 0" class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{{ count }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  count: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  // canEdit=false is used for the virtual "未归类" pseudo-folder (a filter, never editable)
  canEdit: { type: Boolean, default: true },
})

defineEmits(['click', 'contextmenu'])
</script>
