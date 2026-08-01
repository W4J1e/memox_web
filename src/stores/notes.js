import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAllNotes, putNote, deleteNote as dbDeleteNote, putNotes, clearNotes } from '../utils/storage'
import { createEmptyNote, createEmptyListItem, generateId, getAllAttachmentFileNames } from '../utils/note-parser'
import { useSettingsStore } from './settings'

// Mirrors the Android SyncRouter.syncNow() behaviour: every mutation schedules a
// sync. scheduleAutoSync() already debounces (10s) and no-ops when sync is
// disabled, so calling it from every store action is safe.
function triggerAutoSync() {
  try { useSettingsStore().scheduleAutoSync() } catch {}
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const currentFolder = ref('NOTES')
  const searchQuery = ref('')
  const currentLabel = ref(null)
  const loading = ref(false)

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

  const archivedNotes = computed(() => {
    return notes.value.filter(n => n.folder === 'ARCHIVED').sort((a, b) => b.timestamp - a.timestamp)
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
    return note
  }

  async function deleteNoteFromFolder(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    if (note.folder === 'DELETED') {
      await dbDeleteNote(id)
      notes.value = notes.value.filter(n => n.id !== id)
      try {
        const settings = useSettingsStore()
        await settings.addTombstone(id)
        await settings.addPendingAttachmentCleanup(getAllAttachmentFileNames(note))
      } catch {}
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

  // Matches the Android Folder.ARCHIVED behaviour: archiving just moves the note
  // between folders, so it round-trips through WebDAV sync unchanged.
  async function archiveNote(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.folder = 'ARCHIVED'
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function unarchiveNote(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.folder = 'NOTES'
    note.modifiedTimestamp = Date.now()
    await putNote(note)
    triggerAutoSync()
  }

  async function permanentDeleteNote(id) {
    const note = notes.value.find(n => n.id === id)
    await dbDeleteNote(id)
    notes.value = notes.value.filter(n => n.id !== id)
    try {
      const settings = useSettingsStore()
      await settings.addTombstone(id)
      if (note) await settings.addPendingAttachmentCleanup(getAllAttachmentFileNames(note))
    } catch {}
    triggerAutoSync()
  }

  async function emptyTrash() {
    const deleted = notes.value.filter(n => n.folder === 'DELETED')
    const orphanAttachments = []
    for (const note of deleted) {
      await dbDeleteNote(note.id)
      orphanAttachments.push(...getAllAttachmentFileNames(note))
      try { await useSettingsStore().addTombstone(note.id) } catch {}
    }
    notes.value = notes.value.filter(n => n.folder !== 'DELETED')
    try { await useSettingsStore().addPendingAttachmentCleanup(orphanAttachments) } catch {}
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
    archivedNotes,
    allLabels,
    allLabelsIncludingHidden,
    loadNotes,
    saveNote,
    createNote,
    deleteNoteFromFolder,
    restoreNote,
    archiveNote,
    unarchiveNote,
    permanentDeleteNote,
    emptyTrash,
    togglePin,
    updateNoteColor,
    updateNoteLabels,
    updateNoteLocked,
    replaceAllNotes,
  }
})
