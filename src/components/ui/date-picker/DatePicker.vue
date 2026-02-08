<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, type HTMLAttributes } from 'vue'
import flatpickr from 'flatpickr'
import type { Instance as FlatpickrInstance, Options as FlatpickrOptions } from 'flatpickr'
import { Portuguese } from 'flatpickr/dist/l10n/pt'
import { useVModel } from '@vueuse/core'
import { cn } from '@/lib/utils'

const props = defineProps<{
  defaultValue?: string
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
  config?: Partial<FlatpickrOptions>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', payload: string): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const fp = ref<FlatpickrInstance | null>(null)

const modelValue = useVModel(props, 'modelValue', emit, {
  passive: true,
  defaultValue: props.defaultValue ?? '',
})

const inputClass = cn(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  props.class ?? '',
)

onMounted(() => {
  if (!inputRef.value) return
  fp.value = flatpickr(inputRef.value, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd/m/Y',
    altInputClass: inputClass,
    allowInput: true,
    disableMobile: true,
    locale: Portuguese,
    defaultDate: modelValue.value || undefined,
    onChange: (_selectedDates, dateStr) => {
      modelValue.value = dateStr
    },
    ...(props.config || {}),
  })
})

onBeforeUnmount(() => {
  fp.value?.destroy()
  fp.value = null
})

watch(
  () => modelValue.value,
  (next) => {
    if (!fp.value) return
    const current = fp.value.input.value
    if (!next) {
      if (current) fp.value.clear()
      return
    }
    if (current === next) return
    fp.value.setDate(next, false)
  },
)
</script>

<template>
  <input
    ref="inputRef"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="inputClass"
  />
</template>
