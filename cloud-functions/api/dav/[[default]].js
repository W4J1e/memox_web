// memoX WebDAV reverse proxy — EdgeOne Makers Cloud Function (Express framework mode)
//
// Route: /api/dav/*  (cloud-functions/api/dav/[[default]].js)
//
// Why this exact shape (after two prior 404 + zero-log failures):
//   1. Path renamed from __dav__ to dav. Double-underscore names appear to be
//      reserved/bypassed by EdgeOne's router — both prior attempts with
//      __dav__ produced 404 with zero function logs in the dashboard.
//   2. Catch-all ([[default]].js) in EdgeOne Makers is ONLY documented under
//      "framework mode" (Express/Koa) with `export default app`. Handler-mode
//      catch-all is not documented and was not being registered. This file
//      uses Express framework mode, the ONLY pattern the docs demonstrate for
//      catch-all routes.
//   3. The function lives under /api/, matching the canonical documented
//      location for dynamic/catch-all routes.
//
// The browser talks same-origin to /api/dav/memoX/...; this Express app
// forwards to the user's WebDAV server, so there is no CORS issue and no
// external proxy (e.g. Cloudflare Worker) is required.
//
// Cloud Functions are used (not Edge Functions) because WebDAV uploads
// image/audio attachments that routinely exceed Edge's 1 MB body cap.
// Cloud Functions allow 6 MB / 120 s — enough for photo attachments.
//
// This path is the EdgeOne Makers equivalent of:
//   - dev:         vite.config.js middleware
//   - Vercel:      api/dav/[...path].js                       (removed)
//   - Cloudflare:  worker.js                                  (kept for reference)

import express from 'express'
import { Readable } from 'node:stream'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url, X-Method-Override, X-DAV-Method',
  'Access-Control-Max-Age': '86400',
}

// Headers that must NEVER be forwarded back to the browser as-is.
//   - content-encoding: undici's fetch() auto-decompresses gzip/br responses,
//     so the bytes we stream back are already DECODED. Forwarding the original
//     Content-Encoding header would make the browser try to gunzip plaintext
//     -> ERR_CONTENT_DECODING_FAILED. We strip it and stream raw bytes
//     (transparent proxy, same behaviour as the local vite dev middleware).
//   - transfer-encoding / connection / keep-alive: hop-by-hop, managed by Express.
//   - content-length / content-range / accept-ranges: we STREAM the body, so we
//     drop these for full (200/207) responses and let Express use chunked
//     transfer. For 206 Partial Content we KEEP Content-Range so the client can
//     assemble range downloads, but still drop Content-Length (Express chunks).
const SKIP_HEADERS = new Set([
  'strict-transport-security',
  'content-security-policy',
  'transfer-encoding',
  'content-encoding',
  'connection',
  'keep-alive',
])

const MAX_REDIRECTS = 5

const app = express()

