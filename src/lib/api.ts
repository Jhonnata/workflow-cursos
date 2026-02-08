import { mockCatalog } from './workflow'

const BASE_URL = 'http://api.masa.io'

async function tryFetch(url: string, options?: RequestInit, fallbackData?: any) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      const contentType = res.headers.get('content-type') || ''
      let payload: any = null
      if (contentType.includes('application/json')) {
        payload = await res.json().catch(() => null)
      } else {
        payload = await res.text().catch(() => null)
      }
      const message =
        (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
        `HTTP error! status: ${res.status}`
      const error = new Error(message)
      ;(error as any).status = res.status
      ;(error as any).errors = Array.isArray(payload?.errors) ? payload.errors : undefined
      ;(error as any).payload = payload
      throw error
    }
    const data = await res.json()
    return { data, isFallback: false }
  } catch (e) {
    console.warn(`Fetch failed for ${url}, using fallback if available.`, e)
    if (fallbackData !== undefined) return { data: fallbackData, isFallback: true }
    throw e
  }
}

function toNumberIfNumeric(value: any) {
  const n = Number(value)
  return Number.isFinite(n) ? n : value
}

export const api = {
  async getCourses() {
    const res = await tryFetch(`${BASE_URL}/workflows/courses`, {}, mockCatalog.courses)
    const normalized = Array.isArray(res.data)
      ? res.data.map((course: any) => ({
          ...course,
          id: toNumberIfNumeric(course.id),
        }))
      : res.data
    return { ...res, data: normalized }
  },
  async getClasses() {
    const classes = Object.values(mockCatalog.classesByCourse).flat()
    const res = await tryFetch(`${BASE_URL}/workflows/classes`, {}, classes)
    const normalized = Array.isArray(res.data)
      ? res.data.map((cls: any) => ({
          ...cls,
          id: toNumberIfNumeric(cls.id),
          courseId: toNumberIfNumeric(cls.courseId),
          onlyWithContract:
            cls.onlyWithContract ??
            cls.only_with_contract ??
            cls.requires_contract ??
            cls.requiresContract ??
            cls.onlyWithContract,
        }))
      : res.data
    return { ...res, data: normalized }
  },
  async getWorkflows() {
    return tryFetch(`${BASE_URL}/workflows`, {}, [])
  },
  async saveWorkflow(data: any) {
    return tryFetch(`${BASE_URL}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async updateWorkflow(id: string, data: any) {
    return tryFetch(`${BASE_URL}/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async deleteWorkflow(id: string) {
    return tryFetch(`${BASE_URL}/workflows/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }, {})
  },
  async getApprenticeWorkflows(workflowId: string | number) {
    const id = encodeURIComponent(String(workflowId))
    return tryFetch(`${BASE_URL}/apprentice_workflows/status?workflowId=${id}`, {}, [])
  },
  async updateApprenticeWorkflow(id: number, data: any) {
    return tryFetch(`${BASE_URL}/apprentice_workflow/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async publishApprenticeWorkflows(items: any[]) {
    return tryFetch(`${BASE_URL}/apprentice_workflow_bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    }, items)
  },
}
