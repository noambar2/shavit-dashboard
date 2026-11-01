<script lang="ts">
import { getIndicator } from '@/api/dashboard'
import type { IndicatorDetails } from '@/api/types'

/** Shared across rows so each indicator is fetched once per page load. */
const cache = new Map<string, Promise<IndicatorDetails>>()
</script>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{ indicatorId: string }>()

const details = ref<IndicatorDetails | null>(null)
const failed = ref(false)

onMounted(async () => {
  if (!cache.has(props.indicatorId)) cache.set(props.indicatorId, getIndicator(props.indicatorId))
  try {
    details.value = await cache.get(props.indicatorId)!
  } catch {
    cache.delete(props.indicatorId)
    failed.value = true
  }
})
</script>

<template>
  <div class="indicator">
    <span v-if="failed" class="muted">שגיאה בטעינת פרטי המדד</span>
    <span v-else-if="!details" class="muted">טוען…</span>
    <template v-else>
      <dl>
        <dt>מהות המדד</dt>
        <dd>{{ details.description }}</dd>
        <dt>טיפול במדד</dt>
        <dd>{{ details.handling }}</dd>
        <dt>סיווג המדד</dt>
        <dd>{{ details.classification }}</dd>
        <dt>תחום מקצועי</dt>
        <dd>{{ details.professionalField }}</dd>
        <dt>קנס</dt>
        <dd class="num">{{ details.penalty }}</dd>
      </dl>
      <p v-if="details.note" class="note">{{ details.note }}</p>
    </template>
  </div>
</template>

<style scoped>
.indicator {
  font-size: 13px;
}
dl {
  margin: 0;
}
dt {
  color: var(--text-light);
  font-size: 12px;
}
dd {
  margin: 2px 0 10px;
  color: var(--darkest);
}
.note {
  margin: 0;
  color: var(--darkest);
}
.muted {
  color: var(--text-medium);
}
</style>
