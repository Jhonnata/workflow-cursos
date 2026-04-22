import type { ConditionPayload, StartPayload } from './workflow'

export type WorkflowExecutionMode = StartPayload['executionMode']
export type WorkflowEdgeKind = 'next' | 'ok' | 'nok'
export type WorkflowEdgeBranch = 'ok' | 'nok' | null
export type WorkflowPayloadNodeType = 'start' | 'course' | 'condition' | 'comment'

export type WorkflowGraphNode = {
  id: string
  type?: string | null
  position?: { x?: number; y?: number } | null
  data?: {
    payload?: Record<string, any> | null
  } | null
}

export type WorkflowGraphEdge = {
  id: string
  source?: string | null
  target?: string | null
  sourceHandle?: string | null
  targetHandle?: string | null
  data?: Record<string, any> | null
}

export type WorkflowGraphInput = {
  nodes?: WorkflowGraphNode[] | null
  edges?: WorkflowGraphEdge[] | null
}

export type CanonicalCourseClass = {
  id: number
  identifier: string
  name: string
}

export type CanonicalStartPayload = {
  executionMode: WorkflowExecutionMode
  startDate: string
  endDate: string
  runDailyAt: string
  runIntervalMinutes: number | null
}

export type CanonicalCoursePayload = {
  courseId: number
  courseName: string
  classes: CanonicalCourseClass[]
}

export type CanonicalConditionPayload = {
  startDate: string
  endDate: string
  evolveAt: string
  evolutionMode: ConditionPayload['evolutionMode']
  minAttendance: number
  minExamGrade: number
  mustCompleteLessons: boolean
  countJustifiedAbsences: boolean
  checkContract: boolean
  contractStatus: string[]
  checkContractDuration: boolean
  contractDurationMonths: number | null
  classInsertStatus: string
  classExitStatus: string
  classCheckStatus: string
  hasMinGrade: boolean
  hasAttendance: boolean
  useClassEndDate: boolean
  keepSameDayOfWeek: boolean
  isBalanced: boolean
  balanceStrategy: ('occupancy' | 'gender')[]
  manualEvolution: boolean
}

export type CommentPayload = {
  text: string
}

export type WorkflowPayloadNode =
  | {
      id: string
      type: 'start'
      position: { x: number; y: number }
      data: { payload: CanonicalStartPayload }
    }
  | {
      id: string
      type: 'course'
      position: { x: number; y: number }
      data: { payload: CanonicalCoursePayload }
    }
  | {
      id: string
      type: 'condition'
      position: { x: number; y: number }
      data: { payload: CanonicalConditionPayload }
    }
  | {
      id: string
      type: 'comment'
      position: { x: number; y: number }
      data: { payload: CommentPayload }
    }

export type WorkflowPayloadEdgeData = {
  kind: WorkflowEdgeKind | null
  fromClassId: number | null
  toClassId: number | null
  branch: WorkflowEdgeBranch
  priority: number | null
}

export type WorkflowCanvasEdgeData = WorkflowPayloadEdgeData & {
  executionMode?: WorkflowExecutionMode | null
}

export type WorkflowPayloadEdge = {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  data: WorkflowPayloadEdgeData
}

export type WorkflowPayload = {
  nodes: WorkflowPayloadNode[]
  edges: WorkflowPayloadEdge[]
}

export type WorkflowPayloadIssue = {
  edgeId: string
  message: string
}

export class WorkflowPayloadError extends Error {
  readonly issues: WorkflowPayloadIssue[]

  constructor(issues: WorkflowPayloadIssue[]) {
    super(issues.map((issue) => `Edge ${issue.edgeId}: ${issue.message}`).join(' | '))
    this.name = 'WorkflowPayloadError'
    this.issues = issues
  }
}

type CourseNodeIndex = Map<string, Set<number>>
type EdgeStructure = 'start-course' | 'course-condition' | 'condition-course'

const PAYLOAD_NODE_TYPES = new Set<WorkflowPayloadNodeType>(['start', 'course', 'condition', 'comment'])

