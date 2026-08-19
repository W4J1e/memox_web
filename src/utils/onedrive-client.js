// Microsoft Graph API client for OneDrive, mirroring the WebDavClient interface
// used by the sync engine in stores/settings.js. Path-based DriveItem addressing
// is used, so parent folders are auto-created on upload (explicit directory
// creation is only a best-effort pre-step). Large files (>= 4 MB) go through a
// resumable upload session in 5 MB chunks.
//
// The sync engine only depends on these methods:
//   testConnection, ensureDirectories, downloadText, downloadBlob, upload,
//   listFiles, delete, exists
//
// All requests go straight from the browser to graph.microsoft.com (which sends
// CORS headers), so no EdgeOne proxy is involved — this is what removes the
// 502 flakiness that the WebDAV-over-function path suffered from.

import { getValidAccessToken } from './onedrive-auth'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me/drive/root:'
const MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024
const CHUNK_SIZE = 5 * 1024 * 1024

function encodePath(path) {
  if (!path) return ''
  let p = String(path).replace(/^\/+/, '').replace(/\/+$/, '')
  if (!p) return ''
  const encoded = p.split('/').map((seg) => encodeURIComponent(seg)).join('/')
  return '/' + encoded
}

function splitParent(path) {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return ['', path]
  return [path.substring(0, idx), path.substring(idx + 1)]
}

function byteLength(data) {
  if (data instanceof Blob) return data.size
  if (data instanceof ArrayBuffer) return data.byteLength
  if (ArrayBuffer.isView(data)) return data.byteLength
  return 0
}

export class OneDriveClient {
  // The internal _fetch wrapper adds the bearer token and turns server failures
  // into thrown errors so the sync engine reports them instead of silently
  // succeeding (which used to masquerade as "同步完成" while uploading nothing).
  async _fetch(method, url, { headers = {}, body = undefined } = {}) {
    const token = await getValidAccessToken()
    if (!token) throw new Error('OneDrive 未登录或令牌已失效，请重新登录')
    const resp = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + token, ...headers },
      body,
    })
    if (resp.status >= 500) {
      throw new Error(`OneDrive 请求失败：服务端返回 ${resp.status}`)
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`OneDrive 认证失败（${resp.status}），请重新登录`)
    }
    return resp
  }

  async testConnection() {
    try {
      const resp = await this._fetch('GET', 'https://graph.microsoft.com/v1.0/me/drive')
      return resp.ok
    } catch {
      return false
    }
  }

  async ensureDirectories() {
    const dirs = [
      'memoX',
      'memoX/notes',
      'memoX/attachments',
      'memoX/attachments/images',
      'memoX/attachments/audios',
      'memoX/attachments/files',
    ]
    for (const d of dirs) {
      try {
        await this.createDirectory(d)
      } catch {}
    }
  }

  async createDirectory(path) {
    // Idempotent: if the folder already exists (Graph also auto-creates parents
    // on upload), skip the POST entirely so we never emit a 409 Conflict.
    if (await this.exists(path)) return true
    const [parentPath, name] = splitParent(path)
    const url = parentPath
      ? `${GRAPH_BASE}${encodePath(parentPath)}:/children`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children'
    const body = JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    })
    const resp = await this._fetch('POST', url, {
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return resp.ok || resp.status === 201 || resp.status === 409 || resp.status === 204
  }

  // OneDrive exposes quota as the `quota` property of the default drive
  // (GET /me/drive?$select=quota). The scope `Files.ReadWrite` (already granted
  // at sign-in) is enough to read it, so no extra Azure permission is needed.
  // Returns { usedBytes, availableBytes, totalBytes } to match the
  // WebDavClient.getQuota() contract that HomeView consumes.
  async getQuota() {
    try {
      const resp = await this._fetch('GET', 'https://graph.microsoft.com/v1.0/me/drive?$select=quota')
      if (!resp.ok) return null
      const json = await resp.json()
      const q = json.quota
      if (!q || typeof q.total !== 'number' || typeof q.used !== 'number') return null
      const available = typeof q.remaining === 'number' ? q.remaining : q.total - q.used
      return {
        usedBytes: q.used,
        availableBytes: available,
        totalBytes: q.total,
      }
    } catch {
      return null
    }
  }

  async exists(path) {
    try {
      const resp = await this._fetch('GET', `${GRAPH_BASE}${encodePath(path)}`)
      return resp.ok
    } catch {
      return false
    }
  }

  async upload(path, data) {
    if (byteLength(data) >= MAX_SIMPLE_UPLOAD) {
      return this._uploadSession(path, data)
    }
    const resp = await this._fetch('PUT', `${GRAPH_BASE}${encodePath(path)}:/content`, {
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
    })
    return resp.ok || resp.status === 201 || resp.status === 204
  }

  async _uploadSession(path, data) {
    const fileName = path.substring(path.lastIndexOf('/') + 1)
    const bodyBytes =
      data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data)

    let sessionResp
    try {
      sessionResp = await this._fetch(
        'POST',
        `${GRAPH_BASE}${encodePath(path)}:/createUploadSession`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@microsoft.graph.conflictBehavior': 'replace',
            name: fileName,
          }),
        }
      )
    } catch {
      return false
    }
    if (!sessionResp.ok) return false
    const sessionJson = await sessionResp.json()
    const uploadUrl = sessionJson.uploadUrl
    if (!uploadUrl) return false

    let offset = 0
    while (offset < bodyBytes.length) {
      const end = Math.min(offset + CHUNK_SIZE, bodyBytes.length)
      const chunk = bodyBytes.subarray(offset, end)
      const range = `bytes ${offset}-${end - 1}/${bodyBytes.length}`
      try {
        const resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': range,
            'Content-Type': 'application/octet-stream',
          },
          body: chunk,
        })
        if (!(resp.status >= 200 && resp.status < 300)) return false
      } catch {
        return false
      }
      offset = end
    }
    return true
  }

  async download(path) {
    const resp = await this._fetch('GET', `${GRAPH_BASE}${encodePath(path)}:/content`)
    if (!resp.ok) return null
    return resp.blob()
  }

  async downloadBlob(path) {
    return this.download(path)
  }

  async downloadText(path) {
    const blob = await this.download(path)
    if (!blob) return null
    return await blob.text()
  }

  async delete(path) {
    const resp = await this._fetch('DELETE', `${GRAPH_BASE}${encodePath(path)}`)
    return resp.ok || resp.status === 204 || resp.status === 404
  }

  // List direct children. Handles Graph's @odata.nextLink pagination so folders
  // with many items are fully enumerated. Returns [] on any failure (matching
  // the WebDavClient behaviour that an unlistable dir simply yields no files).
  async listFiles(dirPath) {
    const files = []
    try {
      let url = `${GRAPH_BASE}${encodePath(dirPath)}:/children`
      const base = dirPath.replace(/\/+$/, '')
      while (url) {
        const resp = await this._fetch('GET', url)
        if (!resp.ok) return files
        const json = await resp.json()
        const value = json.value || []
        for (const item of value) {
          const name = item.name
          const isDir = !!item.folder
          const size = item.size || 0
          files.push({
            name,
            path: base + '/' + name,
            isDirectory: isDir,
            size,
            lastModified: item.lastModifiedDateTime || null,
          })
        }
        url = json['@odata.nextLink'] || null
      }
    } catch {}
    return files
  }
}
