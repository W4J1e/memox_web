<template>
  <div
    class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
    :class="[
      active
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
    ]"
    @click="$emit('click')"
  >
    <svg v-if="icon === 'folder'" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    <svg v-else class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
    <span class="text-sm flex-1">{{ label }}</span>
    <span v-if="count > 0" class="text-xs text-gray-400 dark:text-gray-500">{{ count }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  count: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
  icon: { type: String, default: 'folder' },
})

defineEmits(['click'])
</script>
