<script setup lang="ts">
import type { MetricMode } from '@/api/types'

const model = defineModel<MetricMode>({ required: true })
const OPTIONS: { id: MetricMode; label: string }[] = [
  { id: 'tasks', label: 'משימות' },
  { id: 'scores', label: 'ציונים' },
]
</script>

<template>
  <div class="toggle" role="radiogroup">
    <template v-for="(opt, i) in OPTIONS" :key="opt.id">
      <span v-if="i > 0" class="sep">/</span>
      <button
        type="button"
        role="radio"
        :aria-checked="model === opt.id"
        :class="{ active: model === opt.id }"
        @click="model = opt.id"
      >
        {{ opt.label }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-light);
}
button {
  color: var(--text-light);
}
button.active {
  color: var(--main-blue);
  font-weight: 600;
}
.sep {
  color: var(--text-light);
}
</style>
