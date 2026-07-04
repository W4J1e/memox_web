import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import http from 'http'
import https from 'https'
import { URL } from 'url'

const MAX_REDIRECTS = 5

function bufferBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function makeRequest(requestUrl, options, bodyBuffer, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects'))
      return
    }

    let parsedUrl
    try {
      parsedUrl = new URL(requestUrl)
    } catch (e) {
      reject(e)
      return
    }

    const client = parsedUrl.protocol === 'https:' ? https : http
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method,
      headers: { ...options.headers },
      rejectUnauthorized: false,
    }

    delete reqOptions.headers.host
    delete reqOptions.headers.origin
    delete reqOptions.headers.referer

    if (bodyBuffer && bodyBuffer.length > 0) {
      reqOptions.headers['Content-Length'] = bodyBuffer.length
    }

    const proxyReq = client.request(reqOptions, (proxyRes) => {
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, requestUrl).toString()
        }
        proxyRes.resume()
        const newMethod = (proxyRes.statusCode === 303) ? 'GET' : reqOptions.method
        const newBody = (newMethod === 'GET' || newMethod === 'HEAD') ? null : bodyBuffer
        makeRequest(redirectUrl, { method: newMethod, headers: options.headers }, newBody, redirectCount + 1)
          .then(resolve)
          .catch(reject)
        return
      }

      resolve(proxyRes)
    })

    proxyReq.on('error', reject)

    if (bodyBuffer && bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer)
    }
    proxyReq.end()
  })
}

async function webdavProxyMiddleware(req, res, next) {
  if (!req.url.startsWith('/__dav__/')) return next()

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, PROPFIND, MKCOL, OPTIONS, HEAD')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Depth, Content-Type, X-WebDAV-Url')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const targetUrl = req.headers['x-webdav-url']
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing X-WebDAV-Url header')
    return
  }

  const targetBase = String(targetUrl).replace(/\/+$/, '')
  const pathSuffix = req.url.replace(/^\/__dav__\//, '')
  const fullUrl = `${targetBase}/${pathSuffix}`

  const headers = {}
  if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization']
  if (req.headers['depth'] !== undefined) headers['Depth'] = req.headers['depth']
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']

  let bodyBuffer = null
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE' && req.method !== 'MKCOL') {
    bodyBuffer = await bufferBody(req)
  }

  try {
    const proxyRes = await makeRequest(fullUrl, { method: req.method, headers }, bodyBuffer)
    const respHeaders = { ...proxyRes.headers }
    respHeaders['Access-Control-Allow-Origin'] = '*'
    respHeaders['Access-Control-Allow-Methods'] = 'GET, PUT, DELETE, PROPFIND, MKCOL, OPTIONS, HEAD'
    respHeaders['Access-Control-Allow-Headers'] = 'Authorization, Depth, Content-Type, X-WebDAV-Url'
    delete respHeaders['strict-transport-security']
    delete respHeaders['content-security-policy']
    res.writeHead(proxyRes.statusCode || 500, respHeaders)
    proxyRes.pipe(res)
  } catch (err) {
    console.error('WebDAV proxy error:', err.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Proxy error: ' + err.message)
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'webdav-proxy',
      configureServer(server) {
        server.middlewares.use(webdavProxyMiddleware)
      },
    },
  ],
  server: {
    port: 3000,
  },
})
