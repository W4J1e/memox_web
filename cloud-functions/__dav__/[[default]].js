import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const MAX_REDIRECTS = 5

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url',
  'Access-Control-Max-Age': '86400',
}

function makeRequest(requestUrl, options, bodyBuffer, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects'))
      return
    }
    let parsedUrl
    try { parsedUrl = new URL(requestUrl) } catch (e) { reject(e); return }

    const client = parsedUrl.protocol === 'https:' ? https : http
    const headers = { ...options.headers }
    delete headers.host
    delete headers.origin
    delete headers.referer
    if (bodyBuffer && bodyBuffer.length > 0) headers['Content-Length'] = bodyBuffer.length

    const req = client.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method,
      headers,
      rejectUnauthorized: false,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location
        if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, requestUrl).toString()
        res.resume()
        const newMethod = res.statusCode === 303 ? 'GET' : options.method
        const newBody = (newMethod === 'GET' || newMethod === 'HEAD') ? null : bodyBuffer
        makeRequest(redirectUrl, { method: newMethod, headers: options.headers }, newBody, redirectCount + 1)
          .then(resolve).catch(reject)
        return
      }
      resolve(res)
    })
    req.on('error', reject)
    if (bodyBuffer && bodyBuffer.length > 0) req.write(bodyBuffer)
    req.end()
  })
}

function bufferStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export async function onRequest(context) {
  const { request } = context

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const targetUrl = request.headers.get('x-webdav-url')
  if (!targetUrl) {
    return new Response('Missing X-WebDAV-Url header', { status: 400, headers: CORS_HEADERS })
  }

  const targetBase = String(targetUrl).replace(/\/+$/, '')
  const url = new URL(request.url)
  const pathSuffix = url.pathname.replace(/^\/__dav__\/?/, '')
  const fullUrl = pathSuffix ? `${targetBase}/${pathSuffix}` : `${targetBase}/`

  const headers = {}
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  const depth = request.headers.get('depth')
  if (depth !== null) headers['Depth'] = depth
  const destination = request.headers.get('destination')
  if (destination) headers['Destination'] = destination
  const contentType = request.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType

  let bodyBuffer = null
  if (!['GET', 'HEAD', 'DELETE', 'MKCOL'].includes(request.method)) {
    const bodyBuf = await request.arrayBuffer()
    bodyBuffer = Buffer.from(bodyBuf)
  }

  try {
    const proxyRes = await makeRequest(fullUrl, { method: request.method, headers }, bodyBuffer)
    const respHeaders = { ...proxyRes.headers, ...CORS_HEADERS }
    delete respHeaders['strict-transport-security']
    delete respHeaders['content-security-policy']
    delete respHeaders['transfer-encoding']

    const body = await bufferStream(proxyRes)
    return new Response(body, {
      status: proxyRes.statusCode || 500,
      headers: respHeaders,
    })
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 502, headers: CORS_HEADERS })
  }
}
