<script setup lang="ts">
import {computed, markRaw, onMounted, ref, watch} from 'vue'
import {Background} from '@vue-flow/background'
import {Controls} from '@vue-flow/controls'
import {VueFlow, type Connection} from '@vue-flow/core'
import {useVueFlow} from '@vue-flow/core'
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  Save,
  Unlink,
  Users,
} from 'lucide-vue-next'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Switch} from '@/components/ui/switch'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import SmoothEdge from '@/components/vue-flow/edges/smooth-edge.vue'
import CustomConnectionLine from '@/components/vue-flow/custom-connection-line.vue'
import ConditionNode from '@/components/vue-flow/nodes/condition-node.vue'
import CourseNode from '@/components/vue-flow/nodes/course-node.vue'
import WorkflowGridPreview from '@/components/workflow-grid-preview.vue'
import {Toaster, useToast} from '@/components/ui/toast'
import {
  buildCoursePayload,
  conditionNodeId,
  courseNodeId,
  edgeKindFromHandles,
  edgeStroke,
  parseCourseId,
  portColor,
  uid,
  type ConditionPayload,
  type Course,
  type CourseClass,
} from '@/lib/workflow'
import {api} from '@/lib/api'

const {toast} = useToast()
const {flowId} = defineProps<{
  flowId: string
}>()
const {
  nodes,
  edges,
  setNodes,
  setEdges,
  project,
  onNodesChange,
  onEdgesChange,
  addNodes
} = useVueFlow({
  id: flowId,
})

const nodeTypes = {
  course: markRaw(CourseNode),
  condition: markRaw(ConditionNode),
}

const edgeTypes = {
  smooth: markRaw(SmoothEdge),
}

const apiCourses = ref<Course[]>([])
const apiClasses = ref<CourseClass[]>([])
const apiWorkflows = ref<any[]>([])
const apiOnline = ref(true)

const query = ref('')
const expandedCourses = ref<Set<number>>(new Set())
const preselect = ref<Record<number, Set<number>>>({})
const connectMode = ref(false)
const selectedNodeId = ref<string | null>(null)
const selectedEdgeId = ref<string | null>(null)
const activeTab = ref('basic-nodes')
const conditionDetailsOpenId = ref<string | null>(null)

const classesByCourse = computed(() => {
  const map: Record<number, any[]> = {}
  apiClasses.value.forEach(cls => {
    // @ts-ignore
    const cId = cls.courseId
    if (cId) {
      if (!map[cId]) map[cId] = []
      map[cId].push(cls)
    }
  })
  return map
})

const view = computed(() => (activeTab.value === 'table' ? 'grid' : 'editor'))
const isGrid = computed(() => view.value === 'grid')

const courses = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return apiCourses.value
  return apiCourses.value.filter((c) => c.name.toLowerCase().includes(q))
})

onMounted(async () => {
  try {
    const [cRes, clRes, wfRes] = await Promise.all([
      api.getCourses(),
      api.getClasses(),
      api.getWorkflows()
    ])
    apiCourses.value = cRes.data
    apiClasses.value = clRes.data
    apiWorkflows.value = wfRes.data
    apiOnline.value = !cRes.isFallback && !clRes.isFallback && !wfRes.isFallback
  } catch (e) {
    console.error('Falha ao carregar dados da API', e)
    apiOnline.value = false
  }
})

function loadWorkflow(wf: any) {
  if (!wf) return
  setNodes(wf.nodes || [])
  setEdges(wf.edges || [])
  selectedNodeId.value = null
  selectedEdgeId.value = null
  toast({
    title: 'Workflow carregado',
    description: `Workflow "${wf.name}" foi carregado com sucesso.`
  })
}

const selectedNode = computed(() => nodes.value.find((n) => n.id === selectedNodeId.value) ?? null)

const flowWrapper = ref<HTMLDivElement | null>(null)

onNodesChange((changes) => {
  // We can let Vue Flow handle the changes automatically since nodes is a ref from useVueFlow
})

onEdgesChange((changes) => {
})

watch([() => nodes.value.filter(n => n?.selected).map(n => n.id), () => edges.value.filter(e => e?.selected).map(e => e.id)], ([selNodes, selEdges]) => {
  selectedNodeId.value = selNodes[0] ?? null
  selectedEdgeId.value = selEdges[0] ?? null
})

function toggleConditionDetails(nodeId: string) {
  conditionDetailsOpenId.value =
      conditionDetailsOpenId.value === nodeId ? null : nodeId
}

