// memoX WebDAV 反向代理 —— Cloudflare Worker
//
// 部署方式（二选一）：
//
// 【方式 A：网页 dashboard，最简单】
//   1. 登录 https://dash.cloudflare.com → Workers & Pages → Create Worker
//   2. 给 Worker 起个名字（如 memox-dav-proxy）→ Deploy
//   3. 点击 "Edit code"，把本文件全部内容粘贴进去覆盖 → Deploy
//   4. 复制 Worker 地址，形如 https://memox-dav-proxy.<你的子域>.workers.dev
//
// 【方式 B：wrangler CLI】
//   1. npm i -g wrangler && wrangler login
//   2. 在本项目根目录执行：wrangler deploy worker.js --name memox-dav-proxy --compatibility-date 2024-01-01
//
// 部署完成后，在 memoX Web 设置页：
//   - 服务器地址：填 WebDAV 服务器地址（如 https://dav.jianguoyun.com/dav/）
//   - 连接模式：选「代理模式」
//   - 代理地址：填 Worker 地址，末尾带 /，如 https://memox-dav-proxy.xxx.workers.dev/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': 'Authorization, Depth, Destination, Content-Type, X-WebDAV-Url, X-Method-Override',
  'Access-Control-Max-Age': '86400',
}

const MAX_REDIRECTS = 5

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const targetUrl = request.headers.get('x-webdav-url')
    if (!targetUrl) {
      return new Response('Missing X-WebDAV-Url header', { status: 400, headers: CORS })
    }

    const method = request.headers.get('x-method-override') || request.method
    const url = new URL(request.url)
    // Worker 部署在自己的域名下，请求路径就是 /memoX/... 这种形式
    const pathAfter = url.pathname.replace(/^\/+/, '')
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
  },
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
