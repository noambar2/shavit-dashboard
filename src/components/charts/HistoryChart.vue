<script setup lang="ts">
/** התפתחות היסטורית — smooth line chart over time. */
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { getHistory } from '@/api/dashboard'
import type { HistorySeries, MetricMode } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { axisText, tooltipBase } from '@/plugins/echarts'
import { CARD_INFO, SERIES_COLORS } from '@/constants/colors'
import { formatNumber, formatShortDate } from '@/utils/format'
import DashCard from '@/components/common/DashCard.vue'
import MetricToggle from '@/components/common/MetricToggle.vue'

const metric = ref<MetricMode>('scores')
const { data, loading, error, reload } = useDashboardData(
  (filters, signal) => getHistory(filters, { metric: metric.value }, signal),
  [metric],
)

/** In ציונים mode the UI adds a ממוצע line: (ציון + ציון אב) / 2 for each date. */
const AVERAGE_KEY = 'average'

const series = computed<HistorySeries[]>(() => {
  const list = data.value?.series ?? []
  const score = list.find((s) => s.key === 'score')
  const parent = list.find((s) => s.key === 'parentScore')
  if (metric.value !== 'scores' || !score || !parent) return list
  const average: HistorySeries = {
    key: AVERAGE_KEY,
    label: 'ממוצע',
    points: score.points.map((p, i) => ({ date: p.date, value: Math.round(((p.value + (parent.points[i]?.value ?? p.value)) / 2) * 10) / 10 })),
  }
  return [...list, average]
})
const dates = computed(() => series.value[0]?.points.map((p) => p.date) ?? [])

const option = computed(() => ({
  grid: { top: 24, right: 24, bottom: 28, left: 32 },
  tooltip: {
    ...tooltipBase,
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: '#e1ebf5' } },
    formatter: (params: { dataIndex: number; seriesIndex: number; value: number }[]) =>
      `<b>${formatShortDate(dates.value[params[0].dataIndex])}</b><br>` +
      params
        .map((p) => `<span style="color:${SERIES_COLORS[p.seriesIndex]}">●</span> ${series.value[p.seriesIndex].label} <b>${formatNumber(p.value)}</b>`)
        .join('<br>'),
  },
  xAxis: {
    type: 'category',
    data: dates.value.map(formatShortDate),
    boundaryGap: ['4%', '4%'],
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#e1ebf5' } },
    axisLabel: { ...axisText, margin: 14 },
  },
  // Scores sit in a narrow band (e.g. 78–93); fit the axis to the data so the lines don't flatten at the top.
  yAxis: { type: 'value', scale: metric.value === 'scores', max: metric.value === 'scores' ? 100 : undefined, splitLine: { show: false }, axisLabel: axisText },
  series: series.value.map((s, i) => ({
    name: s.label,
    type: 'line',
    smooth: 0.5,
    symbol: 'circle',
    lineStyle: { width: s.key === AVERAGE_KEY ? 2 : 3, color: SERIES_COLORS[i], type: s.key === AVERAGE_KEY ? 'dashed' : 'solid' },
    symbolSize: s.key === AVERAGE_KEY ? 6 : 8,
    itemStyle: { color: SERIES_COLORS[i] },
    data: s.points.map((p) => p.value),
  })),
}))
</script>

<template>
  <DashCard title="התפתחות היסטורית" :info="CARD_INFO.history" :loading="loading" :error="error" expandable @retry="reload">
    <template #actions>
      <MetricToggle v-model="metric" />
    </template>

    <!-- Legend on top (same row height as the frameworks breadcrumb, so the plots line up). -->
    <ul class="legend">
      <li v-for="(s, i) in series" :key="s.key">
        <span v-if="s.key === AVERAGE_KEY" class="dash" :style="{ borderColor: SERIES_COLORS[i] }" />
        <span v-else class="dot" :style="{ background: SERIES_COLORS[i] }" />
        {{ s.label }}
      </li>
    </ul>
    <div class="chart">
      <VChart :option="option" autoresize />
    </div>
  </DashCard>
</template>

<style scoped>
.chart {
  height: 210px;
}
.fullscreen .chart {
  flex: 1;
  height: auto;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 12px;
  margin: 4px 0 6px;
  min-height: 20px;
  align-items: center;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-medium);
}
.legend .dot {
  width: 8px;
  height: 8px;
}
.dash {
  width: 14px;
  border-top: 2px dashed;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
