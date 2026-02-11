<script setup lang="ts">
import { computed } from 'vue'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CLASS_INSERT_STATUS_OPTIONS, CONTRACT_STATUS_OPTIONS } from '@/lib/workflow'
import type { ConditionPayload } from '@/lib/workflow'

const props = withDefaults(
  defineProps<{
    value: ConditionPayload
    requiresContract?: boolean
    idPrefix?: string
    showTitle?: boolean
    showOutputsNote?: boolean
    portColor?: (kind: string) => string
  }>(),
  {
    requiresContract: false,
    idPrefix: 'condition',
    showTitle: true,
    showOutputsNote: false,
  },
)

const emit = defineEmits<{
  (event: 'update', patch: Partial<ConditionPayload>): void
}>()

function sanitizeOneToHundred(value: unknown) {
  const raw = String(value ?? '').replace(/\D+/g, '')
  if (!raw) return { n: 1, text: '1' }
  const trimmed = raw.slice(0, 3)
  let n = Number(trimmed)
  if (!Number.isFinite(n)) n = 1
  n = Math.min(100, Math.max(1, n))
  return { n, text: String(n) }
}

function updateCondition(patch: Partial<ConditionPayload>) {
  emit('update', patch)
}

const contractActive = computed(() => (props.requiresContract ? true : !!props.value.checkContract))
</script>