// CORS + preflight, applied to every request
app.use((req, res, next) => {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v)
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Catch-all WebDAV proxy (terminal middleware — always sends a response)
app.use(async (req, res) => {
  try {
    const targetUrl = req.get('x-webdav-url')
    if (!targetUrl) return res.status(400).send('Missing X-WebDAV-Url header')

    // Restore the real WebDAV method. We accept our custom X-DAV-Method header
    // (EdgeOne's CDN/WAF strips the well-known X-Method-Override for security),
    // and fall back to X-Method-Override for backward compatibility.
    const method = req.get('x-dav-method') || req.get('x-method-override') || req.method

    // Reconstruct the upstream WebDAV URL from the original request URL,
    // stripping the /api/dav/ proxy prefix. req.originalUrl always holds the
    // full request URL (incl. query string), regardless of mount point.
    const fullReqUrl = req.originalUrl || req.url
    const qIdx = fullReqUrl.indexOf('?')
    const pathOnlyRaw = qIdx >= 0 ? fullReqUrl.slice(0, qIdx) : fullReqUrl
    // Strip the client's path-fragment cache-bust segment (/.cb/<token>/). The
    // browser injects a unique /.cb/<token>/ right before the file leaf on every
    // attachment GET so the edge CDN (whose cache key is the path, not the query)
    // never serves a stale cached partial. WebDAV must receive the clean path or
    // it 404s on the unknown segment. The regex removes every /.cb/<token>/ chunk
    // anywhere in the path, leaving the real object path intact.
    const pathOnly = pathOnlyRaw.replace(/\/\.cb\/[^/]+\/?/g, '')
    let queryStr = qIdx >= 0 ? fullReqUrl.slice(qIdx) : ''
    // Legacy ?cb= query busting — kept for backward compatibility with older
    // client builds that still append the token as a query string.
    if (queryStr) {
      try {
        const u = new URL('http://localhost' + queryStr)
        if (u.searchParams.has('cb')) {
          u.searchParams.delete('cb')
          queryStr = u.search
        }
      } catch {}
    }
    const webdavPath = pathOnly.replace(/^\/api\/dav\/?/, '')
    const targetBase = String(targetUrl).replace(/\/+$/, '')
    const fullUrl = webdavPath
      ? `${targetBase}/${webdavPath}${queryStr}`
      : `${targetBase}${queryStr}`

    // Forward relevant WebDAV headers (incl. Range for resumable downloads)
    const headers = {}
    const auth = req.get('authorization')
    if (auth) headers['Authorization'] = auth
    const depth = req.get('depth')
    if (depth !== undefined) headers['Depth'] = depth
    const dest = req.get('destination')
    if (dest) headers['Destination'] = dest
    const ct = req.get('content-type')
    if (ct) headers['Content-Type'] = ct
    const range = req.get('range')
    if (range) headers['Range'] = range

    // Buffer the raw request body (binary attachments — must NOT be parsed).
    // No body-parser middleware is registered, so req is the raw stream.
    let body
    if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
      const chunks = []
      await new Promise((resolve, reject) => {
        req.on('data', (c) => chunks.push(c))
        req.on('end', resolve)
        req.on('error', reject)
      })
      const buf = Buffer.concat(chunks)
      if (buf.length > 0) body = buf
    }

    const upstream = await proxyFetch(fullUrl, method, headers, body, 0)

    // Decide which hop-by-hop / decode-related headers to drop.
    const skip = new Set(SKIP_HEADERS)
    skip.add('content-length')
    if (upstream.status !== 206) {
      skip.add('content-range')
      skip.add('accept-ranges')
    }
    // For HEAD we still want Content-Length so the client can learn file size.
    if (method === 'HEAD') skip.delete('content-length')
    upstream.headers.forEach((v, k) => {
      if (!skip.has(k.toLowerCase())) res.setHeader(k, v)
    })

    // Immutable attachments (images/audios/files) are content-addressed by UUID
    // and never change, BUT we deliberately do NOT cache them at the edge. Edge
    // caching of partial (206) bodies or truncated streams gets served to later
    // requests and corrupts reassembled images ("top half renders, bottom half
    // gray"), and a shared edge cache risks cross-user leakage. no-store keeps
    // every byte fresh from the origin; the client already skips unchanged
    // attachments by size, so caching buys no real speed. Accept-Ranges lets the
    // client resume large downloads.
    if ((method === 'GET' || method === 'HEAD') && /\/attachments\//.test(webdavPath)) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Accept-Ranges', 'bytes')
    }

    res.status(upstream.status)

    // Stream the (already-decompressed) upstream body back to the browser.
    // Streaming keeps the connection alive and avoids buffering huge binaries
    // in memory (a 70 MB image previously blew the function's memory and hit
    // the gateway idle timeout -> 504). Range/partial responses stream the same way.
    if (!upstream.body) { res.end(); return }
    const nodeStream = Readable.fromWeb(upstream.body)
    nodeStream.on('error', () => { try { res.destroy() } catch {} })
    nodeStream.pipe(res)
  } catch (err) {
    res.status(502).send('Proxy error: ' + err.message)
  }
})

async function proxyFetch(requestUrl, method, headers, body, redirects, attempt = 0) {
  if (redirects > MAX_REDIRECTS) throw new Error('Too many redirects')

  // EdgeOne -> TeraCloud egress is INTERMITTENT: connections randomly time out
  // with "fetch failed" (verified live — sometimes a request reaches TeraCloud
  // in ~2s, often it hangs ~11s and throws). WebDAV sync ops are idempotent, so
  // retrying a failed attempt almost always succeeds on a later try. We bound
  // each attempt with an abort timer so a hung socket fails fast instead of
  // blocking the whole sync, then retry with a short backoff.
  const MAX_RETRIES = 3
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)

  let resp
  try {
    resp = await fetch(requestUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    // Network-level failure (DNS/connect/TLS/timeout/abort). Nothing was sent,
    // so retrying is always safe.
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
      return proxyFetch(requestUrl, method, headers, body, redirects, attempt + 1)
    }
    throw new Error(`Upstream fetch failed after ${MAX_RETRIES + 1} attempts: ${err.message}`)
  }
  clearTimeout(timer)

  // Transient upstream gateway errors (the upstream itself returned 5xx) — retry
  // only for idempotent WebDAV methods so we never double-apply a non-idempotent op.
  if ([502, 503, 504].includes(resp.status) &&
      ['GET', 'HEAD', 'PUT', 'DELETE', 'PROPFIND', 'MKCOL'].includes(method)) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
      return proxyFetch(requestUrl, method, headers, body, redirects, attempt + 1)
    }
  }

  if (
    [301, 302, 303, 307, 308].includes(resp.status) &&
    resp.headers.get('location')
  ) {
    let loc = resp.headers.get('location')
    if (!loc.startsWith('http')) loc = new URL(loc, requestUrl).toString()
    const newMethod = resp.status === 303 ? 'GET' : method
    const newBody = ['GET', 'HEAD'].includes(newMethod) ? undefined : body
    return proxyFetch(loc, newMethod, headers, newBody, redirects + 1, attempt)
  }
  return resp
}

export default app