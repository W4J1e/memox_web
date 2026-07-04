// Parse a JSON string field that may be double-serialized (Android Room format)
function parseJsonField(val) {
  if (val == null) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') return [parsed]
      return []
    } catch {
      return []
    }
  }
  if (typeof val === 'object') return [val]
  return []
}

export function noteToJson(note) {
  // Match Android's double-serialized format for compatibility
  return JSON.stringify({
    id: note.id,
    type: note.type,
    folder: note.folder,
    color: note.color,
    title: note.title,
    pinned: note.pinned,
    timestamp: note.timestamp,
    modifiedTimestamp: note.modifiedTimestamp,
    labels: JSON.stringify(note.labels || []),
    body: note.body || '',
    spans: JSON.stringify(note.spans || []),
    items: JSON.stringify(note.items || []),
    images: JSON.stringify(note.images || []),
    files: JSON.stringify(note.files || []),
    audios: JSON.stringify(note.audios || []),
    reminders: JSON.stringify(note.reminders || []),
    viewMode: note.viewMode || 'EDIT',
    isPinnedToStatus: note.isPinnedToStatus || false,
    locked: note.locked || false,
  })
}

export function jsonToNote(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json
  return {
    id: obj.id,
    type: obj.type || 'NOTE',
    folder: obj.folder || 'NOTES',
    color: obj.color || 'DEFAULT',
    title: obj.title || '',
    pinned: obj.pinned || false,
    timestamp: obj.timestamp || Date.now(),
    modifiedTimestamp: obj.modifiedTimestamp || obj.timestamp || Date.now(),
    labels: parseJsonField(obj.labels),
    body: obj.body || '',
    spans: parseJsonField(obj.spans),
    items: parseJsonField(obj.items),
    images: parseJsonField(obj.images),
    files: parseJsonField(obj.files),
    audios: parseJsonField(obj.audios),
    reminders: parseJsonField(obj.reminders),
    viewMode: obj.viewMode || 'EDIT',
    isPinnedToStatus: obj.isPinnedToStatus || false,
    locked: obj.locked || false,
  }
}

export function extractNoteId(fileName) {
  if (!fileName.endsWith('.json')) return null
  const name = fileName.replace('.json', '')
  const asNum = Number(name)
  if (!isNaN(asNum) && Number.isInteger(asNum)) return asNum
  const lastUnderscore = name.lastIndexOf('_')
  if (lastUnderscore > 0) {
    const id = Number(name.substring(lastUnderscore + 1))
    if (!isNaN(id) && Number.isInteger(id)) return id
  }
  return null
}

export function noteFileName(note) {
  const safeTitle = note.title.trim().replace(/[/\\:*?"<>|\n\r]/g, '_').substring(0, 50).replace(/_+$/, '').trim()
  return safeTitle ? `${safeTitle}_${note.id}.json` : `${note.id}.json`
}

export function generateId() {
  return Date.now()
}

export function createEmptyNote(id) {
  return {
    id: id || generateId(),
    type: 'NOTE',
    folder: 'NOTES',
    color: 'DEFAULT',
    title: '',
    pinned: false,
    timestamp: Date.now(),
    modifiedTimestamp: Date.now(),
    labels: [],
    body: '',
    spans: [],
    items: [],
    images: [],
    files: [],
    audios: [],
    reminders: [],
    viewMode: 'EDIT',
    isPinnedToStatus: false,
    locked: false,
  }
}

export function createEmptyListItem() {
  return { body: '', checked: false, isChild: false, order: 0, checkedTimestamp: null }
}

export const NOTE_COLORS = {
  DEFAULT: '',
  CORAL: '#FF8A80',
  MANDARIN: '#FFD180',
  BANANA: '#FFFF8D',
  SAGE: '#B9F6CA',
  MINT: '#84FFFF',
  DUCK_EGG: '#80D8FF',
  CLAM_SHELL: '#FF80AB',
  LAVENDER: '#B388FF',
  COCOA: '#D7CCC8',
  SMOKE: '#CFD8DC',
}

export const COLOR_NAMES = {
  DEFAULT: '默认',
  CORAL: '珊瑚',
  MANDARIN: '橘黄',
  BANANA: '香蕉',
  SAGE: '鼠尾草',
  MINT: '薄荷',
  DUCK_EGG: '鸭蛋青',
  CLAM_SHELL: '蛤壳粉',
  LAVENDER: '薰衣草',
  COCOA: '可可',
  SMOKE: '烟灰',
}

export function formatDate(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `今天 ${time}`
  if (isYesterday) return `昨天 ${time}`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + time
}

export function sanitizeBody(text) {
  if (!text) return ''
  return text
    .replace(/\uFFFC/g, '')
    .replace(/\[object Object\]/g, '')
}

export function getNotePreview(note) {
  if (note.locked) return '🔒 内容已锁定'
  let preview = ''
  if (note.type === 'LIST' && note.items && note.items.length > 0) {
    preview = note.items.map(i => (i.checked ? '✓ ' : '○ ') + sanitizeBody(i.body)).join('\n')
  } else {
    preview = sanitizeBody(note.body || '')
  }
  if (note.images && note.images.length > 0) {
    preview = preview ? preview + ' 🖼️' : '🖼️ ' + note.images.length + ' 张图片'
  }
  return preview
}

export function getImageFileName(img) {
  if (!img) return null
  if (typeof img === 'string') {
    const parts = img.split('/')
    return parts[parts.length - 1] || img
  }
  const raw = img && typeof img === 'object' && !Array.isArray(img)
    ? (toRaw(img) || img)
    : img
  const keys = ['localName', 'fileName', 'filename', 'name', 'originalName', 'path', 'uri', 'localPath', 'local_path', 'filePath', 'file_path', 'imagePath', 'image_path', 'file', 'imageUri', 'image_uri', 'src']
  for (const key of keys) {
    if (raw[key] && typeof raw[key] === 'string') {
      const val = raw[key].split('?')[0].split('#')[0]
      const parts = val.split('/')
      const candidate = parts[parts.length - 1]
      if (candidate && candidate.length > 1) return candidate
      if (val.length > 1) return val
    }
  }
  if (raw.id && typeof raw.id === 'string') {
    return raw.id
  }
  return null
}

function toRaw(obj) {
  if (obj.__v_raw) return toRaw(obj.__v_raw)
  return obj
}

export function getAllImageFileNames(note) {
  const names = new Set()
  if (note.images && Array.isArray(note.images)) {
    for (const img of note.images) {
      const fn = getImageFileName(img)
      if (fn) names.add(fn)
    }
  }
  if (note.files && Array.isArray(note.files)) {
    for (const f of note.files) {
      const fn = getImageFileName(f)
      if (fn) {
        const lower = fn.toLowerCase()
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.bmp')) {
          names.add(fn)
        }
      }
    }
  }
  return Array.from(names)
}

export function getNoteColorStyle(color) {
  if (!color || color === 'DEFAULT') return {}
  return { backgroundColor: color + '30', borderColor: color + '50' }
}
