// OneDrive / Microsoft Identity Platform OAuth2 (Authorization Code + PKCE).
//
// The Azure AD application is provided at build time via the
// VITE_ONEDRIVE_CLIENT_ID env var (see .env.example) — there is deliberately NO
// baked-in default. A Client ID is bound to the redirect URIs registered on the
// app, so a shared default would only ever work on one deployment origin and
// fail for everyone else; every deployment must supply its own (the official
// memoX deployment sets the official app id in the EdgeOne build config).
//
// Public client, no client_secret — exactly the model a browser SPA uses.
// Redirect URIs are registered per deployment origin (bare origin, e.g.
// https://memox.hin.cool) under "Single-page application" in the Azure portal.
//
// Tokens live in localStorage (refresh token especially). A browser SPA has no
// server-side secret store, so this is the standard — if imperfect — approach.
// XSS is the known risk; the app already avoids injecting untrusted HTML.
//
// PKCE verifier + state are kept in sessionStorage: they only need to survive the
// redirect round-trip in the same tab, and they must NEVER be persisted longer.

// Vite statically replaces import.meta.env.* at build time. Empty when the
// deployment did not configure the env var → sign-in is blocked with a hint.
const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID || ''
const SCOPES = 'User.Read Files.ReadWrite offline_access'
const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
// Must match EXACTLY the "Single-page application" redirect URI registered for
// the memoX Azure AD app. Use the bare origin (no trailing slash) so it lines up
// with what Azure normalizes the registered value to.
const REDIRECT_URI = window.location.origin

const LS = {
  access: 'memoX.onedrive.access_token',
  refresh: 'memoX.onedrive.refresh_token',
  expiresAt: 'memoX.onedrive.token_expires_at',
  account: 'memoX.onedrive.account',
}
const SS = {
  verifier: 'memoX.onedrive.pkce_verifier',
  state: 'memoX.onedrive.oauth_state',
}

// ---------- helpers ----------

function randomBytes(n) {
  const arr = new Uint8Array(n)
  crypto.getRandomValues(arr)
  return arr
}

function base64Url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateVerifier() {
  return base64Url(randomBytes(32))
}

async function generateChallenge(verifier) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  )
  return base64Url(digest)
}

function generateState() {
  return base64Url(randomBytes(16))
}

// ---------- public API ----------

export function isOneDriveSignedIn() {
  return !!localStorage.getItem(LS.refresh)
}

export function getOneDriveAccount() {
  return localStorage.getItem(LS.account) || ''
}

// Returns a data-URL of the signed-in user's profile photo, or '' when there is
// no photo / the request fails. Results are cached for the session so the sidebar
// and settings page don't refetch on every render. Cleared on sign-out.
let cachedPhoto = null
async function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}
export async function getOneDriveAccountPhoto() {
  if (cachedPhoto !== null) return cachedPhoto
  const token = localStorage.getItem(LS.access)
  if (!token) { cachedPhoto = ''; return '' }
  try {
    const resp = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!resp.ok) { cachedPhoto = ''; return '' }
    const blob = await resp.blob()
    cachedPhoto = await blobToDataUrl(blob)
    return cachedPhoto
  } catch {
    cachedPhoto = ''
    return ''
  }
}

/**
 * Kick off the sign-in flow by navigating the whole tab to Microsoft's consent
 * page. On success Microsoft redirects back to REDIRECT_URI with ?code=&state=,
 * which App.vue captures and passes to handleOAuthRedirect().
 */
export async function startOAuthSignIn() {
  if (!CLIENT_ID) {
    alert('OneDrive 同步未配置：缺少 VITE_ONEDRIVE_CLIENT_ID 环境变量，请在构建配置中设置后重新部署')
    return
  }
  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  const state = generateState()
  sessionStorage.setItem(SS.verifier, verifier)
  sessionStorage.setItem(SS.state, state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  window.location.href = `${AUTH_URL}?${params.toString()}`
}

/**
 * Complete the authorization-code exchange. `searchParams` is a URLSearchParams
 * built from window.location.search. Returns true on success, throws on failure.
 */
export async function handleOAuthRedirect(searchParams) {
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  if (error) {
    throw new Error(decodeURIComponent(error) + (searchParams.get('error_description') ? '：' + decodeURIComponent(searchParams.get('error_description')) : ''))
  }
  if (!code) throw new Error('未获取到授权码')
  const expectedState = sessionStorage.getItem(SS.state)
  if (!state || state !== expectedState) throw new Error('状态校验失败（可能的 CSRF 攻击）')
  const verifier = sessionStorage.getItem(SS.verifier)
  if (!verifier) throw new Error('PKCE verifier 丢失，请重新登录')

  const tokenResp = await exchangeCodeForTokens(code, verifier)
  storeTokenResponse(tokenResp)
  sessionStorage.removeItem(SS.verifier)
  sessionStorage.removeItem(SS.state)
  await fetchAndStoreAccount()
  return true
}

/**
 * Returns a valid (non-expired) access token, refreshing it first if needed.
 * Returns null when there is no refresh token or the refresh failed.
 */
export async function getValidAccessToken() {
  const refresh = localStorage.getItem(LS.refresh)
  if (!refresh) return null
  const expiresAt = parseInt(localStorage.getItem(LS.expiresAt) || '0', 10)
  const access = localStorage.getItem(LS.access)
  const now = Date.now()
  // Reuse the cached access token unless it expires within 60 seconds.
  if (access && now < expiresAt - 60_000) return access
  try {
    const resp = await refreshTokens(refresh)
    storeTokenResponse(resp)
    return localStorage.getItem(LS.access)
  } catch {
    return null
  }
}

export function signOutOneDrive() {
  localStorage.removeItem(LS.access)
  localStorage.removeItem(LS.refresh)
  localStorage.removeItem(LS.expiresAt)
  localStorage.removeItem(LS.account)
  sessionStorage.removeItem(SS.verifier)
  sessionStorage.removeItem(SS.state)
  cachedPhoto = null
}

// ---------- internals ----------

async function exchangeCodeForTokens(code, verifier) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    scope: SCOPES,
  })
  return postTokenRequest(body)
}

async function refreshTokens(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPES,
  })
  return postTokenRequest(body)
}

async function postTokenRequest(body) {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await resp.text()
  if (!resp.ok) {
    let msg = 'HTTP ' + resp.status
    try {
      const j = JSON.parse(text)
      msg = j.error_description || j.error || msg
    } catch {}
    throw new Error(msg)
  }
  return JSON.parse(text)
}

function storeTokenResponse(json) {
  const access = json.access_token
  const expiresIn = json.expires_in || 3600
  const refresh = json.refresh_token
  localStorage.setItem(LS.access, access)
  localStorage.setItem(LS.expiresAt, String(Date.now() + expiresIn * 1000))
  if (refresh) localStorage.setItem(LS.refresh, refresh)
}

async function fetchAndStoreAccount() {
  const token = localStorage.getItem(LS.access)
  if (!token) return
  // A fresh sign-in may belong to a different user — drop any cached photo so
  // the next getOneDriveAccountPhoto() call re-fetches it.
  cachedPhoto = null
  try {
    const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!resp.ok) return
    const json = await resp.json()
    const mail = json.mail || json.userPrincipalName || ''
    const name = json.displayName || ''
    const account = name && mail ? `${name} (${mail})` : (mail || name || 'Microsoft 账户')
    localStorage.setItem(LS.account, account)
  } catch {
    // Non-fatal: account name is display-only.
  }
}
