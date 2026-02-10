<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { GraphEdge, GraphNode } from '@vue-flow/core'
import {
  ChevronRight,
  X,
  Scale,
  Users,
  Calendar,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pencil,
  ChevronLeft,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CLASS_INSERT_STATUS_OPTIONS, CONTRACT_STATUS_OPTIONS, onlyWithContractFlag } from '@/lib/workflow'
import { api } from '@/lib/api'

type CourseSeqItem = {
  courseId: number
  courseName: string
  nodeId: string
}

type EditValue = {
  startDate: string
  endDate: string
  evolveAt: string
  evolutionMode: 'none' | 'specific' | 'range' | 'classEnd'
  minAttendance: number
  minExamGrade: number
  mustCompleteLessons: boolean
  checkContract: boolean
  contractStatus: string[]
  classInsertStatus: string
  classExitStatus: string
  classCheckStatus: string
  useClassEndDate?: boolean
  keepSameDayOfWeek?: boolean
  isBalanced?: boolean
  balanceStrategy?: ('occupancy' | 'gender')[]
}

type EditState = {
  rowId: number
  apprenticeId: number
  courseKey: string
  courseName: string
  conditionNodeKey: string | null
  conditionOptions: { nodeKey: string; label: string }[]
  overrideId: number | null
  value: EditValue
}

type ProgressItem = {
  className?: string
  status?: string
  attendance?: number
  exam?: number
  evolveAt?: string
  condition?: EditValue
  eligibleForNext?: boolean | null
  eligibleForNextReason?: string[]
  eligibilityAny?: boolean | null
  eligibilityReasons?: string[]
  eligibilityByCondition?: { nodeKey: string; eligible: boolean; reasons: string[] }[]
  isFinalStep?: boolean
}

type RowContract = {
  company: string
  start: string
  end: string
  status: string
}

type ApiContract = {
  partnerId?: number
  corporateName?: string
  contractId?: number
  startedAt?: string
  endedAt?: string | null
  status?: string
}

type ApiStep = {
  nodeKey?: string
  order?: number
  courseId?: number
  courseName?: string
  class?: { id?: number; name?: string; identifier?: string }
  status?: string
  isFinalStep?: boolean
}

type ApiApprentice = {
  apprenticeId?: number
  name?: string
  cpf?: string
  email?: string
  contracts?: ApiContract[]
  steps?: ApiStep[]
}

type RowItem = {
  id: number
  name: string
  cpf: string
  email: string
  contract: RowContract | null
  progress: Record<string, ProgressItem>
}

const props = defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
  workflowId: string | number
}>()

function deriveCourseSequence(nodes: GraphNode[], edges: GraphEdge[]): CourseSeqItem[] {
  const courseNodes = nodes.filter((n) => n.type === 'course')
  if (courseNodes.length === 0) return []

  const idToNode = new Map(courseNodes.map((n) => [n.id, n]))
  const courseName = (id: string) => String(idToNode.get(id)?.data?.payload?.courseName || '')

  const classToCourse = new Map<number, string>()
  for (const n of courseNodes) {
    const classes = n.data?.payload?.classes || []
    for (const cls of classes) {
      const clsId = Number((cls as any).id)
      if (Number.isFinite(clsId)) classToCourse.set(clsId, n.id)
    }
  }

  const conditionTargets = new Map<string, Set<string>>()
  const courseToConditions = new Map<string, Set<string>>()

  const addToMapSet = (map: Map<string, Set<string>>, key: string, value: string) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key)?.add(value)
  }

  for (const e of edges) {
    if (!e.sourceHandle || !e.targetHandle) continue

    if (e.sourceHandle.startsWith('class-out') && e.targetHandle === 'if-in') {
      addToMapSet(courseToConditions, e.source, e.target)
    }

    if ((e.sourceHandle === 'if-ok' || e.sourceHandle === 'if-nok') && e.targetHandle.startsWith('class-in')) {
      const classId = Number(e.targetHandle.split(':')[1])
      const courseId = classToCourse.get(classId) || (idToNode.has(e.target) ? e.target : null)
      if (courseId) addToMapSet(conditionTargets, e.source, courseId)
    }
  }

  const adjacency = new Map<string, Set<string>>()
  const indegree = new Map<string, number>()
  for (const n of courseNodes) {
    adjacency.set(n.id, new Set())
    indegree.set(n.id, 0)
  }

  for (const [courseId, conds] of courseToConditions) {
    for (const condId of conds) {
      const targets = conditionTargets.get(condId)
      if (!targets) continue
      for (const targetId of targets) {
        if (courseId === targetId) continue
        const set = adjacency.get(courseId) || new Set()
        if (!set.has(targetId)) {
          set.add(targetId)
          adjacency.set(courseId, set)
          indegree.set(targetId, (indegree.get(targetId) || 0) + 1)
        }
      }
    }
  }

  const startCourses = new Set<string>()
  const startNodes = nodes.filter((n) => n.type === 'start')
  if (startNodes.length > 0) {
    const startIds = new Set(startNodes.map((n) => n.id))
    for (const e of edges) {
      if (!startIds.has(e.source)) continue
      if (idToNode.has(e.target)) {
        startCourses.add(e.target)
        continue
      }
      const targets = conditionTargets.get(e.target)
      if (targets) {
        for (const t of targets) startCourses.add(t)
      }
    }
  }

  if (startCourses.size === 0) {
    for (const [id, deg] of indegree) {
      if (deg === 0) startCourses.add(id)
    }
  }

  const startList = Array.from(startCourses).sort((a, b) => courseName(a).localeCompare(courseName(b)))
  const seq: CourseSeqItem[] = []
  const visited = new Set<string>()
  const queue = [...startList]

  while (queue.length > 0) {
    const cur = queue.shift()
    if (!cur || visited.has(cur) || !idToNode.has(cur)) continue
    visited.add(cur)
    const node = idToNode.get(cur)
    if (node) {
      seq.push({
        courseId: node.data?.payload?.courseId,
        courseName: node.data?.payload?.courseName,
        nodeId: node.id,
      })
    }

    const nexts = Array.from(adjacency.get(cur) || [])
      .sort((a, b) => courseName(a).localeCompare(courseName(b)))
    for (const next of nexts) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  if (seq.length === 0) {
    return courseNodes
      .slice()
      .sort((a, b) =>
        String(a.data?.payload?.courseName).localeCompare(String(b.data?.payload?.courseName)),
      )
      .map((n) => ({
        courseId: n.data?.payload?.courseId,
        courseName: n.data?.payload?.courseName,
        nodeId: n.id,
      }))
  }

  const remaining = courseNodes
    .filter((n) => !visited.has(n.id))
    .sort((a, b) =>
      String(a.data?.payload?.courseName).localeCompare(String(b.data?.payload?.courseName)),
    )

  for (const n of remaining) {
    seq.push({
      courseId: n.data?.payload?.courseId,
      courseName: n.data?.payload?.courseName,
      nodeId: n.id,
    })
  }

  return seq
}

