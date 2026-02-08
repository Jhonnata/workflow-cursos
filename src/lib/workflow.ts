export type Course = { id: number; name: string }
export type CourseClass = {
  id: number
  name: string
  onlyWithContract?: boolean | string | number
  requires_contract?: boolean | string | number
  dayOfWeek?: string | null
  ambiance?: boolean | string | number
  stats?: {
    total: number
    men: number
    women: number
    others: number
  }
}

export type CoursePayload = {
    courseId: number
    courseName: string
    classes: CourseClass[]
}

export type ConditionPayload = {
  startDate: string
  endDate: string
  evolveAt?: string
  evolutionMode?: 'none' | 'specific' | 'range' | 'classEnd'
  minAttendance: number
  minExamGrade: number
  mustCompleteLessons: boolean
  checkContract: boolean
  contractStatus: string[]
  classInsertStatus: string
  classExitStatus: string
  classCheckStatus: string
  hasMinGrade: boolean
  hasAttendance: boolean
  useClassEndDate?: boolean
  keepSameDayOfWeek?: boolean
  isBalanced?: boolean
  balanceStrategy?: ('occupancy' | 'gender')[]
}

export type CourseNodeData = {
    payload: CoursePayload
    connectMode: boolean
    nodeId: string
    onRemove?: (nodeId: string) => void
}

export type ConditionNodeData = {
    payload: ConditionPayload
    connectMode: boolean
    nodeId: string
    showDetails?: boolean
    onToggleDetails?: (nodeId: string) => void
    onRemove?: (nodeId: string) => void
}

export type StartNodeData = {
    payload: StartPayload
    connectMode: boolean
    nodeId: string
    onRemove?: (nodeId: string) => void
}

export type StartPayload = {
    executionMode: 'once' | 'recurring'
    startDate: string
    endDate: string
    runDailyAt: string
    runIntervalMinutes: number | null
}

export const START_NODE_ID = 'start'

export const CONTRACT_STATUS_OPTIONS = [
    {value: 'EA', label: 'Em Andamento'},
    {value: 'A', label: 'Aguardando'},
    {value: 'DI', label: 'Dispensa (Insatisfacao)'},
    {value: 'DC', label: 'Dispensa (Cadeira)'},
    {value: 'E', label: 'Efetivacao'},
    {value: 'PI', label: 'Pedido (Insatisfacao)'},
    {value: 'PIC', label: 'Pedido (Insatisfacao - Cadeira)'},
    {value: 'TC', label: 'Termino de Contrato'},
] as const

export const CLASS_INSERT_STATUS_OPTIONS = [
    {value: 'inProgress', label: 'Em Andamento'},
    {value: 'incomplete', label: 'Incompleto'},
    {value: 'conclude', label: 'Concluido'},
] as const

export const EXECUTION_MODE_OPTIONS = [
    {value: 'recurring', label: 'Recorrente'},
    {value: 'once', label: 'Unica'},
] as const

export function executionModeLabel(value?: string) {
    if (!value) return ''
    const found = EXECUTION_MODE_OPTIONS.find((opt) => opt.value === value)
    return found ? found.label : value
}

export function contractStatusLabel(value?: string) {
    if (!value) return ''
    const needle = value.toUpperCase()
    const found = CONTRACT_STATUS_OPTIONS.find((opt) => opt.value === needle)
    return found ? found.label : value
}

export function classInsertStatusLabel(value?: string) {
    if (!value) return ''
    const needle = value.toLowerCase()
    const found = CLASS_INSERT_STATUS_OPTIONS.find((opt) => opt.value.toLowerCase() === needle)
    return found ? found.label : value
}

export const mockCatalog = {
    courses: [
        {id: 1, name: 'A'},
        {id: 2, name: 'B'},
        {id: 3, name: 'C'},
        {id: 4, name: 'D'},
    ],
    classesByCourse: {
        1: [
            {id: 11, name: 'A1', onlyWithContract: true, stats: {total: 25, men: 12, women: 10, others: 3}},
            {id: 12, name: 'A2', onlyWithContract: false, stats: {total: 20, men: 8, women: 11, others: 1}},
            {id: 13, name: 'A3', onlyWithContract: false, stats: {total: 30, men: 15, women: 14, others: 1}},
        ],
        2: [
            {id: 21, name: 'B1', onlyWithContract: true, stats: {total: 15, men: 7, women: 7, others: 1}},
            {id: 22, name: 'B2', onlyWithContract: true, stats: {total: 18, men: 9, women: 8, others: 1}},
            {id: 23, name: 'B3', onlyWithContract: false, stats: {total: 22, men: 10, women: 10, others: 2}},
        ],
        3: [
            {id: 31, name: 'C1', onlyWithContract: false, stats: {total: 28, men: 14, women: 12, others: 2}},
            {id: 32, name: 'C2', onlyWithContract: false, stats: {total: 24, men: 12, women: 10, others: 2}},
            {id: 33, name: 'C3', onlyWithContract: false, stats: {total: 20, men: 10, women: 9, others: 1}},
        ],
        4: [
            {id: 41, name: 'D1', onlyWithContract: true, stats: {total: 12, men: 6, women: 5, others: 1}},
            {id: 42, name: 'D2', onlyWithContract: false, stats: {total: 16, men: 8, women: 7, others: 1}},
        ],
    } as Record<number, CourseClass[]>,
}

export function uid() {
    if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
        return crypto.randomUUID()
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

export function portColor(port: string) {
    if (port === 'ok') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    if (port === 'nok') return 'text-rose-700 bg-rose-50 border-rose-200'
    return 'text-blue-700 bg-blue-50 border-blue-200'
}

export function edgeKindFromHandles(sourceHandle: string, targetHandle: string) {
    if (sourceHandle === 'if-ok') return 'ok'
    if (sourceHandle === 'if-nok') return 'nok'
    return 'next'
}

export function parseCourseId(nodeId?: string | null) {
    if (!nodeId?.startsWith('course:')) return null
    const v = Number(nodeId.split(':')[1])
    return Number.isFinite(v) ? v : null
}

export function courseNodeId(courseId: number) {
    return `course:${courseId}`
}

export function conditionNodeId(id: string) {
    return `cond:${id}`
}

export function buildCoursePayload(
    courseId: number,
    preselect: Record<number, Set<number>>,
    courses: Course[],
    classesByCourse: Record<number, CourseClass[]>
): CoursePayload {
    const course = courses.find((c) => c.id === courseId)
    const classes = classesByCourse[courseId] ?? []
    const selectedSet = preselect[courseId] ?? new Set()
    return {
        courseId,
        courseName: course?.name ?? '?',
        classes: classes.filter((c) => selectedSet.has(c.id)),
    }
}

export function edgeStroke(kind: string) {
  if (kind === 'ok') return '#059669'
  if (kind === 'nok') return '#e11d48'
  return '#2563eb'
}

export function onlyWithContractFlag(cls?: { onlyWithContract?: unknown; requires_contract?: unknown }) {
  if (!cls) return false
  const raw = (cls.onlyWithContract ?? cls.requires_contract) as unknown
  if (raw === true) return true
  if (raw === false || raw === null || raw === undefined) return false
  if (typeof raw === 'number') return raw > 0
  const str = String(raw).trim().toLowerCase()
  return str === '1' || str === 'true' || str === 'yes' || str === 'sim'
}
