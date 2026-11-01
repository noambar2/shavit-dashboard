<script setup lang="ts" generic="K extends string">
/**
 * A KPI card with a donut and a clickable legend. Clicking a segment or legend
 * row sets the matching dashboard filter; clicking it again clears it.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import VChart from 'vue-echarts'
import { useFiltersStore } from '@/stores/filters'
import { tooltipBase } from '@/plugins/echarts'
import type { Distribution, FilterKey } from '@/api/types'
import { formatNumber, formatPct } from '@/utils/format'
import DashCard from '@/components/common/DashCard.vue'
import HoverTip from '@/components/common/HoverTip.vue'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps<{
  title: string
  info?: string
  data: Distribution<K> | null
  colors: Record<K, string>
  filterKey: FilterKey
  /** Show `data.total` (and `changePct`) in the middle of the donut. */
  showCenter?: boolean
  loading?: boolean
  error?: string | null
}>()
defineEmits<{ retry: [] }>()

const store = useFiltersStore()
const { selected } = storeToRefs(store)
const active = computed(() => selected.value[props.filterKey] as K | undefined)
const sum = computed(() => props.data?.segments.reduce((a, s) => a + s.count, 0) ?? 0)

const isDimmed = (key: K) => !!active.value && active.value !== key

const option = computed(() => ({
  tooltip: {
    ...tooltipBase,
    formatter: (p: { name: string; value: number; color: string }) =>
      `<span style="color:${p.color}">●</span> ${p.name} <b>${formatNumber(p.value)}</b> <span style="color:#9aa0b0">${formatPct(p.value, sum.value)}</span>`,
  },
  series: [
    {
      type: 'pie',
      radius: ['72%', '96%'],
      startAngle: 90,
      clockwise: false,
      label: { show: false },
      emphasis: { scale: false },
      data: (props.data?.segments ?? []).map((s) => ({
        name: s.label,
        value: s.count,
        key: s.key,
        itemStyle: { color: props.colors[s.key], opacity: isDimmed(s.key) ? 0.35 : 1 },
      })),
    },
  ],
}))

function onChartClick(e: { data?: unknown }) {
  const key = (e.data as { key?: K } | null)?.key
  if (key) store.toggleFilter(props.filterKey, key)
}
</script>

<template>
  <DashCard :title="title" :info="info" :loading="loading" :error="error" @retry="$emit('retry')">
    <template #actions>
      <HoverTip v-if="active" text="איפוס סינונים" placement="top" :width="100">
        <button type="button" class="icon-btn plain" aria-label="איפוס סינונים" @click="store.setFilter(filterKey, undefined)">
          <AppIcon name="reset" :size="16" />
        </button>
      </HoverTip>
    </template>

    <div class="content">
      <ul class="legend">
        <li v-for="s in data?.segments ?? []" :key="s.key">
          <HoverTip placement="top" :width="190">
            <button type="button" class="legend-row" :class="{ dimmed: isDimmed(s.key) }" @click="store.toggleFilter(filterKey, s.key)">
              <span class="dot" :style="{ background: colors[s.key] }" />
              <span class="label">{{ s.label }}</span>
              <span class="num count">{{ formatNumber(s.count) }}</span>
            </button>
            <template #tip>
              <span class="tip-row">
                <span class="dot" :style="{ background: colors[s.key] }" />
                {{ s.label }} <b class="num">{{ formatNumber(s.count) }}</b>
                <span class="num muted">{{ formatPct(s.count, sum) }}</span>
              </span>
            </template>
          </HoverTip>
        </li>
      </ul>

      <div class="chart">
        <VChart :option="option" autoresize @click="onChartClick" />
        <div v-if="showCenter && data" class="center">
          <span class="num total">{{ formatNumber(data.total) }}</span>
          <span v-if="data.changePct !== undefined" class="change" :class="data.changePct >= 0 ? 'up' : 'down'">
            <AppIcon :name="data.changePct >= 0 ? 'arrow-up' : 'arrow-down'" :size="11" />
            <span class="num">{{ Math.abs(data.changePct) }}%</span>
          </span>
        </div>
      </div>
    </div>
  </DashCard>
</template>

<style scoped>
.content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 100%;
  min-height: 120px;
  padding-top: 8px;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-row {
  display: grid;
  grid-template-columns: 10px auto 64px;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  text-align: start;
  transition: opacity 0.15s;
}
.legend-row.dimmed {
  opacity: 0.4;
}
.label {
  white-space: nowrap;
  color: var(--darkest);
}
.count {
  color: var(--text-medium);
  text-align: end;
}
.tip-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.muted {
  color: var(--text-light);
}
.chart {
  position: relative;
  width: 108px;
  height: 108px;
  flex: none;
}
.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.total {
  font-size: 20px;
  font-weight: 700;
  color: var(--darkest);
}
.change {
  direction: ltr;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--darkest);
}
.change.up svg {
  color: var(--success);
}
.change.down svg {
  color: var(--error);
}
</style>