function statusConfig(status?: string) {
  const raw = String(status || '').trim()
  if (!raw) return { label: '-', class: 'bg-slate-50 border-slate-200 text-slate-600', icon: Clock }
  const s = raw.toLowerCase()
  const normalized = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const key = normalized.replace(/[\s_]+/g, '')

  const map: Record<string, { label: string; class: string; icon: any }> = {
    current: { label: 'Em Andamento', class: 'bg-blue-50 border-blue-200 text-blue-700', icon: Clock },
    pending: { label: 'Aguardando', class: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock },
    done: { label: 'Concluido', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    emandamento: { label: 'Em Andamento', class: 'bg-blue-50 border-blue-200 text-blue-700', icon: Clock },
    inprogress: { label: 'Em Andamento', class: 'bg-blue-50 border-blue-200 text-blue-700', icon: Clock },
    incompleto: { label: 'Incompleto', class: 'bg-rose-50 border-rose-200 text-rose-700', icon: AlertCircle },
    incomplete: { label: 'Incompleto', class: 'bg-rose-50 border-rose-200 text-rose-700', icon: AlertCircle },
    concluido: { label: 'Concluido', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    concluiu: { label: 'Concluido', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    conclude: { label: 'Concluido', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    concluded: { label: 'Concluido', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    ea: { label: 'Em Andamento', class: 'bg-blue-50 border-blue-200 text-blue-700', icon: Clock },
    a: { label: 'Aguardando', class: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock },
    aguardando: { label: 'Aguardando', class: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock },
    di: { label: 'Dispensa (Insatisfacao)', class: 'bg-rose-50 border-rose-200 text-rose-700', icon: AlertCircle },
    dc: { label: 'Dispensa (Cadeira)', class: 'bg-rose-50 border-rose-200 text-rose-700', icon: AlertCircle },
    e: { label: 'Efetivacao', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    efetivacao: { label: 'Efetivacao', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    efetivado: { label: 'Efetivacao', class: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle2 },
    pi: { label: 'Pedido (Insatisfacao)', class: 'bg-amber-50 border-amber-200 text-amber-700', icon: AlertCircle },
    pic: { label: 'Pedido (Insatisfacao - Cadeira)', class: 'bg-amber-50 border-amber-200 text-amber-700', icon: AlertCircle },
    tc: { label: 'Termino de Contrato', class: 'bg-slate-50 border-slate-200 text-slate-600', icon: AlertCircle },
  }

  return map[key] || map[s] || { label: raw, class: 'bg-slate-50 border-slate-200 text-slate-600', icon: Clock }
}

function fmtDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatDayOfWeek(value?: string | null) {
  if (!value) return ''
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/[^\x00-\x7F]/.test(raw)) return raw
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '')
  const map: Record<string, string> = {
    monday: 'Segunda',
    segunda: 'Segunda',
    seg: 'Segunda',
    '1': 'Segunda',
    tuesday: 'Terca',
    terca: 'Terca',
    tercafeira: 'Terca',
    tue: 'Terca',
    '2': 'Terca',
    wednesday: 'Quarta',
    quarta: 'Quarta',
    qua: 'Quarta',
    '3': 'Quarta',
    thursday: 'Quinta',
    quinta: 'Quinta',
    qui: 'Quinta',
    '4': 'Quinta',
    friday: 'Sexta',
    sexta: 'Sexta',
    sex: 'Sexta',
    '5': 'Sexta',
    saturday: 'Sabado',
    sabado: 'Sabado',
    sab: 'Sabado',
    '6': 'Sabado',
    sunday: 'Domingo',
    domingo: 'Domingo',
    dom: 'Domingo',
    '0': 'Domingo',
    '7': 'Domingo',
  }
  return map[normalized] || raw
}

function evolutionLabel(item?: ProgressItem) {
  const cond = item?.condition
  const mode =
    cond?.evolutionMode ??
    (cond?.useClassEndDate
      ? 'classEnd'
      : cond?.evolveAt
        ? 'specific'
        : cond?.startDate || cond?.endDate
          ? 'range'
          : 'none')
  if (mode === 'classEnd' || cond?.useClassEndDate) return 'Término da turma'
  if (mode === 'specific') return fmtDate(cond?.evolveAt || item?.evolveAt)
  if (mode === 'range') {
    const start = fmtDate(cond?.startDate)
    const end = fmtDate(cond?.endDate)
    if (start !== '-' || end !== '-') return `${start} → ${end}`
  }
  return fmtDate(item?.evolveAt)
}

function normalizeKey(value?: string) {
  if (!value) return ''
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '')
}

const courseSeq = computed(() => deriveCourseSequence(props.nodes, props.edges))
const classMetaByName = computed(() => {
  const map = new Map<string, { dayOfWeek?: string | null; onlyWithContract?: unknown }>()
  for (const n of props.nodes || []) {
    if (n.type !== 'course') continue
    const classes = (n.data as any)?.payload?.classes || []
    for (const cls of classes) {
      const name = String((cls as any)?.name || '').trim()
      if (!name) continue
      map.set(name, {
        dayOfWeek: (cls as any)?.dayOfWeek ?? null,
        onlyWithContract: (cls as any)?.onlyWithContract ?? (cls as any)?.requires_contract,
      })
    }
  }
  return map
})
const rows = ref<RowItem[]>([])
const edit = ref<EditState | null>(null)
const searchQuery = ref('')
const hasLoadedRows = ref(false)
const totalCount = ref(0)
const pageLimit = ref(10)
const pageOffset = ref(0)

/** Accordion state */
const expanded = ref<Set<number>>(new Set())
function isExpanded(rowId: number) {
  return expanded.value.has(rowId)
}
function toggleRow(rowId: number) {
  const next = new Set(expanded.value)
  if (next.has(rowId)) next.delete(rowId)
  else next.add(rowId)
  expanded.value = next
}
function summarizeRow(r: RowItem) {
  let ok = 0, doing = 0, bad = 0
  for (const c of courseSeq.value) {
    const p = getProgress(r, c)
    if (!p?.status) continue
    const raw = String(p.status || '').toLowerCase()
    const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]+/g, '')
    if (normalized === 'concluido' || normalized === 'conclude' || normalized === 'concluded' || normalized === 'done') ok++
    else if (normalized === 'emandamento' || normalized === 'inprogress' || normalized === 'current') doing++
    else if (normalized === 'incompleto' || normalized === 'incomplete') bad++
  }
  return { ok, doing, bad }
}

function countIneligibleSteps(r: RowItem) {
  let count = 0
  for (const c of courseSeq.value) {
    const p = getProgress(r, c)
    if (p?.eligibilityAny === false || p?.eligibleForNext === false) count++
  }
  return count
}

function classDayLabel(item?: ProgressItem) {
  if (!item?.className) return ''
  const meta = classMetaByName.value.get(item.className)
  return formatDayOfWeek(meta?.dayOfWeek ?? '')
}

function classContractLabel(item?: ProgressItem) {
  if (!item?.className) return ''
  const meta = classMetaByName.value.get(item.className)
  if (!meta) return ''
  return onlyWithContractFlag({ onlyWithContract: meta.onlyWithContract }) ? 'Contrato' : 'Livre'
}

function eligibilityReasonLabel(code: string) {
  const map: Record<string, string> = {
    nocurrentstep: 'Sem etapa atual',
    notcurrentstep: 'Aguardando evolucao',
    noconditionforstep: 'Sem condicao definida para a etapa',
    conditionnotfound: 'Condicao nao encontrada',
    classstatusmismatch: 'Status da turma nao atende a condicao',
    classnotended: 'Turma ainda nao finalizada',
    beforespecificdate: 'Data especifica ainda nao atingida',
    attendanceunavailable: 'Frequencia nao disponivel',
    attendancebelowminimum: 'Frequencia abaixo do minimo',
    examunavailable: 'Nota nao disponivel',
    exambelowminimum: 'Nota abaixo do minimo',
    lessonscompletionunavailable: 'Conclusao de aulas nao disponivel',
    lessonsnotcompleted: 'Aulas nao concluidas',
    contractstatusmismatch: 'Status do contrato nao atende a condicao',
    finalstep: 'Evolucao completa',
  }
  const key = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  return map[key] || ''
}

function isWaitingEvolution(reasons?: string[]) {
  return (reasons || []).some((reason) => eligibilityReasonLabel(reason) === 'Aguardando evolucao')
}

async function loadApprenticeWorkflows() {
  if (props.workflowId === undefined || props.workflowId === null || props.workflowId === '') {
    rows.value = []
    hasLoadedRows.value = true
    return
  }

  try {
    const q = searchQuery.value.trim()
    const res = await api.getApprenticeWorkflows(props.workflowId, {
      limit: pageLimit.value,
      offset: pageOffset.value,
      q: q || undefined,
    })
    const payload = res.data as any
    const list: ApiApprentice[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : []
    totalCount.value = Number(payload?.total ?? list.length ?? 0) || 0
    rows.value = list.map((item) => {
      const contracts = Array.isArray(item.contracts) ? item.contracts : []
      const primary = selectPrimaryContract(contracts)
      const progress: Record<string, ProgressItem> = {}
      const steps = Array.isArray(item.steps) ? item.steps : []
      for (const step of steps) {
        const key = String(step?.courseName || '').trim()
        if (!key) continue
        const stats = step?.class?.stats || {}
        const attendanceRaw = stats.actual_attendance_percentage ?? stats.attendance_record_percentage
        const examRaw = stats.overall_average ?? stats.overall_performance
        const attendance = attendanceRaw !== undefined ? Number(attendanceRaw) : undefined
        const exam = examRaw !== undefined ? Number(examRaw) : undefined
        const eligibility = step?.eligibility || {}
        const entry = {
          className: step?.class?.name ?? undefined,
          status: step?.status ?? undefined,
          attendance: Number.isFinite(attendance as number) ? (attendance as number) : undefined,
          exam: Number.isFinite(exam as number) ? (exam as number) : undefined,
          eligibleForNext: step?.eligibleForNext ?? null,
          eligibleForNextReason: Array.isArray(step?.eligibleForNextReason)
            ? step.eligibleForNextReason.map((r: any) => String(r))
            : [],
          eligibilityAny:
            typeof eligibility?.anyEligible === 'boolean' ? eligibility.anyEligible : null,
          eligibilityReasons: Array.isArray(eligibility?.reasons)
            ? eligibility.reasons.map((r: any) => String(r))
            : [],
          eligibilityByCondition: Array.isArray(eligibility?.byCondition)
            ? eligibility.byCondition.map((item: any) => ({
                nodeKey: String(item?.nodeKey || ''),
                eligible: !!item?.eligible,
                reasons: Array.isArray(item?.reasons) ? item.reasons.map((r: any) => String(r)) : [],
              }))
            : [],
          isFinalStep:
            typeof step?.isFinalStep === 'boolean'
              ? step.isFinalStep
              : Array.isArray(eligibility?.reasons)
                ? eligibility.reasons.some((r: any) => String(r) === 'finalStep')
                : false,
        }
        progress[key] = entry
        const normalized = normalizeKey(key)
        if (normalized) progress[`n:${normalized}`] = entry
        if (step?.courseId !== undefined && step?.courseId !== null) {
          progress[`id:${step.courseId}`] = entry
        }
        if (step?.nodeKey) progress[`node:${step.nodeKey}`] = entry
      }
      return {
        id: Number(item.apprenticeId) || 0,
        name: String(item.name || ''),
        cpf: String(item.cpf || ''),
        email: String(item.email || ''),
        contract: primary
          ? {
              company: String(primary.corporateName || ''),
              start: String(primary.startedAt || ''),
              end: primary.endedAt ? String(primary.endedAt) : '',
              status: String(primary.status || ''),
            }
          : null,
        progress,
      }
    })
  } catch (e) {
    console.error('Erro ao buscar workflows/{id}/apprentices', e)
    rows.value = []
    totalCount.value = 0
  } finally {
    hasLoadedRows.value = true
  }
}

onMounted(loadApprenticeWorkflows)

watch(
  () => props.workflowId,
  () => {
    hasLoadedRows.value = false
    rows.value = []
    totalCount.value = 0
    loadApprenticeWorkflows()
  },
)

watch(
  () => searchQuery.value,
  () => {
    hasLoadedRows.value = false
    pageOffset.value = 0
    loadApprenticeWorkflows()
  },
)

const filteredRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.cpf.includes(q) ||
      r.email.toLowerCase().includes(q),
  )
})

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const isLoading = computed(() => !hasLoadedRows.value)
const showNoData = computed(
  () => hasLoadedRows.value && rows.value.length === 0 && !isSearchActive.value,
)
const showNoResults = computed(
  () => hasLoadedRows.value && filteredRows.value.length === 0 && isSearchActive.value,
)
const totalPages = computed(() => {
  const limit = pageLimit.value || 1
  return Math.max(1, Math.ceil(totalCount.value / limit))
})
const currentPage = computed(() =>
  Math.min(totalPages.value, Math.floor(pageOffset.value / pageLimit.value) + 1),
)
const pageStart = computed(() => (totalCount.value === 0 ? 0 : pageOffset.value + 1))
const pageEnd = computed(() => Math.min(pageOffset.value + rows.value.length, totalCount.value))

