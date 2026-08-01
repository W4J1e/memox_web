<script setup>
// Sync-status "Dynamic Island" — mirrors the Android indicator in MainActivity:
// a centered pill between the title and the toolbar buttons that pops in on sync
// start and auto-collapses a few seconds after completion. Reads the global sync
// status from the settings store, so any operation that triggers a sync animates it.
import { ref, watch, onUnmounted } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()

const visible = ref(false)
const mode = ref('syncing') // 'syncing' | 'success' | 'error'
const message = ref('')
let hideTimer = null

function textFor(m) {
  if (m === 'syncing') return '正在同步…'
  if (m === 'error') return settings.syncMessage || '同步失败'
  return settings.syncMessage || '同步完成'
}

function show(state) {
  mode.value = state === 'error' ? 'error' : state === 'success' ? 'success' : 'syncing'
  message.value = textFor(mode.value)
  visible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  // Keep it up while syncing; collapse shortly after a terminal state.
  if (mode.value !== 'syncing') {
    hideTimer = setTimeout(() => { visible.value = false }, mode.value === 'error' ? 5000 : 3000)
  }
}

watch(
  () => settings.syncStatus,
  (s) => {
    if (hideTimer) clearTimeout(hideTimer)
    if (s === 'syncing') show('syncing')
    else if (s === 'success') show('success')
    else if (s === 'error') show('error')
    else visible.value = false
  },
  { immediate: true }
)

onUnmounted(() => { if (hideTimer) clearTimeout(hideTimer) })
</script>

<template>
  <div class="flex-1 flex justify-center items-center min-w-0 pointer-events-none select-none" aria-hidden="true">
    <Transition name="island">
      <div
        v-if="visible"
        class="pointer-events-auto inline-flex items-center gap-1.5 pl-3 pr-3.5 py-1 rounded-full text-[13px] leading-none text-white shadow-lg"
        :class="mode === 'error' ? 'bg-danger' : 'bg-[#2B2B2B]'"
      >
        <svg v-if="mode === 'syncing'" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V4a4 4 0 00-4 4H4z" />
        </svg>
        <svg v-else-if="mode === 'success'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span class="whitespace-nowrap max-w-[160px] truncate">{{ message }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.island-enter-active {
  transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease;
}
.island-leave-active {
  transition: transform 220ms ease-in, opacity 220ms ease-in;
}
.island-enter-from,
.island-leave-to {
  opacity: 0;
  transform: scaleX(0.4);
}
.island-enter-to,
.island-leave-from {
  opacity: 1;
  transform: scaleX(1);
}
</style>