export function parseHandleClassId(handle?: string | null) {
  if (!handle) return null
  const parts = String(handle).split(':')
  if (parts.length < 2) return null
  const id = Number(parts[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

function toText(value: unknown) {
  if (value === undefined || value === null) return ''
  return String(value)
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toPositiveInteger(value: unknown) {
  const n = toNullableNumber(value)
  return n !== null && Number.isInteger(n) && n > 0 ? n : null
}

function normalizeExecutionMode(value: unknown): WorkflowExecutionMode | null {
  return value === 'recurring' ? 'recurring' : value === 'once' ? 'once' : null
}

function normalizeConditionEvolutionMode(value: unknown): ConditionPayload['evolutionMode'] {
  if (value === 'specific' || value === 'range' || value === 'classEnd' || value === 'none') return value
  return 'none'
}

function normalizeBalanceStrategy(value: unknown): ('occupancy' | 'gender')[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is 'occupancy' | 'gender' => item === 'occupancy' || item === 'gender').sort()
}

function normalizeContractStatus(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) =>
      String(item || '')
        .trim()
        .toUpperCase()
    )
    .filter(Boolean)
    .sort()
}

function normalizeEdgeKind(value: unknown): WorkflowEdgeKind | null {
  return value === 'next' || value === 'ok' || value === 'nok' ? value : null
}

function normalizeEdgeBranch(value: unknown): WorkflowEdgeBranch {
  return value === 'ok' || value === 'nok' ? value : null
}

function compareClasses(a: CanonicalCourseClass, b: CanonicalCourseClass) {
  return a.id - b.id || a.identifier.localeCompare(b.identifier) || a.name.localeCompare(b.name)
}

function compareNodes(a: WorkflowPayloadNode, b: WorkflowPayloadNode) {
  const rank = (type: WorkflowPayloadNodeType) => {
    if (type === 'start') return 0
    if (type === 'course') return 1
    if (type === 'condition') return 2
    if (type === 'comment') return 3
    return 4
  }
  const typeDiff = rank(a.type) - rank(b.type)
  if (typeDiff !== 0) return typeDiff
  if (a.type === 'course' && b.type === 'course') {
    return toFiniteNumber(a.data.payload.courseId) - toFiniteNumber(b.data.payload.courseId) || a.id.localeCompare(b.id)
  }
  return a.id.localeCompare(b.id)
}

function compareEdges(a: WorkflowPayloadEdge, b: WorkflowPayloadEdge) {
  return (
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) ||
    a.sourceHandle.localeCompare(b.sourceHandle) ||
    a.targetHandle.localeCompare(b.targetHandle) ||
    a.id.localeCompare(b.id)
  )
}

function sanitizeStartPayload(payload?: Record<string, any> | null): CanonicalStartPayload {
  return {
    executionMode: normalizeExecutionMode(payload?.executionMode) ?? 'once',
    startDate: toText(payload?.startDate),
    endDate: toText(payload?.endDate),
    runDailyAt: toText(payload?.runDailyAt),
    runIntervalMinutes: toNullableNumber(payload?.runIntervalMinutes)
  }
}

function sanitizeCoursePayload(payload?: Record<string, any> | null): CanonicalCoursePayload {
  const classes = Array.isArray(payload?.classes)
    ? payload.classes
        .map((cls: Record<string, any>) => {
          const id = toPositiveInteger(cls?.id)
          if (id === null) return null
          return {
            id,
            identifier: toText(cls?.identifier),
            name: toText(cls?.name)
          }
        })
        .filter((item): item is CanonicalCourseClass => item !== null)
        .sort(compareClasses)
    : []

  return {
    courseId: toFiniteNumber(payload?.courseId),
    courseName: toText(payload?.courseName),
    classes
  }
}

function sanitizeConditionPayload(payload?: Record<string, any> | null): CanonicalConditionPayload {
  return {
    startDate: toText(payload?.startDate),
    endDate: toText(payload?.endDate),
    evolveAt: toText(payload?.evolveAt),
    evolutionMode: normalizeConditionEvolutionMode(payload?.evolutionMode),
    minAttendance: toFiniteNumber(payload?.minAttendance),
    minExamGrade: toFiniteNumber(payload?.minExamGrade),
    mustCompleteLessons: !!payload?.mustCompleteLessons,
    countJustifiedAbsences: !!payload?.countJustifiedAbsences,
    checkContract: !!payload?.checkContract,
    contractStatus: normalizeContractStatus(payload?.contractStatus),
    checkContractDuration: !!(payload?.checkContractDuration ?? payload?.checkContractTime),
    contractDurationMonths: toNullableNumber(payload?.contractDurationMonths ?? payload?.contractTime),
    classInsertStatus: toText(payload?.classInsertStatus),
    classExitStatus: toText(payload?.classExitStatus),
    classCheckStatus: toText(payload?.classCheckStatus),
    hasMinGrade: !!payload?.hasMinGrade,
    hasAttendance: !!payload?.hasAttendance,
    useClassEndDate: !!payload?.useClassEndDate,
    keepSameDayOfWeek: !!payload?.keepSameDayOfWeek,
    isBalanced: !!payload?.isBalanced,
    balanceStrategy: normalizeBalanceStrategy(payload?.balanceStrategy),
    manualEvolution: !!payload?.manualEvolution
  }
}

