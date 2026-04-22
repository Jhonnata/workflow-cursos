<script setup lang="ts">
import { computed, markRaw, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, type Connection } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  Unlink,
  Users
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import ConditionConfigForm from '@/components/condition-config-form.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import SmoothEdge from '@/components/vue-flow/edges/smooth-edge.vue'
import CustomConnectionLine from '@/components/vue-flow/custom-connection-line.vue'
import CommentNode from '@/components/vue-flow/nodes/comment-node.vue'
import ConditionNode from '@/components/vue-flow/nodes/condition-node.vue'
import CourseNode from '@/components/vue-flow/nodes/course-node.vue'
import StartNode from '@/components/vue-flow/nodes/start-node.vue'
import WorkflowGridPreview from '@/components/workflow-grid-preview.vue'
import { useToast } from '@/components/ui/toast'
import {
  buildCoursePayload,
  EXECUTION_MODE_OPTIONS,
  commentNodeId,
  conditionNodeId,
  courseNodeId,
  edgeKindFromHandles,
  edgeStroke,
  portColor,
  START_NODE_ID,
  uid,
  onlyWithContractFlag,
  type CommentPayload,
  type StartPayload,
  type ConditionPayload,
  type Course,
  type CourseClass
} from '@/lib/workflow'
import { api } from '@/lib/api'
import {
  buildEdgeDataFromConnection,
  buildWorkflowPayload,
  validateWorkflowPayload,
  WorkflowPayloadError
} from '@/lib/workflow-payload'

const { toast } = useToast()
const router = useRouter()
const props = defineProps<{
  flowId: string
  workflowId?: string | number
  initialTab?: 'workflow' | 'evolution'
}>()
const { nodes, edges, setNodes, setEdges, project, onNodesChange, onEdgesChange, addNodes } = useVueFlow({
  id: props.flowId
})

const nodeTypes = {
  comment: markRaw(CommentNode),
  course: markRaw(CourseNode),
  condition: markRaw(ConditionNode),
  start: markRaw(StartNode)
}

const edgeTypes = {
  smooth: markRaw(SmoothEdge)
}

type PaletteNodeType = 'start' | 'condition' | 'comment'

const apiCourses = ref<Course[]>([])
const apiClasses = ref<CourseClass[]>([])
const apiWorkflows = ref<any[]>([])
const workflowSchedules = ref<Record<string, any>>({})
const apiOnline = ref(true)

function formatApiError(e: unknown) {
  const err = e as any
  const message =
    typeof err?.message === 'string' && err.message.trim()
      ? err.message.trim()
      : 'Nao foi possivel completar a operacao.'
  const errors = Array.isArray(err?.errors) ? err.errors.map((item: any) => String(item)).filter(Boolean) : []
  if (errors.length === 0) return message
  return `${message} Erros: ${errors.join(' | ')}`
}

function formatWorkflowPayloadIssues(error: WorkflowPayloadError) {
  return error.issues.map((issue) => `Edge ${issue.edgeId}: ${issue.message}`).join(' | ')
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

function scheduleWorkflowId(item: any) {
  const id =
    item?.workflowId ??
    item?.workflow_id ??
    item?.id ??
    item?.workflow?.id ??
    item?.workflow?.workflowId ??
    item?.workflow?.workflow_id ??
    item?.configuration?.workflowId ??
    item?.configuration?.workflow_id
  if (id === undefined || id === null || id === '') return ''
  return String(id)
}

function buildWorkflowScheduleIndex(items: any[]) {
  const next: Record<string, any> = {}
  for (const item of items || []) {
    const key = scheduleWorkflowId(item)
    if (!key) continue
    next[key] = item
  }
  return next
}

function workflowScheduleOf(workflow: any) {
  if (!workflow) return null
  return workflowSchedules.value[String(workflow.id)] ?? null
}

function formatDateTime(value: any) {
  if (value === undefined || value === null || value === '') return '-'
  const raw = String(value).trim()
  if (!raw) return '-'
  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return raw
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}

function scheduleExecutionModeLabel(schedule: any) {
  const mode = String(
    schedule?.executionMode ?? schedule?.mode ?? schedule?.configuration?.executionMode ?? ''
  ).toLowerCase()
  if (mode === 'recurring') return 'Recorrente'
  if (mode === 'once') return 'Unica'
  return '-'
}

function scheduleFrequencyLabel(schedule: any) {
  const intervalRaw = schedule?.runIntervalMinutes ?? schedule?.configuration?.runIntervalMinutes
  const runDailyAt = schedule?.runDailyAt ?? schedule?.configuration?.runDailyAt
  const interval = Number(intervalRaw)
  if (Number.isFinite(interval) && interval > 0) {
    if (interval === 60) return 'A cada 1h'
    if (interval % 60 === 0) return `A cada ${interval / 60}h`
    return `A cada ${interval} min`
  }
  if (runDailyAt) return `Diario as ${runDailyAt}`
  return 'Sem repeticao'
}

function scheduleNextExecutionLabel(schedule: any) {
  return formatDateTime(schedule?.nextExecution ?? schedule?.scheduledAt ?? schedule?.configuration?.nextExecution)
}

function scheduleLastExecutionLabel(schedule: any) {
  return formatDateTime(schedule?.lastExecution ?? schedule?.configuration?.lastExecution)
}

const query = ref('')
const courseApprenticeFilter = ref<'all' | 'with' | 'without'>('all')
const workflowSearch = ref('')
const expandedCourses = ref<Set<number>>(new Set())
const preselect = ref<Record<number, Set<number>>>({})
const connectMode = ref(false)
const selectedNodeId = ref<string | null>(null)
const selectedEdgeId = ref<string | null>(null)
const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)
const mainTab = ref<'workflow' | 'evolution'>('workflow')
const workflowMode = ref<'list' | 'editor'>('list')
const conditionDetailsOpenId = ref<string | null>(null)
const activeWorkflow = ref<{ id?: string | number; name: string; description: string; status: string } | null>(null)
const activeWorkflowGraphId = ref<string | number | null>(null)
const newWorkflow = ref({ name: '', description: '', status: 'active' })
const createWorkflowOpen = ref(false)
const editWorkflowOpen = ref(false)
const editWorkflow = ref<{ id: string | number; name: string; description: string; status: string } | null>(null)
const workflowStatusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'draft', label: 'Rascunho' }
]
const repeatIntervalOptions = [
  { value: '', label: 'Nao repetir' },
  { value: '10', label: 'A cada 10 min' },
  { value: '20', label: 'A cada 20 min' },
  { value: '30', label: 'A cada 30 min' },
  { value: '60', label: 'A cada 1h' },
  { value: '90', label: 'A cada 1h30' },
  { value: '120', label: 'A cada 2h' }
]

function setActiveWorkflow(
  wf: any,
  opts?: { mode?: 'list' | 'editor'; tab?: 'workflow' | 'evolution'; notify?: boolean }
) {
  if (!wf) return
  const inlineGraph = normalizeWorkflowGraph(wf)
  const prevId = activeWorkflow.value?.id
  activeWorkflow.value = {
    id: wf.id,
    name: wf.name || '',
    description: wf.description || '',
    status: wf.status || 'active'
  }
  const hasGraph = inlineGraph.nodes.length > 0 || inlineGraph.edges.length > 0
  const sameWorkflow = prevId !== undefined && prevId !== null && String(prevId) === String(wf.id)
  if (hasGraph) {
    setNodes(inlineGraph.nodes)
    setEdges(inlineGraph.edges)
    activeWorkflowGraphId.value = wf.id
  } else if (!sameWorkflow) {
    setNodes([])
    setEdges([])
    activeWorkflowGraphId.value = null
  }
  selectedNodeId.value = null
  selectedEdgeId.value = null
  conditionDetailsOpenId.value = null
  if (opts?.tab) mainTab.value = opts.tab
  if (opts?.mode) workflowMode.value = opts.mode
  syncNodeMeta()
  syncEdgesForStart()
  if (opts?.notify) {
    toast({
      title: 'Workflow carregado',
      description: `Workflow "${wf.name}" foi carregado com sucesso.`
    })
  }
}

function resetWorkflowState() {
  activeWorkflow.value = null
  activeWorkflowGraphId.value = null
  setNodes([])
  setEdges([])
  selectedNodeId.value = null
  selectedEdgeId.value = null
  conditionDetailsOpenId.value = null
  workflowMode.value = 'list'
  mainTab.value = 'workflow'
}