function goToPage(page: number) {
  const safe = Math.min(Math.max(page, 1), totalPages.value)
  const nextOffset = (safe - 1) * pageLimit.value
  if (nextOffset === pageOffset.value) return
  hasLoadedRows.value = false
  pageOffset.value = nextOffset
  loadApprenticeWorkflows()
}

function prevPage() {
  goToPage(currentPage.value - 1)
}

function nextPage() {
  goToPage(currentPage.value + 1)
}

function getProgress(row: RowItem, course: CourseSeqItem) {
  const direct = row.progress?.[course.courseName]
  if (direct) return direct
  const normalized = normalizeKey(course.courseName)
  if (normalized) {
    const byNormalized = row.progress?.[`n:${normalized}`]
    if (byNormalized) return byNormalized
  }
  if (course.courseId !== undefined) {
    const byId = row.progress?.[`id:${course.courseId}`]
    if (byId) return byId
  }
  const byNode = row.progress?.[`node:${course.nodeId}`]
  return byNode || undefined
}

function conditionOptionsForCourse(course: CourseSeqItem) {
  const nodeTypeById = new Map(props.nodes.map((n) => [n.id, n.type]))
  const found = new Set<string>()
  for (const e of props.edges || []) {
    if (e.source !== course.nodeId) continue
    if (!String(e.sourceHandle || '').startsWith('class-out')) continue
    if (String(e.targetHandle || '') !== 'if-in') continue
    if (nodeTypeById.get(String(e.target)) !== 'condition') continue
    found.add(String(e.target))
  }
  return Array.from(found)
    .sort()
    .map((nodeKey, idx) => ({ nodeKey, label: `Condicao ${idx + 1}` }))
}

