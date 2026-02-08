<script setup lang="ts">
import { Position, type NodeProps } from '@vue-flow/core'
import { Trash2, Scale } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import PortDotHandle from '@/components/vue-flow/port-dot-handle.vue'
import ConditionIcon from '@/assets/images/icon_Condition.png'
import { classInsertStatusLabel, contractStatusLabel, portColor, type ConditionNodeData } from '@/lib/workflow'

defineProps<NodeProps<ConditionNodeData>>()

const HEADER_H = 56
</script>

<template>
  <div class="rounded-xl shadow-md" :class="selected ? 'ring-2 ring-blue-500' : ''">
    <div
      class="relative w-[280px] rounded-xl border border-slate-200 bg-white"
      @dblclick.stop="data.onToggleDetails?.(data.nodeId)"
    >
      <PortDotHandle
        id="if-in"
        type="target"
        :position="Position.Left"
        title="Entrada IF"
        :active="!!data.connectMode"
        tone="neutral"
        top="50%"
      />
      <PortDotHandle
        id="if-ok"
        type="source"
        :position="Position.Right"
        title="Saida OK"
        :active="!!data.connectMode"
        tone="ok"
        top="calc(50% - 10px)"
      />
      <PortDotHandle
        id="if-nok"
        type="source"
        :position="Position.Right"
        title="Saida NOK"
        :active="!!data.connectMode"
        tone="nok"
        top="calc(50% + 10px)"
      />

      <div class="flex items-center justify-between px-3 py-2 cursor-grab" :style="{ height: `${HEADER_H}px` }">
        <div class="min-w-0 flex items-center gap-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg border bg-slate-50">
            <img :src="ConditionIcon" alt="Condicao" class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">Condicao</div>
            <div class="text-[11px] text-muted-foreground">IF</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
          >
            IF
          </span>
          <Button size="icon" variant="ghost" class="h-8 w-8" @click.stop="data.onRemove?.(data.nodeId)">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div v-if="data.showDetails" class="border-t px-3 py-2 text-[11px] text-muted-foreground">
        <div v-if="data.payload.hasAttendance" class="mb-1">
          Freq >= {{ data.payload.minAttendance }}% {{ data.payload.mustCompleteLessons ? '(Todas as aulas)' : '' }}
        </div>
        <div v-if="data.payload.hasMinGrade" class="mb-1">
          Média >= {{ data.payload.minExamGrade }}
        </div>
        <div v-if="data.payload.checkContract" class="mb-1">
          Contrato: {{
            data.payload.contractStatus?.length > 0
              ? data.payload.contractStatus.map((s) => contractStatusLabel(s)).join(', ')
              : 'Nao definido'
          }}
        </div>
        <div v-if="data.payload.keepSameDayOfWeek" class="mb-1">
          Manter dia da semana
        </div>
        <div v-if="(data.payload.evolutionMode === 'specific' || (!data.payload.evolutionMode && data.payload.evolveAt)) && data.payload.evolveAt" class="mb-1">
          Evoluir em: {{ data.payload.evolveAt }}
        </div>
        <div
          v-else-if="(data.payload.evolutionMode === 'range' || (!data.payload.evolutionMode && (data.payload.startDate || data.payload.endDate))) && (data.payload.startDate || data.payload.endDate)"
          class="mb-1"
        >
          Período: {{ data.payload.startDate || '__/__/____' }} -> {{ data.payload.endDate || '__/__/____' }}
        </div>
        <div
          v-else-if="data.payload.evolutionMode === 'classEnd' || data.payload.useClassEndDate"
          class="mb-1"
        >
          Evolução: Término da turma (endedAt)
        </div>
        <div v-if="data.payload.classCheckStatus" class="mb-1">
          Checar status: {{ classInsertStatusLabel(data.payload.classCheckStatus) }}
        </div>
        <div v-if="data.payload.classExitStatus" class="mb-1">
          Status na turma atual: {{ classInsertStatusLabel(data.payload.classExitStatus) }}
        </div>
        <div v-if="data.payload.classInsertStatus" class="mb-1">
          Status na turma destino: {{ classInsertStatusLabel(data.payload.classInsertStatus) }}
        </div>
        <div v-if="!data.payload.hasAttendance && !data.payload.hasMinGrade && !data.payload.checkContract && !data.payload.classInsertStatus && !data.payload.classExitStatus && !data.payload.classCheckStatus && !data.payload.keepSameDayOfWeek && (data.payload.evolutionMode === 'none' || !data.payload.evolutionMode) && !data.payload.useClassEndDate && !data.payload.evolveAt && !data.payload.startDate && !data.payload.endDate && !data.payload.isBalanced">
          Nenhuma condição configurada.
        </div>
        <div v-if="data.payload.isBalanced" class="mt-2 flex flex-col gap-1 text-blue-600 font-medium bg-blue-50/50 p-1.5 rounded-lg border border-blue-100">
          <div class="flex items-center gap-1.5">
            <Scale class="h-3 w-3" />
            <span>Balanceamento ativo</span>
          </div>
          <div class="text-[9px] opacity-80 ml-4.5">
            Critério: {{ 
              data.payload.balanceStrategy?.length > 0 ? 
              data.payload.balanceStrategy.map(s => s === 'gender' ? 'Equilíbrio de Gênero' : 'Menor Ocupação').join(' + ') : 
              'Menor Ocupação' 
            }}
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]" :class="portColor('ok')">
            Sim (OK)
          </span>
          <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]" :class="portColor('nok')">
            Não (NOK)
          </span>
        </div>
      </div>
    </div>
  </div>
</template>


