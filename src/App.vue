<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <PinLock v-if="lockStore.isLocked" />
    <template v-else>
      <router-view />
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useLockStore } from './stores/lock'
import { useNotesStore } from './stores/notes'
import { useSettingsStore } from './stores/settings'
import PinLock from './components/PinLock.vue'

const lockStore = useLockStore()
const notesStore = useNotesStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  await settingsStore.loadSettings()
  await lockStore.loadLock()
  if (!lockStore.isLocked) {
    await notesStore.loadNotes()
    settingsStore.autoSync()
  }
})
</script>
