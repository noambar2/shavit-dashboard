<script setup lang="ts">
/** התפתחות היסטורית — smooth line chart over time. */
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { getHistory } from '@/api/dashboard'
import type { MetricMode } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { axisText, tooltipBase } from '@/plugins/echarts'
import { CARD_INFO, SERIES_COLORS } from '@/constants/colors'
import { formatNumber, formatShortDate } from '@/utils/format'
import DashCard from '@/components/common/DashCard.vue'
import MetricToggle from '@/components/common/MetricToggle.vue'

const metric = ref<MetricMode>('tasks')
const { data, loading, error, reload } = useDashboardData(
  (filters, signal) => getHistory(filters, { metric: metric.value }, signal),
  [metric],
)

const series = computed(() => data.value?.series ?? [])
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
  yAxis: { type: 'value', splitLine: { show: false }, axisLabel: axisText },
  series: series.value.map((s, i) => ({
    name: s.label,
    type: 'line',
    smooth: 0.5,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: { width: 3, color: SERIES_COLORS[i] },
    itemStyle: { color: SERIES_COLORS[i] },
    data: s.points.map((p) => p.value),
  })),
}))
</script>

<template>
  <DashCard title="התפתחות היסטורית" :info="CARD_INFO.history" :loading="loading" :error="error" @retry="reload">
    <template #actions>
      <MetricToggle v-model="metric" />
    </template>

    <div class="spacer" />
    <div class="chart">
      <VChart :option="option" autoresize />
    </div>

    <ul class="legend">
      <li v-for="(s, i) in series" :key="s.key"><span class="dot" :style="{ background: SERIES_COLORS[i] }" />{{ s.label }}</li>
    </ul>
  </DashCard>
</template>

<style scoped>
/* Lines the plot up with the frameworks chart, which has a breadcrumb row here. */
.spacer {
  height: 32px;
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
