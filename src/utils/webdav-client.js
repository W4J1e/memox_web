const PROXY_PATH = '/api/dav/'

function normalizeWebdavPath(path) {
  if (!path) return ''
  let p = path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!p) return ''
  const last = p.split('/').pop()
  if (!last.includes('.')) {
    return p + '/'
  }
  return p
}

// Inject a unique cache-bust segment right before the file leaf, e.g.
//   memoX/attachments/images/x.jpg
//     -> memoX/attachments/images/.cb/<token>/x.jpg
// The token changes every call so the CDN (whose cache key is the request PATH,
// not the query string) always treats the request as a fresh MISS. The proxy
// strips the /.cb/<token>/ segment before forwarding to WebDAV.
function injectCacheBust(path, token) {
  const norm = String(path).replace(/^\/+/, '').replace(/\/+$/, '')
  const sep = norm.lastIndexOf('/')
  if (sep < 0) return '.cb/' + token + '/' + norm
  return norm.slice(0, sep + 1) + '.cb/' + token + '/' + norm.slice(sep + 1)
}

export class WebDavClient {
  constructor(url, username, password, options = {}) {
    this.webdavUrl = url.replace(/\/+$/, '')
    this.username = username
    this.password = password
    this.proxyMode = options.proxyMode || 'auto'
    this.proxyUrl = options.proxyUrl || ''
  }

  get _authHeader() {
    return 'Basic ' + btoa(this.username + ':' + this.password)
  }

  _shouldUseProxy() {
    if (this.proxyMode === 'direct') return false
    if (this.proxyMode === 'proxy') return true
    // auto mode: always use proxy (available via Vercel serverless function or dev server)
    return true
  }

  _getProxyPath() {
    if (this.proxyMode === 'auto') {
      // Auto mode always routes through the SAME-ORIGIN /api/dav/ endpoint. This is
      // the deployment contract for every supported host:
      //   - EdgeOne Makers: backed by the edge/cloud function at /api/dav/
      //   - Self-hosted (OpenResty, Nginx, ...): a reverse proxy at /api/dav/
      // Both are same-origin, so the browser never triggers CORS and no external
      // proxy is needed. We deliberately IGNORE any previously-entered proxyUrl so
      // a stale Cloudflare Worker address can never hijack auto mode.
      return PROXY_PATH
    }
    if (this.proxyMode === 'proxy' && this.proxyUrl) {
      return this.proxyUrl.replace(/\/+$/, '') + '/'
    }
    // proxy mode with no URL entered yet — fall back to same-origin best effort.
    return PROXY_PATH
  }

  _buildRequest(path) {
    const normalized = normalizeWebdavPath(path)
    if (this._shouldUseProxy()) {
      return {
        url: this._getProxyPath() + normalized,
        extraHeaders: { 'X-WebDAV-Url': this.webdavUrl },
      }
    }
    return {
      url: `${this.webdavUrl}/${normalized}`,
      extraHeaders: {},
    }
  }

  async request(method, path, body = null, extraHeaders = {}) {
    const { url, extraHeaders: proxyHeaders } = this._buildRequest(path)
    const headers = {
      'Authorization': this._authHeader,
      ...proxyHeaders,
      ...extraHeaders,
    }
    const STANDARD_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    let actualMethod = method
    if (this._shouldUseProxy() && !STANDARD_METHODS.includes(method)) {
      // Use a non-standard override header name: EdgeOne's CDN/WAF strips the
      // well-known X-Method-Override for security, which broke MKCOL/PROPFIND
      // tunneling (the function received a bare POST and the upstream rejected it).
      headers['X-DAV-Method'] = method
      actualMethod = 'POST'
    }
    const opts = { method: actualMethod, headers }
    if (body !== null) {
      opts.body = body
    }
    const resp = await fetch(url, opts)
    return resp
  }

  async testConnection() {
    try {
      const resp = await this.request('MKCOL', 'memoX/')
      if (resp.ok || resp.status === 405 || resp.status === 201 || resp.status === 204) return true
      const resp2 = await this.request('PROPFIND', 'memoX/', null, {
        'Depth': '0',
        'Content-Type': 'application/xml',
      })
      return resp2.ok || resp2.status === 207
    } catch {
      return false
    }
  }

