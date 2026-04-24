<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  BookOpen,
  ChevronLeft,
  RefreshCw
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import ConditionConfigForm from '@/components/condition-config-form.vue'
import { onlyWithContractFlag } from '@/lib/workflow'
import type { ConditionPayload } from '@/lib/workflow'
import { api } from '@/lib/api'

type CourseSeqItem = {
  courseId: number
  courseName: string
  nodeId: string
}

type EditValue = ConditionPayload

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

type ProgressByConditionItem = {
  nodeKey: string
  eligible: boolean
  reasons: string[]
  condition?: Partial<EditValue>
  overrideData?: Partial<EditValue>
  hasOverride?: boolean
}

type ProgressItem = {
  classId?: number
  className?: string
  classNodeKey?: string
  conditionNodeKey?: string
  hasEnrollment?: boolean
  status?: string
  attendance?: number
  exam?: number
  evolveAt?: string
  condition?: Partial<EditValue>
  eligibleForNext?: boolean | null
  eligibleForNextReason?: string[]
  eligibilityAny?: boolean | null
  eligibilityReasons?: string[]
  eligibilityByCondition?: ProgressByConditionItem[]
  isFinalStep?: boolean
  lessons?: ApiLesson[]
}

type ApiByConditionItem = {
  nodeKey?: string
  conditionNodeKey?: string
  condition_node_key?: string
  eligible?: boolean | number | string | null
  reasons?: string[]
  condition?: Partial<EditValue> | Record<string, any> | string | null
  override?:
    | {
        data?: Partial<EditValue> | Record<string, any> | string | null
      }
    | Record<string, any>
    | string
    | null
  hasOverride?: boolean | number | string | null
  has_override?: boolean | number | string | null
}

type RowContract = {
  partnerId?: string
  contractId?: string
  company: string
  start: string
  end: string
  status: string
}

type ApiContract = {
  partnerId?: number | string
  corporateName?: string
  contractId?: number | string
  startedAt?: string
  endedAt?: string | null
  status?: string
}

type ApiClassInfo = {
  id?: number | string
  name?: string
  identifier?: string
  nodeKey?: string
  stats?: Record<string, unknown>
}

type ApiStep = {
  nodeKey?: string
  order?: number
  courseId?: number
  classId?: number
  courseName?: string
  className?: string
  classNodeKey?: string
  class?: ApiClassInfo
  apprenticeStatus?: string | null
  status?: string
  isFinalStep?: boolean
  eligibleForNext?: boolean | null
  eligibleForNextReason?: string[]
  eligibility?: {
    anyEligible?: boolean | null
    reasons?: string[]
    byCondition?: ApiByConditionItem[]
  }
  conditionNodeKey?: string
  condition_node_key?: string
  evolveAt?: string
  evolve_at?: string
  condition?: Partial<EditValue> | Record<string, any> | null
  resolvedCondition?: Partial<EditValue> | Record<string, any> | null
  resolved_condition?: Partial<EditValue> | Record<string, any> | null
  lessons?: ApiLesson[]
  themes?: ApiLesson[]
  topics?: ApiLesson[]
}

type ApiLesson = {
  lesson?: string | number
  activated?: string | number | boolean | null
  name?: string
  attendance?: number | string | null
  concluded?: string | number | boolean | null
}

type WorkflowMembershipProgress = {
  completedSteps: number
  totalSteps: number
  percentage: number | null
}

type WorkflowMembershipTimelineItem = {
  order?: number
  classId?: string | number
  classInfo: ApiClassInfo | null
  classLabel: string
  status?: string
  concluded?: boolean | null
}

type WorkflowMembershipRun = {
  id?: string | number
  status?: string
  executionMode?: string
  scheduledAt?: string
  startedAt?: string
  finishedAt?: string
}

type WorkflowMembershipTransition = {
  id: string
  fromClass?: string | number
  fromClassInfo: ApiClassInfo | null
  toClass?: string | number
  toClassInfo: ApiClassInfo | null
  conditionNodeKey?: string
  result?: string
  mode?: string
  reasons: string[]
  createdAt?: string
  run: WorkflowMembershipRun | null
}

type WorkflowMembership = {
  status?: string
  timelinePath: string[]
  timeline: WorkflowMembershipTimelineItem[]
  entryClass?: string | number
  entryClassInfo: ApiClassInfo | null
  currentClass?: string | number
  currentClassInfo: ApiClassInfo | null
  currentStepOrder?: number
  currentStepNodeKey?: string
  currentStepLabel?: string
  progress: WorkflowMembershipProgress | null
  joinedAt?: string
  lastTransitionAt?: string
  completedAt?: string
  transitions: WorkflowMembershipTransition[]
  lastRun: WorkflowMembershipRun | null
}

type ApiApprentice = {
  apprenticeId?: number
  name?: string
  cpf?: string
  email?: string
  preferredContract?: ApiContract | null
  contracts?: ApiContract[]
  steps?: ApiStep[]
  workflowMembership?: unknown
}

type RowItem = {
  id: number
  name: string
  cpf: string
  email: string
  contract: RowContract | null
  contracts: RowContract[]
  progress: Record<string, ProgressItem>
  steps: ApiStep[]
  workflowMembership: WorkflowMembership | null
}

type DetailStepItem = {
  key: string
  order: number
  nodeKey: string
  label: string
  progress: ProgressItem | undefined
}

const props = defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
  workflowId: string | number
}>()

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (['true', 'sim', 'yes', 'y'].includes(normalized)) return true
  if (['false', 'nao', 'no', 'n'].includes(normalized)) return false
  return null
}

function normalizeClassInfo(value: unknown): ApiClassInfo | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const id = raw.id ?? raw.classId ?? raw.class
  const name = String(raw.name ?? '').trim()
  const identifier = String(raw.identifier ?? '').trim()
  const nodeKey = String(raw.nodeKey ?? raw.node_key ?? '').trim()
  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : undefined
  const info: ApiClassInfo = {
    id: id !== undefined && id !== null && id !== '' ? id : undefined,
    name: name || undefined,
    identifier: identifier || undefined,
    nodeKey: nodeKey || undefined,
    stats
  }
  return info.id !== undefined || info.name || info.identifier || info.nodeKey ? info : null
}

function formatClassLabel(info?: ApiClassInfo | null, fallback?: unknown) {
  const identifier = String(info?.identifier || '').trim()
  const name = String(info?.name || '').trim()
  if (identifier && name) return `${identifier} - ${name}`
  if (identifier) return identifier
  if (name) return name
  if (fallback === undefined || fallback === null || fallback === '') return '-'
  return typeof fallback === 'number' || /^\d+$/.test(String(fallback)) ? `#${String(fallback)}` : String(fallback)
}

function normalizeTimelinePathItem(value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const raw = value as Record<string, any>
    const classInfo = normalizeClassInfo(raw.classInfo ?? raw.class ?? raw)
    return formatClassLabel(classInfo, raw.classId ?? raw.class ?? raw.id)
  }
  return String(value)
}

function normalizeWorkflowRun(value: unknown): WorkflowMembershipRun | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const run: WorkflowMembershipRun = {
    id: raw.id ?? undefined,
    status: String(raw.status ?? '').trim() || undefined,
    executionMode: String(raw.executionMode ?? raw.execution_mode ?? '').trim() || undefined,
    scheduledAt: String(raw.scheduledAt ?? raw.scheduled_at ?? '').trim() || undefined,
    startedAt: String(raw.startedAt ?? raw.started_at ?? '').trim() || undefined,
    finishedAt: String(raw.finishedAt ?? raw.finished_at ?? '').trim() || undefined
  }
  return run.id !== undefined || run.status || run.executionMode || run.scheduledAt || run.startedAt || run.finishedAt
    ? run
    : null
}

function normalizeWorkflowTransition(value: unknown): WorkflowMembershipTransition | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const id = String(raw.id ?? '').trim()
  const fromClass = raw.fromClass ?? raw.from_class ?? raw.originClass ?? raw.origin_class
  const toClass = raw.toClass ?? raw.to_class ?? raw.destinationClass ?? raw.destination_class
  const transition: WorkflowMembershipTransition = {
    id:
      id ||
      [
        raw.createdAt ?? raw.created_at ?? '',
        raw.fromClass ?? raw.from_class ?? '',
        raw.toClass ?? raw.to_class ?? '',
        raw.conditionNodeKey ?? raw.condition_node_key ?? ''
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join(':') ||
      'transition',
    fromClass: fromClass !== undefined && fromClass !== null && fromClass !== '' ? fromClass : undefined,
    fromClassInfo: normalizeClassInfo(raw.fromClassInfo ?? raw.from_class_info),
    toClass: toClass !== undefined && toClass !== null && toClass !== '' ? toClass : undefined,
    toClassInfo: normalizeClassInfo(raw.toClassInfo ?? raw.to_class_info),
    conditionNodeKey: String(raw.conditionNodeKey ?? raw.condition_node_key ?? '').trim() || undefined,
    result: String(raw.result ?? '').trim() || undefined,
    mode: String(raw.mode ?? '').trim() || undefined,
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map((item: any) => String(item)).filter(Boolean) : [],
    createdAt: String(raw.createdAt ?? raw.created_at ?? '').trim() || undefined,
    run: normalizeWorkflowRun(raw.run)
  }
  return transition.fromClass !== undefined ||
    transition.fromClassInfo ||
    transition.toClass !== undefined ||
    transition.toClassInfo ||
    transition.conditionNodeKey ||
    transition.result ||
    transition.mode ||
    transition.reasons.length > 0 ||
    transition.createdAt ||
    transition.run
    ? transition
    : null
}

function normalizeWorkflowTimelineItem(value: unknown): WorkflowMembershipTimelineItem | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const classInfo = normalizeClassInfo(raw.classInfo ?? raw.class ?? raw)
  const classId = raw.classId ?? raw.class ?? raw.id
  const classLabel = formatClassLabel(classInfo, classId)
  const item: WorkflowMembershipTimelineItem = {
    order: toOptionalNumber(raw.order),
    classId: classId !== undefined && classId !== null && classId !== '' ? classId : undefined,
    classInfo,
    classLabel,
    status: String(raw.status ?? '').trim() || undefined,
    concluded: toOptionalBoolean(raw.concluded)
  }
  return item.order !== undefined ||
    item.classInfo ||
    item.classId !== undefined ||
    item.status ||
    item.concluded !== null
    ? item
    : null
}

function normalizeWorkflowProgress(value: unknown): WorkflowMembershipProgress | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const completedSteps = toOptionalNumber(raw.completedSteps ?? raw.completed_steps)
  const totalSteps = toOptionalNumber(raw.totalSteps ?? raw.total_steps)
  const percentage = toOptionalNumber(raw.percentage)
  if (completedSteps === undefined && totalSteps === undefined && percentage === undefined) return null
  return {
    completedSteps: completedSteps ?? 0,
    totalSteps: totalSteps ?? 0,
    percentage: percentage ?? null
  }
}

