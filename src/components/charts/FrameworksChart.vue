<script setup lang="ts">
/** מסגרות — stacked bars per framework, click a bar to drill down. */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

const metric = ref<MetricMode>('scores')
const parentId = ref<string | null>(null)

const { data, loading, error, reload } = useDashboardData(
  (filters, signal) => getFrameworks(filters, { metric: metric.value, parentId: parentId.value }, signal),
  [metric, parentId],
)

const items = computed(() => data.value?.items ?? [])

/** Each bar gets at least this many px; with more bars than fit, the chart scrolls sideways. */
const MIN_BAR_SLOT = 64
const plotWidth = computed(() => `max(100%, ${items.value.length * MIN_BAR_SLOT}px)`)

/** Axis labels may use the whole slot under their bar (wider in full screen) before getting "…". */
const plotEl = ref<HTMLElement | null>(null)
const plotPx = ref(0)
const observer = new ResizeObserver(([entry]) => (plotPx.value = entry.contentRect.width))
watch(plotEl, (el, old) => {
  if (old) observer.unobserve(old)
  if (el) observer.observe(el)
})
onBeforeUnmount(() => observer.disconnect())
const labelWidth = computed(() => Math.max(MIN_BAR_SLOT - 8, plotPx.value / Math.max(items.value.length, 1) - 10))
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

/** Legend for ציונים mode: bar colour by score. */
const SCORE_LEGEND = [
  { label: '90 ומעלה', color: '#12b8a6' },
  { label: '70–89', color: '#f2b05c' },
  { label: 'מתחת ל-70', color: '#e04a5d' },
]

/**
 * Axis labels without the words every name shares ("לשכת גיוס ירושלים" → "ירושלים"),
 * so they fit on one line. Tooltips keep the full name.
 */
const axisLabels = computed(() => {
  const names = items.value.map((i) => i.name)
  if (names.length < 2) return names
  const words = names.map((n) => n.split(' '))
  let common = 0
  while (words.every((w) => w.length > common + 1 && w[common] === words[0][common])) common++
  return words.map((w) => w.slice(common).join(' '))
})

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
  // No Y axis labels: every bar already shows its value on top.
  grid: { top: 22, right: 4, bottom: 26, left: 4 },
  tooltip: { ...tooltipBase, trigger: 'axis', axisPointer: { type: 'none' }, formatter: tooltip },
  xAxis: {
    type: 'category',
    inverse: true,
    data: axisLabels.value,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#e1ebf5' } },
    axisLabel: { ...axisText, color: '#333c5d', fontSize: 12, interval: 0, overflow: 'truncate', ellipsis: '…', width: labelWidth.value },
  },
  yAxis: {
    type: 'value',
    show: false,
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
  <DashCard title="מסגרות" :info="CARD_INFO.frameworks" :loading="loading" :error="error" expandable @retry="reload">
    <template #actions>
      <MetricToggle v-model="metric" />
    </template>

    <!-- Breadcrumb and legend share one row, to leave the most room for the bars. -->
    <div class="subhead">
      <nav class="crumbs" aria-label="ניווט מסגרות">
        <template v-for="(c, i) in data?.path ?? []" :key="c.id ?? 'root'">
          <span v-if="i > 0" class="sep">/</span>
          <span v-if="i === (data?.path.length ?? 0) - 1 && i > 0" class="crumb current">{{ c.name }}</span>
          <button v-else type="button" class="crumb" @click="parentId = c.id">{{ c.name }}</button>
        </template>
      </nav>
      <ul class="legend">
        <template v-if="metric === 'tasks'">
          <li v-for="s in STACK" :key="s.key"><span class="dot" :style="{ background: STATUS_COLORS[s.key] }" />{{ s.label }}</li>
        </template>
        <template v-else>
          <li v-for="l in SCORE_LEGEND" :key="l.label"><span class="dot" :style="{ background: l.color }" />{{ l.label }}</li>
        </template>
      </ul>
    </div>

    <div class="chart" :class="{ clickable: items.some((i) => i.hasChildren) }">
      <div ref="plotEl" class="plot" :style="{ width: plotWidth }">
        <VChart :option="option" autoresize @click="onBarClick" />
      </div>
    </div>
  </DashCard>
</template>

<style scoped>
.subhead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 4px 0 6px;
  min-height: 20px;
}
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
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
  height: 210px;
}
.fullscreen .chart {
  flex: 1;
  height: auto;
}
/* Scrolls sideways when the bars need more room than the card has. */
.chart {
  overflow-x: auto;
  overflow-y: hidden;
}
.plot {
  height: 100%;
  min-height: 0;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-medium);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 5px;
}
.legend .dot {
  width: 8px;
  height: 8px;
}
</style>