function syncNodeMeta() {
  setNodes(
      nodes.value.map((n) => ({
        ...n,
        data: {
          ...n.data,
          connectMode: connectMode.value,
          onRemove: removeNode,
          nodeId: n.id,
          ...(n.type === 'condition'
              ? {
                showDetails: conditionDetailsOpenId.value === n.id,
                onToggleDetails: toggleConditionDetails,
              }
              : {}),
        },
      })),
  )
}


watch(connectMode, syncNodeMeta)
watch(conditionDetailsOpenId, syncNodeMeta)

function setView(next: 'editor' | 'grid') {
  activeTab.value = next === 'grid' ? 'table' : 'basic-nodes'
}

function toggleExpanded(courseId: number) {
  const next = new Set(expandedCourses.value)
  if (next.has(courseId)) next.delete(courseId)
  else next.add(courseId)
  expandedCourses.value = next
}

function togglePreselect(courseId: number, classId: number, checked: boolean) {
  const current = new Set(preselect.value[courseId] ?? [])
  if (checked) current.add(classId)
  else current.delete(classId)

  preselect.value = {...preselect.value, [courseId]: current}

  const id = courseNodeId(courseId)
  const classes = (classesByCourse.value[courseId] ?? []).filter((c) => current.has(c.id))
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
                    classes,
                  },
                },
              },
      ),
  )
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
                    payload: {...n.data?.payload, ...payload, classes: merged},
                    connectMode: connectMode.value,
                    onRemove: removeNode,
                    nodeId: id,
                  },
                },
        ),
    )
  } else {
    const newNode = {
      id,
      type: 'course',
      position: position ?? {x: 80, y: 80},
      data: {
        payload,
        connectMode: connectMode.value,
        onRemove: removeNode,
        nodeId: id,
      },
    }
    addNodes([newNode])
  }

  selectedNodeId.value = id
  selectedEdgeId.value = null
}

function addConditionNode() {
  const id = conditionNodeId(uid())
  const payload: ConditionPayload = {
    startDate: '',
    endDate: '',
    minAttendance: 100,
    minExamGrade: 0,
    mustCompleteLessons: false,
    checkContract: false,
    contractStatus: [],
    hasMinGrade: false,
    hasEvolutionDate: false,
    hasAttendance: false,
    isBalanced: false,
    balanceStrategy: ['occupancy'],
  }

  const newNode = {
    id,
    type: 'condition',
    position: {x: 250, y: 150},
    data: {
      payload,
      connectMode: connectMode.value,
      onRemove: removeNode,
      nodeId: id,
      showDetails: conditionDetailsOpenId.value === id,
      onToggleDetails: toggleConditionDetails,
    },
  }

  addNodes([newNode])

  selectedNodeId.value = id
  selectedEdgeId.value = null
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

function exportJson() {
  const data = {
    nodes: nodes.value.map((n) => ({
      nodeKey: n.id,
      type: n.type,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      payload: n.data?.payload,
    })),
    edges: edges.value.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: e.data,
    })),
  }
  alert('Export gerado. Veja o console.')
  console.log('WORKFLOW_JSON', data)
}

