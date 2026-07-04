import { proxyRequest } from './_proxy.js'

export async function onRequest(context) {
  const { request } = context
  const targetBase = String(request.headers.get('x-webdav-url') || '').replace(/\/+$/, '')
  const url = new URL(request.url)
  const pathSuffix = url.pathname.replace(/^\/__dav__\/?/, '')
  const fullUrl = pathSuffix ? `${targetBase}/${pathSuffix}` : `${targetBase}/`
  return proxyRequest(request, fullUrl)
}
