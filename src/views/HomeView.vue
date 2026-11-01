<script setup lang="ts">
import { getKpis } from '@/api/dashboard'
import { useDashboardData } from '@/composables/useFetch'
import { CARD_INFO, CLASSIFICATION_COLORS, RATING_COLORS, STATUS_COLORS } from '@/constants/colors'
import FilterBar from '@/components/filters/FilterBar.vue'
import ScoreCard from '@/components/kpi/ScoreCard.vue'
import DonutCard from '@/components/kpi/DonutCard.vue'
import FrameworksChart from '@/components/charts/FrameworksChart.vue'
import HistoryChart from '@/components/charts/HistoryChart.vue'
import TasksTable from '@/components/table/TasksTable.vue'

const kpis = useDashboardData((filters, signal) => getKpis(filters, signal))
</script>

<template>
  <main class="home">
    <FilterBar />

    <div class="kpis">
      <ScoreCard
        :info="CARD_INFO.score"
        :data="kpis.data.value?.score ?? null"
        :loading="kpis.loading.value"
        :error="kpis.error.value"
        @retry="kpis.reload"
      />
      <DonutCard
        title="סטטוס משימות"
        :info="CARD_INFO.taskStatus"
        :data="kpis.data.value?.taskStatus ?? null"
        :colors="STATUS_COLORS"
        filter-key="taskStatus"
        show-center
        :loading="kpis.loading.value"
        :error="kpis.error.value"
        @retry="kpis.reload"
      />
      <DonutCard
        title="דירוג מדדים"
        :info="CARD_INFO.indicatorRating"
        :data="kpis.data.value?.indicatorRating ?? null"
        :colors="RATING_COLORS"
        filter-key="indicatorRating"
        show-center
        :loading="kpis.loading.value"
        :error="kpis.error.value"
        @retry="kpis.reload"
      />
      <DonutCard
        title="סיווג משימות"
        :info="CARD_INFO.taskClassification"
        :data="kpis.data.value?.taskClassification ?? null"
        :colors="CLASSIFICATION_COLORS"
        filter-key="indicatorClassification"
        :loading="kpis.loading.value"
        :error="kpis.error.value"
        @retry="kpis.reload"
      />
    </div>

    <div class="charts">
      <FrameworksChart />
      <HistoryChart />
    </div>

    <TasksTable />
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 30px 40px;
}
.kpis {
  display: grid;
  grid-template-columns: minmax(150px, 0.55fr) minmax(300px, 1.25fr) minmax(260px, 1fr) minmax(280px, 1.1fr);
  gap: 20px;
}
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 1100px) {
  .kpis {
    grid-template-columns: 1fr 1fr;
  }
  .charts {
    grid-template-columns: 1fr;
  }
}
</style>