function normalizeWorkflowMembership(value: unknown): WorkflowMembership | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, any>
  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline
        .map(normalizeWorkflowTimelineItem)
        .filter((item): item is WorkflowMembershipTimelineItem => item !== null)
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    : []
  const timelinePath = Array.isArray(raw.timelinePath)
    ? raw.timelinePath.map(normalizeTimelinePathItem).filter(Boolean)
    : raw.timelinePath !== undefined && raw.timelinePath !== null && raw.timelinePath !== ''
      ? [normalizeTimelinePathItem(raw.timelinePath)].filter(Boolean)
      : []
  const membership: WorkflowMembership = {
    status: String(raw.status ?? '').trim() || undefined,
    timelinePath,
    timeline,
    entryClass:
      raw.entryClass !== undefined && raw.entryClass !== null && raw.entryClass !== '' ? raw.entryClass : undefined,
    entryClassInfo: normalizeClassInfo(raw.entryClassInfo ?? raw.entry_class_info),
    currentClass:
      raw.currentClass !== undefined && raw.currentClass !== null && raw.currentClass !== ''
        ? raw.currentClass
        : undefined,
    currentClassInfo: normalizeClassInfo(raw.currentClassInfo ?? raw.current_class_info),
    currentStepOrder: toOptionalNumber(raw.currentStepOrder ?? raw.current_step_order),
    currentStepNodeKey: String(raw.currentStepNodeKey ?? raw.current_step_node_key ?? '').trim() || undefined,
    currentStepLabel: String(raw.currentStepLabel ?? raw.current_step_label ?? '').trim() || undefined,
    progress: normalizeWorkflowProgress(raw.progress),
    joinedAt: String(raw.joinedAt ?? raw.joined_at ?? '').trim() || undefined,
    lastTransitionAt: String(raw.lastTransitionAt ?? raw.last_transition_at ?? '').trim() || undefined,
    completedAt: String(raw.completedAt ?? raw.completed_at ?? '').trim() || undefined,
    transitions: Array.isArray(raw.transitions)
      ? raw.transitions
          .map(normalizeWorkflowTransition)
          .filter((item): item is WorkflowMembershipTransition => item !== null)
      : [],
    lastRun: normalizeWorkflowRun(raw.lastRun ?? raw.last_run)
  }
  const hasData =
    membership.status ||
    membership.timelinePath.length > 0 ||
    membership.timeline.length > 0 ||
    membership.entryClass !== undefined ||
    membership.entryClassInfo ||
    membership.currentClass !== undefined ||
    membership.currentClassInfo ||
    membership.currentStepOrder !== undefined ||
    membership.currentStepNodeKey ||
    membership.currentStepLabel ||
    membership.progress ||
    membership.joinedAt ||
    membership.lastTransitionAt ||
    membership.completedAt ||
    membership.transitions.length > 0 ||
    membership.lastRun
  return hasData ? membership : null
}

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
        nodeId: node.id
      })
    }

    const nexts = Array.from(adjacency.get(cur) || []).sort((a, b) => courseName(a).localeCompare(courseName(b)))
    for (const next of nexts) {
      if (!visited.has(next)) queue.push(next)
    }
  }

  if (seq.length === 0) {
    return courseNodes
      .slice()
      .sort((a, b) => String(a.data?.payload?.courseName).localeCompare(String(b.data?.payload?.courseName)))
      .map((n) => ({
        courseId: n.data?.payload?.courseId,
        courseName: n.data?.payload?.courseName,
        nodeId: n.id
      }))
  }

  const remaining = courseNodes
    .filter((n) => !visited.has(n.id))
    .sort((a, b) => String(a.data?.payload?.courseName).localeCompare(String(b.data?.payload?.courseName)))

  for (const n of remaining) {
    seq.push({
      courseId: n.data?.payload?.courseId,
      courseName: n.data?.payload?.courseName,
      nodeId: n.id
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
    pic: {
      label: 'Pedido (Insatisfacao - Cadeira)',
      class: 'bg-amber-50 border-amber-200 text-amber-700',
      icon: AlertCircle
    },
    tc: { label: 'Termino de Contrato', class: 'bg-slate-50 border-slate-200 text-slate-600', icon: AlertCircle }
  }

  return map[key] || map[s] || { label: raw, class: 'bg-slate-50 border-slate-200 text-slate-600', icon: Clock }
}

function statusVisual(status?: string) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
  const map: Record<string, { dot: string; bg: string; text: string; ring: string }> = {
    concluded: { dot: '#10b981', bg: '#f0fdf4', text: '#065f46', ring: '#6ee7b7' },
    conclude: { dot: '#10b981', bg: '#f0fdf4', text: '#065f46', ring: '#6ee7b7' },
    concluido: { dot: '#10b981', bg: '#f0fdf4', text: '#065f46', ring: '#6ee7b7' },
    completed: { dot: '#10b981', bg: '#f0fdf4', text: '#065f46', ring: '#6ee7b7' },
    done: { dot: '#10b981', bg: '#f0fdf4', text: '#065f46', ring: '#6ee7b7' },
    current: { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', ring: '#93c5fd' },
    inprogress: { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', ring: '#93c5fd' },
    emandamento: { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', ring: '#93c5fd' },
    paused: { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e', ring: '#fcd34d' },
    incomplete: { dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', ring: '#fca5a5' },
    incompleto: { dot: '#ef4444', bg: '#fef2f2', text: '#991b1b', ring: '#fca5a5' },
    pi: { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e', ring: '#fcd34d' },
    ea: { dot: '#10b981', bg: '#f0fdf4', text: '#065f46', ring: '#6ee7b7' }
  }
  const colors = map[normalized] || {
    dot: '#94a3b8',
    bg: '#f8fafc',
    text: '#475569',
    ring: '#cbd5e1'
  }
  return {
    label: statusConfig(status).label,
    ...colors
  }
}

function isInProgressStatus(status?: string) {
  const raw = String(status || '').trim()
  if (!raw) return false
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '')
  return ['current', 'inprogress', 'emandamento', 'ea'].includes(normalized)
}

function parseDateValue(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    const parsed = new Date(year, month - 1, day, 12, 0, 0)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const dateTimeLocal = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (dateTimeLocal) {
    const year = Number(dateTimeLocal[1])
    const month = Number(dateTimeLocal[2])
    const day = Number(dateTimeLocal[3])
    const hour = Number(dateTimeLocal[4])
    const minute = Number(dateTimeLocal[5])
    const second = Number(dateTimeLocal[6] || '0')
    const parsed = new Date(year, month - 1, day, hour, minute, second)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function fmtDate(d?: string) {
  if (!d) return '-'
  const date = parseDateValue(d)
  if (!date) return '-'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function initials(name?: string) {
  const raw = String(name || '').trim()
  if (!raw) return '--'
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

function fmtLocalDateTime(value?: string) {
  if (!value) return '-'
  const date = parseDateValue(value)
  if (!date) return '-'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function humanizeToken(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function runStatusConfig(status?: string) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  const map: Record<string, { label: string; class: string }> = {
    queued: { label: 'queued', class: 'border-amber-200 bg-amber-50 text-amber-700' },
    running: { label: 'running', class: 'border-blue-200 bg-blue-50 text-blue-700' },
    done: { label: 'done', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    failed: { label: 'failed', class: 'border-rose-200 bg-rose-50 text-rose-700' }
  }
  return map[raw] || { label: raw || '-', class: 'border-slate-200 bg-slate-50 text-slate-600' }
}

function fmtDetailDateTime(value?: string) {
  if (!value) return '-'
  const date = parseDateValue(value)
  if (!date) return '-'
  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short'
  })
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${datePart}, ${timePart}`
}

function fmtDateWithShortYear(value?: string) {
  if (!value) return '-'
  const date = parseDateValue(value)
  if (!date) return '-'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  })
}

function contractStatusVisual(status?: string) {
  const key = normalizeStatusKey(status)
  const map: Record<string, { label: string; class: string }> = {
    ea: { label: 'Ativo', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    active: { label: 'Ativo', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    ativo: { label: 'Ativo', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    pi: { label: 'Pausado', class: 'border-amber-200 bg-amber-50 text-amber-700' },
    paused: { label: 'Pausado', class: 'border-amber-200 bg-amber-50 text-amber-700' },
    tc: { label: 'Encerrado', class: 'border-slate-200 bg-slate-100 text-slate-600' },
    ended: { label: 'Encerrado', class: 'border-slate-200 bg-slate-100 text-slate-600' },
    encerrado: { label: 'Encerrado', class: 'border-slate-200 bg-slate-100 text-slate-600' }
  }
  if (map[key]) return map[key]
  const fallback = String(status || '').trim()
  return {
    label: fallback || 'Sem contrato',
    class: 'border-slate-200 bg-slate-100 text-slate-600'
  }
}

function detailEligibilityLabel(item?: ProgressItem) {
  if (!item) return '-'
  if (item.eligibleForNext === true || item.eligibilityAny === true) return 'Elegível'
  if (item.eligibleForNext === false || item.eligibilityAny === false) return 'Não elegível'
  if (isConcludedStatus(item.status)) return 'Elegível'
  return '-'
}

function detailReasonTag(item?: ProgressItem) {
  const firstReason = progressReasonList(item)[0]
  if (!firstReason) return ''
  return eligibilityReasonLabelForProgress(item, firstReason)
}

function detailTransitionResultVisual(result?: string) {
  const key = normalizeStatusKey(result)
  const map: Record<string, { label: string; class: string }> = {
    approved: { label: 'approved', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    aprovado: { label: 'approved', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    ok: { label: 'approved', class: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    rejected: { label: 'rejected', class: 'border-rose-200 bg-rose-50 text-rose-700' },
    reprovado: { label: 'rejected', class: 'border-rose-200 bg-rose-50 text-rose-700' },
    failed: { label: 'failed', class: 'border-rose-200 bg-rose-50 text-rose-700' }
  }
  if (map[key]) return map[key]
  return {
    label: String(result || 'unknown').trim() || 'unknown',
    class: 'border-slate-200 bg-slate-100 text-slate-600'
  }
}

function detailTransitionModeLabel(mode?: string) {
  const label = humanizeToken(mode)
  if (label === '-') return '-'
  return label.toLowerCase()
}

function detailRunSummary(transition: WorkflowMembershipTransition) {
  const run = transition.run
  if (!run) return '-'
  const runId = run.id !== undefined && run.id !== null && run.id !== '' ? `Run#${String(run.id)}` : 'Run'
  const runStatus = String(run.status || '').trim().toLowerCase()
  return runStatus ? `${runId} · ${runStatus}` : runId
}

function contractDurationLabel(start?: string, end?: string) {
  const months = contractDurationMonths(start, end)
  if (months === null) return ''
  return `${months} meses`
}

function contractElapsedLabel(start?: string, end?: string) {
  const now = new Date()
  const endDate = end ? parseDateValue(end) : now
  if (!endDate) return ''
  const effectiveEnd = endDate.getTime() < now.getTime() ? endDate : now
  const months = contractDurationMonths(start, effectiveEnd.toISOString())
  if (months === null) return ''
  return `${months} meses`
}

function contractDurationMonths(start?: string, end?: string) {
  if (!start) return null
  const startDate = parseDateValue(start)
  if (!startDate) return null
  const endDateRaw = end ? parseDateValue(end) : new Date()
  if (!endDateRaw) return null
  const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0, 0)
  const normalizedEnd = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate(), 12, 0, 0, 0)
  if (normalizedEnd.getTime() < normalizedStart.getTime()) return 0

  let months =
    (normalizedEnd.getFullYear() - normalizedStart.getFullYear()) * 12 +
    (normalizedEnd.getMonth() - normalizedStart.getMonth())
  let anchor = new Date(
    normalizedStart.getFullYear(),
    normalizedStart.getMonth() + months,
    normalizedStart.getDate(),
    12,
    0,
    0,
    0
  )
  if (anchor.getTime() > normalizedEnd.getTime()) {
    months -= 1
    anchor = new Date(
      normalizedStart.getFullYear(),
      normalizedStart.getMonth() + months,
      normalizedStart.getDate(),
      12,
      0,
      0,
      0
    )
  }
  if (months < 0) months = 0

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const remainingDays = Math.max(0, Math.floor((normalizedEnd.getTime() - anchor.getTime()) / MS_PER_DAY))
  if (remainingDays > 15) months += 1
  return months
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
    '7': 'Domingo'
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

function fmtDateNumeric(value?: string) {
  if (!value) return ''
  const date = parseDateValue(value)
  if (!date) return ''
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function selectedByCondition(item?: ProgressItem) {
  const list = item?.eligibilityByCondition || []
  if (!Array.isArray(list) || list.length === 0) return undefined
  const key = String(item?.conditionNodeKey || '').trim()
  if (key) {
    const exact = list.find((entry) => String(entry?.nodeKey || '').trim() === key)
    if (exact) return exact
  }
  if (list.length === 1) return list[0]
  return list[0]
}

function appliedCondition(item?: ProgressItem) {
  return selectedByCondition(item)?.condition ?? item?.condition
}

function specificEvolutionDate(item?: ProgressItem) {
  if (!item) return ''
  const cond = appliedCondition(item)
  const mode =
    cond?.evolutionMode ??
    (cond?.useClassEndDate ? 'classEnd' : cond?.evolveAt ? 'specific' : cond?.startDate || cond?.endDate ? 'range' : 'none')
  if (mode !== 'specific') return ''
  return fmtDateNumeric(cond?.evolveAt || item?.evolveAt)
}

function hasConditionOverride(item?: ProgressItem) {
  const selected = selectedByCondition(item)
  if (selected) return selected.hasOverride === true
  return toOptionalBoolean((item?.condition as any)?.hasOverride) === true
}

function overrideEvolutionDate(item?: ProgressItem) {
  const selected = selectedByCondition(item)
  if (!selected) return ''
  return fmtDateNumeric(selected.overrideData?.evolveAt)
}

function balanceStrategyLabel(item?: ProgressItem) {
  const strategies = item?.condition?.balanceStrategy || []
  if (!Array.isArray(strategies) || strategies.length === 0) return 'Menor Lotação'
  return strategies.map((s) => (s === 'gender' ? 'Equilíbrio H/M/O' : 'Menor Lotação')).join(' + ')
}

function progressReasonList(item?: ProgressItem) {
  if (!item) return []
  if (Array.isArray(item.eligibilityReasons) && item.eligibilityReasons.length > 0) return item.eligibilityReasons
  if (Array.isArray(item.eligibleForNextReason) && item.eligibleForNextReason.length > 0)
    return item.eligibleForNextReason
  return []
}

function progressReasonSummary(item?: ProgressItem) {
  if (!item) return ''
  return progressReasonList(item)
    .map((reason) => eligibilityReasonLabelForProgress(item, reason))
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')
}

function attendanceLabel(value: number | string | undefined | null) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n}%` : '-'
}

function examLabel(value: number | string | undefined | null) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(1) : '-'
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

function parseStatNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const normalized = String(value).trim().replace(',', '.')
  if (!normalized) return undefined
  const num = Number(normalized)
  return Number.isFinite(num) ? num : undefined
}

function parseHandleClassId(handle?: string | null) {
  if (!handle) return null
  const parts = handle.split(':')
  if (parts.length < 2) return null
  const id = Number(parts[1])
  return Number.isFinite(id) ? id : null
}

function resolveStepConditionNodeKey(step: ApiStep, byConditions: ProgressByConditionItem[], fromClass?: number) {
  const candidates = byConditions
    .map((item) => String(item.nodeKey || '').trim())
    .filter(Boolean)
  if (candidates.length === 0) return undefined

  const explicitNodeKey = String(step?.conditionNodeKey ?? step?.condition_node_key ?? '').trim()
  if (explicitNodeKey && candidates.includes(explicitNodeKey)) return explicitNodeKey

  const classNodeKey = String(step?.classNodeKey ?? step?.class?.nodeKey ?? '').trim()
  if (classNodeKey && candidates.includes(classNodeKey)) return classNodeKey

  const courseNodeKey = String(step?.nodeKey || '').trim()
  if (courseNodeKey) {
    const byEdge = candidates.find((conditionNodeKey) =>
      (props.edges || []).some((edge) => {
        if (edge.source !== courseNodeKey || edge.target !== conditionNodeKey) return false
        if (String(edge.targetHandle || '') !== 'if-in') return false
        if (!Number.isFinite(fromClass)) return true
        return parseHandleClassId(edge.sourceHandle) === Number(fromClass)
      })
    )
    if (byEdge) return byEdge
  }

  return candidates[0]
}

function resolveClassIdByCourseAndName(courseNodeId: string, className?: string) {
  const name = String(className || '').trim()
  if (!name) return null
  const courseNode = (props.nodes || []).find((n) => n.id === courseNodeId && n.type === 'course')
  const classes = (courseNode?.data as any)?.payload?.classes || []
  const found = classes.find((cls: any) => String(cls?.name || '').trim() === name)
  const id = Number(found?.id)
  return Number.isFinite(id) ? id : null
}

function conditionKeyForEvolution(course: CourseSeqItem, progress?: ProgressItem) {
  const options = conditionOptionsForCourse(course)
  if (options.length === 0) return null
  const fromClass = Number(progress?.classId)
  const progressConditionKey = String(progress?.conditionNodeKey || progress?.classNodeKey || '').trim()
  if (progressConditionKey) {
    const exists = options.some((opt) => opt.nodeKey === progressConditionKey)
    if (exists) return progressConditionKey
  }
  if (Number.isFinite(fromClass)) {
    const byFromClass = options.find((opt) =>
      (props.edges || []).some(
        (edge) =>
          edge.source === course.nodeId &&
          edge.target === opt.nodeKey &&
          edge.targetHandle === 'if-in' &&
          parseHandleClassId(edge.sourceHandle) === fromClass
      )
    )
    if (byFromClass) return byFromClass.nodeKey
  }
  return defaultConditionKey(options)
}

function inferToClassFromCondition(conditionNodeKey: string) {
  const candidates = new Set<number>()
  for (const edge of props.edges || []) {
    if (edge.source !== conditionNodeKey || edge.sourceHandle !== 'if-ok') continue
    const classId = parseHandleClassId(edge.targetHandle)
    if (classId !== null) candidates.add(classId)
  }
  const list = Array.from(candidates).sort((a, b) => a - b)
  return list.length > 0 ? list[0] : null
}

function resolveClassById(classId: number) {
  for (const node of props.nodes || []) {
    if (node.type !== 'course') continue
    const classes = (node.data as any)?.payload?.classes || []
    const match = classes.find((cls: any) => Number(cls.id) === classId)
    if (match) return match
  }
  return null
}

function conditionRequiresContract(conditionId: string) {
  const classIds = new Set<number>()
  for (const edge of props.edges || []) {
    if (edge.target === conditionId && edge.targetHandle === 'if-in') {
      const id = parseHandleClassId(edge.sourceHandle)
      if (id !== null) classIds.add(id)
    }
    if (edge.source === conditionId && (edge.sourceHandle === 'if-ok' || edge.sourceHandle === 'if-nok')) {
      const id = parseHandleClassId(edge.targetHandle)
      if (id !== null) classIds.add(id)
    }
  }
  for (const id of classIds) {
    const cls = resolveClassById(id)
    if (onlyWithContractFlag(cls)) return true
  }
  return false
}

function evolutionStepKey(rowId: number, courseNodeId: string) {
  return `${rowId}:${courseNodeId}`
}

function canManualEvolute(row: RowItem, course: CourseSeqItem) {
  const progress = getProgress(row, course)
  if (!progress || progress.isFinalStep) return false
  const classIdRaw = Number(progress.classId)
  const fromClass = Number.isFinite(classIdRaw)
    ? classIdRaw
    : resolveClassIdByCourseAndName(course.nodeId, progress.className)
  if (!Number.isFinite(fromClass)) return false
  const conditionNodeKey = conditionKeyForEvolution(course, progress)
  if (!conditionNodeKey) return false
  const toClass = inferToClassFromCondition(conditionNodeKey)
  return Number.isFinite(toClass)
}

async function evoluteStep(row: RowItem, course: CourseSeqItem) {
  if (!props.workflowId) return
  const progress = getProgress(row, course)
  if (!progress) return
  const classIdRaw = Number(progress.classId)
  const fromClass = Number.isFinite(classIdRaw)
    ? classIdRaw
    : resolveClassIdByCourseAndName(course.nodeId, progress.className)
  if (!Number.isFinite(fromClass)) {
    toast({
      title: 'Nao foi possivel evoluir',
      description: 'Nao foi possivel identificar a turma de origem (fromClass).',
      variant: 'destructive'
    })
    return
  }
  const conditionNodeKey = conditionKeyForEvolution(course, progress)
  if (!conditionNodeKey) {
    toast({
      title: 'Nao foi possivel evoluir',
      description: 'Nao foi possivel identificar a condicao da etapa.',
      variant: 'destructive'
    })
    return
  }
  const toClass = inferToClassFromCondition(conditionNodeKey)
  if (!Number.isFinite(toClass)) {
    toast({
      title: 'Nao foi possivel evoluir',
      description: 'Nao foi possivel identificar a turma de destino (toClass) na saida OK.',
      variant: 'destructive'
    })
    return
  }

  const key = evolutionStepKey(row.id, course.nodeId)
  if (evolvingStepKey.value === key) return
  evolvingStepKey.value = key
  try {
    await api.evoluteApprentice(props.workflowId, row.id, {
      fromClass: Number(fromClass),
      toClass: Number(toClass)
    })
    toast({
      title: 'Etapa evoluida',
      description: `Evolucao manual enviada (fromClass ${fromClass} -> toClass ${toClass}).`
    })
    await loadApprenticeWorkflows()
  } catch (e) {
    console.error('Erro ao evoluir etapa manualmente', e)
    toast({
      title: 'Erro ao evoluir etapa',
      description: formatApiError(e),
      variant: 'destructive'
    })
  } finally {
    evolvingStepKey.value = ''
  }
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
        onlyWithContract: (cls as any)?.onlyWithContract ?? (cls as any)?.requires_contract
      })
    }
  }
  return map
})
const rows = ref<RowItem[]>([])
const edit = ref<EditState | null>(null)
const searchQuery = ref('')
const classStatusFilter = ref<'inProgress' | 'concluded' | 'inactive' | 'all'>('all')
const hasContractFilter = ref<'all' | 'with' | 'without'>('all')
const contractMinMonthsFilter = ref('')
const sortHasContractFirst = ref(false)
const transitionsLimit = ref<0 | 5 | 10 | 20>(5)
const runId = ref('')
const hasLoadedRows = ref(false)
const totalCount = ref(0)
const totalTracked = ref(0)
const totalInProgress = ref(0)
const localConditionPreviewByStep = ref<Record<string, Partial<EditValue>>>({})
const pageLimit = ref(10)
const pageOffset = ref(0)
const isRunningEvolution = ref(false)
const evolvingStepKey = ref('')
const detailRowId = ref<number | null>(null)
const detailTab = ref<'timeline' | 'transitions' | 'steps'>('timeline')
const lessonsModal = ref<{
  open: boolean
  apprenticeName: string
  courseName: string
  lessons: ApiLesson[]
}>({
  open: false,
  apprenticeName: '',
  courseName: '',
  lessons: []
})
const contractsModal = ref<{
  open: boolean
  apprenticeName: string
  contracts: RowContract[]
  preferredKey: string
}>({
  open: false,
  apprenticeName: '',
  contracts: [],
  preferredKey: ''
})
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const { toast } = useToast()

function normalizeLessonList(lessons: unknown) {
  if (!Array.isArray(lessons)) return []
  return lessons.map((item, idx) => {
    const raw = (item || {}) as Record<string, any>
    return {
      lesson: raw.lesson ?? raw.id ?? raw.topicId ?? raw.themeId ?? idx + 1,
      activated: raw.activated ?? raw.active ?? raw.enabled ?? raw.isActive,
      name: String(raw.name ?? raw.title ?? raw.topic ?? raw.theme ?? raw.lessonName ?? ''),
      attendance: raw.attendance ?? raw.presence ?? raw.attended ?? null,
      concluded: raw.concluded ?? raw.completed ?? raw.done ?? null
    }
  })
}

function toRecordObject(value: unknown): Record<string, any> | null {
  if (!value) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = toRecordObject(item)
      if (parsed) return parsed
    }
    return null
  }
  if (typeof value === 'object') return value as Record<string, any>
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null
  } catch {
    return null
  }
}

function normalizeConditionForProgress(input: unknown, evolveAtFallback?: unknown) {
  const raw = toRecordObject(input)
  if (!raw) return undefined
  const evolveAt = String(raw.evolveAt ?? raw.evolve_at ?? evolveAtFallback ?? '').trim()
  const startDate = String(raw.startDate ?? raw.start_date ?? '').trim()
  const endDate = String(raw.endDate ?? raw.end_date ?? '').trim()
  const evolutionMode = String(raw.evolutionMode ?? raw.evolution_mode ?? '').trim()
  const useClassEndDate = toOptionalBoolean(raw.useClassEndDate ?? raw.use_class_end_date)

  const value: Partial<EditValue> = {
    ...(raw as Partial<EditValue>),
    evolveAt: evolveAt || undefined,
    startDate,
    endDate,
    useClassEndDate: useClassEndDate === null ? undefined : useClassEndDate,
    evolutionMode:
      evolutionMode === 'specific' || evolutionMode === 'range' || evolutionMode === 'classEnd' || evolutionMode === 'none'
        ? (evolutionMode as EditValue['evolutionMode'])
        : undefined
  }

  if (!value.evolutionMode || value.evolutionMode === 'none') {
    value.evolutionMode = value.useClassEndDate ? 'classEnd' : value.evolveAt ? 'specific' : value.startDate || value.endDate ? 'range' : 'none'
  }
  return value
}

function normalizeStepByConditionList(input: unknown, evolveAtFallback?: unknown): ProgressByConditionItem[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      const raw = toRecordObject(entry)
      if (!raw) return null
      const nodeKey = String(raw.nodeKey ?? raw.conditionNodeKey ?? raw.condition_node_key ?? '').trim()
      const condition = normalizeConditionForProgress(raw.condition, evolveAtFallback)
      const overrideRaw = toRecordObject(raw.override)
      const overrideDataRaw = toRecordObject(overrideRaw?.data)
      const hasOverrideValue = toOptionalBoolean(raw.hasOverride ?? raw.has_override)
      return {
        nodeKey,
        eligible: toOptionalBoolean(raw.eligible) === true,
        reasons: Array.isArray(raw.reasons) ? raw.reasons.map((reason: any) => String(reason)).filter(Boolean) : [],
        condition,
        overrideData: overrideDataRaw ? ({ ...overrideDataRaw } as Partial<EditValue>) : undefined,
        hasOverride: hasOverrideValue === null ? Boolean(overrideDataRaw) : hasOverrideValue
      } as ProgressByConditionItem
    })
    .filter((item): item is ProgressByConditionItem => item !== null)
}

function toFlagLabel(value: unknown) {
  if (value === true || value === 1) return 'Sim'
  if (value === false || value === 0) return 'Nao'
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
  if (text === '1' || text === 'true' || text === 'sim' || text === 'yes') return 'Sim'
  if (!text || text === '0' || text === 'false' || text === 'nao' || text === 'no') return 'Nao'
  return text
}

function isTruthyFlag(value: unknown) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
  return value === true || value === 1 || text === '1' || text === 'true' || text === 'sim' || text === 'yes'
}

function lessonAttendanceLabel(lesson: ApiLesson) {
  if (!isTruthyFlag(lesson?.concluded)) return '-'
  return isTruthyFlag(lesson?.attendance) ? 'Presente' : 'Ausente'
}

function lessonTopicLabel(lesson: ApiLesson, idx: number) {
  const explicit = String(lesson?.name || '').trim()
  if (explicit) return explicit
  const code = String(lesson?.lesson ?? '').trim()
  if (code) return `Tema ${code}`
  return `Tema ${idx + 1}`
}

function lessonConcludedLabel(lesson: ApiLesson) {
  return isTruthyFlag(lesson?.concluded) ? 'Concluido' : 'Pendente'
}

function openLessons(row: RowItem, course: CourseSeqItem) {
  const progress = getProgress(row, course)
  const list = progress?.lessons || []
  lessonsModal.value = {
    open: true,
    apprenticeName: row.name,
    courseName: course.courseName,
    lessons: list
  }
}

function closeLessonsModal() {
  lessonsModal.value.open = false
}

function rowContractKey(contract?: RowContract | null) {
  if (!contract) return ''
  return [
    String(contract.partnerId || '').trim(),
    String(contract.contractId || '').trim(),
    String(contract.company || '').trim(),
    String(contract.start || '').trim(),
    String(contract.end || '').trim(),
    String(contract.status || '').trim()
  ].join('|')
}

function openContracts(row: RowItem) {
  const list = Array.isArray(row.contracts) && row.contracts.length > 0 ? row.contracts : row.contract ? [row.contract] : []
  if (list.length === 0) return
  contractsModal.value = {
    open: true,
    apprenticeName: row.name,
    contracts: list,
    preferredKey: rowContractKey(row.contract)
  }
}

function closeContractsModal() {
  contractsModal.value.open = false
}

function openDetail(row: RowItem, tab: 'timeline' | 'transitions' | 'steps' = 'timeline') {
  detailRowId.value = row.id
  detailTab.value = tab
}

function closeDetail() {
  detailRowId.value = null
  detailTab.value = 'timeline'
}

function reloadApprentices() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  hasLoadedRows.value = false
  loadApprenticeWorkflows()
}

function scheduleApprenticeReload(resetOffset = true) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  if (resetOffset) pageOffset.value = 0
  searchDebounceTimer = setTimeout(() => {
    hasLoadedRows.value = false
    loadApprenticeWorkflows()
    searchDebounceTimer = null
  }, 350)
}

async function runEvolution() {
  if (!props.workflowId || isRunningEvolution.value) return
  isRunningEvolution.value = true
  try {
    const runIdValue = runId.value.trim()
    await api.runWorkflow(props.workflowId, runIdValue || undefined)
    toast({
      title: 'Evolucao executada',
      description: 'A execucao foi disparada com sucesso.'
    })
    await loadApprenticeWorkflows()
  } catch (e) {
    console.error('Erro ao executar evolucao', e)
    toast({
      title: 'Erro ao executar evolucao',
      description: formatApiError(e),
      variant: 'destructive'
    })
  } finally {
    isRunningEvolution.value = false
  }
}

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
  let ok = 0,
    doing = 0,
    bad = 0
  for (const c of courseSeq.value) {
    const p = getProgress(r, c)
    if (!p?.status) continue
    const raw = String(p.status || '').toLowerCase()
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_]+/g, '')
    if (normalized === 'concluido' || normalized === 'conclude' || normalized === 'concluded' || normalized === 'done')
      ok++
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

function hasWorkflowMembership(row: RowItem) {
  return !!row.workflowMembership
}

function normalizeStatusKey(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '')
}

function isConcludedStatus(status?: string) {
  return ['concluido', 'conclude', 'concluded', 'completed', 'done'].includes(normalizeStatusKey(status))
}

function membershipProgressSnapshot(row: RowItem) {
  const progress = row.workflowMembership?.progress
  const rawCompleted = progress?.completedSteps
  const rawTotal = progress?.totalSteps
  const rawPercentage = progress?.percentage

  const completedFromMembership = Number.isFinite(rawCompleted) ? Math.max(0, Number(rawCompleted)) : undefined
  const totalFromMembership = Number.isFinite(rawTotal) ? Math.max(0, Number(rawTotal)) : undefined
  const percentageFromMembership =
    Number.isFinite(rawPercentage) && rawPercentage !== null ? Math.max(0, Math.min(100, Number(rawPercentage))) : undefined

  const totalFallback =
    totalFromMembership && totalFromMembership > 0
      ? totalFromMembership
      : courseSeq.value.length > 0
        ? courseSeq.value.length
        : row.steps.length > 0
          ? row.steps.length
          : Object.values(row.progress || {}).filter(Boolean).length

  const completedFallback =
    completedFromMembership !== undefined
      ? completedFromMembership
      : courseSeq.value.length > 0
        ? courseSeq.value.filter((course) => isConcludedStatus(getProgress(row, course)?.status)).length
        : row.steps.length > 0
          ? row.steps.filter((step) => isConcludedStatus(step.status)).length
          : Object.values(row.progress || {}).filter((item) => isConcludedStatus(item?.status)).length

  const total = Math.max(0, totalFallback)
  const completed = Math.max(0, Math.min(total > 0 ? total : completedFallback, completedFallback))
  const percentage = percentageFromMembership ?? (total > 0 ? Math.round((completed / total) * 100) : 0)

  return { completed, total, percentage }
}

function membershipProgressValue(row: RowItem) {
  return membershipProgressSnapshot(row).percentage
}

function membershipProgressText(row: RowItem) {
  const snapshot = membershipProgressSnapshot(row)
  if (snapshot.total === 0) return '-'
  return `${snapshot.completed}/${snapshot.total}`
}

function membershipStepLabel(row: RowItem) {
  const membership = row.workflowMembership
  if (!membership) return '-'
  const byNode = membership.currentStepNodeKey
    ? courseSeq.value.find((course) => course.nodeId === membership.currentStepNodeKey)?.courseName
    : ''
  const byOrder =
    membership.currentStepOrder !== undefined && membership.currentStepOrder !== null
      ? courseSeq.value[membership.currentStepOrder - 1]?.courseName
      : ''
  const label = membership.currentStepLabel || byNode || byOrder || 'Etapa atual'
  return label || '-'
}

function membershipCurrentClassLabel(row: RowItem) {
  const membership = row.workflowMembership
  if (!membership) return '-'
  return formatClassLabel(membership.currentClassInfo, membership.currentClass)
}

function membershipEntryClassLabel(row: RowItem) {
  const membership = row.workflowMembership
  if (!membership) return '-'
  return formatClassLabel(membership.entryClassInfo, membership.entryClass)
}

function membershipTimelineSummary(row: RowItem) {
  const membership = row.workflowMembership
  if (!membership) return '-'
  const path =
    membership.timelinePath.length > 0
      ? membership.timelinePath
      : membership.timeline.map((item) => item.classLabel).filter(Boolean)
  if (path.length === 0) return '-'
  if (path.length <= 3) return path.join(' -> ')
  return `${path.slice(0, 3).join(' -> ')} -> +${path.length - 3}`
}

function membershipTimelineItems(row: RowItem) {
  const membership = row.workflowMembership
  if (!membership) return []
  if (membership.timeline.length > 0) return membership.timeline
  return membership.timelinePath.map((label, index) => ({
    order: index + 1,
    classInfo: null,
    classId: undefined,
    classLabel: label,
    status: undefined,
    concluded: null
  }))
}

function detailSteps(row: RowItem): DetailStepItem[] {
  if (courseSeq.value.length === 0 && row.steps.length > 0) {
    return row.steps
      .slice()
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .map((step, index) => {
        const stepEvolveAt = String(step.evolveAt ?? step.evolve_at ?? '').trim()
        const byConditionItems = normalizeStepByConditionList(step?.eligibility?.byCondition, stepEvolveAt)
        const byConditionNodeKey = resolveStepConditionNodeKey(
          step,
          byConditionItems,
          Number.isFinite(Number(step.classId)) ? Number(step.classId) : undefined
        )
        const byConditionSelected =
          (byConditionNodeKey ? byConditionItems.find((item) => item.nodeKey === byConditionNodeKey) : undefined) ??
          (byConditionItems.length === 1 ? byConditionItems[0] : undefined)
        const condition =
          byConditionSelected?.condition ??
          normalizeConditionForProgress(step.condition ?? step.resolvedCondition ?? step.resolved_condition, stepEvolveAt)
        return {
          key: `${row.id}:${step.nodeKey || step.courseId || step.courseName || index}`,
          order: step.order ?? index + 1,
          nodeKey: String(step.nodeKey || ''),
          label: String(step.courseName || `Etapa ${index + 1}`),
          progress: {
            evolveAt: String(condition?.evolveAt ?? stepEvolveAt ?? '').trim() || undefined,
            condition,
            classId: step.classId,
            className: String(step.class?.name ?? step.className ?? '').trim() || undefined,
            classNodeKey: String(step.class?.nodeKey ?? step.classNodeKey ?? '').trim() || undefined,
            conditionNodeKey: byConditionNodeKey || undefined,
            status: step.status ?? undefined,
            eligibilityByCondition: byConditionItems,
            lessons: normalizeLessonList(step.lessons ?? step.themes ?? step.topics)
          } as ProgressItem
        }
      })
  }
  return courseSeq.value.map((course, index) => {
    const progress = getProgress(row, course)
    return {
      key: `${row.id}:${course.nodeId}`,
      order: index + 1,
      nodeKey: course.nodeId,
      label: course.courseName,
      progress
    }
  })
}

function isCurrentDetailStep(row: RowItem, item: { order: number; nodeKey: string; label: string }) {
  const membership = row.workflowMembership
  if (!membership) return false
  if (membership.currentStepNodeKey && membership.currentStepNodeKey === item.nodeKey) return true
  if (membership.currentStepOrder !== undefined && membership.currentStepOrder === item.order) return true
  if (membership.currentStepLabel && normalizeKey(membership.currentStepLabel) === normalizeKey(item.label)) {
    return true
  }
  return false
}

function classDayLabel(item?: ProgressItem) {
  if (!item?.hasEnrollment || !item?.className) return ''
  const meta = classMetaByName.value.get(item.className)
  return formatDayOfWeek(meta?.dayOfWeek ?? '')
}

function classContractLabel(item?: ProgressItem) {
  if (!item?.hasEnrollment || !item?.className) return ''
  const meta = classMetaByName.value.get(item.className)
  if (!meta) return ''
  return onlyWithContractFlag({ onlyWithContract: meta.onlyWithContract }) ? 'Contrato' : 'Livre'
}

function eligibilityReasonLabel(code: string) {
  const map: Record<string, string> = {
    nocurrentstep: 'Sem etapa atual',
    notcurrentstep: 'Aguardando evolução',
    noconditionforstep: 'Sem condição definida para a etapa',
    noconditionforclass: 'Condições ligadas, mas nenhuma aplicável à turma atual',
    conditionnotfound: 'Condição não encontrada',
    classstatusmismatch: 'Status da turma não atende à condição',
    classnotended: 'Turma ainda não finalizada',
    beforespecificdate: 'Data específica ainda não atingida',
    attendanceunavailable: 'Frequência não disponível',
    attendancebelowminimum: 'Frequência abaixo do mínimo',
    examunavailable: 'Nota não disponível',
    exambelowminimum: 'Nota abaixo do mínimo',
    lessonscompletionunavailable: 'Conclusão de aulas não disponível',
    lessonsnotcompleted: 'Aulas não concluídas',
    contractstatusmismatch: 'Status do contrato não atende à condição',
    finalstep: 'Etapa final'
  }
  const key = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  return map[key] || ''
}

function finalStepLabel(item?: ProgressItem) {
  if (!item?.isFinalStep) return ''
  const hasEnrollment = item?.hasEnrollment === true
  return hasEnrollment && isInProgressStatus(item?.status) ? 'Evolucao completa' : 'Etapa final'
}

function eligibilityReasonLabelForProgress(item: ProgressItem | undefined, reason: string) {
  const key = String(reason || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (key === 'finalstep') return finalStepLabel(item) || 'Etapa final'
  return eligibilityReasonLabel(reason)
}

function isWaitingEvolution(reasons?: string[]) {
  return (reasons || []).some((reason) => {
    const key = String(reason || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
    return key === 'notcurrentstep'
  })
}

function formatApiError(e: unknown) {
  const err = e as any
  const payload = err?.payload
  const messageFromPayload =
    typeof payload?.messages?.error === 'string' && payload.messages.error.trim()
      ? payload.messages.error.trim()
      : typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : ''
  const messageFromError = typeof err?.message === 'string' && err.message.trim() ? err.message.trim() : ''
  const errors = Array.isArray(err?.errors) ? err.errors.map((item: any) => String(item)).filter(Boolean) : []
  const parts = []
  if (messageFromPayload) parts.push(messageFromPayload)
  if (errors.length) parts.push(...errors)
  if (parts.length) return parts.join(' | ')
  return messageFromError || 'Erro inesperado.'
}

function parseCount(...candidates: unknown[]) {
  for (const item of candidates) {
    const n = Number(item)
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n)
  }
  return null
}

function stepPreviewKey(rowId: number, progressKey: string) {
  return `${rowId}:${progressKey}`
}

function getLocalConditionPreview(rowId: number, progressKeys: Array<string | null | undefined>) {
  for (const key of progressKeys) {
    const clean = String(key || '').trim()
    if (!clean) continue
    const found = localConditionPreviewByStep.value[stepPreviewKey(rowId, clean)]
    if (found) return found
  }
  return undefined
}

function setLocalConditionPreview(rowId: number, progressKeys: Array<string | null | undefined>, value: Partial<EditValue>) {
  const next = { ...localConditionPreviewByStep.value }
  for (const key of progressKeys) {
    const clean = String(key || '').trim()
    if (!clean) continue
    next[stepPreviewKey(rowId, clean)] = { ...value }
  }
  localConditionPreviewByStep.value = next
}

async function loadApprenticeWorkflows() {
  if (props.workflowId === undefined || props.workflowId === null || props.workflowId === '') {
    rows.value = []
    hasLoadedRows.value = true
    return
  }

  try {
    const q = searchQuery.value.trim()
    const minMonthsRaw = Number(contractMinMonthsFilter.value)
    const minMonths = Number.isFinite(minMonthsRaw) && minMonthsRaw >= 0 ? minMonthsRaw : undefined
    const res = await api.getApprenticeWorkflows(props.workflowId, {
      limit: pageLimit.value,
      offset: pageOffset.value,
      q: q || undefined,
      classStatus: classStatusFilter.value || 'inProgress',
      hasContract: hasContractFilter.value === 'all' ? undefined : hasContractFilter.value === 'with',
      contractMinMonths: minMonths,
      sort: sortHasContractFirst.value ? 'hasContract' : undefined,
      order: sortHasContractFirst.value ? 'desc' : undefined,
      transitionsLimit: transitionsLimit.value
    })
    const payload = res.data as any
    const list: ApiApprentice[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.data)
          ? payload.data.data
        : payload?.apprenticeId || payload?.workflowMembership || payload?.steps || payload?.preferredContract
          ? [payload]
          : payload?.data?.apprenticeId ||
              payload?.data?.workflowMembership ||
              payload?.data?.steps ||
              payload?.data?.preferredContract
            ? [payload.data]
            : []
    totalCount.value =
      parseCount(payload?.total, payload?.data?.total, payload?.meta?.total, payload?.pagination?.total, list.length) || 0
    const trackedCount = parseCount(
      payload?.totalTracked,
      payload?.total_tracked,
      payload?.data?.totalTracked,
      payload?.data?.total_tracked
    )
    const inProgressCount = parseCount(
      payload?.totalInProgress,
      payload?.total_in_progress,
      payload?.data?.totalInProgress,
      payload?.data?.total_in_progress
    )
    totalTracked.value = trackedCount ?? totalCount.value
    totalInProgress.value = inProgressCount ?? 0
    const maxOffset = totalCount.value > 0 ? Math.floor((totalCount.value - 1) / pageLimit.value) * pageLimit.value : 0
    if (pageOffset.value > maxOffset) {
      pageOffset.value = maxOffset
      await loadApprenticeWorkflows()
      return
    }
    rows.value = list.map((item) => {
      const apprenticeId = Number(item.apprenticeId) || 0
      const contracts = Array.isArray(item.contracts) ? item.contracts : []
      const primary = selectPrimaryContract(contracts, item.preferredContract ?? null)
      const mappedContracts = contracts
        .map((contract) => mapApiContractToRow(contract))
        .filter((contract): contract is RowContract => contract !== null)
      const preferredMapped = mapApiContractToRow(item.preferredContract ?? null)
      if (preferredMapped && !mappedContracts.some((contract) => rowContractKey(contract) === rowContractKey(preferredMapped))) {
        mappedContracts.unshift(preferredMapped)
      }
      if (mappedContracts.length === 0) {
        const primaryMapped = mapApiContractToRow(primary)
        if (primaryMapped) mappedContracts.push(primaryMapped)
      }
      const progress: Record<string, ProgressItem> = {}
      const steps = Array.isArray(item.steps) ? item.steps : []
      const workflowMembership = normalizeWorkflowMembership((item as any)?.workflowMembership)
      for (const step of steps) {
        const key = String(step?.courseName || '').trim()
        if (!key) continue
        const classInfo = step?.class && typeof step.class === 'object' ? step.class : null
        const hasEnrollment = Boolean(
          classInfo &&
          ((classInfo?.id !== undefined && classInfo?.id !== null) ||
            String(classInfo?.nodeKey || '').trim() ||
            String(classInfo?.name || '').trim())
        )
        /*  const className = hasEnrollment
          ? String(classInfo?.name ?? step?.className ?? '').trim() || undefined
          : undefined*/
        const className = String(classInfo?.name ?? step?.className ?? '').trim()
        const classId =
          hasEnrollment && classInfo?.id !== undefined && classInfo?.id !== null
            ? Number(classInfo.id)
            : step?.classId !== undefined && step?.classId !== null
              ? Number(step.classId)
              : undefined
        const classNodeKey = hasEnrollment
          ? String(classInfo?.nodeKey ?? step?.classNodeKey ?? '').trim() || undefined
          : undefined
        const stats = step?.class?.stats && typeof step.class.stats === 'object' ? step.class.stats : {}
        const attendance = parseStatNumber(
          (stats as any).attendance ??
            (stats as any).averageLessonsAttendedTotal ??
            (stats as any).averageClass ??
            (stats as any).completion_percentage ??
            (stats as any).attendance_record_percentage
        )
        const exam = parseStatNumber(
          (stats as any).exam ??
            (stats as any).average ??
            (stats as any).overall_average ??
            (stats as any).overall_performance
        )
        const eligibility = step?.eligibility || {}
        const stepEvolveAt = String(step?.evolveAt ?? step?.evolve_at ?? '').trim()
        const byConditionItems = normalizeStepByConditionList(eligibility?.byCondition, stepEvolveAt)
        const byConditionNodeKey = resolveStepConditionNodeKey(
          step,
          byConditionItems,
          Number.isFinite(Number(classId)) ? Number(classId) : undefined
        )
        const byConditionSelected =
          (byConditionNodeKey ? byConditionItems.find((item) => item.nodeKey === byConditionNodeKey) : undefined) ??
          (byConditionItems.length === 1 ? byConditionItems[0] : undefined)
        const fallbackStepCondition = normalizeConditionForProgress(
          step?.condition ?? step?.resolvedCondition ?? step?.resolved_condition,
          stepEvolveAt
        )
        const stepCondition = byConditionSelected?.condition ?? fallbackStepCondition
        const progressKeyNormalized = normalizeKey(key)
        const localConditionPreview = getLocalConditionPreview(apprenticeId, [
          key,
          progressKeyNormalized ? `n:${progressKeyNormalized}` : '',
          step?.courseId !== undefined && step?.courseId !== null ? `id:${step.courseId}` : '',
          step?.nodeKey ? `node:${step.nodeKey}` : ''
        ])
        const mergedCondition = localConditionPreview ? { ...(stepCondition || {}), ...localConditionPreview } : stepCondition
        const mergedEvolveAt = String(
          localConditionPreview?.evolveAt ??
            mergedCondition?.evolveAt ??
            stepEvolveAt ??
            ''
        ).trim()
        const lessons = normalizeLessonList(step?.lessons ?? step?.themes ?? step?.topics)
        const entry = {
          classId: Number.isFinite(Number(classId)) ? Number(classId) : undefined,
          className,
          classNodeKey,
          conditionNodeKey: byConditionNodeKey || undefined,
          hasEnrollment,
          status: step?.apprenticeStatus ?? step?.status ?? undefined,
          attendance,
          exam,
          evolveAt: mergedEvolveAt || undefined,
          condition: mergedCondition,
          eligibleForNext: step?.eligibleForNext ?? null,
          eligibleForNextReason: Array.isArray(step?.eligibleForNextReason)
            ? step.eligibleForNextReason.map((r: any) => String(r))
            : [],
          eligibilityAny: typeof eligibility?.anyEligible === 'boolean' ? eligibility.anyEligible : null,
          eligibilityReasons: Array.isArray(eligibility?.reasons) ? eligibility.reasons.map((r: any) => String(r)) : [],
          eligibilityByCondition: byConditionItems,
          isFinalStep:
            typeof step?.isFinalStep === 'boolean'
              ? step.isFinalStep
              : Array.isArray(eligibility?.reasons)
                ? eligibility.reasons.some((r: any) => String(r) === 'finalStep')
                : false,
          lessons
        }
        progress[key] = entry
        if (progressKeyNormalized) progress[`n:${progressKeyNormalized}`] = entry
        if (step?.courseId !== undefined && step?.courseId !== null) {
          progress[`id:${step.courseId}`] = entry
        }
        if (step?.nodeKey) progress[`node:${step.nodeKey}`] = entry
      }
      return {
        id: apprenticeId,
        name: String(item.name || ''),
        cpf: String(item.cpf || ''),
        email: String(item.email || ''),
        contract: mapApiContractToRow(primary),
        contracts: mappedContracts,
        progress,
        steps,
        workflowMembership
      }
    })
    if (trackedCount === null) {
      totalTracked.value = Math.max(totalCount.value, rows.value.length)
    }
    if (inProgressCount === null) {
      totalInProgress.value = rows.value.filter((row) => isInProgressStatus(row.workflowMembership?.status)).length
    }
  } catch (e) {
    console.error('Erro ao buscar workflows/{id}/apprentices', e)
    rows.value = []
    totalCount.value = 0
    totalTracked.value = 0
    totalInProgress.value = 0
  } finally {
    hasLoadedRows.value = true
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const initialRunId = params.get('runId')
    if (initialRunId) runId.value = initialRunId
    const hasContractParam = params.get('hasContract')
    if (hasContractParam === '1') hasContractFilter.value = 'with'
    if (hasContractParam === '0') hasContractFilter.value = 'without'
    const contractMinMonthsParam = params.get('contractMinMonths')
    if (contractMinMonthsParam !== null) contractMinMonthsFilter.value = contractMinMonthsParam
    const sortParam = String(params.get('sort') || '').trim().toLowerCase()
    const orderParam = String(params.get('order') || '').trim().toLowerCase()
    if (sortParam === 'hascontract' && orderParam === 'desc') {
      sortHasContractFirst.value = true
    }
  }
  loadApprenticeWorkflows()
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
})

watch(
  () => props.workflowId,
  () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    closeDetail()
    hasLoadedRows.value = false
    rows.value = []
    totalCount.value = 0
    totalTracked.value = 0
    totalInProgress.value = 0
    pageOffset.value = 0
    loadApprenticeWorkflows()
  }
)

watch(
  () => searchQuery.value,
  () => {
    scheduleApprenticeReload(true)
  }
)

watch(
  () => classStatusFilter.value,
  () => {
    scheduleApprenticeReload(true)
  }
)

watch(
  () => hasContractFilter.value,
  () => {
    scheduleApprenticeReload(true)
  }
)

watch(
  () => contractMinMonthsFilter.value,
  () => {
    scheduleApprenticeReload(true)
  }
)

watch(
  () => sortHasContractFirst.value,
  () => {
    scheduleApprenticeReload(true)
  }
)

watch(
  () => transitionsLimit.value,
  () => {
    hasLoadedRows.value = false
    loadApprenticeWorkflows()
  }
)

watch(
  () => rows.value,
  () => {
    if (detailRowId.value === null) return
    if (!rows.value.some((row) => row.id === detailRowId.value)) {
      closeDetail()
    }
  }
)

const filteredRows = computed(() => {
  return rows.value
})

const statusFilterOptions: Array<{ value: 'all' | 'inProgress' | 'concluded' | 'inactive'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'inProgress', label: 'Em andamento' },
  { value: 'concluded', label: 'Concluídos' },
  { value: 'inactive', label: 'Inativos' }
]

function rowContractCardClass(row: RowItem) {
  if (!row.contract) return 'border-[#e8edf3] bg-white'
  const months = contractDurationMonths(row.contract.start, row.contract.end)
  if (months === null || months === 15) return 'border-[#e8edf3] bg-white'
  if (months <= 12) return 'border-sky-200 bg-sky-50/70'
  if (months <= 18) return 'border-emerald-200 bg-emerald-50/70'
  if (months <= 24) return 'border-amber-200 bg-amber-50/70'
  return 'border-rose-200 bg-rose-50/70'
}

const selectedDetailRow = computed(() =>
  detailRowId.value === null ? null : (rows.value.find((row) => row.id === detailRowId.value) ?? null)
)

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)
const isLoading = computed(() => !hasLoadedRows.value)
const showNoData = computed(() => hasLoadedRows.value && rows.value.length === 0 && !isSearchActive.value)
const showNoResults = computed(() => hasLoadedRows.value && rows.value.length === 0 && isSearchActive.value)
const editRequiresContract = computed(() =>
  edit.value?.conditionNodeKey ? conditionRequiresContract(edit.value.conditionNodeKey) : false
)
const totalPages = computed(() => {
  const limit = pageLimit.value || 1
  return Math.max(1, Math.ceil(totalCount.value / limit))
})
const currentPage = computed(() => Math.min(totalPages.value, Math.floor(pageOffset.value / pageLimit.value) + 1))
const pageStart = computed(() => (totalCount.value === 0 ? 0 : pageOffset.value + 1))
const pageEnd = computed(() => Math.min(pageOffset.value + rows.value.length, totalCount.value))
const visiblePages = computed(() => {
  const pages: number[] = []
  const total = totalPages.value
  if (total <= 3) {
    for (let i = 1; i <= total; i += 1) pages.push(i)
    return pages
  }
  const start = Math.max(1, Math.min(currentPage.value - 1, total - 2))
  pages.push(start, start + 1, start + 2)
  return pages
})

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
    const hasOk = (props.edges || []).some((e) => e.source === opt.nodeKey && e.sourceHandle === 'if-ok')
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

function mapApiContractToRow(contract?: ApiContract | null): RowContract | null {
  if (!contract) return null
  return {
    partnerId: contract.partnerId !== undefined && contract.partnerId !== null ? String(contract.partnerId) : undefined,
    contractId: contract.contractId !== undefined && contract.contractId !== null ? String(contract.contractId) : undefined,
    company: String(contract.corporateName || ''),
    start: String(contract.startedAt || ''),
    end: contract.endedAt ? String(contract.endedAt) : '',
    status: String(contract.status || '')
  }
}

function selectPrimaryContract(contracts: ApiContract[], preferredContract?: ApiContract | null) {
  if (preferredContract) return preferredContract
  if (contracts.length === 0) return null
  const active = contracts.find((c) => String(c.status || '').toUpperCase() === 'EA')
  if (active) return active
  const sorted = contracts.slice().sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
  return sorted[0] ?? contracts[0]
}

function enforceEditContractRequirement(value: EditValue, nodeKey?: string | null) {
  if (nodeKey && conditionRequiresContract(nodeKey)) {
    return { ...value, checkContract: true }
  }
  return value
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
    manualEvolution: !!(payload.manualEvolution ?? current.manualEvolution),
    minAttendance: Number(payload.minAttendance ?? current.minAttendance ?? 100),
    minExamGrade: Number(payload.minExamGrade ?? current.minExamGrade ?? 0),
    mustCompleteLessons: !!(payload.mustCompleteLessons ?? current.mustCompleteLessons),
    countJustifiedAbsences: !!(payload.countJustifiedAbsences ?? current.countJustifiedAbsences),
    checkContract: !!(payload.checkContract ?? current.checkContract),
    checkContractDuration: !!(
      payload.checkContractDuration ??
      payload.checkContractTime ??
      current.checkContractDuration ??
      current.checkContractTime
    ),
    contractDurationMonths:
      payload.contractDurationMonths !== undefined && payload.contractDurationMonths !== null
        ? Number(payload.contractDurationMonths)
        : payload.contractTime !== undefined &&
            payload.contractTime !== null &&
            String(payload.contractTime).trim() !== ''
          ? Number(payload.contractTime)
          : current.contractDurationMonths,
    contractStatus: Array.isArray(payload.contractStatus) ? payload.contractStatus : current.contractStatus || [],
    classInsertStatus: String(payload.classInsertStatus ?? current.classInsertStatus ?? 'inProgress'),
    classExitStatus: String(payload.classExitStatus ?? current.classExitStatus ?? 'conclude'),
    classCheckStatus: String(payload.classCheckStatus ?? current.classCheckStatus ?? 'inProgress'),
    hasMinGrade: !!(payload.hasMinGrade ?? current.hasMinGrade),
    hasAttendance: !!(payload.hasAttendance ?? current.hasAttendance),
    useClassEndDate: !!(payload.useClassEndDate ?? current.useClassEndDate),
    keepSameDayOfWeek: !!(payload.keepSameDayOfWeek ?? current.keepSameDayOfWeek),
    isBalanced: !!(payload.isBalanced ?? current.isBalanced),
    balanceStrategy: Array.isArray(payload.balanceStrategy) ? payload.balanceStrategy : current.balanceStrategy || []
  }
  if (!next.evolutionMode || next.evolutionMode === 'none') {
    const inferred = next.useClassEndDate
      ? 'classEnd'
      : next.evolveAt
        ? 'specific'
        : next.startDate || next.endDate
          ? 'range'
          : 'none'
    next.evolutionMode = inferred
  }
  edit.value = { ...edit.value, value: enforceEditContractRequirement(next, edit.value.conditionNodeKey) }
}

async function loadOverrideMetaForEdit() {
  if (!edit.value) return
  if (!props.workflowId || !edit.value.conditionNodeKey) return
  try {
    const res = await api.listWorkflowOverrides(props.workflowId, edit.value.apprenticeId)
    const list = Array.isArray(res.data) ? res.data : []
    const match = list.find((item: any) => String(item.nodeKey) === String(edit.value?.conditionNodeKey))
    edit.value = { ...edit.value, overrideId: match?.id ? Number(match.id) : null }
  } catch (e) {
    console.error('Erro ao buscar overrides', e)
  }
}

async function loadResolvedConditionForEdit() {
  if (!edit.value) return
  if (!props.workflowId || !edit.value.conditionNodeKey) return
  try {
    const res = await api.getResolvedCondition(props.workflowId, edit.value.conditionNodeKey, edit.value.apprenticeId)
    if (res?.data && typeof res.data === 'object') {
      applyResolvedConditionToEdit(res.data as Record<string, any>)
    }
  } catch (e) {
    console.error('Erro ao buscar condicao resolvida', e)
  }
}

async function openEdit(row: RowItem, course: CourseSeqItem) {
  const courseKey = resolveProgressKey(row, course)
  const p = row.progress?.[courseKey]
  const options = conditionOptionsForCourse(course)
  const progressConditionNodeKey = String(p?.conditionNodeKey || p?.classNodeKey || '').trim()
  if (progressConditionNodeKey && !options.some((opt) => opt.nodeKey === progressConditionNodeKey)) {
    options.unshift({ nodeKey: progressConditionNodeKey, label: 'Condicao da turma' })
  }
  const conditionNodeKey = progressConditionNodeKey || defaultConditionKey(options)
  const requiresContract = conditionNodeKey ? conditionRequiresContract(conditionNodeKey) : false
  const baseValue: EditValue = {
    startDate: '',
    endDate: p?.evolveAt || '',
    evolveAt: p?.condition?.evolveAt || p?.evolveAt || '',
    evolutionMode: 'none',
    manualEvolution: false,
    minAttendance: 100,
    minExamGrade: 0,
    hasAttendance: false,
    hasMinGrade: false,
    mustCompleteLessons: true,
    countJustifiedAbsences: false,
    checkContract: requiresContract,
    checkContractDuration: false,
    contractDurationMonths: undefined,
    contractStatus: ['EA'],
    classInsertStatus: 'inProgress',
    classExitStatus: 'conclude',
    classCheckStatus: 'inProgress',
    useClassEndDate: false,
    keepSameDayOfWeek: false,
    isBalanced: false,
    balanceStrategy: []
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
      ...(p?.condition || {})
    }
  }
  if (edit.value?.conditionNodeKey) {
    edit.value = {
      ...edit.value,
      value: enforceEditContractRequirement(edit.value.value, edit.value.conditionNodeKey)
    }
  }
  if (edit.value) {
    const v = edit.value.value
    if (!v.evolutionMode || v.evolutionMode === 'none') {
      const inferred = v.useClassEndDate
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

async function onEditConditionNodeChange(nodeKey: string) {
  if (!edit.value) return
  const nextNodeKey = String(nodeKey || '').trim() || null
  edit.value = {
    ...edit.value,
    conditionNodeKey: nextNodeKey,
    overrideId: null,
    value: enforceEditContractRequirement({ ...edit.value.value }, nextNodeKey)
  }
  await loadOverrideMetaForEdit()
  await loadResolvedConditionForEdit()
}

function updateEditFields(patch: Partial<EditValue>) {
  if (!edit.value) return
  edit.value = { ...edit.value, value: { ...edit.value.value, ...patch } }
}

function handleConditionPatch(patch: Partial<EditValue>) {
  if (!edit.value) return
  if (patch.evolutionMode) {
    setEvolutionMode(patch.evolutionMode)
    return
  }
  if (patch.checkContract !== undefined && editRequiresContract.value) {
    updateEditFields({ ...patch, checkContract: true })
    return
  }
  updateEditFields(patch)
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

async function saveEdit() {
  if (!edit.value) return
  if (!props.workflowId || !edit.value.conditionNodeKey) return
  const savedEditState = {
    rowId: edit.value.rowId,
    courseKey: edit.value.courseKey,
    courseName: edit.value.courseName,
    value: { ...edit.value.value }
  }
  const override = {
    startDate: edit.value.value.startDate,
    endDate: edit.value.value.endDate,
    evolveAt: edit.value.value.evolveAt,
    evolutionMode: edit.value.value.evolutionMode,
    manualEvolution: !!edit.value.value.manualEvolution,
    minAttendance: edit.value.value.minAttendance,
    minExamGrade: edit.value.value.minExamGrade,
    mustCompleteLessons: edit.value.value.mustCompleteLessons,
    countJustifiedAbsences: !!edit.value.value.countJustifiedAbsences,
    checkContract: edit.value.value.checkContract,
    checkContractDuration: !!edit.value.value.checkContractDuration,
    contractDurationMonths:
      edit.value.value.contractDurationMonths !== undefined && edit.value.value.contractDurationMonths !== null
        ? Number(edit.value.value.contractDurationMonths)
        : undefined,
    contractStatus: edit.value.value.contractStatus || [],
    classInsertStatus: edit.value.value.classInsertStatus,
    classExitStatus: edit.value.value.classExitStatus,
    classCheckStatus: edit.value.value.classCheckStatus,
    hasMinGrade: edit.value.value.hasMinGrade,
    hasAttendance: edit.value.value.hasAttendance,
    useClassEndDate: edit.value.value.useClassEndDate,
    keepSameDayOfWeek: edit.value.value.keepSameDayOfWeek,
    isBalanced: edit.value.value.isBalanced,
    balanceStrategy: edit.value.value.balanceStrategy || []
  }

  try {
    if (edit.value.overrideId) {
      await api.updateWorkflowOverride(props.workflowId, edit.value.overrideId, override)
    } else {
      const res = await api.createWorkflowOverride(
        props.workflowId,
        edit.value.apprenticeId,
        edit.value.conditionNodeKey,
        override
      )
      const createdId = res?.data?.id ?? res?.data?.override?.id
      if (createdId) {
        edit.value = { ...edit.value, overrideId: Number(createdId) }
      }
    }
    const normalizedCourseName = normalizeKey(savedEditState.courseName)
    setLocalConditionPreview(
      savedEditState.rowId,
      [savedEditState.courseKey, savedEditState.courseName, normalizedCourseName ? `n:${normalizedCourseName}` : ''],
      savedEditState.value
    )
    closeEdit()
    toast({
      title: 'Condicao atualizada',
      description: 'A sobrescricao do aprendiz foi salva com sucesso.'
    })
    await loadApprenticeWorkflows()
  } catch (e) {
    console.error('Erro ao salvar override', e)
    toast({
      title: 'Erro ao salvar condicao',
      description: formatApiError(e),
      variant: 'destructive'
    })
    closeEdit()
  }
}

const _legacyPreviewActions = [
  canManualEvolute,
  evoluteStep,
  toFlagLabel,
  lessonAttendanceLabel,
  openLessons,
  closeLessonsModal,
  openEdit,
  handleConditionPatch,
  saveEdit
]
void _legacyPreviewActions

const _keepForTypecheck = {
  Scale,
  Users,
  Calendar,
  TrendingUp,
  FileText,
  BookOpen,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  runStatusConfig,
  contractElapsedLabel,
  evolutionLabel,
  balanceStrategyLabel,
  hasWorkflowMembership,
  membershipCurrentClassLabel,
  membershipEntryClassLabel,
  membershipTimelineItems,
  classDayLabel,
  classContractLabel,
  isWaitingEvolution,
  showNoData
}
void _keepForTypecheck
</script>
<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f8fafc] text-[13px] leading-tight">
    <div class="shrink-0 border-b border-[#e8edf3] bg-white px-6 py-4 shadow-sm">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <div class="text-[16px] font-extrabold text-slate-900">Acompanhamento de Aprendizes</div>
          <div class="mt-1 text-[11.5px] text-slate-400">Progresso e elegibilidade no workflow de cursos</div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            class="h-8 rounded-[9px] bg-slate-800 px-3 text-[12px] font-bold hover:bg-slate-700"
            :disabled="isRunningEvolution"
            @click="runEvolution"
          >
            <span
              v-if="isRunningEvolution"
              class="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            {{ isRunningEvolution ? 'Executando...' : 'Executar evolução' }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="h-8 rounded-[9px] border-slate-200 px-3 text-[12px] font-semibold text-slate-600"
            @click="reloadApprentices"
          >
            <RefreshCw class="mr-1.5 h-3.5 w-3.5" />
            Recarregar
          </Button>
        </div>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700"
          ><span class="h-1.5 w-1.5 rounded-full bg-blue-500" />{{ totalTracked }} Acompanhados</span
        >
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700"
          ><span class="h-1.5 w-1.5 rounded-full bg-blue-400" />{{ totalInProgress }} Em andamento</span
        >
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-[280px] flex-1 md:max-w-[360px]">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-300">⌕</span>
          <Input
            v-model="searchQuery"
            placeholder="Buscar por nome, CPF ou e-mail..."
            class="h-8 rounded-[9px] border-slate-200 bg-slate-50 pl-8 text-[12.5px]"
          />
        </div>
        <button
          v-for="opt in statusFilterOptions"
          :key="opt.value"
          type="button"
          class="h-8 rounded-[9px] border px-3 text-[12px] font-semibold"
          :class="
            classStatusFilter === opt.value
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-200 bg-white text-slate-500'
          "
          @click="classStatusFilter = opt.value"
        >
          {{ opt.label }}
        </button>
        <div class="ml-2 inline-flex items-center rounded-[9px] border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            class="h-7 rounded-[7px] px-2 text-[11px] font-semibold"
            :class="hasContractFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500'"
            @click="hasContractFilter = 'all'"
          >
            Todos
          </button>
          <button
            type="button"
            class="h-7 rounded-[7px] px-2 text-[11px] font-semibold"
            :class="hasContractFilter === 'with' ? 'bg-slate-800 text-white' : 'text-slate-500'"
            @click="hasContractFilter = 'with'"
          >
            Tem contrato
          </button>
          <button
            type="button"
            class="h-7 rounded-[7px] px-2 text-[11px] font-semibold"
            :class="hasContractFilter === 'without' ? 'bg-slate-800 text-white' : 'text-slate-500'"
            @click="hasContractFilter = 'without'"
          >
            Sem contrato
          </button>
        </div>
        <Input
          v-model="contractMinMonthsFilter"
          type="number"
          min="0"
          placeholder="Mín. meses de contrato"
          class="h-8 w-[190px] rounded-[9px] border-slate-200 bg-white text-[12px]"
        />
        <button
          type="button"
          class="h-8 rounded-[9px] border px-3 text-[12px] font-semibold"
          :class="
            sortHasContractFirst
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-200 bg-white text-slate-500'
          "
          @click="sortHasContractFirst = !sortHasContractFirst"
        >
          Com contrato primeiro
        </button>
        <span class="ml-auto text-[11.5px] text-slate-400">{{ filteredRows.length }} de {{ totalCount }}</span>
      </div>
    </div>

    <div class="shrink-0 border-b border-[#f1f5f9] bg-white px-6 py-2">
      <div class="flex items-center gap-3">
        <div class="w-9 shrink-0" />
        <div class="w-[200px] shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Aprendiz</div>
        <div class="w-[160px] shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Empresa</div>
        <div class="w-[160px] shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Status</div>
        <div class="min-w-[110px] flex-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">
          Progresso
        </div>
        <div class="w-[100px] shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Etapas</div>
        <div class="w-[80px] shrink-0" />
      </div>
    </div>

    <div class="flex-1 overflow-auto px-6 py-3">
      <div
        v-if="isLoading"
        class="rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-[12px] text-slate-500"
      >
        <div class="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        <div class="font-semibold text-slate-700">Carregando aprendizes...</div>
      </div>

      <div
        v-else-if="filteredRows.length === 0"
        class="rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
      >
        <div class="text-[14px] font-semibold text-slate-700">
          {{ showNoResults ? 'Nenhum resultado' : 'Sem aprendizes' }}
        </div>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="r in filteredRows"
          :key="r.id"
          class="overflow-hidden rounded-[14px] border border-[#e8edf3] bg-white transition-shadow duration-150"
          :class="[
            rowContractCardClass(r),
            isExpanded(r.id) ? 'shadow-[0_4px_16px_rgba(0,0,0,0.07)]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          ]"
        >
          <button type="button" class="w-full text-left" @click="toggleRow(r.id)">
            <div class="flex items-center gap-3.5 px-4 py-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
                :style="{
                  background: statusVisual(r.workflowMembership?.status).bg,
                  borderColor: statusVisual(r.workflowMembership?.status).ring
                }"
              >
                <span
                  class="text-[12px] font-extrabold"
                  :style="{ color: statusVisual(r.workflowMembership?.status).text }"
                  >{{ initials(r.name) }}</span
                >
              </div>
              <div class="w-[200px] min-w-0 shrink-0">
                <div class="truncate text-[13px] font-bold text-slate-800">{{ r.name }}</div>
                <div class="truncate text-[10.5px] text-slate-400">{{ r.cpf || '-' }}</div>
              </div>
              <div class="w-[160px] min-w-0 shrink-0">
                <template v-if="r.contract">
                  <button
                    type="button"
                    class="w-full rounded-[8px] px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
                    title="Ver todos os contratos"
                    @click.stop="openContracts(r)"
                  >
                  <div class="truncate text-[11.5px] font-semibold text-slate-700">{{ r.contract.company }}</div>
                  <div class="mt-0.5 text-[10px] text-slate-400">
                    {{ contractDurationLabel(r.contract.start, r.contract.end) || '0 meses' }} ·
                    {{ fmtDate(r.contract.end) }}
                  </div>
                  <div v-if="r.contracts.length > 1" class="mt-0.5 text-[9.5px] font-semibold text-blue-600">
                    {{ r.contracts.length }} contratos
                  </div>
                  </button>
                </template>
                <span v-else class="text-[10.5px] italic text-slate-300">Sem contrato</span>
              </div>
              <div class="w-[160px] shrink-0">
                <span
                  class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  :style="{
                    background: statusVisual(r.workflowMembership?.status).bg,
                    color: statusVisual(r.workflowMembership?.status).text,
                    borderColor: statusVisual(r.workflowMembership?.status).ring
                  }"
                  >{{ statusVisual(r.workflowMembership?.status).label }}</span
                >
                <div class="mt-1 truncate text-[10px] text-slate-400">{{ membershipStepLabel(r) }}</div>
              </div>
              <div class="min-w-[110px] flex-1">
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-[10px] text-slate-400">{{ membershipProgressText(r) }} etapas</span
                  ><span class="text-[10px] font-bold text-slate-600">{{ membershipProgressValue(r) }}%</span>
                </div>
                <div class="h-1 overflow-hidden rounded-sm bg-slate-100">
                  <div
                    class="h-full rounded-sm bg-gradient-to-r from-blue-500 to-emerald-500 transition-[width] duration-500 ease-out"
                    :style="{ width: `${membershipProgressValue(r)}%` }"
                  />
                </div>
              </div>
              <div class="flex w-[100px] shrink-0 items-center gap-1">
                <span
                  class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700"
                  >✓ {{ summarizeRow(r).ok }}</span
                >
                <span
                  v-if="countIneligibleSteps(r) > 0"
                  class="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                  >✗ {{ countIneligibleSteps(r) }}</span
                >
              </div>
              <div class="flex w-[80px] shrink-0 items-center justify-end gap-1">
                <button
                  type="button"
                  class="h-7 rounded-[7px] border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600"
                  @click.stop="openDetail(r)"
                >
                  Detalhes
                </button>
                <button
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-[7px] border border-slate-200 text-slate-400"
                  :class="isExpanded(r.id) ? 'bg-slate-100' : 'bg-white'"
                  @click.stop="toggleRow(r.id)"
                >
                  <ChevronRight class="h-3.5 w-3.5 transition-transform" :class="isExpanded(r.id) ? 'rotate-90' : ''" />
                </button>
              </div>
            </div>
          </button>

          <div v-show="isExpanded(r.id)" class="overflow-x-hidden border-t border-slate-100 bg-[#fafbfc] px-4 py-3">
            <div class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              <div v-for="(c, idx) in courseSeq" :key="`${r.id}:${c.nodeId}`" class="min-w-0">
                <div class="mb-1.5 flex items-center gap-1.5">
                  <div class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-slate-800">
                    <span class="text-[9px] font-extrabold text-white">{{ idx + 1 }}</span>
                  </div>
                  <span class="truncate text-[10.5px] font-bold text-slate-700">{{ c.courseName }}</span>
                </div>
                <template v-if="getProgress(r, c)">
                  <div class="rounded-[10px] border border-[#e8edf3] bg-white p-3 shadow-sm">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="truncate text-[11px] font-bold text-slate-800">
                          {{ getProgress(r, c)?.className || '-' }}
                        </div>
                        <div class="mt-0.5 flex items-center gap-1">
                          <span
                            v-if="!getProgress(r, c)?.isFinalStep"
                            class="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                            :class="
                              getProgress(r, c)?.eligibilityAny === true
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            "
                          >
                            {{ getProgress(r, c)?.eligibilityAny === true ? 'Elegivel' : 'Aguardando regra' }}
                          </span>
                          <span
                            v-else
                            class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
                          >
                            {{ finalStepLabel(getProgress(r, c)) }}
                          </span>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="inline-flex h-7 items-center justify-center rounded-[7px] border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 disabled:opacity-50"
                          :title="(getProgress(r, c)?.lessons || []).length > 0 ? 'Ver temas da etapa' : 'Sem temas cadastrados'"
                          :disabled="(getProgress(r, c)?.lessons || []).length === 0"
                          @click.stop="openLessons(r, c)"
                        >
                          <BookOpen class="h-3.5 w-3.5" />
                        </button>
                        <button
                          v-if="!getProgress(r, c)?.isFinalStep"
                          type="button"
                          class="inline-flex h-7 items-center justify-center rounded-[7px] border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 disabled:opacity-50"
                          title="Editar condicao de evolucao"
                          :disabled="conditionOptionsForCourse(c).length === 0"
                          @click.stop="openEdit(r, c)"
                        >
                          <Pencil class="h-3.5 w-3.5" />
                        </button>
                        <button
                          v-if="!getProgress(r, c)?.isFinalStep"
                          type="button"
                          class="inline-flex h-7 items-center justify-center rounded-[7px] border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 disabled:opacity-50"
                          title="Evoluir etapa manualmente"
                          :disabled="!canManualEvolute(r, c) || evolvingStepKey === evolutionStepKey(r.id, c.nodeId)"
                          @click.stop="evoluteStep(r, c)"
                        >
                          <RefreshCw
                            class="h-3.5 w-3.5"
                            :class="evolvingStepKey === evolutionStepKey(r.id, c.nodeId) ? 'animate-spin' : ''"
                          />
                        </button>
                      </div>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        :style="{
                          background: statusVisual(getProgress(r, c)?.status).bg,
                          color: statusVisual(getProgress(r, c)?.status).text,
                          borderColor: statusVisual(getProgress(r, c)?.status).ring
                        }"
                        >{{ statusVisual(getProgress(r, c)?.status).label }}</span
                      >
                      <span
                        v-if="specificEvolutionDate(getProgress(r, c))"
                        class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                        >{{ specificEvolutionDate(getProgress(r, c)) }}</span
                      >
                      <span
                        v-if="hasConditionOverride(getProgress(r, c))"
                        class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-amber-700"
                        :title="
                          overrideEvolutionDate(getProgress(r, c))
                            ? `Override: ${overrideEvolutionDate(getProgress(r, c))}`
                            : 'Condicao com override aplicado'
                        "
                        >Override</span
                      >
                    </div>

                    <div
                      v-if="progressReasonSummary(getProgress(r, c))"
                      class="mt-1.5 line-clamp-2 text-[9.5px] font-medium leading-relaxed text-rose-600"
                    >
                      {{ progressReasonSummary(getProgress(r, c)) }}
                    </div>
                    <div class="mt-2 space-y-1.5">
                      <div class="flex items-center justify-between rounded-[7px] bg-slate-50 px-2 py-1.5 text-[10px]">
                        <span class="text-slate-500">Frequência</span>
                        <span
                          class="font-bold"
                          :class="Number(getProgress(r, c)?.attendance ?? 0) >= 85 ? 'text-emerald-600' : 'text-amber-600'"
                          >{{ attendanceLabel(getProgress(r, c)?.attendance) }}</span
                        >
                      </div>
                      <div class="flex items-center justify-between rounded-[7px] bg-slate-50 px-2 py-1.5 text-[10px]">
                        <span class="text-slate-500">Nota</span>
                        <span
                          class="font-bold"
                          :class="Number(getProgress(r, c)?.exam ?? 0) >= 7 ? 'text-emerald-600' : 'text-amber-600'"
                          >{{ examLabel(getProgress(r, c)?.exam) }}</span
                        >
                      </div>
                    </div>
                  </div>
                </template>
                <div
                  v-else
                  class="flex h-[112px] items-center justify-center rounded-[10px] border border-dashed border-slate-200 bg-[#fafafa]"
                >
                  <span class="text-[11px] font-medium text-slate-300">Não matriculado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="shrink-0 border-t border-[#f1f5f9] bg-white px-6 py-2.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11.5px] text-slate-400">Mostrando {{ pageStart }}-{{ pageEnd }} de {{ totalCount }}</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-[7px] border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
            :disabled="isLoading || currentPage === 1"
            @click="prevPage"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </button>
          <button
            v-for="page in visiblePages"
            :key="`page:${page}`"
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-[7px] border text-[11px] font-bold"
            :class="
              page === currentPage
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            "
            :disabled="isLoading"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-[7px] border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
            :disabled="isLoading || currentPage === totalPages"
            @click="nextPage"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="selectedDetailRow" class="absolute inset-0 z-20">
      <div class="absolute inset-0 bg-[rgba(15,23,42,0.38)] backdrop-blur-[3px]" @click="closeDetail" />
      <div class="absolute right-0 top-0 flex h-full w-[min(640px,95vw)] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
        <div class="shrink-0 border-b border-slate-100 bg-[#fafbfc] px-6 py-5">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-[17px] font-extrabold text-slate-900">{{ selectedDetailRow.name }}</div>
              <div class="mt-1 text-[12px] text-slate-400">
                {{ selectedDetailRow.cpf }} · {{ selectedDetailRow.email }}
              </div>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-500"
              @click="closeDetail"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              :style="{
                background: statusVisual(selectedDetailRow.workflowMembership?.status).bg,
                color: statusVisual(selectedDetailRow.workflowMembership?.status).text,
                borderColor: statusVisual(selectedDetailRow.workflowMembership?.status).ring
              }"
              >{{ statusVisual(selectedDetailRow.workflowMembership?.status).label }}</span
            >
            <span
              class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >{{ membershipStepLabel(selectedDetailRow) }}</span
            >
            <span
              class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >{{ membershipProgressValue(selectedDetailRow) }}% concluído</span
            >
          </div>
        </div>

        <div class="shrink-0 border-b border-slate-100 px-6">
          <div class="flex items-center">
            <button
              type="button"
              class="border-b-2 px-3 py-2 text-[12px] font-semibold"
              :class="
                detailTab === 'timeline' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400'
              "
              @click="detailTab = 'timeline'"
            >
              Resumo
            </button>
            <button
              type="button"
              class="border-b-2 px-3 py-2 text-[12px] font-semibold"
              :class="detailTab === 'steps' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400'"
              @click="detailTab = 'steps'"
            >
              Etapas
            </button>
            <button
              type="button"
              class="border-b-2 px-3 py-2 text-[12px] font-semibold"
              :class="
                detailTab === 'transitions' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400'
              "
              @click="detailTab = 'transitions'"
            >
              Histórico
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto bg-[#f8fafc] p-6">
          <div v-if="detailTab === 'timeline'" class="space-y-3">
            <div class="rounded-xl border border-[#dbe4ef] bg-white p-4">
              <div class="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                Progresso no workflow
              </div>
              <div class="mb-2 flex items-center gap-3">
                <div class="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                  <div
                    class="h-full rounded bg-gradient-to-r from-blue-500 to-emerald-500"
                    :style="{ width: `${membershipProgressValue(selectedDetailRow)}%` }"
                  />
                </div>
                <span class="text-[20px] font-extrabold text-slate-900"
                  >{{ membershipProgressValue(selectedDetailRow) }}%</span
                >
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-[10px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Entrada</div>
                  <div class="mt-0.5 text-[12px] font-bold text-slate-700">
                    {{ fmtDetailDateTime(selectedDetailRow.workflowMembership?.joinedAt || selectedDetailRow.contract?.start) }}
                  </div>
                </div>
                <div class="rounded-[10px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Última transição</div>
                  <div class="mt-0.5 text-[12px] font-bold text-slate-700">
                    {{
                      fmtDetailDateTime(
                        selectedDetailRow.workflowMembership?.lastTransitionAt ||
                          selectedDetailRow.workflowMembership?.completedAt
                      )
                    }}
                  </div>
                </div>
                <div class="rounded-[10px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Etapas</div>
                  <div class="mt-0.5 text-[12px] font-bold text-slate-700">{{ membershipProgressText(selectedDetailRow) }}</div>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-[#dbe4ef] bg-white p-4">
              <div class="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">Contrato</div>
              <div class="mb-2.5 flex items-center justify-between gap-2">
                <div class="truncate text-[30px] font-bold text-slate-700">{{ selectedDetailRow.contract?.company || '-' }}</div>
                <span
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                  :class="contractStatusVisual(selectedDetailRow.contract?.status).class"
                  >{{ contractStatusVisual(selectedDetailRow.contract?.status).label }}</span
                >
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-[10px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Início</div>
                  <div class="mt-0.5 text-[12px] font-bold text-slate-700">{{ fmtDateWithShortYear(selectedDetailRow.contract?.start) }}</div>
                </div>
                <div class="rounded-[10px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Término</div>
                  <div class="mt-0.5 text-[12px] font-bold text-slate-700">{{ fmtDateWithShortYear(selectedDetailRow.contract?.end) }}</div>
                </div>
                <div class="rounded-[10px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Duração</div>
                  <div class="mt-0.5 text-[12px] font-bold text-slate-700">
                    {{ contractDurationLabel(selectedDetailRow.contract?.start, selectedDetailRow.contract?.end) || '-' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-[#dbe4ef] bg-white p-4">
              <div class="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">Desempenho por curso</div>
              <div class="space-y-2.5">
                <div
                  v-for="item in detailSteps(selectedDetailRow)"
                  :key="`timeline-step:${item.key}`"
                  class="rounded-[12px] border border-[#e8edf3] bg-slate-50 px-3 py-2.5"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="mb-1.5 flex items-center gap-2">
                        <span
                          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-slate-800 text-[10px] font-extrabold text-white"
                          >{{ item.order }}</span
                        >
                        <div class="truncate text-[14px] font-bold text-slate-700">{{ item.progress?.className || item.label }}</div>
                      </div>
                      <span
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        :style="{
                          background: statusVisual(item.progress?.status).bg,
                          color: statusVisual(item.progress?.status).text,
                          borderColor: statusVisual(item.progress?.status).ring
                        }"
                        >{{ statusVisual(item.progress?.status).label }}</span
                      >
                    </div>
                    <div class="flex items-end gap-3">
                      <div class="text-right">
                        <div class="text-[10px] text-slate-400">Freq.</div>
                        <div
                          class="text-[24px] font-bold"
                          :class="
                            Number(item.progress?.attendance ?? NaN) >= 85
                              ? 'text-emerald-600'
                              : Number.isFinite(Number(item.progress?.attendance))
                                ? 'text-amber-600'
                                : 'text-slate-500'
                          "
                        >
                          {{ attendanceLabel(item.progress?.attendance) }}
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-[10px] text-slate-400">Nota</div>
                        <div
                          class="text-[24px] font-bold"
                          :class="
                            Number(item.progress?.exam ?? NaN) >= 7
                              ? 'text-emerald-600'
                              : Number.isFinite(Number(item.progress?.exam))
                                ? 'text-amber-600'
                                : 'text-slate-500'
                          "
                        >
                          {{ examLabel(item.progress?.exam) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="detailTab === 'steps'" class="space-y-3">
            <div
              v-for="item in detailSteps(selectedDetailRow)"
              :key="`detail-step:${item.key}`"
              class="rounded-xl border bg-white p-4"
              :class="
                isCurrentDetailStep(selectedDetailRow, item)
                  ? 'border-blue-300 bg-blue-50/60'
                  : 'border-[#e8edf3] bg-white'
              "
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-extrabold text-white"
                      :class="isCurrentDetailStep(selectedDetailRow, item) ? 'bg-blue-500' : 'bg-slate-800'"
                      >{{ item.order }}</span
                    >
                    <div class="truncate text-[13px] font-bold text-slate-800">{{ item.label }}</div>
                  </div>
                  <div v-if="isCurrentDetailStep(selectedDetailRow, item)" class="mt-1 text-[11px] font-semibold text-blue-600">
                    Etapa atual
                  </div>
                </div>
                <span
                  class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  :style="{
                    background: statusVisual(item.progress?.status).bg,
                    color: statusVisual(item.progress?.status).text,
                    borderColor: statusVisual(item.progress?.status).ring
                  }"
                  >{{ statusVisual(item.progress?.status).label }}</span
                >
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2">
                <div class="rounded-[9px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Turma</div>
                  <div class="mt-0.5 text-[14px] font-bold text-slate-700">{{ item.progress?.className || '-' }}</div>
                </div>
                <div class="rounded-[9px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Elegibilidade</div>
                  <div class="mt-0.5 text-[14px] font-bold text-slate-700">{{ detailEligibilityLabel(item.progress) }}</div>
                </div>
                <div class="rounded-[9px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Frequência</div>
                  <div class="mt-0.5 text-[14px] font-bold text-slate-700">{{ attendanceLabel(item.progress?.attendance) }}</div>
                </div>
                <div class="rounded-[9px] bg-slate-50 px-3 py-2">
                  <div class="text-[10px] font-semibold uppercase text-slate-400">Nota</div>
                  <div class="mt-0.5 text-[14px] font-bold text-slate-700">{{ examLabel(item.progress?.exam) }}</div>
                </div>
              </div>

              <div v-if="detailReasonTag(item.progress)" class="mt-3">
                <span
                  class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-600"
                  >{{ detailReasonTag(item.progress) }}</span
                >
              </div>
            </div>
          </div>
          <div v-else class="space-y-2.5">
            <div
              v-if="transitionsLimit === 0"
              class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[12px] text-slate-500"
            >
              Histórico desativado.
            </div>
            <div
              v-else-if="
                !selectedDetailRow.workflowMembership || selectedDetailRow.workflowMembership.transitions.length === 0
              "
              class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[12px] text-slate-500"
            >
              Nenhuma transição registrada.
            </div>
            <div
              v-else
              v-for="transition in selectedDetailRow.workflowMembership.transitions"
              :key="`${transition.id}:${transition.createdAt || ''}`"
              class="rounded-[12px] border border-[#dbe4ef] bg-white p-3.5"
            >
              <div class="mb-1.5 flex items-center justify-between gap-2">
                <div class="text-[11px] text-slate-400">{{ fmtDetailDateTime(transition.createdAt) }}</div>
                <div class="flex items-center gap-1.5">
                  <span
                    class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    :class="detailTransitionResultVisual(transition.result).class"
                    >{{ detailTransitionResultVisual(transition.result).label }}</span
                  >
                  <span
                    class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                    >{{ detailTransitionModeLabel(transition.mode) }}</span
                  >
                </div>
              </div>
              <div class="flex items-center gap-2 text-[16px] font-semibold leading-tight">
                <span class="font-semibold text-slate-700">{{
                  formatClassLabel(transition.fromClassInfo, transition.fromClass)
                }}</span
                ><span class="text-slate-300">→</span
                ><span class="font-bold text-slate-900">{{
                  formatClassLabel(transition.toClassInfo, transition.toClass)
                }}</span>
              </div>
              <div class="mt-1.5 text-[11px] text-slate-400">{{ detailRunSummary(transition) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="contractsModal.open" class="absolute inset-0 z-30">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeContractsModal" />
      <div
        class="absolute left-1/2 top-1/2 flex w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border bg-white shadow-2xl"
      >
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div class="text-sm font-bold text-slate-900">Contratos do aprendiz</div>
            <div class="text-xs text-slate-600">
              {{ contractsModal.apprenticeName }} • {{ contractsModal.contracts.length }} contrato(s)
            </div>
          </div>
          <Button size="icon" variant="ghost" class="h-8 w-8" @click="closeContractsModal">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="max-h-[65vh] overflow-auto p-4">
          <div
            v-if="contractsModal.contracts.length === 0"
            class="rounded-xl border border-dashed bg-slate-50 p-6 text-center text-xs text-slate-500"
          >
            Nenhum contrato encontrado para este aprendiz.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(contract, contractIdx) in contractsModal.contracts"
              :key="`contract-modal:${rowContractKey(contract)}:${contractIdx}`"
              class="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-900">{{ contract.company || '-' }}</div>
                  <div class="text-[11px] text-slate-500">
                    Contrato: {{ contract.contractId || '-' }} • Parceiro: {{ contract.partnerId || '-' }}
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    :class="contractStatusVisual(contract.status).class"
                    >{{ contractStatusVisual(contract.status).label }}</span
                  >
                  <span
                    v-if="rowContractKey(contract) === contractsModal.preferredKey"
                    class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                    >Preferred</span
                  >
                </div>
              </div>
              <div class="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <span class="text-slate-500">Início:</span>
                  <span class="ml-1 font-semibold text-slate-900">{{ fmtDateWithShortYear(contract.start) }}</span>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <span class="text-slate-500">Término:</span>
                  <span class="ml-1 font-semibold text-slate-900">{{ fmtDateWithShortYear(contract.end) }}</span>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <span class="text-slate-500">Duração:</span>
                  <span class="ml-1 font-semibold text-slate-900">
                    {{ contractDurationLabel(contract.start, contract.end) || '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lessonsModal.open" class="absolute inset-0 z-30">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeLessonsModal" />
      <div
        class="absolute left-1/2 top-1/2 flex w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border bg-white shadow-2xl"
      >
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div class="text-sm font-bold text-slate-900">Temas da etapa</div>
            <div class="text-xs text-slate-600">{{ lessonsModal.apprenticeName }} • {{ lessonsModal.courseName }}</div>
          </div>
          <Button size="icon" variant="ghost" class="h-8 w-8" @click="closeLessonsModal">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <div class="max-h-[65vh] overflow-auto p-4">
          <div
            v-if="lessonsModal.lessons.length === 0"
            class="rounded-xl border border-dashed bg-slate-50 p-6 text-center text-xs text-slate-500"
          >
            Nenhum tema encontrado para esta etapa.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(lesson, lessonIdx) in lessonsModal.lessons"
              :key="`lesson-modal:${String(lesson.lesson || lessonIdx)}-${lessonIdx}`"
              class="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-900">
                    {{ lessonTopicLabel(lesson, lessonIdx) }}
                  </div>
                  <div class="text-[11px] text-slate-500">ID: {{ lesson.lesson ?? '-' }}</div>
                </div>
                <span
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  :class="
                    lessonConcludedLabel(lesson) === 'Concluido'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  "
                >
                  {{ lessonConcludedLabel(lesson) }}
                </span>
              </div>
              <div class="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <span class="text-slate-500">Frequencia:</span>
                  <span class="ml-1 font-semibold text-slate-900">{{ lessonAttendanceLabel(lesson) }}</span>
                </div>
                <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  <span class="text-slate-500">Ativa:</span>
                  <span class="ml-1 font-semibold text-slate-900">{{ toFlagLabel(lesson.activated) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="edit" class="absolute inset-0 z-40">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeEdit" />
      <div class="absolute right-0 top-0 h-full w-[420px] overflow-auto border-l bg-white shadow-2xl">
        <div class="sticky top-0 z-10 flex items-center justify-between border-b bg-gradient-to-br from-blue-50 to-white p-5">
          <div class="min-w-0">
            <div class="mb-1 truncate text-sm font-bold text-slate-900">Configurar evolucao do aprendiz</div>
            <div class="truncate text-xs text-slate-600">Aprendiz #{{ edit.rowId }} • {{ edit.courseName }}</div>
          </div>
          <Button size="icon" variant="ghost" class="h-8 w-8" @click="closeEdit">
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-4 p-5">
          <div v-if="edit.conditionOptions.length > 1" class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">Condicao</label>
            <select
              class="h-9 w-full rounded-[8px] border border-slate-200 bg-white px-2 text-[12px] text-slate-700"
              :value="edit.conditionNodeKey || ''"
              @change="onEditConditionNodeChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="opt in edit.conditionOptions" :key="`edit-cond:${opt.nodeKey}`" :value="opt.nodeKey">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div
            v-if="!edit.conditionNodeKey"
            class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-800"
          >
            Nenhuma condicao conectada para esta etapa. Nao ha o que editar.
          </div>

          <ConditionConfigForm
            v-else
            :value="edit.value"
            :requires-contract="editRequiresContract"
            id-prefix="apprentice-override"
            @update="handleConditionPatch"
          />

          <div class="flex items-center gap-2 pt-2">
            <Button variant="outline" class="flex-1" @click="closeEdit">Cancelar</Button>
            <Button
              class="flex-1 bg-blue-600 hover:bg-blue-700"
              :disabled="!edit.conditionNodeKey"
              @click="saveEdit"
            >
              <CheckCircle2 class="mr-1.5 h-4 w-4" />
              Salvar
            </Button>
          </div>

          <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800">
            <strong>Nota:</strong> Esta edicao e especifica para este aprendiz e sobrescreve a condicao padrao.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
