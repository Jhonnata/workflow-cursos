export const AUTH_TOKEN_KEY = '_xat'
export const AUTH_TYPE_KEY = '_xatt'

type StoredAuth = { token: string; type: string }

export function getStoredAuth() {
  if (typeof localStorage === 'undefined') return null
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const type = localStorage.getItem(AUTH_TYPE_KEY)
  if (!token || !type) return null
  return { token, type }
}

function decodeJwtPayload(token: string) {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return null
  try {
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64Url.length % 4
    const base64 = base64Url + (pad ? '='.repeat(4 - pad) : '')
    const json =
      typeof atob === 'function'
        ? atob(base64)
        : decodeURIComponent(
            base64
              .split('')
              .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
              .join(''),
          )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isJwtExpired(token: string, skewSeconds = 30) {
  const payload = decodeJwtPayload(token)
  const exp = Number(payload?.exp)
  if (!Number.isFinite(exp)) return false
  const now = Math.floor(Date.now() / 1000)
  return exp <= now + Math.max(0, Number(skewSeconds) || 0)
}

export function getValidStoredAuth(): StoredAuth | null {
  const auth = getStoredAuth()
  if (!auth) return null
  if (isJwtExpired(auth.token)) {
    clearAuth()
    return null
  }
  return auth
}

export function getValidStoredAuthOrLogout(): StoredAuth | null {
  const auth = getStoredAuth()
  if (!auth) return null
  if (isJwtExpired(auth.token)) {
    logoutForExpiredSession()
    return null
  }
  return auth
}

export function isLoggedIn() {
  return Boolean(getValidStoredAuth())
}

export function setAuth(token: string, type: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_TYPE_KEY, type)
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_TYPE_KEY)
}

export function redirectToLogin() {
  if (typeof window === 'undefined') return
  const currentHash = String(window.location.hash || '')
  if (currentHash.startsWith('#/login')) return
  const nextPath = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash || '/'
  const next = encodeURIComponent(nextPath || '/')
  window.location.hash = `/login?next=${next}`
}

export function logoutForExpiredSession() {
  clearAuth()
  redirectToLogin()
}
