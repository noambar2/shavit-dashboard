<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import DashCard from '@/components/common/DashCard.vue'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps<{
  info?: string
  data: { value: number; changePct: number } | null
  loading?: boolean
  error?: string | null
}>()
defineEmits<{ retry: [] }>()

const option = computed(() => {
  const value = props.data?.value ?? 0
  return {
    series: [
      {
        type: 'pie',
        radius: ['76%', '96%'],
        startAngle: 90,
        clockwise: false,
        silent: true,
        label: { show: false },
        data: [
          { value, itemStyle: { color: '#3d6deb' } },
          { value: 100 - value, itemStyle: { color: '#eef2f8' } },
        ],
      },
    ],
  }
})
</script>

<template>
  <DashCard title="ציון" :info="info" :loading="loading" :error="error" @retry="$emit('retry')">
    <div class="content">
      <div class="chart">
        <VChart :option="option" autoresize />
        <div v-if="data" class="center">
          <span class="num value">{{ data.value }}</span>
          <span class="change" :class="data.changePct >= 0 ? 'up' : 'down'">
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
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 92px;
  padding-top: 4px;
}
.chart {
  position: relative;
  width: 88px;
  height: 88px;
}
.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.value {
  font-size: 18px;
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
