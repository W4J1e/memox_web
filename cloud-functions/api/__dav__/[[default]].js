// memoX WebDAV reverse proxy — EdgeOne Makers Cloud Function
//
// Deployed at /api/__dav__/* via cloud-functions/api/__dav__/[[default]].js.
//
// WHY under /api/ ?
//   EdgeOne Makers' docs only ever demonstrate dynamic ([id]) and catch-all
//   ([[default]]) routes beneath the `api/` directory (e.g.
//   cloud-functions/api/[[default]].js -> /api/*). A top-level catch-all like
//   cloud-functions/__dav__/[[default]].js is NOT shown in any example and was
//   not being recognized by the platform (requests returned 404 with no
//   function logs). Placing it under /api/ follows the documented, reliably
//   recognized routing pattern.
//
// The browser only ever talks to the SAME-ORIGIN path /api/__dav__/memoX/...
// (EdgeOne Makers runs on Tencent infrastructure, China-accessible), and this
// function forwards the request to the user's WebDAV server server-side.
// Because the WebDAV call happens on the server — not in the browser — there is
// NO CORS issue, and no external proxy (e.g. a Cloudflare Worker) is required.
//
// Why Cloud Functions (not Edge Functions)?
//   Edge Functions cap request body at 1 MB and CPU at 200 ms. WebDAV uploads
//   image/audio attachments that routinely exceed 1 MB, so Edge Functions would
//   silently break attachment sync. Cloud Functions allow a 6 MB body and up to
//   120 s duration — enough for photo attachments — while still being
//   same-origin (no CORS) and China-accessible.
//
// This path is the EdgeOne Makers equivalent of:
//   - dev:         vite.config.js middleware
//   - Vercel:      vercel.json rewrite + api/dav/[...path].js   (removed)
//   - Cloudflare:  worker.js                                      (kept for reference)
//
// The web client (src/utils/webdav-client.js) always sends WebDAV-specific methods
// (PROPFIND/MKCOL/...) as POST with an X-Method-Override header when in proxy mode,
// so a single onRequest() handles every call.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url, X-Method-Override',
  'Access-Control-Max-Age': '86400',
}

const MAX_REDIRECTS = 5

export async function onRequest(context) {
  const request = context.request

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // The target WebDAV server is passed by the client so a single function works
  // for every user regardless of their provider.
  const targetUrl = request.headers.get('x-webdav-url')
  if (!targetUrl) {
    return new Response('Missing X-WebDAV-Url header', { status: 400, headers: CORS })
  }

  const method = request.headers.get('x-method-override') || request.method
  const url = new URL(request.url)
  const pathAfter = url.pathname.replace(/^\/api\/__dav__\//, '')
  const targetBase = targetUrl.replace(/\/+$/, '')
  const fullUrl = pathAfter ? `${targetBase}/${pathAfter}${url.search}` : `${targetBase}${url.search}`

  const headers = {}
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  const depth = request.headers.get('depth')
  if (depth !== null) headers['Depth'] = depth
  const dest = request.headers.get('destination')
  if (dest) headers['Destination'] = dest
  const ct = request.headers.get('content-type')
  if (ct) headers['Content-Type'] = ct

  let body = undefined
  if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
    const buf = await request.arrayBuffer()
    if (buf && buf.byteLength > 0) body = buf
  }

  return proxyFetch(fullUrl, method, headers, body, 0)
}

async function proxyFetch(requestUrl, method, headers, body, redirects) {
  if (redirects > MAX_REDIRECTS) {
    return new Response('Too many redirects', { status: 502, headers: CORS })
  }

  try {
    const resp = await fetch(requestUrl, { method, headers, body, redirect: 'manual' })

    if ([301, 302, 303, 307, 308].includes(resp.status) && resp.headers.get('location')) {
      let location = resp.headers.get('location')
      if (!location.startsWith('http')) {
        location = new URL(location, requestUrl).toString()
      }
      const newMethod = resp.status === 303 ? 'GET' : method
      const newBody = (newMethod === 'GET' || newMethod === 'HEAD') ? undefined : body
      return proxyFetch(location, newMethod, headers, newBody, redirects + 1)
    }

    const respHeaders = new Headers(resp.headers)
    Object.entries(CORS).forEach(([k, v]) => respHeaders.set(k, v))
    respHeaders.delete('strict-transport-security')
    respHeaders.delete('content-security-policy')
    respHeaders.delete('transfer-encoding')

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    })
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 502, headers: CORS })
  }
}
