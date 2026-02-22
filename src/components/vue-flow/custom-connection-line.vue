<script setup>
defineProps({
  sourceX: {
    type: Number,
    required: true,
  },
  sourceY: {
    type: Number,
    required: true,
  },
  targetX: {
    type: Number,
    required: true,
  },
  targetY: {
    type: Number,
    required: true,
  },
})
</script>

<template>
  <g>
    <path
      class="vue-flow__connection animated connection-preview"
      fill="none"
      stroke="#6F3381"
      :stroke-width="2.5"
      :d="`M${sourceX},${sourceY} C ${sourceX} ${targetY} ${sourceX} ${targetY} ${targetX},${targetY}`"
    />

    <circle :cx="targetX" :cy="targetY" fill="#fff" :r="4" stroke="#6F3381" :stroke-width="1.5" />
  </g>
</template>

<style>
@keyframes previewDash {
  to {
    stroke-dashoffset: -16;
  }
}

.connection-preview {
  stroke-dasharray: 7 6;
  animation: previewDash 0.6s linear infinite;
}
</style>
