<template>
  <div v-if="visible" class="fixed inset-0 z-40 flex">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')"></div>

    <!-- Panel -->
    <div class="relative w-72 max-w-[80vw] bg-white dark:bg-gray-800 h-full shadow-xl flex flex-col z-10">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <img src="/memox.png" alt="memoX" class="w-9 h-9 rounded-xl object-cover" />
          <div>
            <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">memoX</h1>
          </div>
        </div>
      </div>

      <!-- Nav items -->
      <div class="flex-1 overflow-y-auto py-2 px-2">
        <div
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
          :class="notesStore.currentFolder === 'NOTES' && !notesStore.currentLabel ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
          @click="selectFolder('NOTES')"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span class="text-sm font-medium">笔记</span>
          <span class="text-xs text-gray-400 ml-auto">{{ notesStore.activeNotes.length }}</span>
        </div>

        <!-- Labels -->
        <div v-if="notesStore.allLabels.length || hiddenLabelsToShow.length" class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <h3 class="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">标签</h3>
          <LabelItem
            v-for="label in notesStore.allLabels"
            :key="label"
            :label="label"
            :count="getLabelCount(label)"
            :active="notesStore.currentLabel === label"
            :hidden="false"
            @select="selectLabel"
            @toggle-visibility="toggleLabelVisibility"
          />
          <template v-if="hiddenLabelsToShow.length">
            <div class="px-3 py-1 mt-1">
              <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">已隐藏</span>
            </div>
            <LabelItem
              v-for="label in hiddenLabelsToShow"
              :key="'h_' + label"
              :label="label"
              :count="getLabelCount(label)"
              :active="notesStore.currentLabel === label"
              :hidden="true"
              @select="selectLabel"
              @toggle-visibility="toggleLabelVisibility"
            />
          </template>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <router-link to="/settings" class="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors" @click="$emit('close')">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span class="text-sm">设置</span>
        </router-link>
        <button
          v-if="lockStore.lockEnabled"
          @click="lockApp"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <span class="text-sm">锁定</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import { useLockStore } from '../stores/lock'
import LabelItem from './LabelItem.vue'

defineProps({
  visible: { type: Boolean, default: false },
})

defineEmits(['close'])

const notesStore = useNotesStore()
const settingsStore = useSettingsStore()
const lockStore = useLockStore()

const hiddenLabelsToShow = computed(() => {
  const hidden = settingsStore.hiddenLabels || []
  const allLabels = notesStore.allLabelsIncludingHidden
  return hidden.filter(l => allLabels.includes(l))
})

function selectFolder(folder) {
  notesStore.currentFolder = folder
  notesStore.currentLabel = null
  notesStore.searchQuery = ''
}

function selectLabel(label) {
  notesStore.currentLabel = notesStore.currentLabel === label ? null : label
  notesStore.currentFolder = 'NOTES'
}

function getLabelCount(label) {
  return notesStore.notes.filter(n => n.folder === 'NOTES' && n.labels && n.labels.includes(label)).length
}

async function toggleLabelVisibility(label) {
  await settingsStore.toggleLabelVisibility(label)
}

function lockApp() {
  lockStore.lock()
}
</script>