  async getQuota() {
    try {
      const body = `<?xml version="1.0" encoding="UTF-8"?>
        <d:propfind xmlns:d="DAV:">
          <d:prop>
            <d:quota-used-bytes/>
            <d:quota-available-bytes/>
          </d:prop>
        </d:propfind>`
      const resp = await this.request('PROPFIND', '', body, {
        'Depth': '0',
        'Content-Type': 'application/xml',
      })
      if (!resp.ok && resp.status !== 207) return null
      const text = await resp.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(text, 'text/xml')

      function findByLocalName(doc, name) {
        const all = doc.getElementsByTagName('*')
        for (let i = 0; i < all.length; i++) {
          if (all[i].localName === name) return all[i]
        }
        return null
      }

      let usedEl = xmlDoc.getElementsByTagNameNS('DAV:', 'quota-used-bytes')[0]
      let availEl = xmlDoc.getElementsByTagNameNS('DAV:', 'quota-available-bytes')[0]
      if (!usedEl) usedEl = findByLocalName(xmlDoc, 'quota-used-bytes')
      if (!availEl) availEl = findByLocalName(xmlDoc, 'quota-available-bytes')

      const used = usedEl ? parseInt(usedEl.textContent.trim(), 10) : NaN
      const available = availEl ? parseInt(availEl.textContent.trim(), 10) : NaN

      if (isNaN(used) || isNaN(available)) {
        console.info('[memoX] WebDAV server does not support quota properties')
        return null
      }
      if (used === 0 && available === 0) return null

      return {
        usedBytes: used,
        availableBytes: available,
        totalBytes: used + available,
      }
    } catch (e) {
      console.warn('[memoX] Failed to get WebDAV quota:', e)
      return null
    }
  }

  async createDirectory(path) {
    const dirPath = path.endsWith('/') ? path : path + '/'
    const resp = await this.request('MKCOL', dirPath)
    return resp.ok || resp.status === 405 || resp.status === 201 || resp.status === 204
  }

  async ensureDirectories() {
    const dirs = [
      'memoX/',
      'memoX/notes/',
      'memoX/attachments/',
      'memoX/attachments/images/',
      'memoX/attachments/audios/',
      'memoX/attachments/files/',
    ]
    // Fire all MKCOLs concurrently. Each one still returns 405 when the directory
    // already exists (treated as success by createDirectory), but running them in
    // parallel turns six sequential ~3s round-trips through the proxy into one.
    await Promise.all(dirs.map(d => this.createDirectory(d).catch(() => {})))
  }

  async upload(path, data) {
    const body = data instanceof ArrayBuffer ? new Uint8Array(data) : data
    const resp = await this.request('PUT', path, body, {
      'Content-Type': 'application/octet-stream',
    })
    return resp.ok || resp.status === 201 || resp.status === 204
  }

  async download(path) {
    const resp = await this.request('GET', path)
    if (!resp.ok) return null
    return resp.arrayBuffer()
  }

  // Download a binary attachment. For large files we fetch in byte ranges so a
  // single request never exceeds the EdgeOne gateway timeout (which caused 504s
  // on big images proxied through the Cloud Function). Small files use one GET.
  //
  // Cache-busting (path fragment): EdgeOne's CDN builds its cache key from the
  // REQUEST PATH, not the query string, so a ?cb= query can never bypass an
  // already-cached (e.g. stale 206/partial) entry — it just keeps hitting the
  // same edge object and reproduces "top half renders, bottom half gray". We
  // instead inject a unique /.cb/<token>/ segment right before the file leaf.
  // The path changes on every request, so the CDN treats each fetch as a fresh
  // MISS and always pulls new bytes from origin. The proxy strips the segment
  // before forwarding to WebDAV. This also retroactively defeats the immutable
  // entries that were cached before the no-store fix existed. After assembly we
  // still verify the byte count against the HEAD Content-Length — a truncated
  // body must never be persisted.
  async downloadBlob(path, { chunkSize = 4 * 1024 * 1024 } = {}) {
    const token = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
    const busted = injectCacheBust(path, token)

    const head = await this.request('HEAD', busted)
    const total = head.ok ? parseInt(head.headers.get('content-length') || '0', 10) : 0

    const fetchOnce = async (urlPath) => {
      if (total > chunkSize) {
        try {
          const parts = []
          for (let start = 0; start < total; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, total - 1)
            const resp = await this.request('GET', urlPath, null, { 'Range': `bytes=${start}-${end}` })
            if (resp.status === 200) {
              // Upstream ignored Range -> this response is the whole file.
              return new Blob([new Uint8Array(await resp.arrayBuffer())])
            }
            if (resp.status !== 206) {
              return await this._fullBlob(urlPath)
            }
            const buf = await resp.arrayBuffer()
            if (!buf.byteLength) break
            parts.push(new Uint8Array(buf))
          }
          if (parts.length === 0) return await this._fullBlob(urlPath)
          return new Blob(parts)
        } catch {
          return await this._fullBlob(urlPath)
        }
      }
      return await this._fullBlob(urlPath)
    }

