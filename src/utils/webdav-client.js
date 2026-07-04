const PROXY_PATH = '/__dav__/'

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
    if (this.proxyUrl) {
      return this.proxyUrl.replace(/\/+$/, '') + '/'
    }
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
    const opts = { method, headers }
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
    for (const dir of dirs) {
      await this.createDirectory(dir)
    }
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

  async downloadBlob(path) {
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
