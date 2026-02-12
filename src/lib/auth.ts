export const AUTH_TOKEN_KEY = '_xat'
export const AUTH_TYPE_KEY = '_xatt'

export function getStoredAuth() {
  if (typeof localStorage === 'undefined') return null
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const type = localStorage.getItem(AUTH_TYPE_KEY)
  if (!token || !type) return null
  return { token, type }
}

export function isLoggedIn() {
  return Boolean(getStoredAuth())
}

export function setAuth(token: string, type: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_TYPE_KEY, type)
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_TYPE_KEY)
}
