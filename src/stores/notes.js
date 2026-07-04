import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAllNotes, putNote, deleteNote as dbDeleteNote, putNotes, clearNotes } from '../utils/storage'
import { createEmptyNote, createEmptyListItem, generateId } from '../utils/note-parser'
import { useSettingsStore } from './settings'

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
    } else {
      note.folder = 'DELETED'
      note.modifiedTimestamp = Date.now()
      await putNote(note)
    }
  }

  async function restoreNote(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.folder = 'NOTES'
    note.modifiedTimestamp = Date.now()
    await putNote(note)
  }

  async function permanentDeleteNote(id) {
    await dbDeleteNote(id)
    notes.value = notes.value.filter(n => n.id !== id)
  }

  async function emptyTrash() {
    const deleted = notes.value.filter(n => n.folder === 'DELETED')
    for (const note of deleted) {
      await dbDeleteNote(note.id)
    }
    notes.value = notes.value.filter(n => n.folder !== 'DELETED')
  }

  async function togglePin(id) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.pinned = !note.pinned
    note.modifiedTimestamp = Date.now()
    await putNote(note)
  }

  async function updateNoteColor(id, color) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.color = color
    note.modifiedTimestamp = Date.now()
    await putNote(note)
  }

  async function updateNoteLabels(id, labels) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.labels = labels
    note.modifiedTimestamp = Date.now()
    await putNote(note)
  }

  async function updateNoteLocked(id, locked) {
    const note = notes.value.find(n => n.id === id)
    if (!note) return
    note.locked = locked
    note.modifiedTimestamp = Date.now()
    await putNote(note)
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
