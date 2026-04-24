import { mockCatalog } from './workflow'
import { API_BASE_URL } from './config'
import { getValidStoredAuthOrLogout, isJwtExpired, logoutForExpiredSession } from './auth'

const BASE_URL = API_BASE_URL

async function tryFetch(url: string, options?: RequestInit, fallbackData?: any) {
  try {
    const headers = new Headers(options?.headers || {})
    const auth = getValidStoredAuthOrLogout()
    if (!auth && headers.has('Authorization')) {
      headers.delete('Authorization')
    }
    if (auth && !headers.has('Authorization')) {
      headers.set('Authorization', `${auth.type} ${auth.token}`)
    }
    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const contentType = res.headers.get('content-type') || ''
      let payload: any = null
      if (contentType.includes('application/json')) {
        payload = await res.json().catch(() => null)
      } else {
        payload = await res.text().catch(() => null)
      }
      const payloadMessage =
        (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
        (typeof payload === 'string' ? payload : '')
      if (res.status === 401) {
        const messageKey = String(payloadMessage || '').toLowerCase()
        const explicitExpired =
          messageKey.includes('expir') ||
          messageKey.includes('jwt expired') ||
          messageKey.includes('token expired')
        const explicitInvalidToken =
          messageKey.includes('invalid token') ||
          messageKey.includes('token invalido') ||
          messageKey.includes('token inválido')
        const shouldLogout = Boolean((auth?.token && isJwtExpired(auth.token, 0)) || explicitExpired || explicitInvalidToken)
        if (shouldLogout) logoutForExpiredSession()
        const unauthorized = new Error(
          shouldLogout ? 'Sessao expirada. Realize login novamente.' : payloadMessage || 'Nao autorizado para esta operacao.',
        )
        ;(unauthorized as any).status = 401
        ;(unauthorized as any).payload = payload
        throw unauthorized
      }
      const message =
        payloadMessage ||
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
    if ((e as any)?.status === 401) throw e
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
    const res = await tryFetch(`${BASE_URL}/workflows`, {}, [])
    const normalized = normalizeArrayPayload(res.data, ['workflows'])
    return { ...res, data: normalized }
  },
  async getWorkflowSchedules() {
    const res = await tryFetch(`${BASE_URL}/workflows/schedule`, {}, [])
    const normalized = normalizeArrayPayload(res.data, ['schedules', 'workflows'])
    return { ...res, data: normalized }
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
  async getWorkflowGraph(workflowId: string | number) {
    const id = encodeURIComponent(String(workflowId))
    return tryFetch(`${BASE_URL}/workflows/${id}/graphs`)
  },
  async runWorkflow(workflowId: string | number, runId?: string | number) {
    const id = encodeURIComponent(String(workflowId))
    const query =
      runId !== undefined && runId !== null && runId !== '' ? `?runId=${encodeURIComponent(String(runId))}` : ''
    return tryFetch(`${BASE_URL}/workflows/${id}/run${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  },
  async getApprenticeWorkflows(
    workflowId: string | number,
    params?: {
      limit?: number
      offset?: number
      q?: string
      contract?: string
      classId?: string | number
      classStatus?: string
      hasContract?: boolean
      contractMinMonths?: number
      sort?: 'hasContract'
      order?: 'asc' | 'desc'
      transitionsLimit?: number
    },
  ) {
    const id = encodeURIComponent(String(workflowId))
    const suffix = buildApprenticesQuery(params)
    return tryFetch(`${BASE_URL}/workflows/${id}/apprentices${suffix ? `?${suffix}` : ''}`, {}, [])
  },
  async listWorkflowOverrides(workflowId: string | number, apprenticeId?: string | number) {
    const id = encodeURIComponent(String(workflowId))
    const query =
      apprenticeId !== undefined && apprenticeId !== null && apprenticeId !== ''
        ? `?apprenticeId=${encodeURIComponent(String(apprenticeId))}`
        : ''
    return tryFetch(`${BASE_URL}/workflows/${id}/overrides${query}`, {}, [])
  },
  async createWorkflowOverride(
    workflowId: string | number,
    apprenticeId: string | number,
    nodeKey: string,
    override: Record<string, any>,
  ) {
    const id = encodeURIComponent(String(workflowId))
    return tryFetch(`${BASE_URL}/workflows/${id}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apprentice: apprenticeId, nodeKey, override }),
    })
  },
  async updateWorkflowOverride(
    workflowId: string | number,
    overrideId: string | number,
    override: Record<string, any>,
  ) {
    const wfId = encodeURIComponent(String(workflowId))
    const ovId = encodeURIComponent(String(overrideId))
    return tryFetch(`${BASE_URL}/workflows/${wfId}/overrides/${ovId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ override }),
    })
  },
  async deleteWorkflowOverride(workflowId: string | number, overrideId: string | number) {
    const wfId = encodeURIComponent(String(workflowId))
    const ovId = encodeURIComponent(String(overrideId))
    return tryFetch(`${BASE_URL}/workflows/${wfId}/overrides/${ovId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
  },
  async getResolvedCondition(
    workflowId: string | number,
    nodeKey: string,
    apprenticeId: string | number,
  ) {
    const wfId = encodeURIComponent(String(workflowId))
    const nk = encodeURIComponent(String(nodeKey))
    const ap = encodeURIComponent(String(apprenticeId))
    return tryFetch(`${BASE_URL}/workflows/${wfId}/conditions/${nk}/apprentice/${ap}`)
  },
  async evoluteApprentice(
    workflowId: string | number,
    apprenticeId: string | number,
    data: { fromClass: number; toClass: number },
  ) {
    const wfId = encodeURIComponent(String(workflowId))
    const apId = encodeURIComponent(String(apprenticeId))
    return tryFetch(`${BASE_URL}/workflows/${wfId}/apprentices/${apId}/evolute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
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

type ApprenticesFilters = {
  page?: number
  offset?: number
  limit?: number
  q?: string
  classId?: number | string
  classStatus?: 'inProgress' | 'concluded' | 'inactive' | 'incomplete' | 'all' | string
  contract?: string
  hasContract?: boolean
  contractMinMonths?: number
  sort?: 'hasContract'
  order?: 'asc' | 'desc'
  transitionsLimit?: number
}

function buildApprenticesQuery(f?: ApprenticesFilters) {
  if (!f) return ''
  const p = new URLSearchParams()
  p.set('lmt', String(f.limit ?? 10))
  p.set('offset', String(f.page ?? f.offset ?? 0))
  if (f.q) p.set('q', f.q)
  if (f.classId !== undefined && f.classId !== null && f.classId !== '') p.set('classId', String(f.classId))
  if (f.classStatus && f.classStatus !== 'all') p.set('classStatus', f.classStatus)
  if (f.contract) p.set('contract', f.contract)
  if (typeof f.hasContract === 'boolean') p.set('hasContract', f.hasContract ? '1' : '0')
  if (typeof f.contractMinMonths === 'number' && Number.isFinite(f.contractMinMonths)) {
    p.set('contractMinMonths', String(f.contractMinMonths))
  }
  if (f.sort) p.set('sort', f.sort)
  if (f.order) p.set('order', f.order)
  if (typeof f.transitionsLimit === 'number' && Number.isFinite(f.transitionsLimit)) {
    p.set('transitionsLimit', String(f.transitionsLimit))
  }
  return p.toString()
}

function normalizeArrayPayload(data: any, arrayKeys: string[] = []) {
  if (Array.isArray(data)) return data
  for (const key of arrayKeys) {
    if (Array.isArray(data?.[key])) return data[key]
    if (Array.isArray(data?.data?.[key])) return data.data[key]
  }
  if (Array.isArray(data?.data)) return data.data
  return []
}
