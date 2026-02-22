<script setup lang="ts">
import {computed} from 'vue'
import {Handle, type HandleType, Position} from '@vue-flow/core'

const props = withDefaults(
    defineProps<{
      id: string
      type: HandleType
      position: Position
      title: string
      active: boolean
      size?: number
      hint?: string
      tone?: 'course' | 'next' | 'ok' | 'nok' | 'neutral'
      topPx?: number
      top?: string
      protrude?: boolean
    }>(),
    {
      size: 16,
      tone: 'neutral',
      topPx: undefined,
      protrude: true,
    },
)
const emit = defineEmits<{
  (event: 'handle-click'): void
}>()

const toneBorder = computed(() => {
  if (props.tone === 'course' || props.tone === 'next') return '#93c5fd'
  if (props.tone === 'ok') return '#86efac'
  if (props.tone === 'nok') return '#fda4af'
  return '#cbd5e1'
})

const innerDot = computed(() => {
  if (props.tone === 'course' || props.tone === 'next') return 'rgba(37, 99, 235, 0.85)'
  if (props.tone === 'ok') return 'rgba(5, 150, 105, 0.85)'
  if (props.tone === 'nok') return 'rgba(225, 29, 72, 0.85)'
  return 'rgba(100, 116, 139, 0.75)'
})

const handleStyle = computed(() => {
  const isLeft = props.position === Position.Left
  const isRight = props.position === Position.Right
  const size = Number(props.size) > 0 ? Number(props.size) : 16
  const sideNudge = props.protrude ? Math.floor(size / 2) : 0
  const topValue =
      typeof props.top === 'string'
          ? props.top
          : typeof props.topPx === 'number'
              ? `${props.topPx}px`
              : undefined

  return {
    width: `${size}px`,
    height: `${size}px`,
    borderColor: toneBorder.value,
    borderWidth: '2px',
    borderStyle: 'solid',
    background: `radial-gradient(circle at center, ${innerDot.value} 0 3px, transparent 3.5px), #ffffff`,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)',
    top: topValue,
    transform: topValue ? 'translateY(-50%)' : undefined,
    left: isLeft ? `-${sideNudge}px` : undefined,
    right: isRight ? `-${sideNudge}px` : undefined,
    borderRadius: '9999px',
  }
})

const hintText = computed(() => {
  const base = String(props.hint || '').trim()
  if (!base) return ''
  if (props.active) return base
  return `${base} (ative modo conectar)`
})
</script>

<template>
  <Handle
      :id="id"
      :type="type"
      :position="position"
      :connectable="active"
      :title="active ? title : `${title} (ative modo conectar)`"
      :data-hint="hintText || undefined"
      :data-side="position === Position.Left ? 'left' : position === Position.Right ? 'right' : 'right'"
      :class="active ? '!cursor-crosshair' : '!cursor-not-allowed !opacity-40'"
      :style="handleStyle"
      @click.stop="emit('handle-click')"
  />
</template>

<style>
.vue-flow__handle[data-hint] {
  transition: transform 0.16s ease, box-shadow 0.2s ease;
}

.vue-flow__handle[data-hint]:hover {
  transform: translateY(-50%) scale(1.06);
  box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.12), 0 2px 8px rgba(0, 0, 0, 0.18) !important;
}

.vue-flow__handle[data-hint]:hover::after {
  content: '↔ ' attr(data-hint);
  position: absolute;
  top: 50%;
  white-space: nowrap;
  transform: translateY(-50%);
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  color: #0f172a;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 5px 8px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  pointer-events: none;
}

.vue-flow__handle[data-hint][data-side='right']:hover::after {
  left: calc(100% + 8px);
}

.vue-flow__handle[data-hint][data-side='left']:hover::after {
  right: calc(100% + 8px);
}

.vue-flow__handle.connectingfrom,
.vue-flow__handle.connectingto {
  animation: handlePulse 0.65s ease-in-out infinite;
}

@keyframes handlePulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.25), 0 1px 2px rgba(0, 0, 0, 0.12);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(37, 99, 235, 0), 0 1px 2px rgba(0, 0, 0, 0.12);
  }
}
</style>
