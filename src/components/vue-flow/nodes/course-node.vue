<script setup lang="ts">
import { Position, type NodeProps } from '@vue-flow/core'
import { Trash2, Users, GraduationCap, MoreVertical } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import PortDotHandle from '@/components/vue-flow/port-dot-handle.vue'
import { onlyWithContractFlag, type CourseNodeData } from '@/lib/workflow'

const props = defineProps<NodeProps<CourseNodeData>>()

function formatDayOfWeek(value?: string | null) {
  if (!value) return ''
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/[^\x00-\x7F]/.test(raw)) return raw
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '')
  const map: Record<string, string> = {
    monday: 'Segunda',
    segunda: 'Segunda',
    seg: 'Segunda',
    '1': 'Segunda',
    tuesday: 'Terca',
    terca: 'Terca',
    tercafeira: 'Terca',
    tue: 'Terca',
    '2': 'Terca',
    wednesday: 'Quarta',
    quarta: 'Quarta',
    qua: 'Quarta',
    '3': 'Quarta',
    thursday: 'Quinta',
    quinta: 'Quinta',
    qui: 'Quinta',
    '4': 'Quinta',
    friday: 'Sexta',
    sexta: 'Sexta',
    sex: 'Sexta',
    '5': 'Sexta',
    saturday: 'Sabado',
    sabado: 'Sabado',
    sab: 'Sabado',
    '6': 'Sabado',
    sunday: 'Domingo',
    domingo: 'Domingo',
    dom: 'Domingo',
    '0': 'Domingo',
    '7': 'Domingo',
  }
  return map[normalized] || raw
}

const HEADER_H = 80
const STATS_H = 56
const SECTION_HEADER_H = 40
const PAD_TOP = 12
const ROW_H = 72
const ROW_GAP = 9
const START_Y = HEADER_H + STATS_H + SECTION_HEADER_H + PAD_TOP +15
</script>

<template>
  <div
      class="rounded-3xl transition-all"
      :class="selected ? 'ring-2 ring-blue-500 shadow-2xl' : 'shadow-lg'"
  >
    <div class="relative w-[400px] rounded-3xl border border-slate-200/80 bg-white overflow-hidden">
      <!-- Connection Handles -->
      <template v-for="(cls, idx) in data.payload.classes" :key="`h:${cls.id}`">
        <PortDotHandle
            :id="`class-in:${cls.id}`"
            type="target"
            :position="Position.Left"
            :title="`Entrada turma ${cls.name}`"
            :active="!!data.connectMode"
            tone="neutral"
            :top-px="START_Y + idx * (ROW_H + ROW_GAP) + ROW_H / 2"
        />
        <PortDotHandle
            :id="`class-out:${cls.id}`"
            type="source"
            :position="Position.Right"
            :title="`Saida turma ${cls.name}`"
            :active="!!data.connectMode"
            tone="next"
            :top-px="START_Y + idx * (ROW_H + ROW_GAP) + ROW_H / 2"
        />
      </template>

      <!-- Header -->
      <div
          class="relative flex items-start gap-4 bg-gradient-to-br from-blue-500 to-indigo-600 px-5 py-4 cursor-grab"
          :style="{ minHeight: `${HEADER_H}px` }"
      >
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <GraduationCap class="h-6 w-6 text-white" />
        </div>

        <div class="min-w-0 flex-1 pt-0.5">
          <div class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
            Curso
          </div>
          <h3
              class="text-base font-semibold leading-tight text-white line-clamp-2"
              :title="data.payload.courseName"
          >
            {{ data.payload.courseName }}
          </h3>
        </div>

        <div class="flex shrink-0 items-start gap-1">
          <Button
              size="icon"
              variant="ghost"
              class="h-8 w-8 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <MoreVertical class="h-4 w-4" />
          </Button>
          <Button
              size="icon"
              variant="ghost"
              class="h-8 w-8 text-white/80 hover:bg-red-500 hover:text-white"
              @click.stop="data.onRemove?.(data.nodeId)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Stats Summary -->
      <div
          class="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-3"
          :style="{ height: `${STATS_H}px` }"
      >
        <div class="space-y-1">
          <div class="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Total de Aprendizes
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-slate-900">
              {{ (data.payload?.classes || []).reduce((sum, cls) => sum + (cls.stats?.total || 0), 0) }}
            </span>
            <span class="text-sm text-slate-500">aprendizes</span>
          </div>
        </div>

        <div class="flex items-center gap-4 text-sm">
          <div class="flex items-center gap-1.5">
            <div class="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
            <span class="font-medium text-slate-700">
              {{ (data.payload?.classes || []).reduce((sum, cls) => sum + (cls.stats?.men || 0), 0) }}
            </span>
            <span class="text-slate-500">H</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="h-2.5 w-2.5 rounded-full bg-pink-500"></div>
            <span class="font-medium text-slate-700">
              {{ (data.payload?.classes || []).reduce((sum, cls) => sum + (cls.stats?.women || 0), 0) }}
            </span>
            <span class="text-slate-500">M</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="h-2.5 w-2.5 rounded-full bg-purple-500"></div>
            <span class="font-medium text-slate-700">
              {{ (data.payload?.classes || []).reduce((sum, cls) => sum + (cls.stats?.others || 0), 0) }}
            </span>
            <span class="text-slate-500">O</span>
          </div>
        </div>
      </div>

      <!-- Section Header -->
      <div
          class="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3"
          :style="{ height: `${SECTION_HEADER_H}px` }"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-900">Turmas</span>
          <span class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-700">
            {{ (data.payload?.classes || []).length }}
          </span>
        </div>
        <div class="text-xs text-slate-500">
          {{ data.connectMode ? '🔗 Modo conectar' : '✋ Arraste para mover' }}
        </div>
      </div>

      <!-- Classes List -->
      <div class="px-4 pb-4" :style="{ paddingTop: `${PAD_TOP}px` }">
        <div class="space-y-2">
          <div
              v-for="cls in data.payload.classes"
              :key="cls.id"
              class="group relative flex items-center gap-3 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md"
              :style="{ height: `${ROW_H}px` }"
          >

            <!-- Class Info -->
            <div class="min-w-0 flex-1">
              <div class="mb-1.5 flex items-center gap-2">
                <h4 class="truncate text-sm font-semibold text-slate-900">
                  {{ cls.name }}
                </h4>
              </div>

              <div class="flex items-center gap-3 text-xs">
                <div class="flex items-center gap-1 text-slate-600">
                  <Users class="h-3.5 w-3.5" />
                  <span class="font-semibold">{{ cls.stats?.total || 0 }}</span>
                </div>

                <div v-if="cls.stats" class="flex items-center gap-2.5 border-l border-slate-200 pl-3">
                  <div class="flex items-center gap-1">
                    <div class="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span class="font-medium text-slate-700">{{ cls.stats.men }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <div class="h-2 w-2 rounded-full bg-pink-500"></div>
                    <span class="font-medium text-slate-700">{{ cls.stats.women }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <div class="h-2 w-2 rounded-full bg-purple-500"></div>
                    <span class="font-medium text-slate-700">{{ cls.stats.others }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                   <span
                       v-if="cls.dayOfWeek"
                       class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                   >
                {{ formatDayOfWeek(cls.dayOfWeek) }}
              </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Contract Badge -->
            <div class="shrink-0 flex flex-col items-end gap-2">
              <span
                  v-if="onlyWithContractFlag(cls)"
                  class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Contrato
              </span>
              <span
                  v-else
                  class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Livre
              </span>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