function sanitizeCommentPayload(payload?: Record<string, any> | null): CommentPayload {
  return {
    text: toText(payload?.text)
  }
}

function sanitizePosition(position?: { x?: number; y?: number } | null) {
  return {
    x: toFiniteNumber(position?.x),
    y: toFiniteNumber(position?.y)
  }
}

function buildCourseNodeIndex(nodes: WorkflowPayloadNode[]): CourseNodeIndex {
  const map: CourseNodeIndex = new Map()
  for (const node of nodes) {
    if (node.type !== 'course') continue
    map.set(node.id, new Set(node.data.payload.classes.map((cls) => cls.id)))
  }
  return map
}

function getEdgeStructure(sourceType?: string | null, targetType?: string | null): EdgeStructure | null {
  if (sourceType === 'start' && targetType === 'course') return 'start-course'
  if (sourceType === 'course' && targetType === 'condition') return 'course-condition'
  if (sourceType === 'condition' && targetType === 'course') return 'condition-course'
  return null
}

function inferBranchFromSourceHandle(handle?: string | null): WorkflowEdgeBranch {
  if (handle === 'if-ok') return 'ok'
  if (handle === 'if-nok') return 'nok'
  return null
}

function inferKindFromHandles(sourceHandle?: string | null, targetHandle?: string | null): WorkflowEdgeKind | null {
  if (sourceHandle === 'if-ok') return 'ok'
  if (sourceHandle === 'if-nok') return 'nok'
  if (sourceHandle === 'start-out' && String(targetHandle || '').startsWith('class-in:')) return 'next'
  if (String(sourceHandle || '').startsWith('class-out:') && targetHandle === 'if-in') return 'next'
  return null
}

function buildConditionOutcome(
  explicitKind: WorkflowEdgeKind | null,
  explicitBranch: WorkflowEdgeBranch,
  sourceHandle?: string | null
) {
  const branch = explicitBranch ?? inferBranchFromSourceHandle(sourceHandle)
  const kind = explicitKind === 'ok' || explicitKind === 'nok' ? explicitKind : branch
  const canonicalBranch = branch ?? (kind === 'ok' || kind === 'nok' ? kind : null)
  const priority = canonicalBranch === 'ok' ? 1 : canonicalBranch === 'nok' ? 2 : null
  return {
    kind: kind ?? null,
    branch: canonicalBranch,
    priority
  }
}

function buildPayloadEdgeData(edge: WorkflowGraphEdge, structure: EdgeStructure | null): WorkflowPayloadEdgeData {
  const sourceHandle = String(edge.sourceHandle || '')
  const targetHandle = String(edge.targetHandle || '')
  const explicitKind = normalizeEdgeKind(edge.data?.kind)
  const explicitBranch = normalizeEdgeBranch(edge.data?.branch)
  const explicitFromClassId = toPositiveInteger(edge.data?.fromClassId)
  const explicitToClassId = toPositiveInteger(edge.data?.toClassId)
  const handleFromClassId = parseHandleClassId(sourceHandle)
  const handleToClassId = parseHandleClassId(targetHandle)

  if (structure === 'start-course') {
    return {
      kind: 'next',
      fromClassId: null,
      toClassId: explicitToClassId ?? handleToClassId,
      branch: null,
      priority: null
    }
  }

  if (structure === 'course-condition') {
    return {
      kind: 'next',
      fromClassId: explicitFromClassId ?? handleFromClassId,
      toClassId: null,
      branch: null,
      priority: null
    }
  }

  if (structure === 'condition-course') {
    const condition = buildConditionOutcome(explicitKind, explicitBranch, sourceHandle)
    return {
      kind: condition.kind,
      fromClassId: null,
      toClassId: explicitToClassId ?? handleToClassId,
      branch: condition.branch,
      priority: condition.priority
    }
  }

  const inferredKind = explicitKind ?? inferKindFromHandles(sourceHandle, targetHandle)
  const inferredBranch = explicitBranch ?? inferBranchFromSourceHandle(sourceHandle)
  const branch = inferredBranch ?? (inferredKind === 'ok' || inferredKind === 'nok' ? inferredKind : null)
  return {
    kind: inferredKind,
    fromClassId: explicitFromClassId ?? handleFromClassId,
    toClassId: explicitToClassId ?? handleToClassId,
    branch,
    priority: branch === 'ok' ? 1 : branch === 'nok' ? 2 : null
  }
}

