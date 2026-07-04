import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSetting, putSetting, getAttachment, putAttachment } from '../utils/storage'
import { WebDavClient } from '../utils/webdav-client'
import { noteToJson, jsonToNote, extractNoteId, noteFileName, getImageFileName, getAllImageFileNames } from '../utils/note-parser'
import { useNotesStore } from './notes'

export const useSettingsStore = defineStore('settings', () => {
  const webdavUrl = ref('')
  const webdavUsername = ref('')
  const webdavPassword = ref('')
  const proxyMode = ref('auto') // auto | proxy | direct
  const proxyUrl = ref('')
  const theme = ref('system')
  const notesView = ref('grid')
  const syncStatus = ref('idle')
  const syncMessage = ref('')
  const lastSyncTime = ref(0)
  const tombstones = ref([])
  const hiddenLabels = ref([])
  const lockOnStartup = ref(true)

  async function loadSettings() {
    webdavUrl.value = await getSetting('webdav_url', '')
    webdavUsername.value = await getSetting('webdav_username', '')
    webdavPassword.value = await getSetting('webdav_password', '')
    proxyMode.value = await getSetting('proxy_mode', 'auto')
    proxyUrl.value = await getSetting('proxy_url', '')
    theme.value = await getSetting('theme', 'system')
    notesView.value = await getSetting('notesView', 'grid')
    lastSyncTime.value = await getSetting('lastSyncTime', 0)
    tombstones.value = await getSetting('tombstones', [])
    hiddenLabels.value = await getSetting('hiddenLabels', [])
    lockOnStartup.value = await getSetting('lockOnStartup', true)
    applyTheme()
  }

  async function saveWebdavSettings(url, username, password, mode, pUrl) {
    webdavUrl.value = url
    webdavUsername.value = username
    webdavPassword.value = password
    proxyMode.value = mode || 'auto'
    proxyUrl.value = pUrl || ''
    await putSetting('webdav_url', url)
    await putSetting('webdav_username', username)
    await putSetting('webdav_password', password)
    await putSetting('proxy_mode', proxyMode.value)
    await putSetting('proxy_url', proxyUrl.value)
  }

  async function saveTheme(t) {
    theme.value = t
    await putSetting('theme', t)
    applyTheme()
  }

  async function saveNotesView(v) {
    notesView.value = v
    await putSetting('notesView', v)
  }

  function applyTheme() {
    const root = document.documentElement
    if (theme.value === 'dark') {
      root.classList.add('dark')
    } else if (theme.value === 'light') {
      root.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  function getClient() {
    if (!webdavUrl.value) return null
    const opts = { proxyMode: proxyMode.value }
    if (proxyUrl.value) opts.proxyUrl = proxyUrl.value
    return new WebDavClient(webdavUrl.value, webdavUsername.value, webdavPassword.value, opts)
  }

  async function listAllFiles(client, dirPath, collected = [], depth = 0) {
    if (depth > 3) return collected
    try {
      const files = await client.listFiles(dirPath)
      for (const f of files) {
        if (f.isDirectory) {
          await listAllFiles(client, f.path, collected, depth + 1)
        } else {
          collected.push(f)
        }
      }
    } catch (e) {
      console.warn('[memoX] Failed to list dir:', dirPath, e.message)
    }
    return collected
  }

  async function syncAttachments(client, notes) {
    const neededFileNames = new Set()
    for (const note of notes) {
      const names = getAllImageFileNames(note)
      for (const n of names) neededFileNames.add(n)
    }

    console.log('[memoX] syncAttachments: need', neededFileNames.size, 'files:', Array.from(neededFileNames))

    let downloaded = 0
    if (neededFileNames.size === 0) return downloaded

    for (const fn of Array.from(neededFileNames)) {
      try {
        const existing = await getAttachment(fn)
        if (existing) { neededFileNames.delete(fn) }
      } catch {}
    }
    if (neededFileNames.size === 0) return downloaded

    const allRemoteFiles = []
    const searchDirs = ['memoX/attachments/', 'memoX/attachments/files/', 'memoX/attachments/images/', 'memoX/attachments/audios/']
    for (const dir of searchDirs) {
      try {
        await listAllFiles(client, dir, allRemoteFiles)
      } catch (e) {
        console.warn('[memoX] Error scanning', dir, e.message)
      }
    }

    console.log('[memoX] Found', allRemoteFiles.length, 'remote attachment files')

    const remoteFileMap = new Map()
    for (const f of allRemoteFiles) {
      if (!remoteFileMap.has(f.name)) {
        remoteFileMap.set(f.name, f.path)
      }
    }

    for (const fn of Array.from(neededFileNames)) {
      const remotePath = remoteFileMap.get(fn)
      if (!remotePath) {
        console.warn('[memoX] Remote file not found for:', fn)
        continue
      }
      try {
        const blob = await client.downloadBlob(remotePath)
        if (blob && blob.size > 0) {
          await putAttachment(fn, blob)
          downloaded++
          console.log('[memoX] Downloaded attachment:', fn, blob.size, 'bytes')
        }
      } catch (e) {
        console.warn('[memoX] Failed to download', fn, e.message)
      }
    }

    console.log('[memoX] syncAttachments done:', downloaded, 'new files')
    return downloaded
  }

  async function getImageUrl(img) {
    const fn = getImageFileName(img)
    if (!fn) return null
    const blob = await getAttachment(fn)
    if (!blob) return null
    return URL.createObjectURL(blob)
  }

  async function testConnection() {
    const client = getClient()
    if (!client) throw new Error('WebDAV 未配置')
    const ok = await client.testConnection()
    if (!ok) throw new Error('连接失败，请检查地址、用户名、密码及代理设置')
    await client.ensureDirectories()
    return true
  }

  async function sync() {
    const client = getClient()
    if (!client) throw new Error('WebDAV 未配置')
    const notesStore = useNotesStore()

    syncStatus.value = 'syncing'
    syncMessage.value = '正在同步...'

    try {
      await client.ensureDirectories()

      let remoteTombstones = []
      const metaText = await client.downloadText('memoX/sync_meta.json')
      if (metaText) {
        try {
          const meta = JSON.parse(metaText)
          remoteTombstones = meta.deletedNoteIds || []
        } catch {}
      }

      const mergedTombstones = [...new Set([...tombstones.value, ...remoteTombstones])]

      for (const id of mergedTombstones) {
        const localNote = notesStore.notes.find(n => n.id === id)
        if (localNote) {
          await notesStore.permanentDeleteNote(id)
        }
      }

      const remoteFiles = await client.listFiles('memoX/notes')
      const noteFiles = remoteFiles.filter(f => !f.isDirectory && f.name.endsWith('.json'))

      const remoteNoteIdToFileNames = new Map()
      for (const file of noteFiles) {
        const noteId = extractNoteId(file.name)
        if (noteId && !mergedTombstones.includes(noteId)) {
          if (!remoteNoteIdToFileNames.has(noteId)) {
            remoteNoteIdToFileNames.set(noteId, [])
          }
          remoteNoteIdToFileNames.get(noteId).push(file.name)
        }
      }

      const localNotes = notesStore.notes.filter(n => n.folder !== 'DELETED')
      const localNoteMap = new Map(localNotes.map(n => [n.id, n]))

      const toUpload = []
      const toDownload = []
      const toConflictResolve = []

      for (const note of localNotes) {
        if (!remoteNoteIdToFileNames.has(note.id)) {
          toUpload.push(note)
        }
      }

      for (const [id, fileNames] of remoteNoteIdToFileNames) {
        if (!localNoteMap.has(id)) {
          toDownload.push({ id, fileName: fileNames[fileNames.length - 1] })
        } else {
          toConflictResolve.push({ id, fileName: fileNames[fileNames.length - 1] })
        }
      }

      for (const { id, fileName } of toConflictResolve) {
        const remoteText = await client.downloadText(`memoX/notes/${fileName}`)
        if (remoteText) {
          try {
            const remoteNote = jsonToNote(remoteText)
            const localNote = localNoteMap.get(id)
            if (remoteNote.modifiedTimestamp > localNote.modifiedTimestamp) {
              await notesStore.saveNote(remoteNote)
            } else if (remoteNote.modifiedTimestamp < localNote.modifiedTimestamp) {
              toUpload.push(localNote)
            }
          } catch {}
        }
      }

      for (const note of toUpload) {
        const json = noteToJson(note)
        const fileName = noteFileName(note)
        await client.upload(`memoX/notes/${fileName}`, new TextEncoder().encode(json).buffer)
      }

      for (const { fileName } of toDownload) {
        const remoteText = await client.downloadText(`memoX/notes/${fileName}`)
        if (remoteText) {
          try {
            const remoteNote = jsonToNote(remoteText)
            await notesStore.saveNote(remoteNote)
          } catch {}
        }
      }

      for (const [id, fileNames] of remoteNoteIdToFileNames) {
        if (fileNames.length > 1) {
          const correctName = noteFileName(localNoteMap.get(id) || { id, title: '' })
          for (const name of fileNames) {
            if (name !== correctName) {
              await client.delete(`memoX/notes/${name}`)
            }
          }
        }
      }

      for (const id of mergedTombstones) {
        const fileNames = remoteNoteIdToFileNames.get(id) || []
        for (const name of fileNames) {
          await client.delete(`memoX/notes/${name}`)
        }
      }

      const currentNotes = notesStore.notes.filter(n => n.folder !== 'DELETED')
      const syncedNoteIds = currentNotes.map(n => n.id).sort()
      const syncMeta = {
        lastSyncTime: Date.now(),
        noteCount: currentNotes.length,
        appVersion: '1.0.0-web',
        syncedNoteIds,
        deletedNoteIds: mergedTombstones,
      }
      await client.upload('memoX/sync_meta.json', new TextEncoder().encode(JSON.stringify(syncMeta, null, 2)).buffer)

      const localLabels = notesStore.allLabels
      const labelsText = await client.downloadText('memoX/labels.json')
      let remoteLabels = []
      let remoteHiddenLabels = []
      if (labelsText) {
        try {
          const labelsObj = JSON.parse(labelsText)
          remoteLabels = labelsObj.labels || []
          remoteHiddenLabels = labelsObj.hiddenLabels || []
        } catch {}
      }
      const mergedLabels = [...new Set([...localLabels, ...remoteLabels])].sort()
      const mergedHiddenLabels = [...new Set([...hiddenLabels.value, ...remoteHiddenLabels])].sort()
      const labelsJson = JSON.stringify({ labels: mergedLabels, hiddenLabels: mergedHiddenLabels }, null, 2)
      await client.upload('memoX/labels.json', new TextEncoder().encode(labelsJson).buffer)

      hiddenLabels.value = mergedHiddenLabels
      await putSetting('hiddenLabels', mergedHiddenLabels)

      tombstones.value = mergedTombstones
      lastSyncTime.value = Date.now()
      await putSetting('tombstones', mergedTombstones)
      await putSetting('lastSyncTime', lastSyncTime.value)

      await syncAttachments(client, notesStore.notes.filter(n => n.folder !== 'DELETED'))

      syncStatus.value = 'success'
      syncMessage.value = `同步完成：上传 ${toUpload.length}，下载 ${toDownload.length}`
    } catch (e) {
      syncStatus.value = 'error'
      syncMessage.value = `同步失败：${e.message}`
      throw e
    }
  }

  async function upload() {
    const client = getClient()
    if (!client) throw new Error('WebDAV 未配置')
    const notesStore = useNotesStore()

    syncStatus.value = 'syncing'
    syncMessage.value = '正在上传...'

    try {
      await client.ensureDirectories()
      const localNotes = notesStore.notes.filter(n => n.folder !== 'DELETED')

      const remoteFiles = await client.listFiles('memoX/notes')
      const remoteNoteIdToFileNames = new Map()
      for (const file of remoteFiles) {
        if (!file.isDirectory && file.name.endsWith('.json')) {
          const id = extractNoteId(file.name)
          if (id) {
            if (!remoteNoteIdToFileNames.has(id)) remoteNoteIdToFileNames.set(id, [])
            remoteNoteIdToFileNames.get(id).push(file.name)
          }
        }
      }

      let uploaded = 0
      for (const note of localNotes) {
        const json = noteToJson(note)
        const fileName = noteFileName(note)
        const ok = await client.upload(`memoX/notes/${fileName}`, new TextEncoder().encode(json).buffer)
        if (ok) {
          uploaded++
          const oldFiles = remoteNoteIdToFileNames.get(note.id) || []
          for (const oldName of oldFiles) {
            if (oldName !== fileName) {
              await client.delete(`memoX/notes/${oldName}`)
            }
          }
        }
      }

      const localIds = new Set(localNotes.map(n => n.id))
      for (const [id, fileNames] of remoteNoteIdToFileNames) {
        if (!localIds.has(id)) {
          for (const name of fileNames) {
            await client.delete(`memoX/notes/${name}`)
          }
        }
      }

      const syncMeta = {
        lastSyncTime: Date.now(),
        noteCount: localNotes.length,
        appVersion: '1.0.0-web',
        syncedNoteIds: localNotes.map(n => n.id).sort(),
        deletedNoteIds: tombstones.value,
      }
      await client.upload('memoX/sync_meta.json', new TextEncoder().encode(JSON.stringify(syncMeta, null, 2)).buffer)

      const labelsJson = JSON.stringify({ labels: notesStore.allLabels, hiddenLabels: hiddenLabels.value }, null, 2)
      await client.upload('memoX/labels.json', new TextEncoder().encode(labelsJson).buffer)

      lastSyncTime.value = Date.now()
      await putSetting('lastSyncTime', lastSyncTime.value)
      syncStatus.value = 'success'
      syncMessage.value = `上传完成：${uploaded} 条笔记`
    } catch (e) {
      syncStatus.value = 'error'
      syncMessage.value = `上传失败：${e.message}`
      throw e
    }
  }

  async function download() {
    const client = getClient()
    if (!client) throw new Error('WebDAV 未配置')
    const notesStore = useNotesStore()

    syncStatus.value = 'syncing'
    syncMessage.value = '正在下载...'

    try {
      await client.ensureDirectories()
      const remoteFiles = await client.listFiles('memoX/notes')
      const noteFiles = remoteFiles.filter(f => !f.isDirectory && f.name.endsWith('.json'))

      const newNotes = []
      for (const file of noteFiles) {
        const text = await client.downloadText(`memoX/notes/${file.name}`)
        if (text) {
          try {
            newNotes.push(jsonToNote(text))
          } catch {}
        }
      }

      await notesStore.replaceAllNotes(newNotes)

      const imgCount = await syncAttachments(client, newNotes)

      lastSyncTime.value = Date.now()
      await putSetting('lastSyncTime', lastSyncTime.value)
      syncStatus.value = 'success'
      syncMessage.value = `下载完成：${newNotes.length} 条笔记${imgCount > 0 ? '，' + imgCount + ' 张图片' : ''}`
    } catch (e) {
      syncStatus.value = 'error'
      syncMessage.value = `下载失败：${e.message}`
      throw e
    }
  }

  async function addTombstone(id) {
    if (!tombstones.value.includes(id)) {
      tombstones.value.push(id)
      await putSetting('tombstones', tombstones.value)
    }
  }

  let autoSyncTimer = null

  async function autoSync() {
    if (!webdavUrl.value) return
    if (syncStatus.value === 'syncing') return
    try {
      await sync()
      console.log('[memoX] Auto sync completed')
    } catch (e) {
      console.warn('[memoX] Auto sync failed:', e.message)
    }
  }

  function scheduleAutoSync(delay = 10000) {
    if (!webdavUrl.value) return
    clearTimeout(autoSyncTimer)
    autoSyncTimer = setTimeout(() => {
      autoSync()
    }, delay)
  }

  async function toggleLabelVisibility(label) {
    const list = [...hiddenLabels.value]
    const idx = list.indexOf(label)
    if (idx >= 0) {
      list.splice(idx, 1)
    } else {
      list.push(label)
    }
    hiddenLabels.value = list
    await putSetting('hiddenLabels', list)
  }

  function isLabelHidden(label) {
    return hiddenLabels.value.includes(label)
  }

  async function saveLockOnStartup(val) {
    lockOnStartup.value = val
    await putSetting('lockOnStartup', val)
  }

  return {
    webdavUrl,
    webdavUsername,
    webdavPassword,
    proxyMode,
    proxyUrl,
    theme,
    notesView,
    syncStatus,
    syncMessage,
    lastSyncTime,
    tombstones,
    hiddenLabels,
    lockOnStartup,
    loadSettings,
    saveWebdavSettings,
    saveTheme,
    saveNotesView,
    applyTheme,
    testConnection,
    sync,
    upload,
    download,
    addTombstone,
    getImageUrl,
    syncAttachments,
    autoSync,
    scheduleAutoSync,
    toggleLabelVisibility,
    isLabelHidden,
    saveLockOnStartup,
  }
})
