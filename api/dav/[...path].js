export const config = {
  runtime: 'edge',
}

export const maxDuration = 10

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url, X-Method-Override',
  'Access-Control-Max-Age': '86400',
}

const MAX_REDIRECTS = 5

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const targetUrl = request.headers.get('x-webdav-url')
  if (!targetUrl) {
    return new Response('Missing X-WebDAV-Url header', { status: 400, headers: CORS })
  }

  const method = request.headers.get('x-method-override') || request.method
  const url = new URL(request.url)
  const pathAfter = url.pathname.replace(/^\/api\/dav\//, '')
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
    body = await request.arrayBuffer()
    if (body.byteLength === 0) body = undefined
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
