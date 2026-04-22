<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import { FileText, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { CommentNodeData } from '@/lib/workflow'

defineProps<NodeProps<CommentNodeData>>()
</script>

<template>
  <div
    class="relative transition-all duration-150"
    :class="selected ? 'z-40 rounded-2xl shadow-2xl ring-2 ring-amber-400' : 'z-10 hover:z-30 hover:-translate-y-0.5'"
  >
    <div
      v-if="selected"
      class="w-[280px] rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-100 via-amber-50 to-white"
    >
      <div class="flex cursor-grab items-start justify-between gap-3 border-b border-amber-200/80 px-4 py-3">
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white/80"
          >
            <FileText class="h-4 w-4 text-amber-700" />
          </div>
          <div class="min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Comentário</div>
            <div class="text-sm font-semibold leading-tight text-amber-950">Anotação livre</div>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          class="h-8 w-8 shrink-0 text-amber-900/70 hover:bg-red-500 hover:text-white"
          @click.stop="data.onRemove?.(data.nodeId)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>

      <div class="px-4 py-3">
        <div
          class="max-h-[220px] min-h-[108px] overflow-auto whitespace-pre-wrap break-words pr-1 text-[13px] leading-5 text-amber-950"
        >
          {{
            data.payload?.text?.trim() ||
            'Selecione este comentário para escrever lógicas, observações e anotações do workflow.'
          }}
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex h-14 w-14 cursor-grab items-center justify-center rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-100 via-amber-50 to-white shadow-lg transition-all duration-150 hover:shadow-xl"
      title="Comentário"
    >
      <FileText class="h-5 w-5 text-amber-700" />
    </div>
  </div>
</template>