function buildPayloadNode(node: WorkflowGraphNode): WorkflowPayloadNode | null {
  if (!PAYLOAD_NODE_TYPES.has(node.type as WorkflowPayloadNodeType)) return null

  if (node.type === 'start') {
    return {
      id: String(node.id),
      type: 'start',
      position: sanitizePosition(node.position),
      data: { payload: sanitizeStartPayload(node.data?.payload) }
    }
  }

  if (node.type === 'course') {
    return {
      id: String(node.id),
      type: 'course',
      position: sanitizePosition(node.position),
      data: { payload: sanitizeCoursePayload(node.data?.payload) }
    }
  }

  if (node.type === 'condition') {
    return {
      id: String(node.id),
      type: 'condition',
      position: sanitizePosition(node.position),
      data: { payload: sanitizeConditionPayload(node.data?.payload) }
    }
  }

  return {
    id: String(node.id),
    type: 'comment',
    position: sanitizePosition(node.position),
    data: { payload: sanitizeCommentPayload(node.data?.payload) }
  }
}

export function buildEdgeDataFromConnection(
  connection: Pick<WorkflowGraphEdge, 'sourceHandle' | 'targetHandle'>,
  executionMode: WorkflowExecutionMode | null
): WorkflowCanvasEdgeData {
  const sourceHandle = String(connection.sourceHandle || '')
  const targetHandle = String(connection.targetHandle || '')

  if (sourceHandle === 'start-out' && targetHandle.startsWith('class-in:')) {
    return {
      kind: 'next',
      fromClassId: null,
      toClassId: parseHandleClassId(targetHandle),
      branch: null,
      priority: null,
      executionMode
    }
  }

  if (sourceHandle.startsWith('class-out:') && targetHandle === 'if-in') {
    return {
      kind: 'next',
      fromClassId: parseHandleClassId(sourceHandle),
      toClassId: null,
      branch: null,
      priority: null,
      executionMode
    }
  }

  if (sourceHandle === 'if-ok' && targetHandle.startsWith('class-in:')) {
    return {
      kind: 'ok',
      fromClassId: null,
      toClassId: parseHandleClassId(targetHandle),
      branch: 'ok',
      priority: 1,
      executionMode
    }
  }

  if (sourceHandle === 'if-nok' && targetHandle.startsWith('class-in:')) {
    return {
      kind: 'nok',
      fromClassId: null,
      toClassId: parseHandleClassId(targetHandle),
      branch: 'nok',
      priority: 2,
      executionMode
    }
  }

  return {
    kind: inferKindFromHandles(sourceHandle, targetHandle),
    fromClassId: parseHandleClassId(sourceHandle),
    toClassId: parseHandleClassId(targetHandle),
    branch: inferBranchFromSourceHandle(sourceHandle),
    priority: sourceHandle === 'if-ok' ? 1 : sourceHandle === 'if-nok' ? 2 : null,
    executionMode
  }
}

export function buildWorkflowPayload(graph: WorkflowGraphInput): WorkflowPayload {
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : []

  const nodes = rawNodes.map(buildPayloadNode).filter((node): node is WorkflowPayloadNode => node !== null).sort(compareNodes)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const edges = rawEdges
    .map((edge) => {
      const id = String(edge.id || `${edge.source || 'source'}::${edge.target || 'target'}`)
      const source = String(edge.source || '')
      const target = String(edge.target || '')
      const sourceHandle = String(edge.sourceHandle || '')
      const targetHandle = String(edge.targetHandle || '')
      const structure = getEdgeStructure(nodeById.get(source)?.type, nodeById.get(target)?.type)
      return {
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        data: buildPayloadEdgeData(
          {
            ...edge,
            id,
            source,
            target,
            sourceHandle,
            targetHandle
          },
          structure
        )
      }
    })
    .sort(compareEdges)

  return { nodes, edges }
}