function normalizeWorkflowGraph(payload: any) {
  if (!payload) return { nodes: [], edges: [] }
  const KNOWN_NODE_TYPES = new Set(['start', 'course', 'condition', 'comment'])
  const normalizeNodeType = (value: unknown) => {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase()
    if (!raw) return ''
    if (raw === 'cond' || raw === 'if') return 'condition'
    if (KNOWN_NODE_TYPES.has(raw)) return raw
    return ''
  }
  const inferNodeTypeByNodeKey = (nodeKey: string) => {
    const key = String(nodeKey || '')
      .trim()
      .toLowerCase()
    if (!key) return ''
    if (key === START_NODE_ID || key.startsWith('start')) return 'start'
    if (key.startsWith('course:')) return 'course'
    if (key.startsWith('cond:') || key.startsWith('condition:')) return 'condition'
    if (key.startsWith('comment:')) return 'comment'
    return ''
  }
  const inferNodeTypeByPayload = (payloadValue: any) => {
    const nodePayload = payloadValue && typeof payloadValue === 'object' ? payloadValue : {}
    if (
      nodePayload.executionMode !== undefined ||
      nodePayload.runDailyAt !== undefined ||
      nodePayload.runIntervalMinutes !== undefined
    ) {
      return 'start'
    }
    if (
      nodePayload.courseId !== undefined ||
      nodePayload.courseName !== undefined ||
      Array.isArray(nodePayload.classes)
    ) {
      return 'course'
    }
    if (
      nodePayload.minAttendance !== undefined ||
      nodePayload.minExamGrade !== undefined ||
      nodePayload.classInsertStatus !== undefined ||
      nodePayload.classExitStatus !== undefined
    ) {
      return 'condition'
    }
    if (nodePayload.text !== undefined) return 'comment'
    return ''
  }
  const resolveNodeType = (item: any, nodeKey: string, nodePayload: any) =>
    normalizeNodeType(item?.type) ||
    inferNodeTypeByNodeKey(nodeKey) ||
    inferNodeTypeByPayload(nodePayload) ||
    'comment'
  const parseMaybeJson = (value: any) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (!trimmed) return value
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  const toNumber = (value: any) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }
  const mapApiNodes = (items: any[]) =>
    items
      .map((item) => {
        if (!item) return null
        const nodeKey = String(item.nodeKey ?? item.node_key ?? item.id ?? '').trim()
        const data = parseMaybeJson(item.payloadJson ?? item.payload_json) ?? {}
        const baseData = data?.payload ? data : { payload: data || {}, nodeId: nodeKey || String(item.id) }
        const nodePayload = baseData?.payload ?? {}
        const nodeType = resolveNodeType(item, nodeKey, nodePayload)
        return {
          id: nodeKey || String(item.id),
          type: nodeType,
          position: {
            x: toNumber(item.positionX ?? item.position_x) || 0,
            y: toNumber(item.positionY ?? item.position_y) || 0
          },
          data: {
            ...(baseData || {}),
            connectMode: baseData?.connectMode ?? false,
            nodeId: nodeKey || baseData?.nodeId || String(item.id)
          }
        }
      })
      .filter(Boolean)
  const mapApiEdges = (items: any[]) =>
    items
      .map((item) => {
        if (!item) return null
        const data = parseMaybeJson(item.dataJson) ?? {}
        return {
          id: item.edgeKey ?? String(item.id),
          source: item.sourceNodeKey ?? item.source ?? '',
          target: item.targetNodeKey ?? item.target ?? '',
          sourceHandle: item.sourceHandle ?? item.source_handle ?? null,
          targetHandle: item.targetHandle ?? item.target_handle ?? null,
          type: 'smooth',
          data
        }
      })
      .filter((edge) => edge?.source && edge?.target)
  if (Array.isArray(payload)) {
    const candidate = payload.find((item) => item?.nodes || item?.edges) ?? payload[0]
    if (candidate) return normalizeWorkflowGraph(candidate)
    return { nodes: [], edges: [] }
  }
  const data = payload.graph ?? payload.graphs ?? payload.data ?? payload
  const fromWorkflow = payload?.workflow ?? data?.workflow
  const rawNodes = parseMaybeJson(data?.nodes ?? fromWorkflow?.nodes)
  const rawEdges = parseMaybeJson(data?.edges ?? fromWorkflow?.edges)
  if (Array.isArray(data)) return normalizeWorkflowGraph(data)
  const nodes = Array.isArray(rawNodes)
    ? rawNodes.length > 0 && (rawNodes[0]?.nodeKey || rawNodes[0]?.payloadJson)
      ? mapApiNodes(rawNodes)
      : rawNodes
    : []
  const edges = Array.isArray(rawEdges)
    ? rawEdges.length > 0 && (rawEdges[0]?.edgeKey || rawEdges[0]?.sourceNodeKey)
      ? mapApiEdges(rawEdges)
      : rawEdges
    : []
  return { nodes, edges }
}

async function loadWorkflowGraph(workflowId: string | number, opts?: { notify?: boolean }) {
  const id = workflowId ?? ''
  if (id === '') return
  try {
    const res = await api.getWorkflowGraph(id)
    const graph = normalizeWorkflowGraph(res.data)
    setNodes(graph.nodes)
    setEdges(graph.edges)
    activeWorkflowGraphId.value = id
    selectedNodeId.value = null
    selectedEdgeId.value = null
    conditionDetailsOpenId.value = null
    syncNodeMeta()
    syncEdgesForStart()
    if (opts?.notify) {
      toast({
        title: 'Workflow carregado',
        description: `Workflow "${activeWorkflow.value?.name || ''}" foi carregado com sucesso.`
      })
    }
  } catch (e) {
    console.error('Erro ao carregar workflow/graphs', e)
    toast({
      title: 'Erro ao carregar workflow',
      description: formatApiError(e),
      variant: 'destructive'
    })
  }
}

const classesByCourse = computed(() => {
  const map: Record<number, any[]> = {}
  apiClasses.value.forEach((cls) => {
    // @ts-ignore
    const cId = cls.courseId
    if (cId) {
      if (!map[cId]) map[cId] = []
      map[cId].push(cls)
    }
  })
  return map
})

const courses = computed(() => {
  const q = query.value.trim().toLowerCase()
  return apiCourses.value.filter((c) => {
    const matchesQuery = !q || c.name.toLowerCase().includes(q)
    if (!matchesQuery) return false
    const totalApprentices = courseApprenticesTotal(c.id)
    if (courseApprenticeFilter.value === 'with') return totalApprentices > 0
    if (courseApprenticeFilter.value === 'without') return totalApprentices === 0
    return true
  })
})

function courseApprenticesTotal(courseId: number) {
  return (classesByCourse.value[courseId] || []).reduce((acc, curr) => acc + Number(curr?.stats?.total || 0), 0)
}

const filteredWorkflows = computed(() => {
  const q = workflowSearch.value.trim().toLowerCase()
  if (!q) return apiWorkflows.value
  return apiWorkflows.value.filter((wf) => {
    const name = String(wf?.name || '').toLowerCase()
    const desc = String(wf?.description || '').toLowerCase()
    const id = String(wf?.id || '').toLowerCase()
    return name.includes(q) || desc.includes(q) || id.includes(q)
  })
})

const showWorkflowTabs = computed(() => {
  return props.workflowId !== undefined && props.workflowId !== null && props.workflowId !== ''
})

const editorGridClass = computed(() => {
  if (leftPanelCollapsed.value && rightPanelCollapsed.value) return 'grid-cols-[56px_1fr_56px]'
  if (leftPanelCollapsed.value) return 'grid-cols-[56px_1fr_300px]'
  if (rightPanelCollapsed.value) return 'grid-cols-[320px_1fr_56px]'
  return 'grid-cols-[320px_1fr_300px]'
})

onMounted(async () => {
  try {
    const [cRes, clRes, wfRes, scheduleRes] = await Promise.all([
      api.getCourses(),
      api.getClasses(),
      api.getWorkflows(),
      api.getWorkflowSchedules()
    ])
    apiCourses.value = cRes.data
    apiClasses.value = clRes.data
    apiWorkflows.value = wfRes.data
    workflowSchedules.value = buildWorkflowScheduleIndex(scheduleRes.data)
    apiOnline.value = !cRes.isFallback && !clRes.isFallback && !wfRes.isFallback && !scheduleRes.isFallback
  } catch (e) {
    console.error('Falha ao carregar dados da API', e)
    apiOnline.value = false
  }
})

async function applyRouteSelection() {
  const routeId = props.workflowId
  if (routeId === undefined || routeId === null || routeId === '') {
    if (activeWorkflow.value) resetWorkflowState()
    return
  }
  const targetId = String(routeId)
  if (activeWorkflow.value && String(activeWorkflow.value.id) === targetId) {
    const tab = props.initialTab ?? 'workflow'
    mainTab.value = tab
    if (tab === 'workflow') workflowMode.value = 'editor'
    else workflowMode.value = 'list'
    if (activeWorkflowGraphId.value === null || String(activeWorkflowGraphId.value) !== targetId) {
      await loadWorkflowGraph(targetId)
    }
    return
  }
  const wf = apiWorkflows.value.find((item) => String(item.id) === targetId)
  if (!wf) return
  const tab = props.initialTab ?? 'workflow'
  const mode = tab === 'evolution' ? 'list' : 'editor'
  setActiveWorkflow(wf, { tab, mode })
  await loadWorkflowGraph(wf.id)
}

watch(
  () => [props.workflowId, props.initialTab, apiWorkflows.value.length],
  () => {
    void applyRouteSelection()
  },
  { immediate: true }
)

function goToWorkflowTab() {
  mainTab.value = 'workflow'
  if (activeWorkflow.value?.id !== undefined) {
    workflowMode.value = 'editor'
    router.push({ name: 'workflow', params: { id: activeWorkflow.value.id } })
    if (
      activeWorkflowGraphId.value === null ||
      String(activeWorkflowGraphId.value) !== String(activeWorkflow.value.id)
    ) {
      void loadWorkflowGraph(activeWorkflow.value.id)
    }
  } else {
    workflowMode.value = 'list'
    router.push({ name: 'home' })
  }
}

function goToEvolutionTab() {
  mainTab.value = 'evolution'
  if (activeWorkflow.value?.id !== undefined) {
    router.push({ name: 'workflow-apprentices', params: { id: activeWorkflow.value.id } })
  } else {
    router.push({ name: 'home' })
  }
}

async function loadWorkflow(wf: any) {
  setActiveWorkflow(wf, { mode: 'editor', tab: 'workflow' })
  router.push({ name: 'workflow', params: { id: wf.id } })
  await loadWorkflowGraph(wf.id, { notify: true })
}

async function openEvolutionWorkflow(wf: any) {
  setActiveWorkflow(wf, { mode: 'list', tab: 'evolution' })
  router.push({ name: 'workflow-apprentices', params: { id: wf.id } })
  await loadWorkflowGraph(wf.id)
}

function openEditWorkflow(wf: any) {
  if (!wf) return
  editWorkflow.value = {
    id: wf.id,
    name: wf.name || '',
    description: wf.description || '',
    status: wf.status || 'active'
  }
  editWorkflowOpen.value = true
}

const selectedNode = computed(() => nodes.value.find((n) => n.id === selectedNodeId.value) ?? null)
const selectedConditionRequiresContract = computed(() => {
  if (!selectedNode.value || selectedNode.value.type !== 'condition') return false
  return conditionRequiresContract(selectedNode.value.id)
})

