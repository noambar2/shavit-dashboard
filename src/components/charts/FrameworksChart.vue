<script setup lang="ts">
/** מסגרות — stacked bars per framework, click a bar to drill down. */
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { getFrameworks } from '@/api/dashboard'
import type { FrameworkItem, MetricMode, TaskStatusKey } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { axisText, tooltipBase } from '@/plugins/echarts'
import { CARD_INFO, STATUS_COLORS } from '@/constants/colors'
import { formatNumber, formatPct } from '@/utils/format'
import DashCard from '@/components/common/DashCard.vue'
import MetricToggle from '@/components/common/MetricToggle.vue'

/** Bottom-to-top stack order. */
const STACK: { key: TaskStatusKey; label: string }[] = [
  { key: 'treatment', label: 'לטיפול' },
  { key: 'nearBreach', label: 'עתידות לחרוג' },
  { key: 'breach', label: 'בחריגה' },
  { key: 'paused', label: 'בהשהייה' },
]

const metric = ref<MetricMode>('tasks')
const parentId = ref<string | null>(null)

const { data, loading, error, reload } = useDashboardData(
  (filters, signal) => getFrameworks(filters, { metric: metric.value, parentId: parentId.value }, signal),
  [metric, parentId],
)

const items = computed(() => data.value?.items ?? [])
const BAR_RADIUS = 5

/** Rounds only the outer ends of each stack and puts the total label on the top segment. */
function stackedSeries(list: FrameworkItem[]) {
  return STACK.map(({ key, label }, stackIndex) => ({
    name: label,
    type: 'bar',
    stack: 'status',
    barWidth: 24,
    itemStyle: { color: STATUS_COLORS[key] },
    data: list.map((item) => {
      const values = STACK.map((s) => item.breakdown?.[s.key] ?? 0)
      const value = values[stackIndex]
      const top = values.length - 1 - [...values].reverse().findIndex((v) => v > 0)
      const bottom = values.findIndex((v) => v > 0)
      const r = BAR_RADIUS
      return {
        value,
        itemStyle: {
          borderRadius: [stackIndex === top ? r : 0, stackIndex === top ? r : 0, stackIndex === bottom ? r : 0, stackIndex === bottom ? r : 0],
        },
        label: {
          show: stackIndex === top,
          position: 'top',
          formatter: () => formatNumber(item.total),
          color: '#8d9ab5',
          fontSize: 11,
          fontWeight: 600,
        },
      }
    }),
  }))
}

function scoreSeries(list: FrameworkItem[]) {
  return [
    {
      name: 'ציון',
      type: 'bar',
      barWidth: 24,
      data: list.map((item) => ({
        value: item.score ?? 0,
        itemStyle: {
          borderRadius: BAR_RADIUS,
          color: (item.score ?? 0) >= 90 ? '#12b8a6' : (item.score ?? 0) >= 70 ? '#f2b05c' : '#e04a5d',
        },
      })),
      label: { show: true, position: 'top', color: '#8d9ab5', fontSize: 11, fontWeight: 600 },
    },
  ]
}

function tooltip(params: { dataIndex: number }[]) {
  const item = items.value[params[0]?.dataIndex]
  if (!item) return ''
  if (metric.value === 'scores') return `<b>${item.name}</b>&nbsp; ציון ${item.score ?? '-'}`
  const rows = STACK.filter((s) => (item.breakdown?.[s.key] ?? 0) > 0)
    .reverse()
    .map((s) => {
      const v = item.breakdown![s.key]
      return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;min-width:170px">
        <span><span style="color:${STATUS_COLORS[s.key]}">●</span> ${s.label} <b>${formatNumber(v)}</b></span>
        <span style="color:#9aa0b0">${formatPct(v, item.total)}</span></div>`
    })
    .join('')
  return `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #e6ecf3;padding-bottom:4px;margin-bottom:4px">
    <b>${item.name}</b><span>${formatNumber(item.total)}</span></div>${rows}`
}

const option = computed(() => ({
  grid: { top: 24, right: 8, bottom: 44, left: 32 },
  tooltip: { ...tooltipBase, trigger: 'axis', axisPointer: { type: 'none' }, formatter: tooltip },
  xAxis: {
    type: 'category',
    inverse: true,
    data: items.value.map((i) => i.name),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#e1ebf5' } },
    axisLabel: { ...axisText, color: '#333c5d', fontSize: 13, interval: 0, width: 80, overflow: 'break', lineHeight: 16 },
  },
  yAxis: {
    type: 'value',
    splitLine: { show: false },
    axisLabel: axisText,
    max: metric.value === 'scores' ? 100 : undefined,
  },
  series: metric.value === 'scores' ? scoreSeries(items.value) : stackedSeries(items.value),
}))

function onBarClick(e: { dataIndex: number }) {
  const item = items.value[e.dataIndex]
  if (item?.hasChildren) parentId.value = item.id
}
</script>

<template>
  <DashCard title="מסגרות" :info="CARD_INFO.frameworks" :loading="loading" :error="error" @retry="reload">
    <template #actions>
      <MetricToggle v-model="metric" />
    </template>

    <nav class="crumbs" aria-label="ניווט מסגרות">
      <template v-for="(c, i) in data?.path ?? []" :key="c.id ?? 'root'">
        <span v-if="i > 0" class="sep">/</span>
        <span v-if="i === (data?.path.length ?? 0) - 1 && i > 0" class="crumb current">{{ c.name }}</span>
        <button v-else type="button" class="crumb" @click="parentId = c.id">{{ c.name }}</button>
      </template>
    </nav>

    <div class="chart" :class="{ clickable: items.some((i) => i.hasChildren) }">
      <VChart :option="option" autoresize @click="onBarClick" />
    </div>

    <ul v-if="metric === 'tasks'" class="legend">
      <li v-for="s in STACK" :key="s.key"><span class="dot" :style="{ background: STATUS_COLORS[s.key] }" />{{ s.label }}</li>
    </ul>
  </DashCard>
</template>

<style scoped>
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 8px;
  font-size: 13px;
  min-height: 20px;
}
.crumb {
  color: var(--darkest);
}
button.crumb:hover {
  color: var(--main-blue);
}
.crumb.current {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.sep {
  color: var(--text-medium);
}
.chart {
  height: 240px;
}
.legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
