<script setup lang="ts">
import { Position, type NodeProps } from '@vue-flow/core'
import { Play, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import PortDotHandle from '@/components/vue-flow/port-dot-handle.vue'
import type { StartNodeData } from '@/lib/workflow'

defineProps<NodeProps<StartNodeData>>()
</script>

<template>
  <div
    class="relative rounded-2xl shadow-md transition-all duration-150"
    :class="selected ? 'z-40 ring-2 ring-emerald-500' : 'z-10 hover:z-30 hover:-translate-y-0.5 hover:shadow-xl'"
  >
    <div class="relative w-[220px] rounded-2xl border border-emerald-200 bg-emerald-50/60">
      <PortDotHandle
        id="start-out"
        type="source"
        :position="Position.Right"
        title="Saida inicio"
        :active="!!data.connectMode"
        tone="ok"
        top="50%"
      />

      <div class="flex items-center justify-between px-3 py-2 cursor-grab">
        <div class="min-w-0 flex items-center gap-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white">
            <Play class="h-4 w-4 text-emerald-600" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-emerald-900 truncate">Inicio</div>
            <div class="text-[11px] text-emerald-700">Start</div>
          </div>
        </div>

        <Button size="icon" variant="ghost" class="h-8 w-8" @click.stop="data.onRemove?.(data.nodeId)">
          <Trash2 class="h-4 w-4 text-emerald-700" />
        </Button>
      </div>
    </div>
  </div>
</template>
