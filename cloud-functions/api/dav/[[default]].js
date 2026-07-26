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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url, X-Method-Override, X-DAV-Method',
  'Access-Control-Max-Age': '86400',
}

// Headers that must NOT be forwarded back to the browser as-is.
//   - transfer-encoding / content-encoding / content-length / content-range:
//     undici's fetch() auto-decompresses gzip/br responses, so `upstream.arrayBuffer()`
//     already returns the DECODED bytes. Forwarding the original Content-Encoding
//     header would make the browser try to gunzip plaintext -> ERR_CONTENT_DECODING_FAILED.
//     Stripping these lets Express recompute the correct length and the browser treats
//     the body as raw (transparent proxy, same as the local vite dev middleware).
const SKIP_HEADERS = new Set([
  'strict-transport-security',
  'content-security-policy',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'content-range',
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
    const pathOnly = qIdx >= 0 ? fullReqUrl.slice(0, qIdx) : fullReqUrl
    const queryStr = qIdx >= 0 ? fullReqUrl.slice(qIdx) : ''
    const webdavPath = pathOnly.replace(/^\/api\/dav\/?/, '')
    const targetBase = String(targetUrl).replace(/\/+$/, '')
    const fullUrl = webdavPath
      ? `${targetBase}/${webdavPath}${queryStr}`
      : `${targetBase}${queryStr}`

    // Forward relevant WebDAV headers
    const headers = {}
    const auth = req.get('authorization')
    if (auth) headers['Authorization'] = auth
    const depth = req.get('depth')
    if (depth !== undefined) headers['Depth'] = depth
    const dest = req.get('destination')
    if (dest) headers['Destination'] = dest
    const ct = req.get('content-type')
    if (ct) headers['Content-Type'] = ct

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

    upstream.headers.forEach((v, k) => {
      if (!SKIP_HEADERS.has(k.toLowerCase())) res.setHeader(k, v)
    })

    const buf = Buffer.from(await upstream.arrayBuffer())
    res.status(upstream.status).send(buf)
  } catch (err) {
    res.status(502).send('Proxy error: ' + err.message)
  }
})

async function proxyFetch(requestUrl, method, headers, body, redirects) {
  if (redirects > MAX_REDIRECTS) throw new Error('Too many redirects')
  const resp = await fetch(requestUrl, { method, headers, body, redirect: 'manual' })
  if (
    [301, 302, 303, 307, 308].includes(resp.status) &&
    resp.headers.get('location')
  ) {
    let loc = resp.headers.get('location')
    if (!loc.startsWith('http')) loc = new URL(loc, requestUrl).toString()
    const newMethod = resp.status === 303 ? 'GET' : method
    const newBody = ['GET', 'HEAD'].includes(newMethod) ? undefined : body
    return proxyFetch(loc, newMethod, headers, newBody, redirects + 1)
  }
  return resp
}

export default app