function defaultConditionKey(options: { nodeKey: string }[]) {
  if (options.length <= 1) return options[0]?.nodeKey ?? null
  for (const opt of options) {
    const hasOk = (props.edges || []).some(
      (e) => e.source === opt.nodeKey && e.sourceHandle === 'if-ok',
    )
    if (hasOk) return opt.nodeKey
  }
  return options[0]?.nodeKey ?? null
}

function resolveProgressKey(row: RowItem, course: CourseSeqItem) {
  if (row.progress?.[course.courseName]) return course.courseName
  const normalized = normalizeKey(course.courseName)
  if (normalized && row.progress?.[`n:${normalized}`]) return `n:${normalized}`
  if (course.courseId !== undefined && row.progress?.[`id:${course.courseId}`]) return `id:${course.courseId}`
  if (row.progress?.[`node:${course.nodeId}`]) return `node:${course.nodeId}`
  return course.courseName
}

function selectPrimaryContract(contracts: ApiContract[]) {
  if (contracts.length === 0) return null
  const active = contracts.find((c) => String(c.status || '').toUpperCase() === 'EA')
  if (active) return active
  const sorted = contracts
    .slice()
    .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
  return sorted[0] ?? contracts[0]
}

function applyResolvedConditionToEdit(payload: Record<string, any>) {
  if (!edit.value) return
  const cleanDate = (value: any) => {
    if (value === null || value === undefined) return ''
    const raw = String(value)
    if (!raw || raw === '0000-00-00') return ''
    return raw
  }
  const current = edit.value.value
  const next: EditValue = {
    ...current,
    startDate: cleanDate(payload.startDate),
    endDate: cleanDate(payload.endDate),
    evolveAt: cleanDate(payload.evolveAt),
    evolutionMode: (payload.evolutionMode as any) || current.evolutionMode || 'none',
    minAttendance: Number(payload.minAttendance ?? current.minAttendance ?? 100),
    minExamGrade: Number(payload.minExamGrade ?? current.minExamGrade ?? 0),
    mustCompleteLessons: !!(payload.mustCompleteLessons ?? current.mustCompleteLessons),
    checkContract: !!(payload.checkContract ?? current.checkContract),
    contractStatus: Array.isArray(payload.contractStatus) ? payload.contractStatus : (current.contractStatus || []),
    classInsertStatus: String(payload.classInsertStatus ?? current.classInsertStatus ?? 'inProgress'),
    classExitStatus: String(payload.classExitStatus ?? current.classExitStatus ?? 'conclude'),
    classCheckStatus: String(payload.classCheckStatus ?? current.classCheckStatus ?? 'inProgress'),
    hasMinGrade: !!(payload.hasMinGrade ?? current.hasMinGrade),
    hasAttendance: !!(payload.hasAttendance ?? current.hasAttendance),
    useClassEndDate: !!(payload.useClassEndDate ?? current.useClassEndDate),
    keepSameDayOfWeek: !!(payload.keepSameDayOfWeek ?? current.keepSameDayOfWeek),
    isBalanced: !!(payload.isBalanced ?? current.isBalanced),
    balanceStrategy: Array.isArray(payload.balanceStrategy)
      ? payload.balanceStrategy
      : (current.balanceStrategy || []),
  }
  if (!next.evolutionMode || next.evolutionMode === 'none') {
    const inferred =
      next.useClassEndDate
        ? 'classEnd'
        : next.evolveAt
          ? 'specific'
          : next.startDate || next.endDate
            ? 'range'
            : 'none'
    next.evolutionMode = inferred
  }
  edit.value = { ...edit.value, value: next }
}

function applyOverridePatchToEdit(payload: Record<string, any>) {
  if (!edit.value) return
  const current = edit.value.value
  const patch: Partial<EditValue> = {}
  if ('startDate' in payload) patch.startDate = String(payload.startDate ?? '')
  if ('endDate' in payload) patch.endDate = String(payload.endDate ?? '')
  if ('evolveAt' in payload) patch.evolveAt = String(payload.evolveAt ?? '')
  if ('evolutionMode' in payload) patch.evolutionMode = payload.evolutionMode
  if ('minAttendance' in payload) patch.minAttendance = Number(payload.minAttendance)
  if ('minExamGrade' in payload) patch.minExamGrade = Number(payload.minExamGrade)
  if ('mustCompleteLessons' in payload) patch.mustCompleteLessons = !!payload.mustCompleteLessons
  if ('checkContract' in payload) patch.checkContract = !!payload.checkContract
  if ('contractStatus' in payload) {
    patch.contractStatus = Array.isArray(payload.contractStatus) ? payload.contractStatus : []
  }
  if ('classInsertStatus' in payload) patch.classInsertStatus = String(payload.classInsertStatus || '')
  if ('classExitStatus' in payload) patch.classExitStatus = String(payload.classExitStatus || '')
  if ('classCheckStatus' in payload) patch.classCheckStatus = String(payload.classCheckStatus || '')
  if ('hasMinGrade' in payload) patch.hasMinGrade = !!payload.hasMinGrade
  if ('hasAttendance' in payload) patch.hasAttendance = !!payload.hasAttendance
  if ('useClassEndDate' in payload) patch.useClassEndDate = !!payload.useClassEndDate
  if ('keepSameDayOfWeek' in payload) patch.keepSameDayOfWeek = !!payload.keepSameDayOfWeek
  if ('isBalanced' in payload) patch.isBalanced = !!payload.isBalanced
  if ('balanceStrategy' in payload) {
    patch.balanceStrategy = Array.isArray(payload.balanceStrategy) ? payload.balanceStrategy : []
  }
  edit.value = { ...edit.value, value: { ...current, ...patch } }
}

async function loadOverrideMetaForEdit() {
  if (!edit.value) return
  if (!props.workflowId || !edit.value.conditionNodeKey) return
  try {
    const res = await api.listWorkflowOverrides(props.workflowId, edit.value.apprenticeId)
    const list = Array.isArray(res.data) ? res.data : []
    const match = list.find((item: any) => String(item.nodeKey) === String(edit.value?.conditionNodeKey))
    edit.value = { ...edit.value, overrideId: match?.id ? Number(match.id) : null }
    if (match?.override && typeof match.override === 'object') {
      applyOverridePatchToEdit(match.override as Record<string, any>)
    }
  } catch (e) {
    console.error('Erro ao buscar overrides', e)
  }
}

async function loadResolvedConditionForEdit() {
  if (!edit.value) return
  if (!props.workflowId || !edit.value.conditionNodeKey) return
  try {
    const res = await api.getResolvedCondition(
      props.workflowId,
      edit.value.conditionNodeKey,
      edit.value.apprenticeId,
    )
    if (res?.data && typeof res.data === 'object') {
      applyResolvedConditionToEdit(res.data as Record<string, any>)
    }
  } catch (e) {
    console.error('Erro ao buscar condicao resolvida', e)
  }
}

