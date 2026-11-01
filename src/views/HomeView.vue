<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getKpis } from '@/api/dashboard'
import type { Announcement } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { useSessionStore } from '@/stores/session'
import { CARD_INFO, CLASSIFICATION_COLORS, RATING_COLORS, STATUS_COLORS } from '@/constants/colors'
import FilterBar from '@/components/filters/FilterBar.vue'
import ScoreCard from '@/components/kpi/ScoreCard.vue'
import DonutCard from '@/components/kpi/DonutCard.vue'
import FrameworksChart from '@/components/charts/FrameworksChart.vue'
import HistoryChart from '@/components/charts/HistoryChart.vue'
import TasksTable from '@/components/table/TasksTable.vue'
import AnnouncementsBar from '@/components/announcements/AnnouncementsBar.vue'
import AnnouncementDialog from '@/components/announcements/AnnouncementDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'

const kpis = useDashboardData((filters, signal) => getKpis(filters, signal))

const { isAdmin } = storeToRefs(useSessionStore())
/** `null` = closed, `'new'` = creating, otherwise the announcement being edited. */
const dialog = ref<Announcement | 'new' | null>(null)
</script>

<template>
  <main class="home">
    <AnnouncementsBar @edit="dialog = $event" />

    <FilterBar>
      <template #end>
        <button v-if="isAdmin" type="button" class="new-announcement" @click="dialog = 'new'">
          <AppIcon name="plus" :size="14" />
          הודעה חדשה
        </button>
      </template>
    </FilterBar>

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

    <div class="main-area">
      <div class="area frameworks"><FrameworksChart /></div>
      <div class="area history"><HistoryChart /></div>
      <div class="area table"><TasksTable /></div>
    </div>

    <AnnouncementDialog
      v-if="dialog"
      :key="dialog === 'new' ? 'new' : dialog.id"
      :announcement="dialog === 'new' ? null : dialog"
      @close="dialog = null"
    />
  </main>
</template>

<style scoped>
/* Navbar is 48px; the dashboard fits the rest of the screen. */
.home {
  --screen: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px 20px;
}
.kpis {
  display: grid;
  grid-template-columns: minmax(150px, 0.55fr) minmax(300px, 1.25fr) minmax(260px, 1fr) minmax(280px, 1.1fr);
  gap: 14px;
}
.new-announcement {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--main-blue);
  border-radius: var(--radius-sm);
  color: var(--main-blue);
  font-weight: 600;
}
.new-announcement:hover {
  background: var(--selected-bg);
}
.area {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.area > :deep(.card) {
  flex: 1;
  min-height: 0;
}

/* Default (laptop widths): charts side by side, table on its own row, one screen tall. */
.main-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    'frameworks history'
    'table table';
  gap: 14px;
}
.frameworks {
  grid-area: frameworks;
}
.history {
  grid-area: history;
}
.table {
  grid-area: table;
  height: calc(var(--screen) - 28px);
  min-height: 420px;
}

/* Wide screens ("Main screen - wide" in Figma): charts stacked beside the table, page fits the screen. */
@media (min-width: 1280px) {
  .home {
    height: var(--screen);
    min-height: 700px;
  }
  .kpis {
    grid-template-columns: repeat(4, 1fr);
  }
  .main-area {
    flex: 1;
    min-height: 0;
    grid-template-columns: minmax(360px, 1fr) 2.1fr;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'history table'
      'frameworks table';
  }
  .table {
    height: auto;
    min-height: 0;
  }
  /* Charts stretch to share the column height instead of a fixed height. */
  .frameworks :deep(.chart),
  .history :deep(.chart) {
    height: auto;
    flex: 1;
    min-height: 110px;
  }
  /* The spacer only lines the history plot up with the frameworks plot when they sit side by side. */
  .history :deep(.spacer) {
    display: none;
  }
}

/* Narrow screens: everything in one column. */
@media (max-width: 1100px) {
  .kpis {
    grid-template-columns: 1fr 1fr;
  }
  .main-area {
    grid-template-columns: 1fr;
    grid-template-areas:
      'frameworks'
      'history'
      'table';
  }
}
</style>
