<template>
  <div class="flex items-center gap-2 px-3 py-2 hover:bg-sunken dark:hover:bg-sunken rounded-lg cursor-pointer transition-colors group" :class="{ 'bg-accent/10 dark:bg-accent/20': active }" @click="$emit('select', label)" @contextmenu.prevent="$emit('contextmenu', $event, label)">
    <span class="shrink-0 text-sm font-bold" :class="active ? 'text-accent dark:text-accent' : 'text-accent-hover dark:text-accent-hover/70'">#</span>
    <span class="text-sm flex-1 truncate" :class="active ? 'text-accent dark:text-accent font-medium' : 'text-ink-soft dark:text-ink-soft'">
      {{ label }}
    </span>
    <span v-if="count > 0" class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
      {{ count }}
    </span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  count: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
})

defineEmits(['select', 'contextmenu'])
</script>