async function changeConditionKey(nodeKey: string) {
  if (!edit.value) return
  edit.value = { ...edit.value, conditionNodeKey: nodeKey, overrideId: null }
  await loadOverrideMetaForEdit()
  await loadResolvedConditionForEdit()
}

async function openEdit(row: RowItem, course: CourseSeqItem) {
  const courseKey = resolveProgressKey(row, course)
  const p = row.progress?.[courseKey]
  const options = conditionOptionsForCourse(course)
  const conditionNodeKey = defaultConditionKey(options)
  const baseValue: EditValue = {
    startDate: '',
    endDate: p?.evolveAt || '',
    evolveAt: p?.condition?.evolveAt || p?.evolveAt || '',
    evolutionMode: 'none',
    minAttendance: 100,
    minExamGrade: 0,
    mustCompleteLessons: true,
    checkContract: false,
    contractStatus: ['EA'],
    classInsertStatus: 'inProgress',
    classExitStatus: 'conclude',
    classCheckStatus: 'inProgress',
    useClassEndDate: false,
    keepSameDayOfWeek: false,
    isBalanced: false,
  }
  edit.value = {
    rowId: row.id,
    apprenticeId: row.id,
    courseKey,
    courseName: course.courseName,
    conditionNodeKey,
    conditionOptions: options,
    overrideId: null,
    value: {
      ...baseValue,
      ...(p?.condition || {}),
    },
  }
  if (edit.value) {
    const v = edit.value.value
    if (!v.evolutionMode || v.evolutionMode === 'none') {
      const inferred =
        v.useClassEndDate
          ? 'classEnd'
          : v.evolveAt
            ? 'specific'
            : v.startDate || v.endDate
              ? 'range'
              : 'none'
      edit.value = { ...edit.value, value: { ...v, evolutionMode: inferred } }
    }
  }
  await loadOverrideMetaForEdit()
  await loadResolvedConditionForEdit()
}

function closeEdit() {
  edit.value = null
}

function updateEditField<T extends keyof EditValue>(key: T, value: EditValue[T]) {
  if (!edit.value) return
  edit.value = { ...edit.value, value: { ...edit.value.value, [key]: value } }
}

function updateEditFields(patch: Partial<EditValue>) {
  if (!edit.value) return
  edit.value = { ...edit.value, value: { ...edit.value.value, ...patch } }
}

function setEvolutionMode(mode: EditValue['evolutionMode']) {
  if (!edit.value) return
  const patch: Partial<EditValue> = { evolutionMode: mode }
  if (mode === 'none') {
    patch.evolveAt = ''
    patch.startDate = ''
    patch.endDate = ''
    patch.useClassEndDate = false
  } else if (mode === 'specific') {
    patch.useClassEndDate = false
    patch.startDate = ''
    patch.endDate = ''
    patch.evolveAt = edit.value.value.evolveAt || ''
  } else if (mode === 'range') {
    patch.useClassEndDate = false
    patch.evolveAt = ''
    patch.startDate = edit.value.value.startDate || ''
    patch.endDate = edit.value.value.endDate || ''
  } else if (mode === 'classEnd') {
    patch.useClassEndDate = true
    patch.evolveAt = ''
    patch.startDate = ''
    patch.endDate = ''
  }
  updateEditFields(patch)
}

function sanitizeOneToHundred(value: unknown) {
  const raw = String(value ?? '').replace(/\D+/g, '')
  if (!raw) return { n: 1, text: '1' }
  const trimmed = raw.slice(0, 3)
  let n = Number(trimmed)
  if (!Number.isFinite(n)) n = 1
  n = Math.min(100, Math.max(1, n))
  return { n, text: String(n) }
}

