// Image compressor Web Worker (runs jSquash / WASM off the UI thread).
//
// Behaviour mirrors memoX Android's ImageCompressor:
//  - Only images larger than 1MB are touched; smaller ones are returned as-is
//    by the caller (src/utils/image-compress.js) BEFORE reaching this worker.
//  - Output format is chosen by *content*, not extension:
//      * has alpha OR low-colour / sharp line-art  -> lossless WebP
//        (fallback to oxipng-optimised PNG if WebP encode fails)
//      * photo (smooth gradients, many colours)     -> MozJPEG q91, original resolution
//  - If the encoded result is still > 1MB, the longest edge is stepped down
//    (2400 -> 2000 -> 1600) as a last resort.
//  - The caller keeps the original if compression does not actually shrink it.

import { decode as decodeJpeg, encode as encodeJpeg } from '@jsquash/jpeg'
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp'
import { decode as decodePng } from '@jsquash/png'
import { optimise as optimisePng } from '@jsquash/oxipng'
import resize from '@jsquash/resize'

const ONE_MB = 1024 * 1024

function detectFormat(bytes) {
  if (!bytes || bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp'
  return null
}

// Classify by sampling pixels: alpha presence, colour count, and horizontal sharpness.
function classify(raw) {
  const { data, width, height } = raw
  const total = width * height
  const step = Math.max(1, Math.floor(total / 20000)) // ~20k samples
  let alphaCount = 0
  const colorSet = new Set()
  let sharpSum = 0
  let prevLum = -1
  let sampled = 0
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 255) alphaCount++
    // Quantise to 4 bits/channel so near-identical colours collapse.
    colorSet.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) | 0
    if (prevLum >= 0) sharpSum += Math.abs(lum - prevLum)
    prevLum = lum
    sampled++
  }
  const hasAlpha = alphaCount > 0
  const uniqueColors = colorSet.size
  const avgSharp = sharpSum / Math.max(1, sampled - 1)
  const isFlat = uniqueColors <= 32 // screenshots / solid diagrams
  const isLineArt = uniqueColors <= 96 && avgSharp > 35 // many-colour but sharp edges
  return { hasAlpha, useWebp: hasAlpha || isFlat || isLineArt }
}

async function resizeLongest(raw, longEdge) {
  const { width, height } = raw
  const longest = Math.max(width, height)
  if (longest <= longEdge) return raw
  const scale = longEdge / longest
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  return resize(raw, { width: w, height: h })
}

// Encode to the chosen target format, with WebP -> PNG fallback on failure.
async function encodeTarget(raw, cls) {
  if (cls.useWebp) {
    try {
      return { bytes: await encodeWebp(raw, { lossless: 1 }), ext: 'webp', mime: 'image/webp' }
    } catch {
      return { bytes: await optimisePng(raw), ext: 'png', mime: 'image/png' }
    }
  }
  return { bytes: await encodeJpeg(raw, { quality: 91 }), ext: 'jpg', mime: 'image/jpeg' }
}

async function compress(uint8, name) {
  const fmt = detectFormat(uint8)
  if (fmt !== 'jpeg' && fmt !== 'png' && fmt !== 'webp') {
    throw new Error('unsupported image format')
  }
  const raw = fmt === 'jpeg'
    ? await decodeJpeg(uint8)
    : fmt === 'png'
      ? await decodePng(uint8)
      : await decodeWebp(uint8)

  const cls = classify(raw)
  let best = await encodeTarget(raw, cls)

  if (best.bytes.byteLength > ONE_MB) {
    let cur = raw
    for (const longEdge of [2400, 2000, 1600]) {
      cur = await resizeLongest(cur, longEdge)
      const candidate = await encodeTarget(cur, cls)
      best = candidate
      if (candidate.bytes.byteLength <= ONE_MB) break
    }
  }

  return best // { bytes: ArrayBuffer, ext, mime }
}

self.onmessage = async (e) => {
  const { id, buf, name } = e.data || {}
  try {
    const result = await compress(new Uint8Array(buf), name)
    // Transfer the encoded ArrayBuffer back (no copy).
    self.postMessage({ id, bytes: result.bytes, ext: result.ext, mime: result.mime }, [result.bytes])
  } catch (err) {
    self.postMessage({ id, error: err && err.message ? err.message : String(err) })
  }
}
