<script setup lang="ts">
import { computed } from 'vue'
import { getSmoothStepPath, type EdgeProps, useVueFlow, EdgeLabelRenderer } from '@vue-flow/core'

const props = defineProps<EdgeProps>()
const { removeEdges } = useVueFlow()

const label = computed(() => {
  if (props.sourceHandle === 'if-ok') return 'Sim'
  if (props.sourceHandle === 'if-nok') return 'Não'
  return null
})

const labelColor = computed(() => {
  if (props.sourceHandle === 'if-ok') return '#059669'
  if (props.sourceHandle === 'if-nok') return '#e11d48'
  return '#666'
})

const edgePath = computed(() => {
  const [path] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 18,
  })

  return path
})

const isDashed = computed(() => {
  const style = props.style as Record<string, unknown> | undefined
  return props.data?.executionMode === 'recurring' || !!style?.strokeDasharray
})

function handleClick(event: MouseEvent) {
  event.stopPropagation()
  removeEdges(props.id)
}
</script>

<template>
  <g>
    <path
      :d="edgePath"
      fill="none"
      :style="props.style"
      :class="isDashed ? 'edge-dashed' : ''"
      :marker-end="props.markerEnd"
    />
    <path
      :d="edgePath"
      fill="none"
      stroke="transparent"
      stroke-width="18"
      @click="handleClick"
    />

    <EdgeLabelRenderer v-if="label">
      <div
        :style="{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${props.labelX}px,${props.labelY}px)`,
          pointerEvents: 'all',
        }"
        class="nodrag nopan"
      >
        <div
          class="rounded-md border bg-white px-2 py-0.5 text-[10px] font-bold shadow-sm"
          :style="{
            color: labelColor,
            borderColor: labelColor,
          }"
        >
          {{ label }}
        </div>
      </div>
    </EdgeLabelRenderer>
  </g>
</template>

<style>
@keyframes edgeDash {
  to {
    stroke-dashoffset: -12;
  }
}

.edge-dashed {
  animation: edgeDash 0.9s linear infinite;
}
</style>