export function validateWorkflowPayload(payload: WorkflowPayload): WorkflowPayloadIssue[] {
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : []
  const edges = Array.isArray(payload.edges) ? payload.edges : []
  const issues: WorkflowPayloadIssue[] = []
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const courseNodeIndex = buildCourseNodeIndex(nodes)
  const duplicateKeys = new Set<string>()

  for (const edge of edges) {
    const edgeId = String(edge.id || `${edge.source || 'source'}::${edge.target || 'target'}`)
    const sourceNode = nodeById.get(String(edge.source || ''))
    const targetNode = nodeById.get(String(edge.target || ''))

    if (!sourceNode || !targetNode) {
      issues.push({
        edgeId,
        message: 'referencia um node inexistente ou nao suportado.'
      })
      continue
    }

    const structure = getEdgeStructure(sourceNode.type, targetNode.type)
    if (!structure) {
      issues.push({
        edgeId,
        message: 'possui combinacao invalida de source/target.'
      })
      continue
    }

    const data = edge.data || {
      kind: null,
      fromClassId: null,
      toClassId: null,
      branch: null,
      priority: null
    }
    const fromClassId = toPositiveInteger(data.fromClassId)
    const toClassId = toPositiveInteger(data.toClassId)
    const branch = normalizeEdgeBranch(data.branch)
    const kind = normalizeEdgeKind(data.kind)

    if (structure === 'start-course') {
      if (kind !== 'next') {
        issues.push({
          edgeId,
          message: 'start->course deve informar data.kind="next".'
        })
      }
      if (toClassId === null) {
        issues.push({
          edgeId,
          message: 'start->course deve informar data.toClassId numerico > 0.'
        })
      } else if (!courseNodeIndex.get(targetNode.id)?.has(toClassId)) {
        issues.push({
          edgeId,
          message: `data.toClassId=${toClassId} nao existe na turma de destino.`
        })
      }
    }

    if (structure === 'course-condition') {
      if (kind !== 'next') {
        issues.push({
          edgeId,
          message: 'course->condition deve informar data.kind="next".'
        })
      }
      if (fromClassId === null) {
        issues.push({
          edgeId,
          message: 'course->condition deve informar data.fromClassId numerico > 0.'
        })
      } else if (!courseNodeIndex.get(sourceNode.id)?.has(fromClassId)) {
        issues.push({
          edgeId,
          message: `data.fromClassId=${fromClassId} nao existe na turma de origem.`
        })
      }
    }

    if (structure === 'condition-course') {
      if (kind !== 'ok' && kind !== 'nok') {
        issues.push({
          edgeId,
          message: 'condition->course deve informar data.kind="ok" ou "nok".'
        })
      }
      if (branch === null) {
        issues.push({
          edgeId,
          message: 'condition->course deve informar data.branch="ok" ou "nok".'
        })
      } else {
        const expectedPriority = branch === 'ok' ? 1 : 2
        if (kind !== null && kind !== branch) {
          issues.push({
            edgeId,
            message: 'condition->course deve manter data.kind consistente com data.branch.'
          })
        }
        if (data.priority !== expectedPriority) {
          issues.push({
            edgeId,
            message: `condition->course deve informar data.priority=${expectedPriority}.`
          })
        }
      }
      if (toClassId === null) {
        issues.push({
          edgeId,
          message: 'condition->course deve informar data.toClassId numerico > 0.'
        })
      } else if (!courseNodeIndex.get(targetNode.id)?.has(toClassId)) {
        issues.push({
          edgeId,
          message: `data.toClassId=${toClassId} nao existe na turma de destino.`
        })
      }
    }

    const duplicateKey = [edge.source, edge.target, fromClassId ?? '', toClassId ?? '', branch ?? ''].join('|')
    if (duplicateKeys.has(duplicateKey)) {
      issues.push({
        edgeId,
        message: 'edge duplicada com mesmo source, target, fromClassId, toClassId e branch.'
      })
    } else {
      duplicateKeys.add(duplicateKey)
    }
  }

  return issues
}
