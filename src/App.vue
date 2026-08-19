<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
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
import { handleOAuthRedirect } from './utils/onedrive-auth'
import PinLock from './components/PinLock.vue'

const lockStore = useLockStore()
const notesStore = useNotesStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  await settingsStore.loadSettings()
  await lockStore.loadLock()

  // OneDrive OAuth redirect: Microsoft sends the browser back to
  // `origin/?code=...&state=...`. If we see those query params, finish the
  // token exchange, switch the active provider, clean the URL, and return the
  // user to the settings page.
  const params = new URLSearchParams(window.location.search)
  if (params.get('code') && params.get('state')) {
    try {
      await handleOAuthRedirect(params)
      await settingsStore.saveSyncProvider('onedrive')
    } catch (e) {
      console.error('[memoX] OneDrive 登录失败：', e.message)
    } finally {
      // Strip the ?code=&state= from the URL so a refresh won't re-trigger.
      window.history.replaceState(null, '', window.location.origin + '/')
    }
    // Return the user to the settings page (replaceState above already removed
    // the query; this fragment change navigates the hash router).
    window.location.hash = '#/settings'
  }

  if (!lockStore.isLocked) {
    await notesStore.loadNotes()
    settingsStore.autoSync()
  }
})
</script>
