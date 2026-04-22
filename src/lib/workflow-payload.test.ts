import { describe, expect, it } from 'vitest'
import { buildWorkflowPayload, validateWorkflowPayload } from './workflow-payload'

function startNode() {
  return {
    id: 'start',
    type: 'start',
    position: { x: 10, y: 20 },
    data: {
      payload: {
        executionMode: 'once',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        runDailyAt: '08:00',
        runIntervalMinutes: null
      }
    }
  }
}

function courseNode(id: string, courseId: number, courseName: string, classIds: number[]) {
  return {
    id,
    type: 'course',
    position: { x: courseId * 100, y: courseId * 20 },
    data: {
      payload: {
        courseId,
        courseName,
        classes: classIds.map((classId, index) => ({
          id: classId,
          identifier: `T-${classId}`,
          name: `${courseName}-${index + 1}`,
          stats: { total: 99 }
        }))
      }
    }
  }
}

function conditionNode(id: string) {
  return {
    id,
    type: 'condition',
    position: { x: 300, y: 180 },
    data: {
      payload: {
        startDate: '',
        endDate: '',
        evolveAt: '2026-03-15',
        evolutionMode: 'specific',
        minAttendance: 85,
        minExamGrade: 7,
        mustCompleteLessons: true,
        countJustifiedAbsences: false,
        checkContract: true,
        contractStatus: ['EA'],
        checkContractDuration: true,
        contractDurationMonths: 12,
        classInsertStatus: 'inProgress',
        classExitStatus: 'conclude',
        classCheckStatus: 'inProgress',
        hasMinGrade: true,
        hasAttendance: true,
        useClassEndDate: false,
        keepSameDayOfWeek: false,
        isBalanced: false,
        balanceStrategy: ['occupancy'],
        manualEvolution: false
      }
    }
  }
}

function edge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  data?: Record<string, unknown>
) {
  return {
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    ...(data ? { data } : {})
  }
}

function buildValidPayload(graph: { nodes: any[]; edges: any[] }) {
  const payload = buildWorkflowPayload(graph)
  expect(validateWorkflowPayload(payload)).toEqual([])
  return payload
}

describe('workflow payload', () => {
  it('builds an explicit 175 -> condition -> 245 flow', () => {
    const payload = buildValidPayload({
      nodes: [
        startNode(),
        courseNode('course:1', 1, 'Origem', [175]),
        conditionNode('cond:1'),
        courseNode('course:2', 2, 'Destino', [245])
      ],
      edges: [
        edge('e-start', 'start', 'start-out', 'course:1', 'class-in:175'),
        edge('e-from', 'course:1', 'class-out:175', 'cond:1', 'if-in'),
        edge('e-to', 'cond:1', 'if-ok', 'course:2', 'class-in:245')
      ]
    })

    expect(payload.edges.find((item) => item.id === 'e-from')?.data).toEqual({
      kind: 'next',
      fromClassId: 175,
      toClassId: null,
      branch: null,
      priority: null
    })
    expect(payload.edges.find((item) => item.id === 'e-to')?.data).toEqual({
      kind: 'ok',
      fromClassId: null,
      toClassId: 245,
      branch: 'ok',
      priority: 1
    })
  })

  it('preserves multiple origins 241/242/243 -> condition -> 245', () => {
    const payload = buildValidPayload({
      nodes: [
        startNode(),
        courseNode('course:1', 1, 'Origem', [241, 242, 243]),
        conditionNode('cond:1'),
        courseNode('course:2', 2, 'Destino', [245])
      ],
      edges: [
        edge('e-start', 'start', 'start-out', 'course:1', 'class-in:241'),
        edge('e-241', 'course:1', 'class-out:241', 'cond:1', 'if-in'),
        edge('e-242', 'course:1', 'class-out:242', 'cond:1', 'if-in'),
        edge('e-243', 'course:1', 'class-out:243', 'cond:1', 'if-in'),
        edge('e-ok', 'cond:1', 'if-ok', 'course:2', 'class-in:245')
      ]
    })

    expect(payload.edges.find((item) => item.id === 'e-241')?.data.fromClassId).toBe(241)
    expect(payload.edges.find((item) => item.id === 'e-242')?.data.fromClassId).toBe(242)
    expect(payload.edges.find((item) => item.id === 'e-243')?.data.fromClassId).toBe(243)
    expect(payload.edges.find((item) => item.id === 'e-ok')?.data.toClassId).toBe(245)
  })

  it('reports invalid course->condition edge without fromClassId', () => {
    const payload = buildWorkflowPayload({
      nodes: [courseNode('course:1', 1, 'Origem', [175]), conditionNode('cond:1')],
      edges: [edge('e-invalid', 'course:1', 'class-out', 'cond:1', 'if-in')]
    })

    expect(validateWorkflowPayload(payload)).toContainEqual({
      edgeId: 'e-invalid',
      message: 'course->condition deve informar data.fromClassId numerico > 0.'
    })
  })

  it('reports invalid condition->course edge without toClassId', () => {
    const payload = buildWorkflowPayload({
      nodes: [conditionNode('cond:1'), courseNode('course:2', 2, 'Destino', [245])],
      edges: [edge('e-invalid', 'cond:1', 'if-ok', 'course:2', 'class-in')]
    })

    expect(validateWorkflowPayload(payload)).toContainEqual({
      edgeId: 'e-invalid',
      message: 'condition->course deve informar data.toClassId numerico > 0.'
    })
  })

  it('reports condition->course edge with missing branch', () => {
    const payload = buildWorkflowPayload({
      nodes: [conditionNode('cond:1'), courseNode('course:2', 2, 'Destino', [245])],
      edges: [edge('e-invalid', 'cond:1', 'if-out', 'course:2', 'class-in:245', { toClassId: 245 })]
    })

    expect(validateWorkflowPayload(payload)).toContainEqual({
      edgeId: 'e-invalid',
      message: 'condition->course deve informar data.branch="ok" ou "nok".'
    })
  })

  it('builds payload without graph field', () => {
    const payload = buildValidPayload({
      nodes: [startNode(), courseNode('course:1', 1, 'Origem', [175])],
      edges: [edge('e-start', 'start', 'start-out', 'course:1', 'class-in:175')]
    })

    expect(payload).not.toHaveProperty('graph')
    expect(Object.keys(payload).sort()).toEqual(['edges', 'nodes'])
  })

  it('reports duplicated edges with same source, target, fromClassId, toClassId and branch', () => {
    const payload = buildWorkflowPayload({
      nodes: [
        startNode(),
        courseNode('course:1', 1, 'Origem', [175]),
        conditionNode('cond:1'),
        courseNode('course:2', 2, 'Destino', [245])
      ],
      edges: [
        edge('e-from-1', 'course:1', 'class-out:175', 'cond:1', 'if-in'),
        edge('e-from-2', 'course:1', 'class-out:175', 'cond:1', 'if-in'),
        edge('e-to', 'cond:1', 'if-ok', 'course:2', 'class-in:245')
      ]
    })

    expect(validateWorkflowPayload(payload)).toContainEqual({
      edgeId: 'e-from-2',
      message: 'edge duplicada com mesmo source, target, fromClassId, toClassId e branch.'
    })
  })
})