function nodeTypeLabel(type?: string | null) {
  if (type === 'condition') return 'IF'
  if (type === 'start') return 'INICIO'
  if (type === 'comment') return 'COMENTÁRIO'
  if (type === 'course') return 'CURSO'
  return '-'
}

const flowWrapper = ref<HTMLDivElement | null>(null)

function getViewportCenterPosition(nodeSize: { width: number; height: number }) {
  const bounds = flowWrapper.value?.getBoundingClientRect()
  if (!bounds) return { x: 250, y: 150 }
  const center = project({
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2
  })
  return {
    x: center.x - nodeSize.width / 2,
    y: center.y - nodeSize.height / 2
  }
}

onNodesChange((_changes) => {
  // We can let Vue Flow handle the changes automatically since nodes is a ref from useVueFlow
})

onEdgesChange((_changes) => {})

watch(
  [
    () => nodes.value.filter((n) => n?.selected).map((n) => n.id),
    () => edges.value.filter((e) => e?.selected).map((e) => e.id)
  ],
  ([selNodes, selEdges]) => {
    selectedNodeId.value = selNodes[0] ?? null
    selectedEdgeId.value = selEdges[0] ?? null
  }
)

watch(
  () => edges.value,
  () => {
    enforceContractCheckForConditions()
  },
  { deep: true }
)

function toggleConditionDetails(nodeId: string) {
  const willOpen = conditionDetailsOpenId.value !== nodeId
  conditionDetailsOpenId.value = willOpen ? nodeId : null
  if (willOpen && rightPanelCollapsed.value) rightPanelCollapsed.value = false
}

function hydrateCourseClasses(courseId: number, classes: any[]) {
  const apiMap = new Map((classesByCourse.value[courseId] ?? []).map((cls) => [Number(cls.id), cls]))
  return (Array.isArray(classes) ? classes : [])
    .map((cls) => {
      const id = Number(cls?.id)
      if (!Number.isFinite(id)) return null
      const apiClass = apiMap.get(id)
      return {
        ...(apiClass || {}),
        ...(cls || {}),
        id,
        identifier: String(cls?.identifier ?? apiClass?.identifier ?? ''),
        name: String(cls?.name ?? apiClass?.name ?? '')
      }
    })
    .filter(Boolean)
}

function hydrateCoursePayload(payload?: Record<string, any> | null) {
  const courseId = Number(payload?.courseId)
  const fallbackName = apiCourses.value.find((course) => Number(course.id) === courseId)?.name ?? ''
  return {
    ...(payload || {}),
    courseId: Number.isFinite(courseId) ? courseId : 0,
    courseName: String(payload?.courseName ?? fallbackName ?? ''),
    classes: hydrateCourseClasses(courseId, payload?.classes || [])
  }
}

function syncNodeMeta() {
  setNodes(
    nodes.value.map((n) => {
      let payload = n.data?.payload
      if (n.type === 'course') {
        payload = hydrateCoursePayload(n.data?.payload)
      } else if (n.type === 'condition') {
        const evolutionMode =
          n.data?.payload?.evolutionMode ??
          (n.data?.payload?.useClassEndDate
            ? 'classEnd'
            : n.data?.payload?.evolveAt
              ? 'specific'
              : n.data?.payload?.startDate || n.data?.payload?.endDate
                ? 'range'
                : 'none')
        payload = {
          ...(n.data?.payload || {}),
          evolutionMode,
          evolveAt: n.data?.payload?.evolveAt ?? '',
          startDate: n.data?.payload?.startDate ?? '',
          endDate: n.data?.payload?.endDate ?? '',
          manualEvolution: n.data?.payload?.manualEvolution ?? false,
          useClassEndDate: evolutionMode === 'classEnd' ? true : false,
          classInsertStatus: n.data?.payload?.classInsertStatus ?? 'inProgress',
          classExitStatus: n.data?.payload?.classExitStatus ?? 'conclude',
          classCheckStatus: n.data?.payload?.classCheckStatus ?? 'inProgress',
          checkContractDuration: n.data?.payload?.checkContractDuration ?? n.data?.payload?.checkContractTime ?? false,
          contractDurationMonths:
            n.data?.payload?.contractDurationMonths ??
            (n.data?.payload?.contractTime ? Number(n.data?.payload?.contractTime) : undefined),
          keepSameDayOfWeek: n.data?.payload?.keepSameDayOfWeek ?? false
        }
      } else if (n.type === 'start') {
        payload = {
          ...(n.data?.payload || {}),
          executionMode: n.data?.payload?.executionMode ?? 'once',
          startDate: n.data?.payload?.startDate ?? '',
          endDate: n.data?.payload?.endDate ?? '',
          runDailyAt: n.data?.payload?.runDailyAt ?? '08:00',
          runIntervalMinutes: n.data?.payload?.runIntervalMinutes ?? null
        }
      } else if (n.type === 'comment') {
        payload = {
          ...(n.data?.payload || {}),
          text: String(n.data?.payload?.text ?? '')
        }
      }

      return {
        ...n,
        data: {
          ...n.data,
          connectMode: connectMode.value,
          payload,
          onRemove: removeNode,
          nodeId: n.id,
          ...(n.type === 'course'
            ? {
                onCreateConditionForClass: createConditionFromClass,
                onEnableConnectMode: () => {
                  connectMode.value = true
                  toast({
                    title: 'Modo conectar ativado',
                    description: 'Arraste a saida da turma para uma condicao existente.'
                  })
                }
              }
            : {}),
          ...(n.type === 'condition'
            ? {
                showDetails: conditionDetailsOpenId.value === n.id,
                onToggleDetails: toggleConditionDetails
              }
            : {})
        }
      }
    })
  )
}

watch(connectMode, syncNodeMeta)
watch(conditionDetailsOpenId, syncNodeMeta)
watch(() => [apiClasses.value.length, apiCourses.value.length], syncNodeMeta)

function toggleExpanded(courseId: number) {
  const next = new Set(expandedCourses.value)
  if (next.has(courseId)) next.delete(courseId)
  else next.add(courseId)
  expandedCourses.value = next
}

function setPreselectForCourse(courseId: number, next: Set<number>) {
  preselect.value = { ...preselect.value, [courseId]: next }

  const id = courseNodeId(courseId)
  const classes = (classesByCourse.value[courseId] ?? []).filter((c) => next.has(c.id))
  if (!nodes.value.some((n) => n.id === id)) return

  setNodes(
    nodes.value.map((n) =>
      n.id !== id
        ? n
        : {
            ...n,
            data: {
              ...n.data,
              payload: {
                ...n.data?.payload,
                classes
              }
            }
          }
    )
  )
}

function togglePreselect(courseId: number, classId: number, checked: boolean) {
  const current = new Set(preselect.value[courseId] ?? [])
  if (checked) current.add(classId)
  else current.delete(classId)
  setPreselectForCourse(courseId, current)
}

function selectAllCourseClasses(courseId: number) {
  const allClasses = classesByCourse.value[courseId] ?? []
  if (allClasses.length === 0) return
  const next = new Set(allClasses.map((cls) => cls.id))
  setPreselectForCourse(courseId, next)
}

function addStartNode(position?: { x: number; y: number }) {
  const existing = nodes.value.find((n) => n.type === 'start')
  if (existing) {
    selectedNodeId.value = existing.id
    selectedEdgeId.value = null
    toast({
      title: 'Inicio ja definido',
      description: 'Ja existe um no de inicio no workflow.'
    })
    return
  }

  const id = START_NODE_ID
  const newNode = {
    id,
    type: 'start',
    position: position ?? { x: 40, y: 40 },
    data: {
      payload: {
        executionMode: 'once',
        startDate: '',
        endDate: '',
        runDailyAt: '08:00',
        runIntervalMinutes: null
      },
      connectMode: connectMode.value,
      onRemove: removeNode,
      nodeId: id
    }
  }

  addNodes([newNode])
  selectedNodeId.value = id
  selectedEdgeId.value = null
}

function addCourseNode(courseId: number, position?: { x: number; y: number }) {
  const id = courseNodeId(courseId)
  const payload = buildCoursePayload(courseId, preselect.value, apiCourses.value, classesByCourse.value)

  const existing = nodes.value.find((n) => n.id === id)
  if (existing) {
    const current = existing.data?.payload?.classes ?? []
    const seen = new Set(current.map((c: { id: number }) => c.id))
    const merged = [...current]
    for (const cls of payload.classes) {
      if (!seen.has(cls.id)) {
        seen.add(cls.id)
        merged.push(cls)
      }
    }

    setNodes(
      nodes.value.map((n) =>
        n.id !== id
          ? n
          : {
              ...n,
              data: {
                ...n.data,
                payload: { ...n.data?.payload, ...payload, classes: merged },
                connectMode: connectMode.value,
                onRemove: removeNode,
                onCreateConditionForClass: createConditionFromClass,
                onEnableConnectMode: () => {
                  connectMode.value = true
                  toast({
                    title: 'Modo conectar ativado',
                    description: 'Arraste a saida da turma para uma condicao existente.'
                  })
                },
                nodeId: id
              }
            }
      )
    )
  } else {
    const newNode = {
      id,
      type: 'course',
      position: position ?? { x: 80, y: 80 },
      data: {
        payload,
        connectMode: connectMode.value,
        onRemove: removeNode,
        onCreateConditionForClass: createConditionFromClass,
        onEnableConnectMode: () => {
          connectMode.value = true
          toast({
            title: 'Modo conectar ativado',
            description: 'Arraste a saida da turma para uma condicao existente.'
          })
        },
        nodeId: id
      }
    }
    addNodes([newNode])
  }

  selectedNodeId.value = id
  selectedEdgeId.value = null
}