async function saveEdit() {
  if (!edit.value) return
  if (!props.workflowId || !edit.value.conditionNodeKey) return
  const override = {
    startDate: edit.value.value.startDate,
    endDate: edit.value.value.endDate,
    evolveAt: edit.value.value.evolveAt,
    evolutionMode: edit.value.value.evolutionMode,
    minAttendance: edit.value.value.minAttendance,
    minExamGrade: edit.value.value.minExamGrade,
    mustCompleteLessons: edit.value.value.mustCompleteLessons,
    checkContract: edit.value.value.checkContract,
    contractStatus: edit.value.value.contractStatus || [],
    classInsertStatus: edit.value.value.classInsertStatus,
    classExitStatus: edit.value.value.classExitStatus,
    classCheckStatus: edit.value.value.classCheckStatus,
    hasMinGrade: edit.value.value.hasMinGrade,
    hasAttendance: edit.value.value.hasAttendance,
    useClassEndDate: edit.value.value.useClassEndDate,
    keepSameDayOfWeek: edit.value.value.keepSameDayOfWeek,
    isBalanced: edit.value.value.isBalanced,
    balanceStrategy: edit.value.value.balanceStrategy || [],
  }

  try {
    if (edit.value.overrideId) {
      await api.updateWorkflowOverride(props.workflowId, edit.value.overrideId, override)
    } else {
      const res = await api.createWorkflowOverride(
        props.workflowId,
        edit.value.apprenticeId,
        edit.value.conditionNodeKey,
        override,
      )
      const createdId = res?.data?.id ?? res?.data?.override?.id
      if (createdId) {
        edit.value = { ...edit.value, overrideId: Number(createdId) }
      }
    }
    closeEdit()
  } catch (e) {
    console.error('Erro ao salvar override', e)
    closeEdit()
  }
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-slate-50 text-[13px] leading-tight">
    <!-- Header -->
    <div class="sticky top-0 z-20 border-b bg-white shadow-sm">
      <div class="px-4 py-3">
        <div class="flex items-center justify-between gap-3 mb-2">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <TrendingUp class="h-5 w-5 text-blue-600" />
              <h2 class="text-lg font-bold text-slate-900">Acompanhamento de Aprendizes</h2>
            </div>
            <p class="text-xs text-slate-600">
              Visualização dinâmica do progresso dos aprendizes através do workflow de cursos
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
                class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
            >
              <Users class="h-3.5 w-3.5" />
              {{ totalCount }} aprendizes
            </span>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <Input v-model="searchQuery" placeholder="Buscar por nome, CPF ou email..." class="h-9" />
          </div>
        </div>
        <div class="flex items-center justify-between gap-2 mt-2">
          <div class="text-[11px] text-slate-600">
            Mostrando {{ pageStart }}-{{ pageEnd }} de {{ totalCount }} aprendizes
          </div>
          <div class="flex items-center gap-1.5">
            <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                :disabled="isLoading || currentPage === 1"
                @click="prevPage"
            >
              <ChevronLeft class="h-4 w-4" />
            </Button>
            <div class="text-[11px] font-semibold text-slate-700">
              Pagina {{ currentPage }} de {{ totalPages }}
            </div>
            <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                :disabled="isLoading || currentPage === totalPages"
                @click="nextPage"
            >
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Course Headers -->
      <div class="border-t bg-gradient-to-br from-slate-50 to-white px-4 py-2.5">
        <div class="flex items-center gap-2.5">
          <div class="w-[280px] shrink-0">
            <div class="text-xs font-bold text-slate-900 uppercase tracking-wide">Aprendiz</div>
          </div>
          <div class="w-[240px] shrink-0">
            <div class="text-xs font-bold text-slate-900 uppercase tracking-wide">Contrato</div>
          </div>
          <div class="flex flex-1 gap-2.5 overflow-x-auto">
            <div v-for="(c, idx) in courseSeq" :key="c.nodeId" class="w-[480px] shrink-0">
              <div class="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs"
                >
                  {{ idx + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-bold text-blue-900 truncate">{{ c.courseName }}</div>
                  <div class="text-[11px] text-blue-700">Etapa {{ idx + 1 }} do workflow</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-auto">
      <div class="p-4 space-y-2.5">
        <div
            v-if="isLoading"
            class="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center"
        >
          <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500"></div>
          <div class="text-sm font-semibold text-slate-900 mb-1">Carregando aprendizes...</div>
          <div class="text-xs text-slate-500">Buscando evolucoes do workflow selecionado</div>
        </div>
        <!-- ROWS: table-like + accordion -->
        <div
            v-for="r in filteredRows"
            :key="r.id"
            v-if="!isLoading"
            class="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden"
        >
          <!-- Accordion Header (line) -->
          <button type="button" class="w-full text-left" @click="toggleRow(r.id)">
            <div class="flex items-start gap-2.5 p-3">
              <!-- Student Info -->
              <div class="w-[280px] shrink-0">
                <div class="flex items-start gap-3">
                  <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs"
                  >
                    {{ r.name.split(' ').map((n) => n[0]).join('').substring(0, 2) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-bold text-slate-900 truncate">{{ r.name }}</div>
                    <div class="text-[11px] text-slate-600 truncate">{{ r.cpf }}</div>
                    <div class="text-[11px] text-slate-500 truncate">{{ r.email }}</div>
                  </div>
                </div>
              </div>

              <!-- Contract Info -->
              <div class="w-[240px] shrink-0">
                <template v-if="r.contract">
                  <div class="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div class="flex items-center gap-1.5 mb-1">
                      <FileText class="h-3.5 w-3.5 text-slate-600" />
                      <div class="text-[11px] font-semibold text-slate-900 truncate">{{ r.contract.company }}</div>
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-slate-600 mb-1">
                      <Calendar class="h-3 w-3" />
                      <span>{{ fmtDate(r.contract.start) }} → {{ fmtDate(r.contract.end) }}</span>
                    </div>
                    <span
                        :class="statusConfig(r.contract.status).class"
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    >
                      <component :is="statusConfig(r.contract.status).icon" class="h-3 w-3" />
                      {{ statusConfig(r.contract.status).label }}
                    </span>
                  </div>
                </template>
                <template v-else>
                  <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5 text-center">
                    <div class="text-[11px] text-slate-500 font-medium">Sem contrato</div>
                  </div>
                </template>
              </div>

              <!-- Summary area (instead of showing everything) -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                        class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
                    >
                      <CheckCircle2 class="h-3.5 w-3.5" />
                      {{ summarizeRow(r).ok }} concluído(s)
                    </span>
                    <span
                        class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
                    >
                      <Clock class="h-3.5 w-3.5" />
                      {{ summarizeRow(r).doing }} em andamento
                    </span>
                    <span
                        class="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                    >
                      <AlertCircle class="h-3.5 w-3.5" />
                        {{ summarizeRow(r).bad }} incompleto(s)
                      </span>
                      <span
                          v-if="countIneligibleSteps(r) > 0"
                          class="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                      >
                        <AlertCircle class="h-3.5 w-3.5" />
                        {{ countIneligibleSteps(r) }} nao elegivel(is)
                      </span>

                    <span class="text-xs text-slate-500 ml-1">
                      Clique para {{ isExpanded(r.id) ? 'recolher' : 'ver detalhes' }}
                    </span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <Button
                        size="icon"
                        variant="ghost"
                        class="h-8 w-8"
                        :title="isExpanded(r.id) ? 'Recolher' : 'Ver detalhes'"
                        @click.stop="toggleRow(r.id)"
                    >
                      <ChevronRight
                          class="h-4 w-4 transition-transform"
                          :class="isExpanded(r.id) ? 'rotate-90' : ''"
                      />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </button>

          <!-- Accordion Content (same layout you already had for courses) -->
          <div v-show="isExpanded(r.id)" class="border-t bg-gradient-to-br from-white to-slate-50">
            <div class="p-4">
              <div class="flex flex-1 gap-3 overflow-x-auto">
                <div v-for="c in courseSeq" :key="`${r.id}:${c.courseName}`" class="w-[480px] shrink-0">
                  <template v-if="getProgress(r, c)">
                    <div class="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                      <!-- Class Name & Status -->
                      <div class="flex items-center justify-between gap-2 mb-3">
                        <div class="flex-1 min-w-0 gap-2">
                            <div class="text-sm font-bold text-slate-900 truncate mb-1">
                              {{ getProgress(r, c)?.className }}
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                               <span
                                   :class="statusConfig(getProgress(r, c)?.status).class"
                                   class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold"
                               >
                                <component :is="statusConfig(getProgress(r, c)?.status).icon" class="h-3.5 w-3.5" />
                                {{ statusConfig(getProgress(r, c)?.status).label }}
                              </span>
                              <span
                                  v-if="!getProgress(r, c)?.isFinalStep && (getProgress(r, c)?.eligibilityAny === true)"
                                  class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700  mb-1"
                              >
                                Elegivel
                              </span>
                              <span
                                  v-else-if="!getProgress(r, c)?.isFinalStep && (getProgress(r, c)?.eligibilityReasons || []).length > 0 && isWaitingEvolution(getProgress(r, c)?.eligibilityReasons)"
                                  class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
                              >
                                Aguardando evolucao
                              </span>
                              <span
                                  v-else-if="!getProgress(r, c)?.isFinalStep && ((getProgress(r, c)?.eligibilityAny === false) || (getProgress(r, c)?.eligibleForNext === false) || ((getProgress(r, c)?.eligibilityReasons || []).length > 0))"
                                  class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700"
                              >
                                Nao elegivel
                              </span>
                              <span
                                  v-if="getProgress(r, c)?.isFinalStep"
                                  class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                              >
                                Evolucao completa
                              </span>
                              <span
                                  v-if="classContractLabel(getProgress(r, c))"
                                  class="ml-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700"
                              >
                                {{ classContractLabel(getProgress(r, c)) }}
                              </span>
                              <span
                                  v-if="classDayLabel(getProgress(r, c))"
                                  class="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700"
                              >
                                <Calendar class="h-3.5 w-3.5" />
                                {{ classDayLabel(getProgress(r, c)) }}
                              </span>
                            </div>

                            </div>
                        <Button
                            v-if="!getProgress(r, c)?.isFinalStep"
                            size="icon"
                            variant="ghost"
                            class="h-8 w-8 shrink-0"
                            title="Editar condições"
                              @click.stop="openEdit(r, c)"
                        >
                          <Pencil class="h-4 w-4" />
                          </Button>
                        </div>

                        <div
                            v-if="(getProgress(r, c)?.eligibilityReasons || getProgress(r, c)?.eligibleForNextReason || []).length > 0 && !isWaitingEvolution(getProgress(r, c)?.eligibilityReasons || [])"
                            class="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700"
                        >
                          {{
                            (getProgress(r, c)?.eligibilityReasons?.length
                              ? getProgress(r, c)?.eligibilityReasons
                              : getProgress(r, c)?.eligibleForNextReason || []
                            )
                              .map((reason) => eligibilityReasonLabel(reason))
                              .filter(Boolean)
                              .join(', ')
                          }}
                        </div>

                        <!-- Metrics -->
                        <div class="grid grid-cols-2 gap-2 mb-3">
                        <div class="rounded-lg border border-slate-200 bg-white p-2">
                          <div class="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Presença</div>
                          <div class="flex items-baseline gap-1">
                              <span
                                  class="text-lg font-bold"
                                  :class="(getProgress(r, c)?.attendance ?? 0) >= 85 ? 'text-emerald-600' : 'text-rose-600'"
                              >
                                {{ getProgress(r, c)?.attendance?.toFixed(1) || '-' }}
                              </span>
                            <span class="text-xs text-slate-500">%</span>
                          </div>
                        </div>
                        <div class="rounded-lg border border-slate-200 bg-white p-2">
                          <div class="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Nota</div>
                          <div class="flex items-baseline gap-1">
                              <span
                                  class="text-lg font-bold"
                                  :class="(getProgress(r, c)?.exam ?? 0) >= 7 ? 'text-emerald-600' : 'text-rose-600'"
                              >
                                {{ getProgress(r, c)?.exam?.toFixed(1) || '-' }}
                              </span>
                            <span class="text-xs text-slate-500">/10</span>
                          </div>
                        </div>
                      </div>

                      <!-- Evolution Info -->
                      <div class="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                          <div class="text-[10px] font-semibold text-blue-900 uppercase tracking-wide">Evolução</div>
                          <div class="text-xs font-bold text-blue-700">
                            {{
                                evolutionLabel(getProgress(r, c))
                            }}
                          </div>
                        </div>

                        <div v-if="getProgress(r, c)?.condition?.isBalanced" class="space-y-1">
                          <div class="flex items-center gap-1.5 rounded-md bg-white border border-blue-200 px-2 py-1">
                            <Scale class="h-3 w-3 text-blue-600" />
                            <span class="text-[11px] font-semibold text-blue-900">
                              Destino: {{ r.id % 2 === 0 ? 'Turma B1' : 'Turma B2' }}
                            </span>
                          </div>
                          <div class="text-[9px] text-blue-700 px-1">
                            {{
                                getProgress(r, c)?.condition?.balanceStrategy?.length > 0
                                    ? getProgress(r, c)?.condition?.balanceStrategy
                                      .map((s) => (s === 'gender' ? 'Equilíbrio H/M/O' : 'Menor Lotação'))
                                      .join(' + ')
                                  : 'Menor Lotação'
                            }}
                          </div>
                        </div>
                        <div v-else class="text-[11px] text-blue-700">
                          Sem balanceamento ativo
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div
                        class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center h-full flex items-center justify-center"
                    >
                      <div class="text-xs text-slate-500 font-medium">Não matriculado</div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
            v-if="showNoData"
            class="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center"
        >
          <Users class="h-12 w-12 mx-auto mb-3 text-slate-400" />
          <div class="text-sm font-semibold text-slate-900 mb-1">Nao ha jovens para evoluir</div>
          <div class="text-xs text-slate-500">Aguarde novas evolucoes ou ajuste o workflow</div>
        </div>
        <div
            v-else-if="showNoResults"
            class="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center"
        >
          <Users class="h-12 w-12 mx-auto mb-3 text-slate-400" />
          <div class="text-sm font-semibold text-slate-900 mb-1">Nenhum aprendiz encontrado</div>
          <div class="text-xs text-slate-500">Tente ajustar sua busca</div>
        </div>
      </div>
    </div>

    <!-- Edit Sidebar -->
    <div v-if="edit" class="absolute inset-0 z-30">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeEdit" />
      <div class="absolute right-0 top-0 h-full w-[420px] border-l bg-white shadow-2xl overflow-auto">
        <div class="sticky top-0 z-10 flex items-center justify-between border-b bg-gradient-to-br from-blue-50 to-white p-5">
          <div>
            <div class="text-sm font-bold text-slate-900 mb-1">Configurar Evolução</div>
            <div class="text-xs text-slate-600">Aprendiz #{{ edit.rowId }} • {{ edit.courseName }}</div>
          </div>
          <Button size="icon" variant="ghost" class="h-8 w-8" @click="closeEdit">
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-4 p-5">
          <!-- Evolução por Data -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div class="flex items-center gap-2 mb-2">
              <Calendar class="h-4 w-4 text-slate-600" />
              <div class="text-xs font-bold text-slate-900 uppercase tracking-wide">Evolução por data</div>
            </div>
            <div class="space-y-2">
              <div class="space-y-1">
                <Label class="text-xs text-slate-700">Tipo de evolução</Label>
                <select
                    class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    :value="edit.value.evolutionMode || 'none'"
                    @change="(e) => setEvolutionMode((e.target as HTMLSelectElement).value as any)"
                >
                  <option value="none">Sem data (segue execução do workflow)</option>
                  <option value="specific">Data específica</option>
                  <option value="range">Período (início/fim)</option>
                  <option value="classEnd">Término da turma</option>
                </select>
              </div>

              <div v-if="edit.value.evolutionMode === 'specific'" class="space-y-1">
                <Label class="text-xs text-slate-700">Evoluir em</Label>
                <DatePicker
                    :model-value="edit.value.evolveAt"
                    @update:model-value="(value) => updateEditField('evolveAt', String(value))"
                />
              </div>

              <div v-if="edit.value.evolutionMode === 'range'" class="space-y-2">
                <div class="space-y-1">
                  <Label class="text-xs text-slate-700">Data início</Label>
                  <DatePicker
                      :model-value="edit.value.startDate"
                      @update:model-value="(value) => updateEditField('startDate', String(value))"
                  />
                </div>
                <div class="space-y-1">
                  <Label class="text-xs text-slate-700">Data término</Label>
                  <DatePicker
                      :model-value="edit.value.endDate"
                      @update:model-value="(value) => updateEditField('endDate', String(value))"
                  />
                </div>
              </div>

              <div v-if="edit.value.evolutionMode === 'classEnd'" class="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                A evolução ocorrerá no término da turma.
              </div>
            </div>
          </div>

          <!-- Performance Criteria -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div class="flex items-center gap-2 mb-2">
              <TrendingUp class="h-4 w-4 text-slate-600" />
              <div class="text-xs font-bold text-slate-900 uppercase tracking-wide">Critérios de Desempenho</div>
            </div>
            <div class="space-y-3">
              <div class="space-y-1">
                <Label class="text-xs text-slate-700">Presença mínima (%)</Label>
                <Input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    :model-value="edit.value.minAttendance"
                    @input="(e) => {
                      const target = e.target as HTMLInputElement
                      const { n, text } = sanitizeOneToHundred(target?.value)
                      if (target) target.value = text
                      updateEditField('minAttendance', n)
                    }"
                />
              </div>
              <div class="space-y-1">
                <Label class="text-xs text-slate-700">Nota mínima (0-10)</Label>
                <Input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    :model-value="edit.value.minExamGrade"
                    @input="(e) => {
                      const target = e.target as HTMLInputElement
                      const { n, text } = sanitizeOneToHundred(target?.value)
                      if (target) target.value = text
                      updateEditField('minExamGrade', n)
                    }"
                />
              </div>
              <div class="flex items-center justify-between rounded-lg border bg-white p-3">
                <div class="flex-1">
                  <div class="text-xs font-semibold text-slate-900">Aulas completas</div>
                  <div class="text-[10px] text-slate-600">Exigir todas as aulas</div>
                </div>
                <Switch
                    :checked="!!edit.value.mustCompleteLessons"
                    @update:checked="(value) => updateEditField('mustCompleteLessons', value)"
                />
              </div>
            </div>
          </div>

          <!-- Status na Turma -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div class="flex items-center gap-2 mb-2">
              <Users class="h-4 w-4 text-slate-600" />
              <div class="text-xs font-bold text-slate-900 uppercase tracking-wide">Status na Turma</div>
            </div>
            <div class="space-y-2">
              <div class="space-y-1">
                <Label class="text-xs text-slate-700">Checar status na turma</Label>
                <select
                    class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    :value="edit.value.classCheckStatus || ''"
                    @change="(e) => updateEditField('classCheckStatus', (e.target as HTMLSelectElement).value)"
                >
                  <option value="">Nao filtrar</option>
                  <option v-for="opt in CLASS_INSERT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                <div class="text-[10px] text-slate-600">Somente matriculados com este status</div>
              </div>
              <div class="space-y-1">
                <Label class="text-xs text-slate-700">Status na turma atual</Label>
                <select
                    class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    :value="edit.value.classExitStatus || ''"
                    @change="(e) => updateEditField('classExitStatus', (e.target as HTMLSelectElement).value)"
                >
                  <option value="">Nao definir</option>
                  <option v-for="opt in CLASS_INSERT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1">
                <Label class="text-xs text-slate-700">Status na turma destino</Label>
                <select
                    class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    :value="edit.value.classInsertStatus || ''"
                    @change="(e) => updateEditField('classInsertStatus', (e.target as HTMLSelectElement).value)"
                >
                  <option value="">Nao definir</option>
                  <option v-for="opt in CLASS_INSERT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Manter dia da semana -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Calendar class="h-4 w-4 text-slate-600" />
                <div>
                  <div class="text-xs font-bold text-slate-900">Manter dia da semana</div>
                  <div class="text-[10px] text-slate-600">SEGUNDA -> SEGUNDA</div>
                </div>
              </div>
              <Switch
                  :checked="!!edit.value.keepSameDayOfWeek"
                  @update:checked="(value) => updateEditField('keepSameDayOfWeek', value)"
              />
            </div>
          </div>

          <!-- Contract Check -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileText class="h-4 w-4 text-slate-600" />
                <div>
                  <div class="text-xs font-bold text-slate-900">Verificar Contrato</div>
                  <div class="text-[10px] text-slate-600">Validar status contratual</div>
                </div>
              </div>
              <Switch
                  :checked="!!edit.value.checkContract"
                  @update:checked="(value) => updateEditField('checkContract', value)"
              />
            </div>

            <div v-if="edit.value.checkContract" class="space-y-1.5 pt-2 border-t">
              <Label class="text-[10px] text-slate-700 uppercase tracking-wide">Status aceitos</Label>
              <div class="space-y-1">
                <label
                    v-for="opt in CONTRACT_STATUS_OPTIONS"
                    :key="opt.value"
                    class="flex items-center gap-2 rounded-lg border bg-white p-2 cursor-pointer hover:bg-slate-50"
                >
                  <input
                      type="checkbox"
                      :id="`grid-status-${opt.value}`"
                      :checked="edit.value.contractStatus?.includes(opt.value)"
                      @change="(e) => {
                      const checked = (e.target as HTMLInputElement).checked
                      const current = [...(edit.value.contractStatus || [])]
                      if (checked) {
                        if (!current.includes(opt.value)) current.push(opt.value)
                      } else {
                        const idx = current.indexOf(opt.value)
                        if (idx !== -1) current.splice(idx, 1)
                      }
                      updateEditField('contractStatus', current)
                    }"
                      class="h-4 w-4 rounded border-2"
                  />
                  <span class="text-xs text-slate-900">{{ opt.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Load Balancing -->
          <div class="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Scale class="h-4 w-4 text-blue-600" />
                <div>
                  <div class="text-xs font-bold text-blue-900">Balanceamento</div>
                  <div class="text-[10px] text-blue-700">Distribuir entre turmas</div>
                </div>
              </div>
              <Switch :checked="!!edit.value.isBalanced" @update:checked="(value) => updateEditField('isBalanced', value)" />
            </div>

            <div v-if="edit.value.isBalanced" class="space-y-2 pt-2 border-t border-blue-200">
              <Label class="text-[10px] text-blue-900 uppercase tracking-wide">Estratégias</Label>
              <div class="space-y-1.5">
                <label class="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-white cursor-pointer hover:bg-blue-50">
                  <input
                      type="checkbox"
                      :checked="edit.value.balanceStrategy?.includes('occupancy')"
                      @change="(e) => {
                      const checked = (e.target as HTMLInputElement).checked
                      const current = [...(edit.value.balanceStrategy || [])]
                      if (checked) {
                        if (!current.includes('occupancy')) current.push('occupancy')
                      } else {
                        const idx = current.indexOf('occupancy')
                        if (idx !== -1) current.splice(idx, 1)
                      }
                      updateEditField('balanceStrategy', current)
                    }"
                      class="h-4 w-4 rounded border-2"
                  />
                  <span class="text-xs font-medium text-slate-900">Menor Ocupação Geral</span>
                </label>

                <label class="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-white cursor-pointer hover:bg-blue-50">
                  <input
                      type="checkbox"
                      :checked="edit.value.balanceStrategy?.includes('gender')"
                      @change="(e) => {
                      const checked = (e.target as HTMLInputElement).checked
                      const current = [...(edit.value.balanceStrategy || [])]
                      if (checked) {
                        if (!current.includes('gender')) current.push('gender')
                      } else {
                        const idx = current.indexOf('gender')
                        if (idx !== -1) current.splice(idx, 1)
                      }
                      updateEditField('balanceStrategy', current)
                    }"
                      class="h-4 w-4 rounded border-2"
                  />
                  <span class="text-xs font-medium text-slate-900">Equilíbrio de Gênero (H/M/O)</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 pt-2">
            <Button variant="outline" class="flex-1" @click="closeEdit">Cancelar</Button>
            <Button class="flex-1 bg-blue-600 hover:bg-blue-700" @click="saveEdit">
              <CheckCircle2 class="h-4 w-4 mr-1.5" />
              Salvar
            </Button>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800">
            <strong>Nota:</strong> As configurações aqui são específicas para este aprendiz e sobrescrevem as condições padrão do workflow.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


