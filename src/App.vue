<script setup lang="ts">
import { GhostIcon } from 'lucide-vue-next'
import { RouterView } from 'vue-router'
import { Toaster } from '@/components/ui/toast'
</script>

<template>
  <div class="absolute bottom-0 left-0 right-0 top-0">
    <div class="relative flex h-full w-full flex-col">
      <header class="h-20 border-b border-gray-200 px-4 py-3 " style="display: none">
        <div class="flex h-full items-center justify-between">
          <div class="flex gap-x-3">
            <div class="flex items-center gap-x-1">
              <GhostIcon class="w-12 text-red-200"/>
              <div class="flex flex-col">
                <div class="flex items-center gap-x-3">
                  <p class="text-bold">workflow-test</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main class="relative flex h-full w-full flex-1">
        <RouterView v-slot="{ Component }">
          <component :is="Component" class="h-full w-full" />
        </RouterView>
      </main>
    </div>
  </div>
  <Toaster/>
</template>
