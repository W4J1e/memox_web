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

        <div
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
          :class="notesStore.currentFolder === 'DELETED' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
          @click="selectFolder('DELETED')"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span class="text-sm font-medium">回收站</span>
          <span class="text-xs text-gray-400 ml-auto">{{ notesStore.deletedNotes.length }}</span>
        </div>

        <!-- User folders (Android v1.2.4) — ABOVE labels -->
        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between px-3 mb-1">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">文件夹</span>
            <button @click="promptNewFolder" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="新建文件夹">
              <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <FolderItem
            label="未归类"
            :count="getFolderCount('')"
            :active="notesStore.currentUserFolder === ''"
            :can-edit="false"
            @click="selectUserFolder('')"
          />
          <FolderItem
            v-for="f in allFoldersSorted"
            :key="f.name"
            :label="f.name"
            :count="getFolderCount(f.name)"
            :active="notesStore.currentUserFolder === f.name"
            :hidden="f.hidden"
            @click="selectUserFolder(f.name)"
            @contextmenu="onFolderContextMenu"
          />
        </div>

        <!-- Labels (below folders) -->
        <div v-if="allAvailableLabels.length" class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between px-3 mb-1">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">标签</span>
            <button @click="promptNewLabelSidebar" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="新建标签">
              <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <LabelItem
            v-for="label in visibleLabels"
            :key="label"
            :label="label"
            :count="getLabelCount(label)"
            :active="notesStore.currentLabel === label"
            @select="selectLabel"
            @contextmenu="onLabelContextMenu"
          />
          <button
            v-if="allAvailableLabels.length > 5"
            @click="showAllLabels = !showAllLabels"
            class="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors w-full"
          >
            <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': showAllLabels }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            <span>{{ showAllLabels ? '收起标签' : `更多标签 (${allAvailableLabels.length - 5})` }}</span>
          </button>
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

  <!-- Global right-click context menu (folders / labels) -->
  <ContextMenu />
</template>

<script setup>
import { computed } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import { useLockStore } from '../stores/lock'
import { putSetting } from '../utils/storage'
import LabelItem from './LabelItem.vue'
import FolderItem from './FolderItem.vue'
import ContextMenu from './ContextMenu.vue'
import { useContextMenu } from '../composables/contextMenu'

defineProps({
  visible: { type: Boolean, default: false },
})

defineEmits(['close'])

const notesStore = useNotesStore()
const settingsStore = useSettingsStore()
const lockStore = useLockStore()
const { openMenu } = useContextMenu()

const hiddenLabelsToShow = computed(() => {
  const hidden = settingsStore.hiddenLabels || []
  const allLabels = notesStore.allLabelsIncludingHidden
  return hidden.filter(l => allLabels.includes(l))
})

// Merged label list: labels from notes + sidebar-created labels not yet on any note
const allAvailableLabels = computed(() => {
  const set = new Set([...notesStore.allLabels, ...(settingsStore.createdLabels || [])])
  return Array.from(set).sort()
})

// Show at most 5 labels; "更多标签" reveals the rest
const showAllLabels = ref(false)
const visibleLabels = computed(() => {
  return showAllLabels.value ? allAvailableLabels.value : allAvailableLabels.value.slice(0, 5)
})

function selectFolder(folder) {
  notesStore.currentFolder = folder
  notesStore.currentLabel = null
  notesStore.currentUserFolder = null
  notesStore.searchQuery = ''
}

function selectLabel(label) {
  notesStore.currentLabel = notesStore.currentLabel === label ? null : label
  notesStore.currentFolder = 'NOTES'
  notesStore.currentUserFolder = null
}

function getLabelCount(label) {
  return notesStore.notes.filter(n => n.folder === 'NOTES' && n.labels && n.labels.includes(label)).length
}

async function toggleLabelVisibility(label) {
  await settingsStore.toggleLabelVisibility(label)
}

async function promptNewLabelSidebar() {
  const name = window.prompt('新建标签名称')
  if (!name) return
  const trimmed = name.trim()
  if (!trimmed) return
  await settingsStore.addCreatedLabel(trimmed)
}