function addConditionNode(position?: { x: number; y: number }) {
  const id = conditionNodeId(uid())
  const payload: ConditionPayload = {
    startDate: '',
    endDate: '',
    evolveAt: '',
    evolutionMode: 'none',
    manualEvolution: false,
    minAttendance: 100,
    minExamGrade: 0,
    mustCompleteLessons: false,
    countJustifiedAbsences: false,
    checkContract: false,
    checkContractDuration: false,
    contractDurationMonths: undefined,
    contractStatus: [],
    classInsertStatus: 'inProgress',
    classExitStatus: 'conclude',
    classCheckStatus: 'inProgress',
    hasMinGrade: false,
    hasAttendance: false,
    useClassEndDate: false,
    keepSameDayOfWeek: false,
    isBalanced: false,
    balanceStrategy: ['occupancy']
  }

  const nodePosition = position ?? getViewportCenterPosition({ width: 280, height: 120 })
  const newNode = {
    id,
    type: 'condition',
    position: nodePosition,
    data: {
      payload,
      connectMode: connectMode.value,
      onRemove: removeNode,
      nodeId: id,
      showDetails: conditionDetailsOpenId.value === id,
      onToggleDetails: toggleConditionDetails
    }
  }

  addNodes([newNode])

  selectedNodeId.value = id
  selectedEdgeId.value = null
  return id
}

function addCommentNode(position?: { x: number; y: number }) {
  const id = commentNodeId(uid())
  const payload: CommentPayload = {
    text: ''
  }

  const nodePosition = position ?? getViewportCenterPosition({ width: 280, height: 170 })
  const newNode = {
    id,
    type: 'comment',
    position: nodePosition,
    data: {
      payload,
      connectMode: connectMode.value,
      onRemove: removeNode,
      nodeId: id
    }
  }

  addNodes([newNode])

  selectedNodeId.value = id
  selectedEdgeId.value = null
  return id
}

function createConditionFromClass(courseNodeId: string, classId: number) {
  const courseNode = nodes.value.find((n) => n.id === courseNodeId && n.type === 'course')
  if (!courseNode) return
  const classes = (courseNode.data?.payload?.classes || []) as Array<{ id: number }>
  const classIndex = classes.findIndex((cls) => Number(cls.id) === Number(classId))
  if (classIndex < 0) return

  const ROW_H = 72
  const ROW_GAP = 9
  const START_Y = 80 + 56 + 40 + 12 + 15
  const anchorY = courseNode.position.y + START_Y + classIndex * (ROW_H + ROW_GAP) + ROW_H / 2
  const conditionPos = {
    x: courseNode.position.x + 470,
    y: anchorY - 60
  }

  const nextConnection: Connection = {
    source: courseNodeId,
    sourceHandle: `class-out:${classId}`,
    target: '',
    targetHandle: 'if-in'
  }
  const validation = validateConditionConnectionLimits({
    ...nextConnection,
    target: 'new-condition'
  })
  if (!validation.ok) {
    toast({
      title: 'Conexao nao permitida',
      description: validation.reason,
      variant: 'destructive'
    })
    return
  }

  const conditionId = addConditionNode(conditionPos)
  if (!conditionId) return
  const kind = edgeKindFromHandles(String(nextConnection.sourceHandle), String(nextConnection.targetHandle))
  const executionMode = getStartExecutionMode()
  const style = edgeStyle(kind, executionMode)
  const edgeId = uid()
  setEdges([
    ...edges.value,
    {
      id: edgeId,
      source: courseNodeId,
      sourceHandle: `class-out:${classId}`,
      target: conditionId,
      targetHandle: 'if-in',
      type: 'smooth',
      style,
      data: {
        ...buildEdgeDataFromConnection(
          {
            sourceHandle: `class-out:${classId}`,
            targetHandle: 'if-in'
          },
          executionMode
        ),
        auto: true,
        animateIn: true
      }
    }
  ])
  connectMode.value = true
  toast({
    title: 'Condicao criada',
    description: 'Nova condicao criada e conectada. Agora voce pode ligar para turmas de destino.'
  })
}

function removeNode(nodeId: string) {
  setEdges(edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId))
  setNodes(nodes.value.filter((n) => n.id !== nodeId))
  if (selectedNodeId.value === nodeId) selectedNodeId.value = null
  if (conditionDetailsOpenId.value === nodeId) conditionDetailsOpenId.value = null
  selectedEdgeId.value = null
}

function clearConnections() {
  setEdges([])
  selectedEdgeId.value = null
}

function parseHandleClassId(handle?: string | null) {
  if (!handle) return null
  const parts = handle.split(':')
  if (parts.length < 2) return null
  const id = Number(parts[1])
  return Number.isFinite(id) ? id : null
}

function resolveClassById(classId: number) {
  for (const node of nodes.value) {
    if (node.type !== 'course') continue
    const classes = node.data?.payload?.classes || []
    const match = classes.find((cls: any) => Number(cls.id) === classId)
    if (match) return match
  }
  return apiClasses.value.find((cls) => Number(cls.id) === classId)
}

function conditionRequiresContract(conditionId: string) {
  const classIds = new Set<number>()
  edges.value.forEach((edge) => {
    if (edge.target === conditionId && edge.targetHandle === 'if-in') {
      const id = parseHandleClassId(edge.sourceHandle)
      if (id !== null) classIds.add(id)
    }
    if (edge.source === conditionId && (edge.sourceHandle === 'if-ok' || edge.sourceHandle === 'if-nok')) {
      const id = parseHandleClassId(edge.targetHandle)
      if (id !== null) classIds.add(id)
    }
  })
  for (const id of classIds) {
    const cls = resolveClassById(id)
    if (onlyWithContractFlag(cls)) return true
  }
  return false
}

function enforceContractCheckForConditions() {
  const required = new Set(
    nodes.value
      .filter((n) => n.type === 'condition')
      .filter((n) => conditionRequiresContract(n.id))
      .map((n) => n.id)
  )
  if (required.size === 0) return
  let changed = false
  const nextNodes = nodes.value.map((n) => {
    if (n.type !== 'condition' || !required.has(n.id)) return n
    if (n.data?.payload?.checkContract) return n
    changed = true
    return {
      ...n,
      data: {
        ...n.data,
        payload: {
          ...n.data?.payload,
          checkContract: true
        }
      }
    }
  })
  if (changed) setNodes(nextNodes)
}

function exportJson() {
  try {
    const canonicalGraph = buildWorkflowPayload({ nodes: nodes.value, edges: edges.value })
    const issues = validateWorkflowPayload(canonicalGraph)
    if (issues.length > 0) throw new WorkflowPayloadError(issues)
    const data = {
      name: activeWorkflow.value?.name || '',
      description: activeWorkflow.value?.description || '',
      status: activeWorkflow.value?.status || 'draft',
      nodes: canonicalGraph.nodes,
      edges: canonicalGraph.edges
    }
    alert('Export gerado. Veja o console.')
    console.log('WORKFLOW_JSON', data)
  } catch (e) {
    const description =
      e instanceof WorkflowPayloadError ? formatWorkflowPayloadIssues(e) : formatApiError(e)
    toast({
      title: 'Nao foi possivel exportar',
      description,
      variant: 'destructive'
    })
  }
}

function onDragStartCourse(event: DragEvent, courseId: number) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/vueflow', JSON.stringify({ type: 'course', courseId: Number(courseId) }))
  event.dataTransfer.effectAllowed = 'move'
}

