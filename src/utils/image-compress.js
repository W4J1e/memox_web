// Client-side image compression entry point (main thread).
//
// Spawns a single module Web Worker that runs jSquash (WASM) off the UI thread.
// Only images larger than 1MB are compressed; smaller ones pass through untouched.
// If anything goes wrong the original File is returned, so callers never lose data.
//
// The worker decides the output format by *content* (alpha / colorfulness / sharpness),
// not by file extension — see workers/image-compress.worker.js.

const ONE_MB = 1024 * 1024

let _worker = null
let _seq = 0
const _pending = new Map()

function getWorker() {
  if (_worker) return _worker
  _worker = new Worker(new URL('../workers/image-compress.worker.js', import.meta.url), { type: 'module' })
  _worker.onmessage = (e) => {
    const { id, bytes, ext, mime, error } = e.data || {}
    const p = _pending.get(id)
    if (!p) return
    _pending.delete(id)
    if (error) p.reject(new Error(error))
    else p.resolve({ bytes, ext, mime })
  }
  _worker.onerror = (e) => {
    // Worker crashed — reject everything in flight and let the next call rebuild it.
    for (const [, p] of _pending) p.reject(e)
    _pending.clear()
    _worker = null
  }
  return _worker
}

function extOf(name) {
  const dot = String(name || '').lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const EXT_TO_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

function mimeOf(name, type) {
  if (type && EXT_TO_MIME[extOf(type)]) return type
  const ext = extOf(name)
  return EXT_TO_MIME[ext] || type || 'application/octet-stream'
}

function extOfMime(type) {
  return MIME_TO_EXT[type] || ''
}

/**
 * Compress an image file in a Web Worker.
 * @param {File|Blob} file
 * @returns {Promise<{blob: Blob, ext: string, mime: string}>}  ext/mime reflect the
 *   (possibly changed) output format. On skip or failure the ORIGINAL file + its
 *   extension/mime are returned unchanged.
 */
export async function compressImageFile(file) {
  const origExt = extOf(file.name) || extOfMime(file.type)
  const origMime = mimeOf(file.name, file.type)

  // Already small enough — Android's ImageCompressor behaviour: pass through.
  if (file.size <= ONE_MB) {
    return { blob: file, ext: origExt, mime: origMime }
  }

  let worker
  try {
    worker = getWorker()
  } catch {
    return { blob: file, ext: origExt, mime: origMime }
  }

  let buf
  try {
    buf = await file.arrayBuffer()
  } catch {
    return { blob: file, ext: origExt, mime: origMime }
  }

  let res
  try {
    res = await new Promise((resolve, reject) => {
      const id = ++_seq
      _pending.set(id, { resolve, reject })
      // Transfer the buffer so we don't copy megabytes on the main thread.
      worker.postMessage({ id, buf, name: file.name, mime: file.type }, [buf])
    })
  } catch {
    return { blob: file, ext: origExt, mime: origMime }
  }

  // Safety net: if compression didn't actually shrink it, keep the original.
  if (!res || !res.bytes || res.bytes.byteLength >= file.size) {
    return { blob: file, ext: origExt, mime: origMime }
  }

  return {
    blob: new Blob([res.bytes], { type: res.mime }),
    ext: res.ext || origExt,
    mime: res.mime || origMime,
  }
}

/** Replace a file name's extension, keeping the rest (incl. any Date prefix). */
export function withNewExt(name, ext) {
  const dot = String(name || '').lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return ext ? `${base}.${ext}` : base
}