async function renameLabelPrompt(oldName) {
  const newName = window.prompt('重命名标签', oldName)
  if (!newName) return
  const trimmed = newName.trim()
  if (!trimmed || trimmed === oldName) return
  const notes = notesStore.notes.filter(n => (n.labels || []).includes(oldName))
  for (const note of notes) {
    const labels = note.labels.map(l => l === oldName ? trimmed : l)
    await notesStore.updateNoteLabels(note.id, labels)
  }
  const ci = settingsStore.createdLabels.indexOf(oldName)
  if (ci >= 0) {
    settingsStore.createdLabels[ci] = trimmed
    await putSetting('createdLabels', [...settingsStore.createdLabels])
  }
}

async function deleteLabelConfirm(labelName) {
  if (!window.confirm(`确定删除标签「${labelName}」吗？\n该标签将从所有笔记中移除。`)) return
  const notes = notesStore.notes.filter(n => (n.labels || []).includes(labelName))
  for (const note of notes) {
    const labels = note.labels.filter(l => l !== labelName)
    await notesStore.updateNoteLabels(note.id, labels)
  }
  const ci = settingsStore.createdLabels.indexOf(labelName)
  if (ci >= 0) {
    settingsStore.createdLabels.splice(ci, 1)
    await putSetting('createdLabels', [...settingsStore.createdLabels])
  }
}

// ---- User folders (Android v1.2.4) ----
const visibleFolders = computed(() => {
  const folders = settingsStore.folders || []
  return folders.filter(f => !f.hidden || settingsStore.revealHiddenFolders)
})
const hiddenFolders = computed(() => {
  const folders = settingsStore.folders || []
  return folders.filter(f => f.hidden && !settingsStore.revealHiddenFolders)
})
const foldersHaveHidden = computed(() => (settingsStore.folders || []).some(f => f.hidden))
// All real user folders, sorted by stored order. Hidden ones render with a
// strikethrough (FolderItem :hidden) but stay visible in the list — hiding only
// de-emphasizes them and removes their notes from the "全部笔记" view.
const allFoldersSorted = computed(() => {
  const folders = settingsStore.folders || []
  return [...folders].sort((a, b) => (a.order || 0) - (b.order || 0))
})

function getFolderCount(name) {
  return notesStore.notes.filter(n => n.folder === 'NOTES' && (n.folderId || '') === name).length
}

function selectUserFolder(name) {
  notesStore.currentUserFolder = name
  notesStore.currentFolder = 'NOTES'
  notesStore.currentLabel = null
  notesStore.searchQuery = ''
}

async function promptNewFolder() {
  const name = window.prompt('新建文件夹名称')
  if (!name) return
  await settingsStore.addFolder(name.trim())
}

function renameFolderPrompt(name) {
  const nn = window.prompt('重命名文件夹', name)
  if (!nn) return
  settingsStore.renameFolder(name, nn.trim())
}

function deleteFolderConfirm(name) {
  if (window.confirm(`删除文件夹"${name}"？相关笔记将变为未分类。`)) {
    settingsStore.deleteFolder(name)
    if (notesStore.currentUserFolder === name) notesStore.currentUserFolder = null
  }
}

// ---- Right-click context menu for a folder row ----
function onFolderContextMenu(e, folderName) {
  if (folderName === '未归类') return // pseudo-folder: not editable
  e.preventDefault()
  const folder = settingsStore.folders.find(f => f.name === folderName)
  const items = [
    { label: '重命名', icon: 'rename', action: () => renameFolderPrompt(folderName) },
    { label: '删除', icon: 'delete', danger: true, action: () => deleteFolderConfirm(folderName) },
    { separator: true },
    folder?.hidden
      ? { label: '显示文件夹', icon: 'eyeOn', action: () => settingsStore.toggleFolderHidden(folderName) }
      : { label: '隐藏文件夹', icon: 'eyeOff', action: () => settingsStore.toggleFolderHidden(folderName) },
  ]
  openMenu(e.clientX, e.clientY, items)
}

// ---- Right-click context menu for a label row ----
function onLabelContextMenu(e, labelName) {
  e.preventDefault()
  const items = [
    { label: '重命名', icon: 'rename', action: () => renameLabelPrompt(labelName) },
    { label: '删除', icon: 'delete', danger: true, action: () => deleteLabelConfirm(labelName) },
  ]
  openMenu(e.clientX, e.clientY, items)
}

function lockApp() {
  lockStore.lock()
}
</script>