function onDragStartPaletteNode(event: DragEvent, type: PaletteNodeType) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/vueflow', JSON.stringify({ type }))
  event.dataTransfer.effectAllowed = 'move'
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('application/vueflow')
  if (!raw) return

  let payload: { type: string; courseId?: number }
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const bounds = flowWrapper.value?.getBoundingClientRect()
  if (!bounds) return

  const position = project({
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  })

  if (payload.type === 'course') {
    const courseId = typeof payload.courseId === 'number' ? payload.courseId : Number(payload.courseId)
    if (!Number.isFinite(courseId)) return
    const x = Math.max(0, position.x - 160)
    const y = Math.max(0, position.y - 40)
    addCourseNode(courseId, { x, y })
    return
  }

  if (payload.type === 'start') {
    const x = Math.max(0, position.x - 110)
    const y = Math.max(0, position.y - 40)
    addStartNode({ x, y })
    return
  }

  if (payload.type === 'condition') {
    const x = Math.max(0, position.x - 140)
    const y = Math.max(0, position.y - 60)
    addConditionNode({ x, y })
    return
  }

  if (payload.type === 'comment') {
    const x = Math.max(0, position.x - 140)
    const y = Math.max(0, position.y - 85)
    addCommentNode({ x, y })
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function createWorkflow() {
  const name = newWorkflow.value.name.trim()
  if (!name) {
    toast({
      title: 'Informe um nome',
      description: 'O nome do workflow e obrigatorio para criar.',
      variant: 'destructive'
    })
    return
  }

  activeWorkflow.value = {
    name,
    description: newWorkflow.value.description.trim(),
    status: newWorkflow.value.status || 'active'
  }
  setNodes([])
  setEdges([])
  selectedNodeId.value = null
  selectedEdgeId.value = null
  conditionDetailsOpenId.value = null
  workflowMode.value = 'editor'
  mainTab.value = 'workflow'
  newWorkflow.value = { name: '', description: '', status: 'active' }
  createWorkflowOpen.value = false
}

function backToList() {
  workflowMode.value = 'list'
  router.push({ name: 'home' })
}

async function deleteWorkflow(wf: any) {
  if (!wf) return
  const name = wf?.name ? `"${wf.name}"` : 'este workflow'
  const ok = window.confirm(`Excluir ${name}? Essa acao nao pode ser desfeita.`)
  if (!ok) return
  try {
    const res = await api.deleteWorkflow(String(wf.id))
    apiWorkflows.value = apiWorkflows.value.filter((w) => String(w.id) !== String(wf.id))
    if (activeWorkflow.value && String(activeWorkflow.value.id) === String(wf.id)) {
      activeWorkflow.value = null
      activeWorkflowGraphId.value = null
      setNodes([])
      setEdges([])
      selectedNodeId.value = null
      selectedEdgeId.value = null
      conditionDetailsOpenId.value = null
      workflowMode.value = 'list'
      router.push({ name: 'home' })
    }
    toast({
      title: res?.isFallback ? 'Workflow removido (simulado)' : 'Workflow removido',
      description: res?.isFallback
        ? 'A API esta offline. A remocao foi aplicada apenas localmente.'
        : 'Workflow removido com sucesso.'
    })
  } catch (e) {
    console.error('Erro ao remover workflow', e)
    toast({
      title: 'Erro ao remover',
      description: formatApiError(e),
      variant: 'destructive'
    })
  }
}

function workflowStatusMeta(status?: string) {
  const value = String(status || '').toLowerCase()
  if (value === 'active') {
    return { label: 'Ativo', class: 'bg-emerald-50 border-emerald-200 text-emerald-700' }
  }
  if (value === 'inactive') {
    return { label: 'Inativo', class: 'bg-slate-100 border-slate-200 text-slate-600' }
  }
  return { label: 'Rascunho', class: 'bg-amber-50 border-amber-200 text-amber-700' }
}

async function saveEditWorkflow() {
  if (!editWorkflow.value) return
  const current = apiWorkflows.value.find((wf) => String(wf.id) === String(editWorkflow.value?.id))
  if (!current) return
  try {
    const payload = {
      ...current,
      name: editWorkflow.value.name.trim(),
      description: editWorkflow.value.description.trim(),
      status: editWorkflow.value.status || 'active'
    }
    const res = await api.updateWorkflow(String(current.id), payload)
    const [wfRes, scheduleRes] = await Promise.all([api.getWorkflows(), api.getWorkflowSchedules()])
    apiWorkflows.value = wfRes.data
    workflowSchedules.value = buildWorkflowScheduleIndex(scheduleRes.data)
    if (activeWorkflow.value && String(activeWorkflow.value.id) === String(current.id)) {
      activeWorkflow.value = {
        ...activeWorkflow.value,
        name: payload.name,
        description: payload.description,
        status: payload.status
      }
    }
    editWorkflowOpen.value = false
    toast({
      title: res?.isFallback ? 'Workflow Simulado' : 'Workflow Atualizado',
      description: res?.isFallback
        ? 'A API esta offline. As alteracoes foram aplicadas localmente para demonstracao.'
        : 'Workflow atualizado com sucesso.'
    })
  } catch (e) {
    console.error('Erro ao atualizar workflow', e)
    toast({
      title: 'Erro ao atualizar',
      description: formatApiError(e),
      variant: 'destructive'
    })
  }
}

async function persistWorkflow(status: 'active' | 'draft') {
  if (!activeWorkflow.value) return
  try {
    const canonicalGraph = buildWorkflowPayload({ nodes: nodes.value, edges: edges.value })
    const issues = validateWorkflowPayload(canonicalGraph)
    if (issues.length > 0) throw new WorkflowPayloadError(issues)
    const payload = {
      name: activeWorkflow.value.name,
      description: activeWorkflow.value.description,
      status,
      nodes: canonicalGraph.nodes,
      edges: canonicalGraph.edges
    }

    let res: any
    if (activeWorkflow.value.id) {
      res = await api.updateWorkflow(String(activeWorkflow.value.id), payload)
    } else {
      res = await api.saveWorkflow({
        id: `workflow-${Date.now()}`,
        ...payload
      })
    }

    if (!activeWorkflow.value.id && res?.data?.id) {
      activeWorkflow.value.id = res.data.id
    }
    activeWorkflow.value.status = status

    const [wfRes, scheduleRes] = await Promise.all([api.getWorkflows(), api.getWorkflowSchedules()])
    apiWorkflows.value = wfRes.data
    workflowSchedules.value = buildWorkflowScheduleIndex(scheduleRes.data)

    toast({
      title: res?.isFallback ? 'Workflow Simulado' : status === 'draft' ? 'Rascunho salvo' : 'Workflow Publicado',
      description: res?.isFallback
        ? 'A API esta offline. O workflow foi processado localmente para demonstracao.'
        : status === 'draft'
          ? 'Workflow salvo como rascunho. Ele nao sera executado.'
          : 'Workflow publicado com sucesso.'
    })
  } catch (e) {
    console.error('Erro ao salvar workflow', e)
    const description = e instanceof WorkflowPayloadError ? formatWorkflowPayloadIssues(e) : formatApiError(e)
    toast({
      title: 'Erro ao salvar',
      description,
      variant: 'destructive'
    })
  }
}

async function publishWorkflow() {
  await persistWorkflow('active')
}

async function saveWorkflowDraft() {
  await persistWorkflow('draft')
}

function isValidConnection(connection: Connection) {
  const { target, sourceHandle, targetHandle } = connection
  if (!sourceHandle || !targetHandle) return false

  if (sourceHandle === 'start-out') {
    const existing = edges.value.find((e) => e.sourceHandle === 'start-out')
    if (existing && target && existing.target !== target) return false
    return targetHandle.startsWith('class-in')
  }

  // Se a saída for uma turma
  if (sourceHandle.startsWith('class-out')) {
    // Só pode conectar em uma condição (if-in)
    return targetHandle === 'if-in'
  }

  // Se a saída for uma condição (OK ou NOK)
  if (sourceHandle === 'if-ok' || sourceHandle === 'if-nok') {
    // Só pode conectar em uma turma (class-in)
    if (!targetHandle.startsWith('class-in')) return false

    // Se for 'if-ok', permite múltiplas conexões para balanceamento
    if (sourceHandle === 'if-ok') {
      return true
    }

    // Para 'if-nok', geralmente apenas uma saída, mas vamos manter a lógica de não duplicar arestas idênticas
    // O Vue Flow já evita arestas idênticas por padrão se não configurado o contrário
    return true
  }

  return false
}

function validateConditionConnectionLimits(params: Connection) {
  const { source, target, sourceHandle, targetHandle } = params
  if (!source || !target || !sourceHandle || !targetHandle) {
    return { ok: false, reason: 'Conexao invalida.' }
  }

  if (sourceHandle.startsWith('class-out') && targetHandle === 'if-in') {
    const alreadyLinkedToCondition = edges.value.some(
      (e) => e.source === source && e.sourceHandle === sourceHandle && e.targetHandle === 'if-in' && e.target !== target
    )
    if (alreadyLinkedToCondition) {
      return {
        ok: false,
        reason: 'Esta turma ja possui condicao de saida. Permitido apenas 1 vinculo de saida para condicao.'
      }
    }
  }

  if ((sourceHandle === 'if-ok' || sourceHandle === 'if-nok') && targetHandle.startsWith('class-in')) {
    const oppositeHandle = sourceHandle === 'if-ok' ? 'if-nok' : 'if-ok'
    const hasOppositeToSameClass = edges.value.some(
      (e) =>
        e.source === source &&
        e.sourceHandle === oppositeHandle &&
        e.target === target &&
        e.targetHandle === targetHandle
    )
    if (hasOppositeToSameClass) {
      return {
        ok: false,
        reason: 'Nao e permitido ligar OK e NOK na mesma turma de destino.'
      }
    }
  }

  return { ok: true as const }
}

function edgeStyle(kind: string, executionMode?: string) {
  const base = {
    stroke: edgeStroke(kind),
    strokeWidth: 3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    opacity: 0.92
  }
  if (executionMode === 'recurring') {
    return { ...base, strokeDasharray: '6 6', strokeDashoffset: '0' }
  }
  return base
}

function getStartExecutionMode() {
  const startNode = nodes.value.find((n) => n.type === 'start')
  const mode = startNode?.data?.payload?.executionMode
  return mode === 'recurring' ? 'recurring' : 'once'
}

function syncEdgesForStart() {
  const mode = getStartExecutionMode()
  setEdges(
    edges.value.map((e) => {
      const kind = e.data?.kind || edgeKindFromHandles(e.sourceHandle || '', e.targetHandle || '')
      return {
        ...e,
        data: { ...e.data, ...buildEdgeDataFromConnection(e, mode) },
        style: edgeStyle(kind, mode)
      }
    })
  )
  enforceContractCheckForConditions()
}

function handleConnect(params: Connection) {
  if (!connectMode.value) return

  const { source, target, sourceHandle, targetHandle } = params
  if (!source || !target || !sourceHandle || !targetHandle) {
    toast({
      title: 'Conexao invalida',
      description: 'Nao foi possivel identificar origem e destino da conexao.',
      variant: 'destructive'
    })
    return
  }

  if (sourceHandle.startsWith('class-in') || sourceHandle === 'if-in') {
    toast({
      title: 'Conexao nao permitida',
      description: 'Conexao deve iniciar por uma saida do no.',
      variant: 'destructive'
    })
    return
  }
  if (targetHandle.startsWith('class-out') || targetHandle === 'if-ok' || targetHandle === 'if-nok') {
    toast({
      title: 'Conexao nao permitida',
      description: 'Conexao deve terminar em uma entrada do no.',
      variant: 'destructive'
    })
    return
  }
  if (!isValidConnection(params)) {
    toast({
      title: 'Conexao nao permitida',
      description: 'Este tipo de ligacao nao e permitido no workflow.',
      variant: 'destructive'
    })
    return
  }
  const validated = validateConditionConnectionLimits(params)
  if (!validated.ok) {
    toast({
      title: 'Conexao nao permitida',
      description: validated.reason,
      variant: 'destructive'
    })
    return
  }

  const kind = edgeKindFromHandles(sourceHandle, targetHandle)
  const id = uid()
  const executionMode = getStartExecutionMode()
  const style = edgeStyle(kind, executionMode)

  const nextEdges = [
    ...edges.value,
    {
      ...params,
      id,
      type: 'smooth',
      style,
      data: {
        ...buildEdgeDataFromConnection(params, executionMode),
        auto: false,
        animateIn: true
      }
    }
  ]

  setEdges(nextEdges)
  selectedEdgeId.value = null
}

function updateSelectedCondition(patch: Partial<ConditionPayload>) {
  if (!selectedNode.value || selectedNode.value.type !== 'condition') return
  if (patch.evolutionMode) {
    const mode = patch.evolutionMode
    if (mode === 'none') {
      patch = { ...patch, evolveAt: '', startDate: '', endDate: '', useClassEndDate: false }
    } else if (mode === 'specific') {
      patch = {
        ...patch,
        useClassEndDate: false,
        startDate: '',
        endDate: '',
        evolveAt: patch.evolveAt ?? selectedNode.value.data?.payload?.evolveAt ?? ''
      }
    } else if (mode === 'range') {
      patch = {
        ...patch,
        useClassEndDate: false,
        evolveAt: '',
        startDate: patch.startDate ?? selectedNode.value.data?.payload?.startDate ?? '',
        endDate: patch.endDate ?? selectedNode.value.data?.payload?.endDate ?? ''
      }
    } else if (mode === 'classEnd') {
      patch = { ...patch, useClassEndDate: true, evolveAt: '', startDate: '', endDate: '' }
    }
  }
  setNodes(
    nodes.value.map((n) =>
      n.id !== selectedNode.value?.id
        ? n
        : {
            ...n,
            data: {
              ...n.data,
              payload: { ...n.data?.payload, ...patch }
            }
          }
    )
  )
}

function updateSelectedComment(patch: Partial<CommentPayload>) {
  if (!selectedNode.value || selectedNode.value.type !== 'comment') return
  setNodes(
    nodes.value.map((n) =>
      n.id !== selectedNode.value?.id
        ? n
        : {
            ...n,
            data: {
              ...n.data,
              payload: {
                ...n.data?.payload,
                ...patch,
                text: String(patch.text ?? n.data?.payload?.text ?? '')
              }
            }
          }
    )
  )
}

function updateSelectedStart(patch: Partial<StartPayload>) {
  if (!selectedNode.value || selectedNode.value.type !== 'start') return
  setNodes(
    nodes.value.map((n) =>
      n.id !== selectedNode.value?.id
        ? n
        : {
            ...n,
            data: {
              ...n.data,
              payload: { ...n.data?.payload, ...patch }
            }
          }
    )
  )
  if (patch.executionMode) {
    syncEdgesForStart()
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b bg-white px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <div v-if="showWorkflowTabs" class="flex items-center gap-2">
          <Button size="sm" :variant="mainTab === 'workflow' ? 'secondary' : 'ghost'" @click="goToWorkflowTab">
            Workflow
          </Button>
          <Button size="sm" :variant="mainTab === 'evolution' ? 'secondary' : 'ghost'" @click="goToEvolutionTab">
            Evolucao dos Jovens
          </Button>
        </div>
        <div v-else class="text-sm font-semibold text-slate-900">Workflows</div>
        <div class="flex items-center gap-2">
          <div
            v-if="mainTab === 'workflow' && workflowMode === 'editor' && activeWorkflow"
            class="text-xs text-slate-500"
          >
            {{ activeWorkflow.name }}
          </div>
          <div v-if="mainTab === 'workflow' && workflowMode === 'editor'" class="flex items-center gap-2">
            <Button size="sm" variant="outline" @click="backToList">Voltar</Button>
            <Button size="sm" variant="secondary" class="gap-1.5" @click="saveWorkflowDraft">
              <Save class="h-4 w-4" />
              Salvar rascunho
            </Button>
            <Button size="sm" class="bg-blue-600 hover:bg-blue-700" @click="publishWorkflow">Publicar</Button>
          </div>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="mainTab === 'evolution'" class="relative h-full w-full">
        <WorkflowGridPreview
          v-if="activeWorkflow && nodes.length > 0"
          :nodes="nodes"
          :edges="edges"
          :workflow-id="activeWorkflow.id ?? ''"
        />
        <div v-else class="flex h-full items-center justify-center text-sm text-slate-500">
          Selecione um workflow para ver a evolucao dos jovens.
        </div>
      </div>

      <div v-else class="h-full min-h-0">
        <div v-if="workflowMode === 'list'" class="h-full overflow-auto">
          <div class="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 p-6">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold text-slate-900">Workflows</div>
                <div class="text-xs text-muted-foreground">Selecione um workflow existente ou crie um novo</div>
              </div>
              <Dialog v-model:open="createWorkflowOpen">
                <DialogTrigger as-child>
                  <Button size="sm" class="bg-blue-600 hover:bg-blue-700">Criar Workflow</Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Novo Workflow</DialogTitle>
                    <DialogDescription>Informe os dados basicos para criar um workflow.</DialogDescription>
                  </DialogHeader>
                  <div class="grid gap-3 py-2">
                    <div class="grid gap-1">
                      <Label class="text-xs">Nome</Label>
                      <Input v-model="newWorkflow.name" placeholder="Nome do workflow" class="h-9" />
                    </div>
                    <div class="grid gap-1">
                      <Label class="text-xs">Descricao</Label>
                      <Textarea
                        v-model="newWorkflow.description"
                        class="min-h-[90px]"
                        placeholder="Descreva o objetivo do workflow"
                      />
                    </div>
                    <div class="grid gap-1">
                      <Label class="text-xs">Status</Label>
                      <select
                        v-model="newWorkflow.status"
                        class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                      >
                        <option v-for="opt in workflowStatusOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button size="sm" variant="outline" @click="createWorkflowOpen = false">Cancelar</Button>
                    <Button size="sm" class="bg-blue-600 hover:bg-blue-700" @click="createWorkflow"
                      >Criar Workflow
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div class="rounded-2xl border bg-white p-5 shadow-sm">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="text-sm font-semibold text-slate-900">Lista de Workflows</div>
                <Input v-model="workflowSearch" placeholder="Buscar workflow..." class="h-8 w-full max-w-[260px]" />
              </div>
              <div v-if="apiWorkflows.length === 0" class="rounded-xl border border-dashed bg-slate-50 p-6 text-center">
                <div class="mb-1 text-sm font-semibold text-slate-600">Nenhum workflow</div>
                <div class="text-xs text-muted-foreground">Crie um workflow para comecar</div>
              </div>
              <div
                v-else-if="filteredWorkflows.length === 0"
                class="rounded-xl border border-dashed bg-slate-50 p-6 text-center"
              >
                <div class="mb-1 text-sm font-semibold text-slate-600">Sem resultados</div>
                <div class="text-xs text-muted-foreground">Ajuste a busca para encontrar workflows</div>
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="wf in filteredWorkflows"
                  :key="wf.id"
                  class="group flex items-center justify-between rounded-xl border bg-white p-3 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 cursor-pointer flex-col justify-center self-stretch text-left"
                    @click="loadWorkflow(wf)"
                  >
                    <div class="mb-0.5 truncate text-sm font-bold text-slate-900">{{ wf.name }}</div>
                    <div class="line-clamp-2 text-[10px] text-muted-foreground">
                      {{ wf.description || 'Sem descricao' }}
                    </div>
                    <div class="mt-1 grid gap-0.5 text-[10px] text-slate-600">
                      <div class="flex items-center gap-1">
                        <span class="font-semibold">Modo:</span>
                        <span>{{ scheduleExecutionModeLabel(workflowScheduleOf(wf)) }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="font-semibold">Proxima:</span>
                        <span>{{ scheduleNextExecutionLabel(workflowScheduleOf(wf)) }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="font-semibold">Frequencia:</span>
                        <span>{{ scheduleFrequencyLabel(workflowScheduleOf(wf)) }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>ID: {{ wf.id }}</span>
                      <span>-</span>
                      <span>{{ wf.nodes?.length || 0 }} nos</span>
                    </div>
                  </button>
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                      :class="workflowStatusMeta(wf.status).class"
                    >
                      {{ workflowStatusMeta(wf.status).label }}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="h-8 w-8 text-blue-600 hover:text-blue-700"
                      title="Ver evolucao dos jovens"
                      @pointerdown.stop
                      @click.stop="openEvolutionWorkflow(wf)"
                    >
                      <Users class="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="h-8 w-8"
                      title="Editar workflow"
                      @pointerdown.stop
                      @click.stop="openEditWorkflow(wf)"
                    >
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="h-8 w-8 text-rose-600 hover:text-rose-700"
                      title="Excluir workflow"
                      @pointerdown.stop
                      @click.stop="deleteWorkflow(wf)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Dialog v-model:open="editWorkflowOpen">
              <DialogContent class="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Editar Workflow</DialogTitle>
                  <DialogDescription>Atualize o nome, descricao e status do workflow.</DialogDescription>
                </DialogHeader>
                <div v-if="editWorkflow" class="grid gap-3 py-2">
                  <div class="grid gap-1">
                    <Label class="text-xs">Nome</Label>
                    <Input v-model="editWorkflow.name" placeholder="Nome do workflow" class="h-9" />
                  </div>
                  <div class="grid gap-1">
                    <Label class="text-xs">Descricao</Label>
                    <Textarea
                      v-model="editWorkflow.description"
                      class="min-h-[90px]"
                      placeholder="Descreva o objetivo do workflow"
                    />
                  </div>
                  <div class="grid gap-1">
                    <Label class="text-xs">Status</Label>
                    <select
                      v-model="editWorkflow.status"
                      class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option v-for="opt in workflowStatusOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button size="sm" variant="outline" @click="editWorkflowOpen = false">Cancelar</Button>
                  <Button size="sm" class="bg-blue-600 hover:bg-blue-700" @click="saveEditWorkflow">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div v-else class="grid h-full min-h-0 gap-0 overflow-hidden rounded-2xl border" :class="editorGridClass">
          <div class="h-full min-h-0 overflow-hidden border-r bg-muted/30">
            <template v-if="!leftPanelCollapsed">
              <ScrollArea class="h-full w-full">
                <div class="p-4">
                  <div class="mb-3 flex items-center justify-between">
                    <div class="text-sm font-semibold">Cursos</div>
                    <div class="flex items-center gap-2">
                      <div
                        class="h-2 w-2 rounded-full"
                        :class="apiOnline ? 'bg-emerald-500' : 'bg-orange-500'"
                        :title="apiOnline ? 'API Online' : 'API Offline (Demo Mode)'"
                      ></div>
                      <span
                        class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        vueflow
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="h-7 w-7"
                        title="Recolher painel de cursos"
                        @click="leftPanelCollapsed = true"
                      >
                        <ChevronRight class="h-4 w-4 rotate-180" />
                      </Button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <Input v-model="query" placeholder="Buscar..." />
                    <select
                      v-model="courseApprenticeFilter"
                      class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option value="all">Todos os cursos</option>
                      <option value="with">Com aprendizes</option>
                      <option value="without">Sem aprendizes</option>
                    </select>
                    <div class="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        class="cursor-grab active:cursor-grabbing"
                        title="Inicio (clique ou arraste)"
                        draggable="true"
                        @click="addStartNode"
                        @dragstart="(event: DragEvent) => onDragStartPaletteNode(event, 'start')"
                      >
                        <Play class="mr-2 h-4 w-4" />
                        Inicio
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        class="cursor-grab active:cursor-grabbing"
                        title="Condicao (clique ou arraste)"
                        draggable="true"
                        @click="addConditionNode"
                        @dragstart="(event: DragEvent) => onDragStartPaletteNode(event, 'condition')"
                      >
                        <Plus class="mr-2 h-4 w-4" />
                        Condicao
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        class="cursor-grab active:cursor-grabbing"
                        title="Comentário (clique ou arraste)"
                        draggable="true"
                        @click="addCommentNode"
                        @dragstart="(event: DragEvent) => onDragStartPaletteNode(event, 'comment')"
                      >
                        <FileText class="mr-2 h-4 w-4" />
                        Comentário
                      </Button>
                      <Button size="sm" variant="secondary" title="Export JSON" @click="exportJson">
                        <Save class="mr-2 h-4 w-4" />
                        Exportar
                      </Button>
                    </div>
                  </div>

                  <div class="my-4 h-px w-full bg-border" />

                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Switch
                        :checked="connectMode"
                        @update:checked="
                          (value) => {
                            connectMode = value
                            selectedEdgeId = null
                          }
                        "
                      />
                      <Label class="text-xs">Modo conectar</Label>
                    </div>
                    <Button size="sm" variant="ghost" title="Limpar conexoes" @click="clearConnections">
                      <Unlink class="h-4 w-4" />
                    </Button>
                  </div>

                  <div class="mt-2 space-y-2 text-xs text-muted-foreground">
                    <div class="flex items-center gap-2">
                      <Link2 class="h-3 w-3" />
                      <span>
                        {{
                          connectMode
                            ? 'Conecte Turmas apenas em Condições, e Condições apenas em Turmas.'
                            : 'Ative o modo conectar para criar conexoes.'
                        }}
                      </span>
                    </div>
                    <div v-if="connectMode" class="text-[11px] text-muted-foreground">
                      IF tem duas saidas: OK (verde) e NOK (vermelha).
                    </div>
                  </div>

                  <div class="my-4 h-px w-full bg-border" />

                  <div class="space-y-2">
                    <div
                      v-if="courses.length === 0"
                      class="rounded-xl border border-dashed bg-slate-50 p-3 text-center text-xs text-muted-foreground"
                    >
                      Nenhum curso encontrado para o filtro selecionado.
                    </div>
                    <div
                      v-for="c in courses"
                      :key="c.id"
                      class="overflow-hidden rounded-2xl border bg-background shadow-sm"
                    >
                      <div class="relative flex items-start gap-4 bg-gray-100 px-4 py-3" style="min-height: 67px">
                        <div
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-200 backdrop-blur-sm"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="lucide lucide-graduation-cap-icon h-6 w-6 text-gray-400"
                          >
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                          </svg>
                        </div>
                        <div class="min-w-0 flex-1 pt-0.5">
                          <div class="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Curso</div>
                          <h3
                            class="line-clamp-2 text-[12px] font-semibold leading-tight text-gray-500"
                            title="{{ c.name }}"
                          >
                            {{ c.name }}
                          </h3>
                        </div>
                      </div>
                      <div
                        class="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-3"
                        style="height: 56px"
                      >
                        <div class="space-y-1">
                          <div class="text-[9px] font-medium uppercase tracking-wide text-slate-500">
                            Total de Aprendizes
                          </div>
                          <div class="flex items-baseline gap-2">
                            <span class="text-1xl font-bold text-slate-600">{{ courseApprenticesTotal(c.id) }}</span
                            ><span class="text-sm text-slate-500">Aprendizes</span>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center justify-between gap-2 p-3">
                        <button class="flex items-center gap-2 text-left" type="button" @click="toggleExpanded(c.id)">
                          <component :is="expandedCourses.has(c.id) ? ChevronDown : ChevronRight" class="h-4 w-4" />
                          <div>
                            <div class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <span>Selecionar turmas</span>
                            </div>
                          </div>
                        </button>

                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                            title="Turmas selecionadas"
                          >
                            {{ preselect[c.id]?.size || 0 }}
                          </span>

                          <div
                            class="cursor-grab select-none rounded-xl border px-3 py-1 text-xs active:cursor-grabbing"
                            :class="preselect[c.id]?.size ? '' : 'opacity-50'"
                            :draggable="!!preselect[c.id]?.size"
                            :title="preselect[c.id]?.size ? 'Arraste' : 'Selecione pelo menos 1 turma'"
                            @dragstart="
                              (event: DragEvent) => {
                                if (!preselect[c.id]?.size) return
                                onDragStartCourse(event, c.id)
                              }
                            "
                          >
                            Arrastar
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            :disabled="!preselect[c.id]?.size"
                            :title="preselect[c.id]?.size ? 'Adicionar' : 'Selecione turmas'"
                            @click="
                              () => {
                                if (!preselect[c.id]?.size) return
                                addCourseNode(c.id, { x: 80, y: 80 })
                              }
                            "
                          >
                            <Plus class="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div v-if="expandedCourses.has(c.id)" class="px-3 pb-3">
                        <div class="mb-2 flex items-center justify-between gap-2">
                          <div class="text-xs font-semibold">Turmas:</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            class="h-7 px-2 text-[10px]"
                            :disabled="
                              !classesByCourse[c.id]?.length ||
                              (preselect[c.id]?.size || 0) === (classesByCourse[c.id] || []).length
                            "
                            @click="selectAllCourseClasses(c.id)"
                          >
                            {{
                              (classesByCourse[c.id]?.length || 0) > 0 &&
                              (preselect[c.id]?.size || 0) === (classesByCourse[c.id] || []).length
                                ? 'Todas selecionadas'
                                : 'Selecionar todas'
                            }}
                          </Button>
                        </div>
                        <div class="space-y-2">
                          <div
                            v-for="cls in classesByCourse[c.id] || []"
                            :key="cls.id"
                            class="flex items-center justify-between gap-2 rounded-xl border bg-slate-50/50 px-3 py-2"
                          >
                            <div class="flex min-w-0 flex-1 items-center gap-2">
                              <input
                                type="checkbox"
                                :checked="preselect[c.id]?.has(cls.id) || false"
                                @change="
                                  (event) => togglePreselect(c.id, cls.id, (event.target as HTMLInputElement).checked)
                                "
                                class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div class="min-w-0 flex-1">
                                <div class="truncate text-[13px] font-semibold text-slate-800">{{ cls.name }}</div>
                                <div class="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span class="flex items-center gap-0.5" title="Total de aprendizes">
                                    <Users class="h-3 w-3" />
                                    {{ cls.stats?.total || 0 }}
                                  </span>
                                  <span v-if="cls.stats" class="flex gap-1.5 border-l border-slate-200 pl-2">
                                    <span title="Homens">H: {{ cls.stats.men }}</span>
                                    <span title="Mulheres">M: {{ cls.stats.women }}</span>
                                    <span title="Outros">O: {{ cls.stats.others }}</span>
                                    <span
                                      v-if="cls.dayOfWeek"
                                      class="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[7px] font-medium text-slate-700"
                                    >
                                      {{ formatDayOfWeek(cls.dayOfWeek) }}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div class="flex shrink-0 flex-col items-end gap-2">
                              <span
                                v-if="onlyWithContractFlag(cls)"
                                class="whitespace-nowrap rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[7px] font-medium text-orange-700"
                              >
                                Contrato
                              </span>
                              <span
                                v-else
                                class="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[7px] font-medium text-slate-600"
                              >
                                Livre
                              </span>
                            </div>
                          </div>
                        </div>
                        <div class="mt-2 text-[11px] text-muted-foreground">
                          Exemplo: "matriculados do Curso X / Turma X1 -> Curso Y / Turma Y3".
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </template>
            <div v-else class="flex h-full flex-col items-center gap-3 pt-3">
              <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                title="Expandir painel de cursos"
                @click="leftPanelCollapsed = false"
              >
                <ChevronRight class="h-4 w-4" />
              </Button>
              <div class="h-px w-8 bg-border"></div>
              <Button
                size="icon"
                variant="secondary"
                class="h-9 w-9 cursor-grab active:cursor-grabbing"
                title="Inicio (clique ou arraste)"
                draggable="true"
                @click="addStartNode()"
                @dragstart="(event: DragEvent) => onDragStartPaletteNode(event, 'start')"
              >
                <Play class="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                class="h-9 w-9 cursor-grab active:cursor-grabbing"
                title="Condicao (clique ou arraste)"
                draggable="true"
                @click="addConditionNode()"
                @dragstart="(event: DragEvent) => onDragStartPaletteNode(event, 'condition')"
              >
                <Plus class="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                class="h-9 w-9 cursor-grab active:cursor-grabbing"
                title="Comentário (clique ou arraste)"
                draggable="true"
                @click="addCommentNode()"
                @dragstart="(event: DragEvent) => onDragStartPaletteNode(event, 'comment')"
              >
                <FileText class="h-4 w-4" />
              </Button>
              <div class="mt-2 rotate-180 text-[10px] text-muted-foreground [writing-mode:vertical-rl]">arraste</div>
            </div>
          </div>

          <div class="relative h-full min-h-0" ref="flowWrapper" @drop="handleDrop" @dragover="handleDragOver">
            <div class="relative h-full">
              <VueFlow
                :id="flowId"
                :nodes="nodes"
                :edges="edges"
                :node-types="nodeTypes"
                :edge-types="edgeTypes"
                :min-zoom="0.45"
                :max-zoom="2.2"
                :default-edge-options="{ type: 'smooth' }"
                :is-valid-connection="isValidConnection"
                class="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.35)_1px,transparent_0)] bg-[length:22px_22px]"
                @connect="handleConnect"
              >
                <template #connection-line="{ sourceX, sourceY, targetX, targetY }">
                  <CustomConnectionLine
                    :source-x="sourceX"
                    :source-y="sourceY"
                    :target-x="targetX"
                    :target-y="targetY"
                  />
                </template>
                <Background :gap="22" :size="1" />
                <Controls
                  class="pointer-events-auto z-10"
                  position="top-right"
                  :show-fit-view="true"
                  :show-zoom="true"
                  :show-interactive="true"
                />
              </VueFlow>

              <div
                v-if="nodes.length === 0"
                class="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div
                  class="pointer-events-auto rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 shadow-xl"
                >
                  <div class="text-center">
                    <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                      <Plus class="h-6 w-6 text-blue-600" />
                    </div>
                    <div class="mb-1 text-sm font-bold text-slate-900">Solte um curso aqui</div>
                    <div class="max-w-[240px] text-xs text-muted-foreground">
                      Selecione turmas na sidebar e arraste o curso para comecar
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="h-full min-h-0 border-l bg-muted/30"
            :class="rightPanelCollapsed ? 'flex items-start justify-center pt-4' : 'overflow-auto p-4'"
          >
            <Button
              size="icon"
              variant="ghost"
              class="h-8 w-8 shrink-0"
              :title="rightPanelCollapsed ? 'Expandir painel de configuracao' : 'Recolher painel de configuracao'"
              @click="rightPanelCollapsed = !rightPanelCollapsed"
            >
              <ChevronRight class="h-4 w-4 transition-transform" :class="rightPanelCollapsed ? '' : 'rotate-180'" />
            </Button>

            <template v-if="!rightPanelCollapsed">
              <div v-if="activeWorkflow" class="mb-4 rounded-2xl border bg-white shadow-sm">
                <div class="p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow</div>
                      <div class="text-sm font-bold text-slate-900">{{ activeWorkflow.name }}</div>
                      <div class="mt-1 grid gap-0.5 text-[10px] text-slate-600">
                        <div class="flex items-center gap-1">
                          <span class="font-semibold">Proxima execucao:</span>
                          <span>{{ scheduleNextExecutionLabel(workflowScheduleOf(activeWorkflow)) }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="font-semibold">Ultima execucao:</span>
                          <span>{{ scheduleLastExecutionLabel(workflowScheduleOf(activeWorkflow)) }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="font-semibold">Frequencia:</span>
                          <span>{{ scheduleFrequencyLabel(workflowScheduleOf(activeWorkflow)) }}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                      :class="workflowStatusMeta(activeWorkflow.status).class"
                    >
                      {{ workflowStatusMeta(activeWorkflow.status).label }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="mb-3 flex items-center justify-between">
                <div class="text-sm font-semibold">Configuracao</div>
                <span
                  class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                >
                  {{ nodeTypeLabel(selectedNode?.type) }}
                </span>
              </div>

              <div v-if="!selectedNode" class="rounded-2xl border bg-white shadow-sm">
                <div class="p-4 text-sm text-muted-foreground">Selecione um node no canvas para configurar.</div>
              </div>
              <div v-else-if="selectedNode.type === 'course'" class="rounded-2xl border bg-white shadow-sm">
                <div class="space-y-2 p-4">
                  <div class="text-sm font-semibold">Curso {{ selectedNode.data?.payload?.courseName }}</div>
                  <div class="text-xs text-muted-foreground">
                    Turmas no card: <b>{{ selectedNode.data?.payload?.classes?.length || 0 }}</b>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Use as conexoes por turma para dizer exatamente quem sai (ex.: X1) e quem entra (ex.: Y3).
                  </div>
                </div>
              </div>
              <div v-else-if="selectedNode.type === 'comment'" class="rounded-2xl border bg-white shadow-sm">
                <div class="space-y-3 p-4">
                  <div>
                    <div class="text-sm font-semibold">Comentário</div>
                    <div class="text-[11px] text-muted-foreground">
                      Use este bloco para escrever regras, lógicas e observações livres do workflow.
                    </div>
                  </div>

                  <div class="space-y-1">
                    <Label class="text-[11px]">Texto</Label>
                    <Textarea
                      :model-value="selectedNode.data?.payload?.text || ''"
                      class="min-h-[220px] resize-y"
                      placeholder="Escreva aqui a anotação do workflow..."
                      @update:model-value="(val) => updateSelectedComment({ text: String(val) })"
                    />
                  </div>
                </div>
              </div>
              <div v-else-if="selectedNode.type === 'start'" class="rounded-2xl border bg-white shadow-sm">
                <div class="space-y-3 p-4">
                  <div class="text-sm font-semibold">Configuracao do Inicio</div>

                  <div class="space-y-2 rounded-xl border p-3">
                    <div>
                      <div class="text-xs font-semibold">Execucao do workflow</div>
                      <div class="text-[11px] text-muted-foreground">Defina se a execucao e unica ou recorrente</div>
                    </div>
                    <div class="grid gap-2 pt-1">
                      <label
                        v-for="opt in EXECUTION_MODE_OPTIONS"
                        :key="opt.value"
                        class="flex cursor-pointer items-center gap-2 rounded-lg border bg-white p-2 hover:bg-slate-50"
                      >
                        <input
                          type="radio"
                          :name="`exec-mode-${selectedNode.id}`"
                          :value="opt.value"
                          :checked="selectedNode.data?.payload?.executionMode === opt.value"
                          @change="() => updateSelectedStart({ executionMode: opt.value })"
                        />
                        <span class="text-[11px] text-slate-900">{{ opt.label }}</span>
                      </label>
                    </div>
                  </div>

                  <div class="space-y-2 rounded-xl border p-3">
                    <div>
                      <div class="text-xs font-semibold">Periodo de execucao</div>
                      <div class="text-[11px] text-muted-foreground">Inicie em uma data ou defina um intervalo</div>
                    </div>
                    <div class="grid grid-cols-1 gap-2 pt-1">
                      <div class="space-y-1">
                        <Label class="text-[11px]">Data inicio</Label>
                        <DatePicker
                          :model-value="selectedNode.data?.payload?.startDate"
                          @update:model-value="(val) => updateSelectedStart({ startDate: String(val) })"
                        />
                      </div>
                      <div class="space-y-1">
                        <Label class="text-[11px]">Data termino</Label>
                        <DatePicker
                          :model-value="selectedNode.data?.payload?.endDate"
                          :class="
                            selectedNode.data?.payload?.executionMode === 'once' && !selectedNode.data?.payload?.endDate
                              ? 'border-rose-300'
                              : ''
                          "
                          @update:model-value="(val) => updateSelectedStart({ endDate: String(val) })"
                        />
                        <div
                          v-if="
                            selectedNode.data?.payload?.executionMode === 'once' && !selectedNode.data?.payload?.endDate
                          "
                          class="text-[10px] text-rose-600"
                        >
                          Informe a data de termino para execucao unica.
                        </div>
                      </div>
                      <div v-if="selectedNode.data?.payload?.executionMode === 'recurring'" class="space-y-1">
                        <Label class="text-[11px]">Horario diario</Label>
                        <Input
                          type="time"
                          step="60"
                          :model-value="selectedNode.data?.payload?.runDailyAt"
                          @update:model-value="(val) => updateSelectedStart({ runDailyAt: String(val) })"
                        />
                        <div class="text-[10px] text-muted-foreground">Execucao diaria no horario definido.</div>
                      </div>
                      <div v-if="selectedNode.data?.payload?.executionMode === 'recurring'" class="space-y-1">
                        <Label class="text-[11px]">Repetir a cada</Label>
                        <select
                          class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                          :value="
                            selectedNode.data?.payload?.runIntervalMinutes === null
                              ? ''
                              : String(selectedNode.data?.payload?.runIntervalMinutes)
                          "
                          @change="
                            (e) => {
                              const value = (e.target as HTMLSelectElement).value
                              updateSelectedStart({ runIntervalMinutes: value ? Number(value) : null })
                            }
                          "
                        >
                          <option v-for="opt in repeatIntervalOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </option>
                        </select>
                        <div class="text-[10px] text-muted-foreground">
                          Se definido, repete durante o dia no intervalo escolhido.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="text-[11px] text-slate-600">
                    Conecte o inicio a uma turma ou condicao para definir onde o fluxo comeca.
                  </div>
                </div>
              </div>
              <div v-else-if="selectedNode.type === 'condition'" class="rounded-2xl border bg-white shadow-sm">
                <div v-if="conditionDetailsOpenId === selectedNode.id" class="space-y-3 p-4">
                  <ConditionConfigForm
                    v-if="selectedNode.data?.payload"
                    :value="selectedNode.data.payload"
                    :requires-contract="selectedConditionRequiresContract"
                    :show-outputs-note="true"
                    :port-color="portColor"
                    @update="updateSelectedCondition"
                  />
                </div>
                <div v-else class="p-4 text-center text-sm text-muted-foreground">
                  <div class="mb-2">Clique duas vezes no nó de condição no canvas para abrir as configurações.</div>
                  <Button size="sm" variant="outline" @click="toggleConditionDetails(selectedNode.id)">
                    Abrir Configurações
                  </Button>
                </div>
              </div>

              <div class="my-4 h-px w-full bg-border" />

              <div class="rounded-2xl border bg-white shadow-sm">
                <div class="p-4">
                  <div class="text-xs font-semibold">Como editar conexoes</div>
                  <div class="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div>- Ative Modo conectar.</div>
                    <div>- Arraste do ponto de saida ate a entrada.</div>
                    <div>- Clique na linha para remover.</div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
</style>
