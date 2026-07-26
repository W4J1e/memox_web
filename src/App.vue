<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <PinLock v-if="lockStore.isLocked" />
    <template v-else>
      <router-view />
    </template>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useLockStore } from './stores/lock'
import { useNotesStore } from './stores/notes'
import { useSettingsStore } from './stores/settings'
import PinLock from './components/PinLock.vue'

const lockStore = useLockStore()
const notesStore = useNotesStore()
const settingsStore = useSettingsStore()

// Periodic background sync so remote changes (made on the Android app or another
// browser) are pulled in without manual action. Mirrors Android's 30-min
// WorkManager periodic sync; kept shorter here for a more responsive web UX.
let periodicSyncTimer = null
const PERIODIC_SYNC_INTERVAL = 60 * 1000

onMounted(async () => {
  await settingsStore.loadSettings()
  await lockStore.loadLock()
  if (!lockStore.isLocked) {
    await notesStore.loadNotes()
    settingsStore.autoSync()
    periodicSyncTimer = setInterval(() => {
      if (settingsStore.webdavUrl) settingsStore.autoSync()
    }, PERIODIC_SYNC_INTERVAL)
  }
})

onUnmounted(() => {
  if (periodicSyncTimer) clearInterval(periodicSyncTimer)
})
</script>
