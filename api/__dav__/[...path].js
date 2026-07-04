import http from 'http'
import https from 'https'
import { URL } from 'url'

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  maxDuration: 10,
}

const MAX_REDIRECTS = 5

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url, X-Method-Override',
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

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const targetUrl = req.headers['x-webdav-url']
  if (!targetUrl) {
    res.status(400).send('Missing X-WebDAV-Url header')
    return
  }

  // Tunnel non-standard methods via X-Method-Override
  const actualMethod = req.headers['x-method-override'] || req.method

  const targetBase = String(targetUrl).replace(/\/+$/, '')
  const pathSegments = req.query.path
  const pathSuffix = Array.isArray(pathSegments) ? pathSegments.join('/') : (pathSegments || '')
  const fullUrl = pathSuffix ? `${targetBase}/${pathSuffix}` : `${targetBase}/`

  const headers = {}
  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization']
  if (req.headers['depth'] !== undefined) headers['Depth'] = req.headers['depth']
  if (req.headers['destination']) headers['Destination'] = req.headers['destination']
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']

  let bodyBuffer = null
  if (!['GET', 'HEAD', 'DELETE'].includes(actualMethod)) {
    bodyBuffer = await bufferStream(req)
  }

  try {
    const proxyRes = await makeRequest(fullUrl, { method: actualMethod, headers }, bodyBuffer)
    const respHeaders = { ...proxyRes.headers, ...CORS_HEADERS }
    delete respHeaders['strict-transport-security']
    delete respHeaders['content-security-policy']
    delete respHeaders['transfer-encoding']
    res.writeHead(proxyRes.statusCode || 500, respHeaders)
    proxyRes.pipe(res)
  } catch (err) {
    console.error('WebDAV proxy error:', err.message)
    if (!res.headersSent) {
      res.status(502).send('Proxy error: ' + err.message)
    }
  }
}