<template>
  <div class="space-y-3">
    <div v-if="showTitle" class="text-sm font-semibold">Configuração da Condição</div>

    <!-- Aulas Completas -->
    <div class="space-y-2 rounded-xl border p-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold">Aulas completas</div>
          <div class="text-[11px] text-muted-foreground">Frequência mínima exigida</div>
        </div>
        <Switch
            :checked="!!value.hasAttendance"
            @update:checked="(val) => updateCondition({ hasAttendance: val })"
        />
      </div>
      <div v-if="value.hasAttendance" class="space-y-1 pt-2">
        <Label class="text-[11px]">Porcentagem de aulas (%)</Label>
        <Input
            type="number"
            min="1"
            max="100"
            step="1"
            inputmode="numeric"
            pattern="[0-9]*"
            :model-value="value.minAttendance"
            @input="(e) => {
              const target = e.target as HTMLInputElement
              const { n, text } = sanitizeOneToHundred(target?.value)
              if (target) target.value = text
              updateCondition({ minAttendance: n })
            }"
        />
        <div class="flex items-center gap-2 mt-2">
          <Switch
              :id="`${idPrefix}-must-complete`"
              :checked="!!value.mustCompleteLessons"
              @update:checked="(val) => updateCondition({ mustCompleteLessons: val })"
          />
          <Label :for="`${idPrefix}-must-complete`" class="text-[11px]">Exigir todas as aulas</Label>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <Switch
              :id="`${idPrefix}-count-justified`"
              :checked="!!value.countJustifiedAbsences"
              @update:checked="(val) => updateCondition({ countJustifiedAbsences: val })"
          />
          <Label :for="`${idPrefix}-count-justified`" class="text-[11px]">Contabilizar Justificativas</Label>
        </div>
      </div>
    </div>

    <!-- Nota Mínima -->
    <div class="space-y-2 rounded-xl border p-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold">Nota Mínima</div>
          <div class="text-[11px] text-muted-foreground">Média mínima estipulada</div>
        </div>
        <Switch
            :checked="!!value.hasMinGrade"
            @update:checked="(val) => updateCondition({ hasMinGrade: val })"
        />
      </div>
      <div v-if="value.hasMinGrade" class="space-y-1 pt-2">
        <Label class="text-[11px]">Média mínima</Label>
        <Input
            type="number"
            min="1"
            max="100"
            step="1"
            inputmode="numeric"
            pattern="[0-9]*"
            :model-value="value.minExamGrade"
            @input="(e) => {
              const target = e.target as HTMLInputElement
              const { n, text } = sanitizeOneToHundred(target?.value)
              if (target) target.value = text
              updateCondition({ minExamGrade: n })
            }"
        />
      </div>
    </div>

    <!-- Evolução por Data -->
    <div class="space-y-2 rounded-xl border p-3">
      <div>
        <div class="text-xs font-semibold">Evolução por data</div>
        <div class="text-[11px] text-muted-foreground">Defina quando esta condição deve evoluir</div>
      </div>
      <div class="space-y-2 pt-1">
        <div class="space-y-1">
          <Label class="text-[11px]">Tipo de evolução</Label>
          <select
              class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              :value="value.evolutionMode || 'none'"
              @change="(e) => updateCondition({ evolutionMode: (e.target as HTMLSelectElement).value as any })"
          >
            <option value="none">Sem data (segue execução do workflow)</option>
            <option value="specific">Data específica</option>
            <option value="range">Período (início/fim)</option>
            <option value="classEnd">Término da turma</option>
          </select>
        </div>

        <div v-if="value.evolutionMode === 'specific'" class="space-y-1">
          <Label class="text-[11px]">Evoluir em</Label>
          <DatePicker
              :model-value="value.evolveAt"
              @update:model-value="(val) => updateCondition({ evolveAt: String(val) })"
          />
          <div v-if="!value.evolveAt" class="text-[10px] text-rose-600">
            Informe a data específica de evolução.
          </div>
        </div>

        <div v-if="value.evolutionMode === 'range'" class="space-y-2">
          <div class="space-y-1">
            <Label class="text-[11px]">Data início</Label>
            <DatePicker
                :model-value="value.startDate"
                @update:model-value="(val) => updateCondition({ startDate: String(val) })"
            />
          </div>
          <div class="space-y-1">
            <Label class="text-[11px]">Data término</Label>
            <DatePicker
                :model-value="value.endDate"
                @update:model-value="(val) => updateCondition({ endDate: String(val) })"
            />
          </div>
        </div>

        <div
            v-if="value.evolutionMode === 'classEnd'"
            class="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2"
        >
          A evolução ocorrerá no término da turma (endedAt).
        </div>
      </div>
    </div>

    <!-- Checar Contrato -->
    <div class="space-y-2 rounded-xl border p-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold">Checar Contrato</div>
          <div class="text-[11px] text-muted-foreground">Validar status do contrato</div>
        </div>
        <Switch
            :checked="contractActive"
            :disabled="requiresContract"
            @update:checked="(val) => {
              if (requiresContract) return
              updateCondition({ checkContract: val })
            }"
        />
      </div>
      <div
          v-if="requiresContract"
          class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2"
      >
        Obrigatorio para turmas com contrato.
      </div>
      <div v-if="contractActive" class="space-y-2 pt-2">
        <Label class="text-[11px]">Status do contrato (selecione um ou mais)</Label>
        <div class="space-y-1">
          <div
              v-for="opt in CONTRACT_STATUS_OPTIONS"
              :key="opt.value"
              class="flex items-center gap-2 rounded-lg border p-2"
          >
            <input
                type="checkbox"
                :id="`${idPrefix}-status-${opt.value}`"
                :checked="value.contractStatus?.includes(opt.value)"
                @change="(e) => {
                  const checked = (e.target as HTMLInputElement).checked
                  const current = [...(value.contractStatus || [])]
                  if (checked) {
                    if (!current.includes(opt.value)) current.push(opt.value)
                  } else {
                    const idx = current.indexOf(opt.value)
                    if (idx !== -1) current.splice(idx, 1)
                  }
                  updateCondition({ contractStatus: current })
                }"
            />
            <Label :for="`${idPrefix}-status-${opt.value}`" class="text-[11px] cursor-pointer flex-1">{{
              opt.label
            }}</Label>
          </div>
        </div>
      </div>
    </div>

    <!-- Manter dia da semana -->
    <div class="space-y-2 rounded-xl border p-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold">Manter dia da semana</div>
          <div class="text-[11px] text-muted-foreground">Evoluir para turmas com o mesmo dia</div>
        </div>
        <Switch
            :checked="!!value.keepSameDayOfWeek"
            @update:checked="(val) => updateCondition({ keepSameDayOfWeek: val })"
        />
      </div>
      <div class="text-[10px] text-muted-foreground">
        Ex: SEGUNDA -> SEGUNDA. Aplica-se principalmente a turmas de empresa.
      </div>
    </div>

    <!-- Status na Turma -->
    <div class="space-y-2 rounded-xl border p-3">
      <div>
        <div class="text-xs font-semibold">Status na Turma</div>
        <div class="text-[11px] text-muted-foreground">Status ao sair e ao entrar na turma</div>
      </div>
      <div class="space-y-2 pt-1">
        <div class="space-y-1">
          <Label class="text-[11px]">Checar status na turma</Label>
          <select
              class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              :value="value.classCheckStatus || ''"
              @change="(e) => updateCondition({ classCheckStatus: (e.target as HTMLSelectElement).value })"
          >
            <option value="">Nao filtrar</option>
            <option v-for="opt in CLASS_INSERT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <div class="text-[10px] text-muted-foreground">
            A condicao so considera matriculados com este status.
          </div>
        </div>
        <div class="space-y-1">
          <Label class="text-[11px]">Status na turma atual</Label>
          <select
              class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              :value="value.classExitStatus || ''"
              @change="(e) => updateCondition({ classExitStatus: (e.target as HTMLSelectElement).value })"
          >
            <option value="">Nao definir</option>
            <option v-for="opt in CLASS_INSERT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="space-y-1">
          <Label class="text-[11px]">Status na turma destino</Label>
          <select
              class="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
              :value="value.classInsertStatus || ''"
              @change="(e) => updateCondition({ classInsertStatus: (e.target as HTMLSelectElement).value })"
          >
            <option value="">Nao definir</option>
            <option v-for="opt in CLASS_INSERT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Balanceamento de Carga -->
    <div class="space-y-2 rounded-xl border p-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold">Equilibrar Turmas</div>
          <div class="text-[11px] text-muted-foreground">Distribuir aprendizes entre saídas OK</div>
        </div>
        <Switch
            :checked="!!value.isBalanced"
            @update:checked="(val) => updateCondition({ isBalanced: val })"
        />
      </div>
      <div v-if="value.isBalanced" class="mt-3 space-y-3">
        <div class="text-[10px] text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
          <p class="font-bold mb-1">Regras de Balanceamento:</p>
          <ul class="list-disc pl-3 space-y-1">
            <li><b>Round Robin:</b> Distribuição cíclica entre as turmas de destino.</li>
            <li><b>Proporcionalidade:</b> Mantém o equilíbrio de gênero (H/M/O) conforme as vagas disponíveis.</li>
            <li><b>Capacidade:</b> Prioriza turmas com menor lotação atual.</li>
          </ul>
        </div>

        <div class="space-y-1.5 border-t pt-2">
          <Label class="text-[11px]">Critérios de Balanceamento (pode escolher ambos)</Label>
          <div class="grid grid-cols-1 gap-1.5">
            <label class="flex items-center gap-2 p-2 rounded border bg-white cursor-pointer hover:bg-slate-50">
              <input
                  type="checkbox"
                  :checked="value.balanceStrategy?.includes('occupancy')"
                  @change="(e) => {
                    const checked = (e.target as HTMLInputElement).checked
                    const current = [...(value.balanceStrategy || [])]
                    if (checked) {
                      if (!current.includes('occupancy')) current.push('occupancy')
                    } else {
                      const idx = current.indexOf('occupancy')
                      if (idx !== -1) current.splice(idx, 1)
                    }
                    updateCondition({ balanceStrategy: current })
                  }"
                  class="h-3 w-3"
              />
              <span class="text-[10px]">Menor Ocupação Geral</span>
            </label>
            <label class="flex items-center gap-2 p-2 rounded border bg-white cursor-pointer hover:bg-slate-50">
              <input
                  type="checkbox"
                  :checked="value.balanceStrategy?.includes('gender')"
                  @change="(e) => {
                    const checked = (e.target as HTMLInputElement).checked
                    const current = [...(value.balanceStrategy || [])]
                    if (checked) {
                      if (!current.includes('gender')) current.push('gender')
                    } else {
                      const idx = current.indexOf('gender')
                      if (idx !== -1) current.splice(idx, 1)
                    }
                    updateCondition({ balanceStrategy: current })
                  }"
                  class="h-3 w-3"
              />
              <span class="text-[10px]">Equilíbrio de Gênero (H/M/O)</span>
            </label>
          </div>
        </div>

        <div class="p-2 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-700">
          <b>Nota:</b> O balanceamento só será aplicado se houver mais de uma conexão na saída "Sim".
        </div>
      </div>
    </div>

    <div v-if="showOutputsNote && portColor" class="text-[11px] text-muted-foreground mt-4">
      Saidas do IF:
      <span
          class="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
          :class="portColor('ok')"
      >Sim (OK)</span>
      e
      <span
          class="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
          :class="portColor('nok')"
      >Não (NOK)</span>
    </div>
  </div>
</template>
