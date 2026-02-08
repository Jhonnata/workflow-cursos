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
      tone?: 'course' | 'next' | 'ok' | 'nok' | 'neutral'
      topPx?: number
      top?: string
      protrude?: boolean
    }>(),
    {
      tone: 'neutral',
      topPx: undefined,
      protrude: true,
    },
)

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
  const sideNudge = props.protrude ? 0 : 0
  const topValue =
      typeof props.top === 'string'
          ? props.top
          : typeof props.topPx === 'number'
              ? `${props.topPx}px`
              : undefined

  return {
    borderColor: '#CB1B45',
    background: '#CB1B45',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)',
    top: topValue,
    transform: topValue ? 'translateY(-50%)' : undefined,
    left: isLeft ? `-${sideNudge}px` : undefined,
    right: isRight ? `-${sideNudge}px` : undefined,
    borderRadius: '2px',
  }
})
</script>

<template>
  <Handle
      :id="id"
      :type="type"
      :position="position"
      :connectable="active"
      :title="active ? title : `${title} (ative modo conectar)`"
      class="!h-[16px] !w-[8px] !border-none"
      :class="active ? '!cursor-crosshair' : '!cursor-not-allowed !opacity-40'"
      :style="handleStyle"
  />
</template>
