const DB_NAME = 'memox_db'
const DB_VERSION = 2

const STORES = {
  NOTES: 'notes',
  SETTINGS: 'settings',
  LABELS: 'labels',
  SYNC_META: 'sync_meta',
  ATTACHMENTS: 'attachments',
}

function deepToPlain(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (obj instanceof Blob) return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (seen.has(obj)) return obj
  seen.add(obj)
  const raw = obj.__v_raw ? obj.__v_raw : obj
  if (Array.isArray(raw)) {
    return raw.map(item => deepToPlain(item, seen))
  }
  const plain = {}
  for (const key of Object.keys(raw)) {
    if (key.startsWith('__v_')) continue
    plain[key] = deepToPlain(raw[key], seen)
  }
  return plain
}

let dbInstance = null
let dbPending = null

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (dbPending) return dbPending
  dbPending = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        db.createObjectStore(STORES.NOTES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.LABELS)) {
        db.createObjectStore(STORES.LABELS, { keyPath: 'value' })
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
        db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
        db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'fileName' })
      }
    }
    request.onsuccess = (e) => {
      const db = e.target.result
      db.onversionchange = () => {
        db.close()
        dbInstance = null
        dbPending = null
      }
      dbInstance = db
      dbPending = null
      resolve(db)
    }
    request.onerror = (e) => {
      dbPending = null
      reject(e.target.error)
    }
    request.onblocked = () => {
      dbPending = null
      reject(new Error('Database upgrade blocked, please close other tabs'))
    }
  })
  return dbPending
}

function txn(storeName, mode = 'readonly') {
  return openDB().then(db => {
    const tx = db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  })
}

// Notes
export async function getAllNotes() {
  const store = await txn(STORES.NOTES)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getNote(id) {
  const store = await txn(STORES.NOTES)
  return new Promise((resolve, reject) => {
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putNote(note) {
  const store = await txn(STORES.NOTES, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.put(deepToPlain(note))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putNotes(notes) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.NOTES, 'readwrite')
    const store = tx.objectStore(STORES.NOTES)
    for (const note of notes) {
      store.put(deepToPlain(note))
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteNote(id) {
  const store = await txn(STORES.NOTES, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clearNotes() {
  const store = await txn(STORES.NOTES, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Settings
export async function getSetting(key, defaultValue = null) {
  const store = await txn(STORES.SETTINGS)
  return new Promise((resolve, reject) => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result?.value ?? defaultValue)
    req.onerror = () => reject(req.error)
  })
}

export async function putSetting(key, value) {
  const store = await txn(STORES.SETTINGS, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value: deepToPlain(value) })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Labels
export async function getAllLabels() {
  const store = await txn(STORES.LABELS)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putLabel(label) {
  const store = await txn(STORES.LABELS, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.put(label)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function putLabels(labels) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.LABELS, 'readwrite')
    const store = tx.objectStore(STORES.LABELS)
    store.clear()
    for (const label of labels) {
      store.put(label)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteLabel(value) {
  const store = await txn(STORES.LABELS, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.delete(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Sync Meta
export async function getSyncMeta(key, defaultValue = null) {
  const store = await txn(STORES.SYNC_META)
  return new Promise((resolve, reject) => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result?.value ?? defaultValue)
    req.onerror = () => reject(req.error)
  })
}

export async function putSyncMeta(key, value) {
  const store = await txn(STORES.SYNC_META, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Attachments (images, files) - stored as Blobs keyed by fileName
export async function getAttachment(fileName) {
  const store = await txn(STORES.ATTACHMENTS)
  return new Promise((resolve, reject) => {
    const req = store.get(fileName)
    req.onsuccess = () => resolve(req.result?.blob || null)
    req.onerror = () => reject(req.error)
  })
}

export async function putAttachment(fileName, blob) {
  const store = await txn(STORES.ATTACHMENTS, 'readwrite')
  return new Promise((resolve, reject) => {
    const req = store.put({ fileName, blob })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function attachmentExists(fileName) {
  const store = await txn(STORES.ATTACHMENTS)
  return new Promise((resolve, reject) => {
    const req = store.get(fileName)
    req.onsuccess = () => resolve(!!req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllAttachmentNames() {
  const store = await txn(STORES.ATTACHMENTS)
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}
