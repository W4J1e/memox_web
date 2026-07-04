import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSetting, putSetting } from '../utils/storage'
import { hashPin, verifyPin } from '../utils/crypto'

export const useLockStore = defineStore('lock', () => {
  const pinHash = ref('')
  const isLocked = ref(false)
  const lockEnabled = ref(false)
  const unlockedNoteIds = ref(new Set())

  async function loadLock() {
    pinHash.value = await getSetting('pin_hash', '')
    lockEnabled.value = !!pinHash.value
    if (lockEnabled.value) {
      const lockOnStartup = await getSetting('lockOnStartup', true)
      const sessionUnlocked = sessionStorage.getItem('memox_unlocked')
      isLocked.value = lockOnStartup && !sessionUnlocked
    }
  }

  async function setPin(pin) {
    const hash = await hashPin(pin)
    pinHash.value = hash
    lockEnabled.value = true
    await putSetting('pin_hash', hash)
  }

  async function removePin() {
    pinHash.value = ''
    lockEnabled.value = false
    isLocked.value = false
    sessionStorage.removeItem('memox_unlocked')
    await putSetting('pin_hash', '')
  }

  async function unlock(pin) {
    if (!pinHash.value) {
      isLocked.value = false
      return true
    }
    const valid = await verifyPin(pin, pinHash.value)
    if (valid) {
      isLocked.value = false
      sessionStorage.setItem('memox_unlocked', 'true')
    }
    return valid
  }

  async function verifyPinOnly(pin) {
    if (!pinHash.value) return true
    return verifyPin(pin, pinHash.value)
  }

  function lock() {
    if (lockEnabled.value) {
      isLocked.value = true
      sessionStorage.removeItem('memox_unlocked')
      unlockedNoteIds.value.clear()
    }
  }

  function isNoteUnlocked(noteId) {
    return unlockedNoteIds.value.has(noteId)
  }

  function unlockNote(noteId) {
    unlockedNoteIds.value.add(noteId)
  }

  function lockNote(noteId) {
    unlockedNoteIds.value.delete(noteId)
  }

  function clearUnlockedNotes() {
    unlockedNoteIds.value.clear()
  }

  return {
    pinHash,
    isLocked,
    lockEnabled,
    unlockedNoteIds,
    loadLock,
    setPin,
    removePin,
    unlock,
    verifyPinOnly,
    lock,
    isNoteUnlocked,
    unlockNote,
    lockNote,
    clearUnlockedNotes,
  }
})
