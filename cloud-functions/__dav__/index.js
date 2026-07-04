import { proxyRequest } from './_proxy.js'

export async function onRequest(context) {
  const { request } = context
  const targetBase = String(request.headers.get('x-webdav-url') || '').replace(/\/+$/, '') + '/'
  return proxyRequest(request, targetBase)
}
