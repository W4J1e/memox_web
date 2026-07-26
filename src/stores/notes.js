import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAllNotes, putNote, deleteNote as dbDeleteNote, putNotes, clearNotes } from '../utils/storage'
import { createEmptyNote, createEmptyListItem, generateId, getAllAttachmentFileNames } from '../utils/note-parser'
import { useSettingsStore } from './settings'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const currentFolder = ref('NOTES')
  const searchQuery = ref('')
  const currentLabel = ref(null)
  const loading = ref(false)

  // Fire a debounced background sync after any local mutation so that changes
  // (create / edit / delete / pin / color / label / lock ...) reach the remote
  // store without requiring the user to tap "sync". Mirrors the Android app,
  // which calls SyncRouter.syncNow() after every operation.
  function triggerAutoSync() {
    try {
      useSettingsStore().scheduleAutoSync()
    } catch {
      // settings store not ready yet — ignore
    }
  }

  const activeNotes = computed(() => {
    let filtered = notes.value.filter(n => n.folder === currentFolder.value)
    // Filter out notes with hidden labels (when not searching and not specifically viewing a label)
    if (!currentLabel.value && !searchQuery.value.trim()) {
      let hidden = []
      try { hidden = useSettingsStore().hiddenLabels || [] } catch {}
      if (hidden.length > 0) {
        filtered = filtered.filter(n => !(n.labels && n.labels.some(l => hidden.includes(l))))
      }
    }
    if (currentLabel.value) {
      filtered = filtered.filter(n => n.labels && n.labels.includes(currentLabel.value))
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      filtered = filtered.filter(n => {
        if ((n.title || '').toLowerCase().includes(q)) return true
        if ((n.labels || []).some(l => l.toLowerCase().includes(q))) return true
        if (n.locked) return false
        if ((n.body || '').toLowerCase().includes(q)) return true
        if ((n.items || []).some(i => (i.body || '').toLowerCase().includes(q))) return true
        return false
      })
    }
    const pinned = filtered.filter(n => n.pinned).sort((a, b) => b.timestamp - a.timestamp)
    const others = filtered.filter(n => !n.pinned).sort((a, b) => b.timestamp - a.timestamp)
    return [...pinned, ...others]
  })

  const deletedNotes = computed(() => {
    return notes.value.filter(n => n.folder === 'DELETED').sort((a, b) => b.timestamp - a.timestamp)
  })

  const allLabels = computed(() => {
    const labelSet = new Set()
    notes.value.forEach(n => {
      if (n.labels) n.labels.forEach(l => labelSet.add(l))
    })
    let labels = Array.from(labelSet).sort()
    try {
      const hidden = useSettingsStore().hiddenLabels || []
      if (hidden.length > 0) {
        labels = labels.filter(l => !hidden.includes(l))
      }
    } catch {}
    return labels
  })

  const allLabelsIncludingHidden = computed(() => {
    const labelSet = new Set()
    notes.value.forEach(n => {
      if (n.labels) n.labels.forEach(l => labelSet.add(l))
    })
    return Array.from(labelSet).sort()
  })

  async function loadNotes() {
    loading.value = true
    try {
      notes.value = await getAllNotes()
    } catch (e) {
      console.error('Failed to load notes:', e)
    } finally {
      loading.value = false
    }
  }

  async function saveNote(note) {
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx >= 0) {
      notes.value[idx] = { ...note }
    } else {
      notes.value.push({ ...note })
    }
    triggerAutoSync()
  }

  async function createNote(type = 'NOTE') {
    const note = createEmptyNote()
    note.type = type
    if (type === 'LIST') {
      note.items = [createEmptyListItem()]
    }
    await putNote(note)
    notes.value.push({ ...note })
    triggerAutoSync()
    return note
  }

  async function deleteNoteFromFolder(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    if (note.folder === 'DELETED') {
      await dbDeleteNote(id)
      notes.value = notes.value.filter(n => n.id !== id)
      try { await useSettingsStore().addTombstone(id) } catch {}
    } else {
      note.folder = 'DELETED'
      note.modifiedTimestamp = Date.now()
      await putNote(note)
    }
    triggerAutoSync()
  }

  async function restoreNote(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.folder = 'NOTES'
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function permanentDeleteNote(id) {
    const note = notes.value.find(n => n.id === id)
    if (note) {
      const names = getAllAttachmentFileNames(note)
      if (names.length) {
        try { await useSettingsStore().addPendingAttachmentCleanup(names) } catch {}
      }
    }
    await dbDeleteNote(id)
    notes.value = notes.value.filter(n => n.id !== id)
    try { await useSettingsStore().addTombstone(id) } catch {}
    triggerAutoSync()
  }

  async function emptyTrash() {
    const deleted = notes.value.filter(n => n.folder === 'DELETED')
    for (const note of deleted) {
      const names = getAllAttachmentFileNames(note)
      if (names.length) {
        try { await useSettingsStore().addPendingAttachmentCleanup(names) } catch {}
      }
      await dbDeleteNote(note.id)
      try { await useSettingsStore().addTombstone(note.id) } catch {}
    }
    notes.value = notes.value.filter(n => n.folder !== 'DELETED')
    triggerAutoSync()
  }

  async function togglePin(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.pinned = !note.pinned
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function updateNoteColor(id, color) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.color = color
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function updateNoteLabels(id, labels) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.labels = labels
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function updateNoteLocked(id, locked) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.locked = locked
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function replaceAllNotes(newNotes) {
    await clearNotes()
    await putNotes(newNotes)
    notes.value = newNotes
  }

  return {
    notes,
    currentFolder,
    searchQuery,
    currentLabel,
    loading,
    activeNotes,
    deletedNotes,
    allLabels,
    allLabelsIncludingHidden,
    loadNotes,
    saveNote,
    createNote,
    deleteNoteFromFolder,
    restoreNote,
    permanentDeleteNote,
    emptyTrash,
    togglePin,
    updateNoteColor,
    updateNoteLabels,
    updateNoteLocked,
    replaceAllNotes,
  }
})