    // Try the cache-busted request first; if the WebDAV (or an un-deployed proxy)
    // rejects the query string, fall back to the bare path. The size gate in
    // syncAttachments still refuses to persist a truncated body either way.
    let blob = await fetchOnce(busted)
    if (!blob || blob.size === 0) blob = await fetchOnce(path)
    if (blob && total > 0 && blob.size !== total) {
      // Still truncated after cache-bust -> fetch the whole file (no ranges).
      blob = (await this._fullBlob(busted)) || (await this._fullBlob(path))
    }
    return blob
  }

  async _fullBlob(path) {
    const resp = await this.request('GET', path)
    if (!resp.ok) return null
    return resp.blob()
  }

  async downloadText(path) {
    const buf = await this.download(path)
    if (!buf) return null
    return new TextDecoder().decode(buf)
  }

  async delete(path) {
    const resp = await this.request('DELETE', path)
    return resp.ok || resp.status === 204 || resp.status === 404
  }

  async exists(path) {
    const resp = await this.request('HEAD', path)
    return resp.ok
  }

  async listFiles(dirPath) {
    const dPath = dirPath.endsWith('/') ? dirPath : dirPath + '/'
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype/>
    <d:getlastmodified/>
    <d:getcontentlength/>
  </d:prop>
</d:propfind>`

    const resp = await this.request('PROPFIND', dPath, propfindBody, {
      'Depth': '1',
      'Content-Type': 'application/xml',
    })

    if (!resp.ok && resp.status !== 207) return []
    const text = await resp.text()
    return this.parseMultiStatus(text, dPath)
  }

  parseMultiStatus(xml, basePath) {
    const files = []
    const normalizedBase = basePath.replace(/\/+/g, '/').replace(/\/$/, '')

    function extractPathFromHref(href) {
      const decoded = decodeURIComponent(href.trim())
      let pathPart = decoded
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        try {
          const u = new URL(decoded)
          pathPart = u.pathname
        } catch {
          pathPart = decoded.replace(/^https?:\/\/[^/]+/, '')
        }
      }
      pathPart = pathPart.replace(/\/+/g, '/').replace(/\/$/, '')
      return pathPart
    }

    function getChildName(hrefPath, baseSegments) {
      const segments = hrefPath.split('/').filter(Boolean)
      if (segments.length < baseSegments.length) return null
      for (let i = 0; i < baseSegments.length; i++) {
        if (segments[i] !== baseSegments[i]) {
          const trailing = segments.slice(-(baseSegments.length + 1))
          let matches = true
          for (let j = 0; j < baseSegments.length; j++) {
            if (trailing[j] !== baseSegments[j]) { matches = false; break }
          }
          if (matches && trailing.length === baseSegments.length + 1) {
            return trailing[trailing.length - 1]
          }
          return null
        }
      }
      if (segments.length === baseSegments.length) return null
      if (segments.length > baseSegments.length + 1) return null
      return segments[segments.length - 1]
    }

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'application/xml')
      if (doc.querySelector('parsererror')) {
        return this.parseMultiStatusRegex(xml, normalizedBase)
      }

      const DAV_NS = 'DAV:'
      let responses = doc.getElementsByTagNameNS(DAV_NS, 'response')
      if (!responses || responses.length === 0) {
        responses = doc.getElementsByTagName('response')
      }
      if (!responses || responses.length === 0) {
        const allEls = doc.querySelectorAll('*')
        responses = Array.from(allEls).filter(el => el.localName === 'response')
      }
      if (!responses || responses.length === 0) {
        return this.parseMultiStatusRegex(xml, normalizedBase)
      }

      const baseSegments = normalizedBase.split('/').filter(Boolean)

      function childByLocalName(parent, localName) {
        for (let i = 0; i < parent.children.length; i++) {
          if (parent.children[i].localName === localName) return parent.children[i]
        }
        const found = parent.getElementsByTagNameNS(DAV_NS, localName)
        if (found && found.length > 0) return found[0]
        const found2 = parent.getElementsByTagName(localName)
        if (found2 && found2.length > 0) return found2[0]
        return null
      }

      function hasCollectionChild(resType) {
        if (!resType) return false
        for (let i = 0; i < resType.children.length; i++) {
          if (resType.children[i].localName === 'collection') return true
        }
        const cols = resType.getElementsByTagNameNS(DAV_NS, 'collection')
        if (cols && cols.length > 0) return true
        const cols2 = resType.getElementsByTagName('collection')
        if (cols2 && cols2.length > 0) return true
        return false
      }

      for (const resp of Array.from(responses)) {
        const hrefEl = childByLocalName(resp, 'href')
        if (!hrefEl) continue

        const hrefPath = extractPathFromHref(hrefEl.textContent || '')
        if (!hrefPath) continue

        const name = getChildName(hrefPath, baseSegments)
        if (!name) continue

        const resType = childByLocalName(resp, 'resourcetype')
        const isDir = hasCollectionChild(resType)

        const lastModifiedEl = childByLocalName(resp, 'getlastmodified')
        const sizeEl = childByLocalName(resp, 'getcontentlength')

        files.push({
          name,
          path: normalizedBase + '/' + name,
          isDirectory: isDir,
          lastModified: lastModifiedEl?.textContent || null,
          size: sizeEl ? parseInt(sizeEl.textContent, 10) : 0,
        })
      }

      if (files.length === 0) {
        return this.parseMultiStatusRegex(xml, normalizedBase)
      }

      return files
    } catch {
      return this.parseMultiStatusRegex(xml, normalizedBase)
    }
  }

  parseMultiStatusRegex(xml, basePath) {
    const files = []
    const normalizedBase = basePath.replace(/\/+/g, '/').replace(/\/$/, '')
    const baseSegments = normalizedBase.split('/').filter(Boolean)

    function extractPathFromHref(href) {
      const decoded = decodeURIComponent(href.trim())
      let pathPart = decoded
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        pathPart = decoded.replace(/^https?:\/\/[^/]+/, '')
      }
      pathPart = pathPart.replace(/\/+/g, '/').replace(/\/$/, '')
      return pathPart
    }

    function getChildName(hrefPath) {
      const segments = hrefPath.split('/').filter(Boolean)
      if (segments.length < baseSegments.length + 1) return null
      const trailing = segments.slice(-(baseSegments.length + 1))
      for (let i = 0; i < baseSegments.length; i++) {
        if (trailing[i] !== baseSegments[i]) return null
      }
      return trailing[trailing.length - 1]
    }

    const hrefRegex = /<(?:[^:]*:)?href[^>]*>([^<]+)<\/(?:[^:]*:)?href>/g
    let match

    while ((match = hrefRegex.exec(xml)) !== null) {
      const hrefPath = extractPathFromHref(match[1])
      if (!hrefPath) continue

      const name = getChildName(hrefPath)
      if (!name) continue

      const startPos = xml.indexOf(match[0])
      const nearbyXml = xml.substring(startPos, startPos + 2000)
      const isDir = /<(?:[^:]*:)?resourcetype[^>]*>[\s\S]*?<(?:[^:]*:)?collection\s*\/?>/.test(nearbyXml)

      files.push({
        name,
        path: normalizedBase + '/' + name,
        isDirectory: isDir,
      })
    }

    return files
  }
}