function onDragStartCourse(event: DragEvent, courseId: number) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/vueflow', JSON.stringify({type: 'course', courseId}))
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
    y: event.clientY - bounds.top,
  })

  if (payload.type === 'course' && typeof payload.courseId === 'number') {
    const x = Math.max(0, position.x - 160)
    const y = Math.max(0, position.y - 40)
    addCourseNode(payload.courseId, {x, y})
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function isValidConnection(connection: Connection) {
  const {sourceHandle, targetHandle} = connection
  if (!sourceHandle || !targetHandle) return false

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

function handleConnect(params: Connection) {
  if (!connectMode.value) return

  const {source, target, sourceHandle, targetHandle} = params
  if (!source || !target || !sourceHandle || !targetHandle) return

  if (sourceHandle.startsWith('class-in') || sourceHandle === 'if-in') return
  if (targetHandle.startsWith('class-out') || targetHandle === 'if-ok' || targetHandle === 'if-nok') return

  const kind = edgeKindFromHandles(sourceHandle, targetHandle)
  const id = uid()
  const style = {
    stroke: edgeStroke(kind),
    strokeWidth: 3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    opacity: 0.92,
  }

  const nextEdges = [
    ...edges.value,
    {
      ...params,
      id,
      type: 'smooth',
      style,
      data: {kind, auto: false},
    },
  ]

  setEdges(nextEdges)
  selectedEdgeId.value = null
}

function updateSelectedCondition(patch: Partial<ConditionPayload>) {
  if (!selectedNode.value || selectedNode.value.type !== 'condition') return
  setNodes(
      nodes.value.map((n) =>
          n.id !== selectedNode.value?.id
              ? n
              : {
                ...n,
                data: {
                  ...n.data,
                  payload: {...n.data?.payload, ...patch},
                },
              },
      ),
  )
}
</script>

<template>
  <div class="grid h-full grid-cols-[340px_1fr_360px] gap-0 border rounded-2xl overflow-hidden">
    <div class="bg-muted/30 border-r">
      <tabs v-model="activeTab" default-value="basic-nodes">
        <tabs-list class="grid w-full grid-cols-3">
          <tabs-trigger value="basic-nodes">Basic Nodes</tabs-trigger>
          <tabs-trigger value="table">Table</tabs-trigger>
          <tabs-trigger value="workflows">Workflows</tabs-trigger>
        </tabs-list>

        <tabs-content value="basic-nodes">
          <scroll-area class="h-[calc(100vh-150px)] w-full">
            <div class="p-4">
              <div class="mb-3 flex items-center justify-between">
                <div class="text-sm font-semibold">Cursos</div>
                <div class="flex items-center gap-2">
                  <div 
                    class="h-2 w-2 rounded-full" 
                    :class="apiOnline ? 'bg-emerald-500' : 'bg-orange-500'"
                    :title="apiOnline ? 'API Online' : 'API Offline (Demo Mode)'"
                  ></div>
                  <Button
                      size="sm"
                      :variant="!isGrid ? 'secondary' : 'ghost'"
                      @click="setView('editor')"
                  >
                    Editor
                  </Button>
                  <Button
                      size="sm"
                      :variant="isGrid ? 'secondary' : 'ghost'"
                      @click="setView('grid')"
                  >
                    Table
                  </Button>
                  <span
                      class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    vueflow
                  </span>
                </div>
              </div>

              <div class="space-y-2">
                <Input v-model="query" placeholder="Buscar..."/>
                <div class="flex gap-2">
                  <Button size="sm" variant="secondary" class="w-full" @click="addConditionNode">
                    <Plus class="mr-2 h-4 w-4"/>
                    Condicao
                  </Button>
                  <Button size="sm" variant="secondary" title="Export JSON" @click="exportJson">
                    <Save class="h-4 w-4"/>
                  </Button>
                </div>
              </div>

              <div class="my-4 h-px w-full bg-border"/>

              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Switch
                      :checked="connectMode"
                      @update:checked="(value) => {
                      connectMode = value
                      selectedEdgeId = null
                    }"
                  />
                  <Label class="text-xs">Modo conectar</Label>
                </div>
                <Button size="sm" variant="ghost" title="Limpar conexoes" @click="clearConnections">
                  <Unlink class="h-4 w-4"/>
                </Button>
              </div>

              <div class="mt-2 space-y-2 text-xs text-muted-foreground">
                <div class="flex items-center gap-2">
                  <Link2 class="h-3 w-3"/>
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

              <div class="my-4 h-px w-full bg-border"/>

              <div class="space-y-2">
                <div
                    v-for="c in courses"
                    :key="c.id"
                    class="rounded-2xl border bg-background shadow-sm overflow-hidden"
                >
                  <div class="flex items-center justify-between gap-2 p-3">
                    <button
                        class="flex items-center gap-2 text-left"
                        type="button"
                        @click="toggleExpanded(c.id)"
                    >
                      <component :is="expandedCourses.has(c.id) ? ChevronDown : ChevronRight" class="h-4 w-4"/>
                      <div>
                        <div class="text-sm font-semibold text-slate-800">Curso {{ c.name }}</div>
                        <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Users class="h-3 w-3" />
                          <span>{{ (classesByCourse[c.id] || []).reduce((acc, curr) => acc + (curr.stats?.total || 0), 0) }} aprendizes</span>
                          <span class="mx-0.5 opacity-50">•</span>
                          <span>Selecione turmas -> arraste</span>
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
                          @dragstart="(event) => {
                          if (!preselect[c.id]?.size) return
                          onDragStartCourse(event, c.id)
                        }"
                      >
                        Arrastar
                      </div>

                      <Button
                          size="sm"
                          variant="ghost"
                          :disabled="!preselect[c.id]?.size"
                          :title="preselect[c.id]?.size ? 'Adicionar' : 'Selecione turmas'"
                          @click="() => {
                          if (!preselect[c.id]?.size) return
                          addCourseNode(c.id, { x: 80, y: 80 })
                        }"
                      >
                        <Plus class="h-4 w-4"/>
                      </Button>
                    </div>
                  </div>

                  <div v-if="expandedCourses.has(c.id)" class="px-3 pb-3">
                    <div class="mb-2 text-xs font-semibold">Turmas no card</div>
                    <div class="space-y-2">
                      <div
                          v-for="cls in classesByCourse[c.id] || []"
                          :key="cls.id"
                          class="flex items-center justify-between gap-2 rounded-xl border bg-slate-50/50 px-3 py-2"
                      >
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                          <input
                              type="checkbox"
                              :checked="preselect[c.id]?.has(cls.id) || false"
                              @change="(event) => togglePreselect(c.id, cls.id, (event.target as HTMLInputElement).checked)"
                              class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div class="min-w-0 flex-1">
                            <div class="text-[13px] font-semibold truncate text-slate-800">{{ cls.name }}</div>
                            <div class="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span class="flex items-center gap-0.5" title="Total de aprendizes">
                                <Users class="h-3 w-3" />
                                {{ cls.stats?.total || 0 }}
                              </span>
                              <span v-if="cls.stats" class="flex gap-1.5 border-l pl-2 border-slate-200">
                                <span title="Homens">H: {{ cls.stats.men }}</span>
                                <span title="Mulheres">M: {{ cls.stats.women }}</span>
                                <span title="Outros">O: {{ cls.stats.others }}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                            v-if="cls.requires_contract"
                            class="shrink-0 whitespace-nowrap rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700 font-medium"
                        >
                          Exige contrato
                        </span>
                        <span
                            v-else
                            class="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 font-medium"
                        >
                          Livre
                        </span>
                      </div>
                    </div>
                    <div class="mt-2 text-[11px] text-muted-foreground">
                      Exemplo: "matriculados do Curso X / Turma X1 -> Curso Y / Turma Y3".
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </scroll-area>
        </tabs-content>

        <tabs-content value="table">
          <div class="p-4 text-xs text-muted-foreground">
            Visualize a tabela dinamica baseada no fluxo de cursos.
          </div>
        </tabs-content>

        <tabs-content value="workflows">
          <scroll-area class="h-[calc(100vh-150px)] w-full">
            <div class="p-4 space-y-3">
              <div v-if="apiWorkflows.length === 0" class="text-xs text-muted-foreground">
                Sem workflows cadastrados.
              </div>
              <div
                v-for="wf in apiWorkflows"
                :key="wf.id"
                class="flex items-center justify-between rounded-xl border bg-background p-3 shadow-sm hover:border-blue-200 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold truncate">{{ wf.name }}</div>
                  <div class="text-[10px] text-muted-foreground truncate">
                    ID: {{ wf.id }} • {{ wf.nodes?.length || 0 }} nodes
                  </div>
                </div>
                <Button size="sm" variant="ghost" class="h-8 w-8" @click="loadWorkflow(wf)">
                  <ChevronRight class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </scroll-area>
        </tabs-content>
      </tabs>
    </div>

    <div class="relative h-full" ref="flowWrapper" @drop="handleDrop" @dragover="handleDragOver">
      <div v-if="view === 'editor'" class="relative h-full">
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
            <CustomConnectionLine :source-x="sourceX" :source-y="sourceY" :target-x="targetX" :target-y="targetY"/>
          </template>
          <Background :gap="22" :size="1"/>
          <Controls/>
        </VueFlow>

        <div v-if="nodes.length === 0" class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="pointer-events-auto rounded-2xl border bg-white shadow-sm">
            <div class="p-5 text-center">
              <div class="text-sm font-semibold">Solte um curso aqui</div>
              <div class="mt-1 text-xs text-muted-foreground">
                Primeiro selecione as turmas na sidebar e depois arraste.
              </div>
            </div>
          </div>
        </div>
      </div>
      <WorkflowGridPreview v-else :nodes="nodes" :edges="edges"/>
    </div>

    <div class="bg-muted/30 border-l p-4 overflow-auto">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-sm font-semibold">Configuracao</div>
        <span
            class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
        >
          {{ selectedNode ? (selectedNode.type === 'condition' ? 'IF' : 'CURSO') : '-' }}
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
      <div v-else-if="selectedNode.type === 'condition'" class="rounded-2xl border bg-white shadow-sm">
        <div v-if="conditionDetailsOpenId === selectedNode.id" class="space-y-3 p-4">
          <div class="text-sm font-semibold">Configuração da Condição</div>

          <!-- Aulas Completas -->
          <div class="space-y-2 rounded-xl border p-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold">Aulas completas</div>
                <div class="text-[11px] text-muted-foreground">Frequência mínima exigida</div>
              </div>
              <Switch
                  :checked="!!selectedNode.data?.payload?.hasAttendance"
                  @update:checked="(val) => updateSelectedCondition({ hasAttendance: val })"
              />
            </div>
            <div v-if="selectedNode.data?.payload?.hasAttendance" class="space-y-1 pt-2">
              <Label class="text-[11px]">Porcentagem de aulas (%)</Label>
              <Input
                  type="number"
                  min="0"
                  max="100"
                  :model-value="selectedNode.data?.payload?.minAttendance"
                  @update:model-value="(val) => updateSelectedCondition({ minAttendance: Number(val || 0) })"
              />
              <div class="flex items-center gap-2 mt-2">
                <Switch
                    id="must-complete"
                    :checked="!!selectedNode.data?.payload?.mustCompleteLessons"
                    @update:checked="(val) => updateSelectedCondition({ mustCompleteLessons: val })"
                />
                <Label for="must-complete" class="text-[11px]">Exigir todas as aulas</Label>
              </div>
            </div>
          </div>

          <!-- Nota Mínima -->
          <div class="space-y-2 rounded-xl border p-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold">Nota Mínima</div>
                <div class="text-[11px] text-muted-foreground">Média mínima estipulada</div>
              </div>
              <Switch
                  :checked="!!selectedNode.data?.payload?.hasMinGrade"
                  @update:checked="(val) => updateSelectedCondition({ hasMinGrade: val })"
              />
            </div>
            <div v-if="selectedNode.data?.payload?.hasMinGrade" class="space-y-1 pt-2">
              <Label class="text-[11px]">Média mínima</Label>
              <Input
                  type="number"
                  min="0"
                  step="0.1"
                  :model-value="selectedNode.data?.payload?.minExamGrade"
                  @update:model-value="(val) => updateSelectedCondition({ minExamGrade: Number(val || 0) })"
              />
            </div>
          </div>

          <!-- Data para Evolução -->
          <div class="space-y-2 rounded-xl border p-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold">Data para Evolução</div>
                <div class="text-[11px] text-muted-foreground">Período de evolução automática</div>
              </div>
              <Switch
                  :checked="!!selectedNode.data?.payload?.hasEvolutionDate"
                  @update:checked="(val) => updateSelectedCondition({ hasEvolutionDate: val })"
              />
            </div>
            <div v-if="selectedNode.data?.payload?.hasEvolutionDate" class="space-y-2 pt-2">
              <div class="space-y-1">
                <Label class="text-[11px]">Data início</Label>
                <Input
                    type="date"
                    :model-value="selectedNode.data?.payload?.startDate"
                    @update:model-value="(val) => updateSelectedCondition({ startDate: String(val) })"
                />
              </div>
              <div class="space-y-1">
                <Label class="text-[11px]">Data término</Label>
                <Input
                    type="date"
                    :model-value="selectedNode.data?.payload?.endDate"
                    @update:model-value="(val) => updateSelectedCondition({ endDate: String(val) })"
                />
              </div>
            </div>
          </div>

          <!-- Checar Contrato -->
          <div class="space-y-2 rounded-xl border p-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold">Checar Contrato</div>
                <div class="text-[11px] text-muted-foreground">Validar status do contrato</div>
              </div>
              <Switch
                  :checked="!!selectedNode.data?.payload?.checkContract"
                  @update:checked="(val) => updateSelectedCondition({ checkContract: val })"
              />
            </div>
            <div v-if="selectedNode.data?.payload?.checkContract" class="space-y-2 pt-2">
              <Label class="text-[11px]">Status do contrato (selecione um ou mais)</Label>
              <div class="space-y-1">
                <div
                    v-for="opt in [
                      { value: 'in_progress', label: 'Contrato em andamento' },
                      { value: 'finished', label: 'Contrato Finalizado' },
                      { value: 'waived', label: 'Contrato dispensa' },
                      { value: 'no_contract', label: 'Sem contrato' }
                    ]"
                    :key="opt.value"
                    class="flex items-center gap-2 rounded-lg border p-2"
                >
                  <input
                      type="checkbox"
                      :id="`status-${opt.value}`"
                      :checked="selectedNode.data?.payload?.contractStatus?.includes(opt.value)"
                      @change="(e) => {
                        const checked = (e.target as HTMLInputElement).checked
                        const current = [...(selectedNode?.data?.payload?.contractStatus || [])]
                        if (checked) {
                          if (!current.includes(opt.value)) current.push(opt.value)
                        } else {
                          const idx = current.indexOf(opt.value)
                          if (idx !== -1) current.splice(idx, 1)
                        }
                        updateSelectedCondition({ contractStatus: current })
                      }"
                  />
                  <Label :for="`status-${opt.value}`" class="text-[11px] cursor-pointer flex-1">{{ opt.label }}</Label>
                </div>
              </div>
            </div>
          </div>

          <!-- Balanceamento de Carga -->
          <div class="space-y-2 rounded-xl border p-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold">Equilibrar Turmas</div>
                <div class="text-[11px] text-muted-foreground">Distribuir aprendizes entre saídas OK</div>
              </div>
              <Switch
                  :checked="!!selectedNode.data?.payload?.isBalanced"
                  @update:checked="(val) => updateSelectedCondition({ isBalanced: val })"
              />
            </div>
            <div v-if="selectedNode.data?.payload?.isBalanced" class="mt-3 space-y-3">
              <div class="text-[10px] text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
                <p class="font-bold mb-1">Regras de Balanceamento:</p>
                <ul class="list-disc pl-3 space-y-1">
                  <li><b>Round Robin:</b> Distribuição cíclica entre as turmas de destino.</li>
                  <li><b>Proporcionalidade:</b> Mantém o equilíbrio de gênero (H/M/O) conforme as vagas disponíveis.</li>
                  <li><b>Capacidade:</b> Prioriza turmas com menor lotação atual.</li>
                </ul>
              </div>

              <div class="space-y-1.5 border-t pt-2">
                <Label class="text-[11px]">Critérios de Balanceamento (pode escolher ambos)</Label>
                <div class="grid grid-cols-1 gap-1.5">
                  <label class="flex items-center gap-2 p-2 rounded border bg-white cursor-pointer hover:bg-slate-50">
                    <input 
                      type="checkbox" 
                      :checked="selectedNode.data?.payload?.balanceStrategy?.includes('occupancy')" 
                      @change="(e) => {
                        const checked = (e.target as HTMLInputElement).checked
                        const current = [...(selectedNode.data?.payload?.balanceStrategy || [])]
                        if (checked) {
                          if (!current.includes('occupancy')) current.push('occupancy')
                        } else {
                          const idx = current.indexOf('occupancy')
                          if (idx !== -1) current.splice(idx, 1)
                        }
                        updateSelectedCondition({ balanceStrategy: current })
                      }"
                      class="h-3 w-3" 
                    />
                    <span class="text-[10px]">Menor Ocupação Geral</span>
                  </label>
                  <label class="flex items-center gap-2 p-2 rounded border bg-white cursor-pointer hover:bg-slate-50">
                    <input 
                      type="checkbox" 
                      :checked="selectedNode.data?.payload?.balanceStrategy?.includes('gender')" 
                      @change="(e) => {
                        const checked = (e.target as HTMLInputElement).checked
                        const current = [...(selectedNode.data?.payload?.balanceStrategy || [])]
                        if (checked) {
                          if (!current.includes('gender')) current.push('gender')
                        } else {
                          const idx = current.indexOf('gender')
                          if (idx !== -1) current.splice(idx, 1)
                        }
                        updateSelectedCondition({ balanceStrategy: current })
                      }"
                      class="h-3 w-3" 
                    />
                    <span class="text-[10px]">Equilíbrio de Gênero (H/M/O)</span>
                  </label>
                </div>
              </div>

              <div class="p-2 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-700">
                <b>Nota:</b> O balanceamento só será aplicado se houver mais de uma conexão na saída "Sim".
              </div>
            </div>
          </div>

          <div class="text-[11px] text-muted-foreground mt-4">
            Saidas do IF:
            <span class="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                  :class="portColor('ok')">Sim (OK)</span>
            e
            <span class="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                  :class="portColor('nok')">Não (NOK)</span>
          </div>
        </div>
        <div v-else class="p-4 text-sm text-muted-foreground text-center">
          <div class="mb-2">Clique duas vezes no nó de condição no canvas para abrir as configurações.</div>
          <Button size="sm" variant="outline" @click="toggleConditionDetails(selectedNode.id)">
            Abrir Configurações
          </Button>
        </div>
      </div>

      <div class="my-4 h-px w-full bg-border"/>

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
    </div>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
</style>
