import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSetting, putSetting, getAttachment, putAttachment } from '../utils/storage'
import { WebDavClient } from '../utils/webdav-client'
import { noteToJson, jsonToNote, extractNoteId, noteFileName, getImageFileName, getAllImageFileNames, getAllAttachmentFileNames } from '../utils/note-parser'
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
  // Attachment file names scheduled for deletion from the remote store. A note's
  // attachments are enqueued here when the note is permanently deleted (from the
  // recycle bin); cleanupAttachments() removes them from the remote once the note
  // file itself has been purged, mirroring Android's deleteRemoteNote behavior.
  const pendingAttachmentCleanup = ref([])
  // Remembers which WebDAV server we've already created the memoX/ directory tree
  // on. Once set, sync/upload/download skip ensureDirectories() entirely — this
  // removes six serial ~3s MKCOL round-trips (and the harmless-but-noisy 405s they
  // produce) from every subsequent sync. Cleared when the server URL changes.
  const DIRS_ENSURED_KEY = 'memoX.dirsEnsured'

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
    pendingAttachmentCleanup.value = await getSetting('pendingAttachmentCleanup', [])
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
    // Server changed — force a fresh directory tree check on the next sync.
    await putSetting(DIRS_ENSURED_KEY, '')
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
    // Only forward a custom proxy URL in proxy mode. In auto/direct it must stay
    // out of the client so a leftover Cloudflare Worker URL can never hijack auto
    // mode (the WebDavClient also guards this, but belt-and-suspenders).
    if (proxyMode.value === 'proxy' && proxyUrl.value) opts.proxyUrl = proxyUrl.value
    return new WebDavClient(webdavUrl.value, webdavUsername.value, webdavPassword.value, opts)
  }

  // Ensure the memoX/ directory tree exists, but only once per WebDAV server.
  // After the first successful creation we persist the server URL and skip the
  // (slow, proxy-bound) MKCOL round-trips on all later syncs.
  async function ensureDirsOnce(client) {
    const ensuredFor = await getSetting(DIRS_ENSURED_KEY, '')
    if (ensuredFor === webdavUrl.value) return
    await client.ensureDirectories()
    await putSetting(DIRS_ENSURED_KEY, webdavUrl.value)
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

  // Build a single remote attachment index (name -> byte size) for the three
  // attachment dirs. Mirrors Android's loadRemoteAttachmentIndex: one listing,
  // reused by upload skip + download skip + orphan cleanup so the whole sync
  // issues far fewer PROPFIND requests against the (slow) EdgeOne proxy.
  async function buildRemoteAttachmentIndex(client) {
    const index = { images: new Map(), audios: new Map(), files: new Map() }
    const dirs = [
      ['memoX/attachments/images/', index.images],
      ['memoX/attachments/audios/', index.audios],
      ['memoX/attachments/files/', index.files],
    ]
    for (const [dir, map] of dirs) {
      try {
        const files = await client.listFiles(dir)
        for (const f of files) {
          if (!f.isDirectory) map.set(f.name, f.size)
        }
      } catch {}
    }
    return index
  }

  function attachmentKey(fileName) {
    const dir = getAttachmentDir(fileName)
    if (dir.includes('/images/')) return 'images'
    if (dir.includes('/audios/')) return 'audios'
    return 'files'
  }

  function attachmentDirFromKey(key) {
    if (key === 'audios') return 'memoX/attachments/audios/'
    if (key === 'files') return 'memoX/attachments/files/'
    return 'memoX/attachments/images/'
  }

  // Find a referenced attachment anywhere in the three remote indexes. Android may
  // store a file under a different subdir than our local routing guess (e.g. an
  // image whose name has no recognized extension ends up in files/), so we must
  // not assume the expected dir — otherwise remoteSize stays undefined and the
  // file is silently skipped and never downloaded.
  function findRemoteAttachment(index, fileName) {
    for (const key of ['images', 'audios', 'files']) {
      if (index[key].has(fileName)) {
        return { key, dir: attachmentDirFromKey(key), size: index[key].get(fileName) }
      }
    }
    return null
  }

  async function probeSize(client, path) {
    try {
      // Cache-bust so we don't read a stale immutable entry left over from the
      // corruption phase (EdgeOne Makers keeps no manual purge).
      const resp = await client.request('HEAD', path + '?cb=' + Date.now())
      if (resp.ok) {
        const len = parseInt(resp.headers.get('content-length') || '0', 10)
        if (len > 0) return len
      }
    } catch {}
    return undefined
  }

  // A downloaded attachment must not be an HTML/XML error page (e.g. a 404 body
  // the proxy returned instead of the file). Persisting that would lock a
  // "broken" blob into the size-based skip check forever. Cheap 512-byte peek.
  async function isErrorBody(blob) {
    try {
      const head = blob.slice(0, 512)
      const text = (await head.text()).trim().toLowerCase()
      return text.startsWith('<!doctype') || text.startsWith('<html') || text.startsWith('<?xml')
    } catch {
      return false
    }
  }

  async function uploadAttachments(client, notes, index = null) {
    const neededFileNames = new Set()
    for (const note of notes) {
      // Cover images + files + audios (getAllAttachmentFileNames) so voice memos
      // and non-image files sync too — getAllImageFileNames silently dropped them.
      const names = getAllAttachmentFileNames(note)
      for (const n of names) neededFileNames.add(n)
    }

    if (neededFileNames.size === 0) return 0
    if (!index) index = await buildRemoteAttachmentIndex(client)

    let uploaded = 0
    for (const fn of Array.from(neededFileNames)) {
      const key = attachmentKey(fn)
      const dir = getAttachmentDir(fn)
      const remoteSize = index[key].get(fn)
      let blob
      try { blob = await getAttachment(fn) } catch { continue }
      if (!blob || blob.size === 0) continue
      // The web app never EDITs existing attachments — the WebDAV copy is the
      // source of truth. So if the remote already has a file with this name,
      // ALWAYS skip the upload: pushing our local copy would overwrite a good
      // remote file with a (possibly stale/half-downloaded) local one and
      // silently pollute the server. The only case we upload is when the remote
      // has NO such file yet — i.e. a genuinely new attachment the web created
      // (its name is unique, so it can't already exist on the server).
      if (remoteSize !== undefined) continue
      const ok = await client.upload(`${dir}${fn}`, blob)
      if (ok) {
        uploaded++
        index[key].set(fn, blob.size)
      }
    }

    return uploaded
  }

  function getAttachmentDir(fileName) {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.bmp')) {
      return 'memoX/attachments/images/'
    }
    if (lower.endsWith('.mp3') || lower.endsWith('.m4a') || lower.endsWith('.wav') || lower.endsWith('.ogg')) {
      return 'memoX/attachments/audios/'
    }
    // Android app names images as "timestamp_image_xxx" without extension
    if (fileName.includes('_image_') || /^\d+_image/.test(fileName)) {
      return 'memoX/attachments/images/'
    }
    return 'memoX/attachments/files/'
  }

  async function syncAttachments(client, notes, index = null) {
    const neededFileNames = new Set()
    for (const note of notes) {
      // Cover images + files + audios (getAllAttachmentFileNames) so voice memos
      // and non-image files sync too — getAllImageFileNames silently dropped them.
      const names = getAllAttachmentFileNames(note)
      for (const n of names) neededFileNames.add(n)
    }

    if (neededFileNames.size === 0) return 0
    if (!index) index = await buildRemoteAttachmentIndex(client)

    let downloaded = 0
    for (const fn of Array.from(neededFileNames)) {
      // Resolve the file's real location. Search all three indexes (Android may
      // store it under a different subdir than our local guess); if it's missing
      // everywhere, probe the expected path (and the other two dirs) with a
      // cache-busted HEAD so a file the listing somehow missed still downloads
      // instead of being permanently skipped.
      let located = findRemoteAttachment(index, fn)
      let key, dir, remoteSize
      if (located) {
        key = located.key
        dir = located.dir
        remoteSize = located.size
      } else {
        key = attachmentKey(fn)
        dir = getAttachmentDir(fn)
        remoteSize = await probeSize(client, `${dir}${fn}`)
        if (remoteSize === undefined) {
          for (const d of ['memoX/attachments/images/', 'memoX/attachments/audios/', 'memoX/attachments/files/']) {
            const s = await probeSize(client, `${d}${fn}`)
            if (s !== undefined) {
              dir = d
              remoteSize = s
              key = d.includes('/audios/') ? 'audios' : d.includes('/files/') ? 'files' : 'images'
              break
            }
          }
        }
      }
      if (remoteSize === undefined) continue

      // Skip if we already own a blob of matching size — unless it's actually a
      // stored error page that matched the size by accident.
      try {
        const existing = await getAttachment(fn)
        if (existing && existing.size > 0 && existing.size === remoteSize) {
          if (!(await isErrorBody(existing))) continue
        }
      } catch {}

      try {
        const blob = await client.downloadBlob(`${dir}${fn}`)
        // Only persist a download that is actually complete AND not an error page.
        // A truncated/error body must never be stored, or the size-based skip check
        // would lock in a broken attachment and re-download it forever.
        if (blob && blob.size > 0 && blob.size === remoteSize && !(await isErrorBody(blob))) {
          await putAttachment(fn, blob)
          downloaded++
        }
      } catch {}
    }

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

  // Normalize a note body for *semantic* comparison across clients. Web and
  // Android serialize the same note with different whitespace / span noise, and
  // some buggy intermediate builds left stray <br> anchors on WebDAV copies.
  // Collapsing that noise lets two notes that read identically be treated as
  // identical — otherwise the sync conflict rule re-uploads them every run.
  function normalizeBodyText(s) {
    if (!s) return ''
    return String(s)
      .replace(/ /g, ' ')                  // nbsp -> space
      .replace(/\uFFFC/g, '\u0001')            // unify the image placeholder
      .replace(/\s*\u0001\s*/g, '\u0001')     // drop whitespace hugging a placeholder
      .replace(/\s+/g, ' ')                    // collapse runs of whitespace
      .trim()
  }

  // True when two notes carry the same actual content. Ignores the whitespace /
  // placeholder noise that triggers phantom "changed" detections, so an
  // unchanged note (or one merely polluted with stray <br>s on WebDAV) is never
  // treated as an edit that must be pushed up.
  function notesContentEqual(a, b) {
    if (!a || !b) return false
    if ((a.title || '') !== (b.title || '')) return false
    if (a.type === 'LIST') {
      return JSON.stringify(a.items || []) === JSON.stringify(b.items || [])
    }
    return normalizeBodyText(a.body) === normalizeBodyText(b.body)
  }

  async function sync() {
    const client = getClient()
    if (!client) throw new Error('WebDAV 未配置')
    const notesStore = useNotesStore()

    syncStatus.value = 'syncing'
    syncMessage.value = '正在同步...'

    try {
      await ensureDirsOnce(client)

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

      const localNotes = notesStore.notes
      const localNoteMap = new Map(localNotes.map(n => [n.id, n]))

      const toUpload = []
      const toDownload = []

      for (const note of localNotes) {
        if (!mergedTombstones.includes(note.id) && !remoteNoteIdToFileNames.has(note.id)) {
          toUpload.push(note)
        }
      }

      // Build per-note remote metadata (canonical file name + byte size) so we can
      // skip the expensive full-text download when a note is byte-identical on both
      // sides. This is the single biggest latency win on the (slow) EdgeOne proxy:
      // an unchanged note no longer costs a full round-trip per note.
      const remoteNoteMeta = new Map()
      for (const file of noteFiles) {
        const noteId = extractNoteId(file.name)
        if (!noteId || mergedTombstones.includes(noteId)) continue
        remoteNoteMeta.set(noteId, { fileName: file.name, size: file.size })
      }

      for (const [id, meta] of remoteNoteMeta) {
        const localNote = localNoteMap.get(id)
        if (!localNote) {
          toDownload.push({ id, fileName: meta.fileName })
          continue
        }
        // Cheap pre-check: PROPFIND already gave us the remote byte size. If the
        // serialized local note is byte-identical to what's on the server, there is
        // nothing to do — skip the download entirely (no proxy round-trip).
        const expectedSize = new TextEncoder().encode(noteToJson(localNote)).length
        if (typeof meta.size === 'number' && meta.size === expectedSize) continue

        const remoteText = await client.downloadText(`memoX/notes/${meta.fileName}`)
        if (!remoteText) continue
        let remoteNote
        try { remoteNote = jsonToNote(remoteText) } catch { continue }

        // Semantic reconciliation: if the two notes carry the same actual content
        // (ignoring whitespace / image-placeholder noise and the stray <br> anchors
        // some buggy builds left on WebDAV), treat them as identical. This stops
        // the "ghost upload" storm where unchanged notes get re-pushed every sync
        // and clobber the Android copy.
        if (notesContentEqual(localNote, remoteNote)) continue

        const remoteTs = remoteNote.modifiedTimestamp || 0
        const localTs = localNote.modifiedTimestamp || 0
        if (localTs > remoteTs) {
          // Local is newer -> push it up.
          toUpload.push(localNote)
        } else if (localTs < remoteTs) {
          // Remote is newer -> pull it, but preserve its modifiedTimestamp so the
          // next sync sees equal timestamps and skips (Android keeps the remote
          // value too, avoiding per-run re-uploads of unchanged notes).
          await notesStore.saveNote(remoteNote, { preserveTimestamp: true, silent: true })
        }
        // localTs === remoteTs -> already identical, skip (no pointless re-upload)
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
            // Preserve the remote modifiedTimestamp. A freshly downloaded note must
            // NOT be re-stamped "now", or the next sync's conflict rule (local newer
            // -> overwrite remote) would treat it as locally-edited and push it back
            // up — the "ghost upload" of notes you never touched. silent:true keeps
            // this sync-internal write from re-triggering auto-sync.
            await notesStore.saveNote(remoteNote, { preserveTimestamp: true, silent: true })
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

      await cleanupAttachments(client)

      const allNoteIds = notesStore.notes.map(n => n.id).sort()
      const syncMeta = {
        lastSyncTime: Date.now(),
        noteCount: notesStore.notes.length,
        appVersion: '1.0.0-web',
        syncedNoteIds: allNoteIds,
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

      // Build the remote attachment index ONCE and reuse it for both upload and
      // download skip checks (Android builds it once in loadRemoteAttachmentIndex).
      // Only skip the whole attachment pass when no note references any attachment —
      // then there is nothing to push/pull and we save the three PROPFIND index
      // requests against the (slow) proxy. When attachments ARE referenced we still
      // run the pass, but uploadAttachments/syncAttachments skip transfers by
      // comparing file size (Android parity), so unchanged attachments cost nothing.
      const referencedAttachments = new Set()
      for (const n of notesStore.notes) {
        for (const fn of getAllAttachmentFileNames(n)) referencedAttachments.add(fn)
      }

      if (referencedAttachments.size > 0) {
        const attachmentIndex = await buildRemoteAttachmentIndex(client)
        await uploadAttachments(client, notesStore.notes, attachmentIndex)
        await syncAttachments(client, notesStore.notes.filter(n => n.folder !== 'DELETED'), attachmentIndex)
      }

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
      await ensureDirsOnce(client)
      const localNotes = notesStore.notes

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
        if (tombstones.value.includes(note.id)) continue
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

      const localIds = new Set(localNotes.filter(n => !tombstones.value.includes(n.id)).map(n => n.id))
      for (const [id, fileNames] of remoteNoteIdToFileNames) {
        if (!localIds.has(id)) {
          for (const name of fileNames) {
            await client.delete(`memoX/notes/${name}`)
          }
        }
      }

      await cleanupAttachments(client)

      const activeNoteIds = localNotes.filter(n => !tombstones.value.includes(n.id)).map(n => n.id).sort()
      const syncMeta = {
        lastSyncTime: Date.now(),
        noteCount: activeNoteIds.length,
        appVersion: '1.0.0-web',
        syncedNoteIds: activeNoteIds,
        deletedNoteIds: tombstones.value,
      }
      await client.upload('memoX/sync_meta.json', new TextEncoder().encode(JSON.stringify(syncMeta, null, 2)).buffer)

      const labelsJson = JSON.stringify({ labels: notesStore.allLabels, hiddenLabels: hiddenLabels.value }, null, 2)
      await client.upload('memoX/labels.json', new TextEncoder().encode(labelsJson).buffer)

      const attachUploaded = await uploadAttachments(client, localNotes)

      lastSyncTime.value = Date.now()
      await putSetting('lastSyncTime', lastSyncTime.value)
      syncStatus.value = 'success'
      syncMessage.value = `上传完成：${uploaded} 条笔记${attachUploaded > 0 ? '，' + attachUploaded + ' 个附件' : ''}`
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
      await ensureDirsOnce(client)
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

      const imgCount = await syncAttachments(client, newNotes.filter(n => n.folder !== 'DELETED'))

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

  async function addPendingAttachmentCleanup(names) {
    if (!names || !names.length) return
    const merged = Array.from(new Set([...pendingAttachmentCleanup.value, ...names]))
    pendingAttachmentCleanup.value = merged
    await putSetting('pendingAttachmentCleanup', merged)
  }

  // Remove attachment files from the remote store that are no longer referenced by
  // any active (non-deleted) local note. Skips files still used by other notes so a
  // shared attachment is never deleted prematurely. Retries on the next sync if the
  // remote delete fails (the pending list is only cleared after a successful attempt).
  async function cleanupAttachments(client) {
    if (!pendingAttachmentCleanup.value.length) return
    const pending = [...pendingAttachmentCleanup.value]

    const notesStore = useNotesStore()
    const referenced = new Set()
    for (const n of notesStore.notes) {
      for (const fn of getAllAttachmentFileNames(n)) referenced.add(fn)
    }

    const dirs = ['memoX/attachments/images/', 'memoX/attachments/audios/', 'memoX/attachments/files/']
    for (const name of pending) {
      if (referenced.has(name)) continue
      for (const dir of dirs) {
        try {
          await client.delete(`${dir}${name}`)
        } catch {}
      }
    }

    pendingAttachmentCleanup.value = []
    await putSetting('pendingAttachmentCleanup', [])
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
    scheduleAutoSync()
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
    addPendingAttachmentCleanup,
    getImageUrl,
    syncAttachments,
    autoSync,
    scheduleAutoSync,
    toggleLabelVisibility,
    isLabelHidden,
    saveLockOnStartup,
    getClient,
  }
})
