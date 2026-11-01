<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { downloadNamedReport, getTasks } from '@/api/dashboard'
import type { TaskRow } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { useClickOutside } from '@/composables/useClickOutside'
import { useFiltersStore } from '@/stores/filters'
import { formatNumber, scoreColor } from '@/utils/format'
import DashCard from '@/components/common/DashCard.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import HoverTip from '@/components/common/HoverTip.vue'
import IndicatorTooltip from './IndicatorTooltip.vue'

type ColumnId = 'treatment' | 'nearBreach' | 'breach' | 'paused' | 'total' | 'sla' | 'weightPct' | 'score' | 'trendPct' | 'report'

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'treatment', label: 'משימות לטיפול' },
  { id: 'nearBreach', label: 'עתידות לחרוג' },
  { id: 'breach', label: 'משימות בחריגה' },
  { id: 'paused', label: 'משימות בהשהייה' },
  { id: 'total', label: 'סה"כ' },
  { id: 'sla', label: 'SLA' },
  { id: 'weightPct', label: 'משקל' },
  { id: 'score', label: 'ציון' },
  { id: 'trendPct', label: 'מגמה' },
  { id: 'report', label: 'דוח שמי' },
]

const { filters } = storeToRefs(useFiltersStore())
const { data, loading, error, reload } = useDashboardData((f, signal) => getTasks(f, signal))

// --- expand / collapse -------------------------------------------------------
const collapsed = ref(new Set<string>())
function toggleRow(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

// --- row search (filter button) ---------------------------------------------
const searchOpen = ref(false)
const search = ref('')
watch(searchOpen, (open) => !open && (search.value = ''))

function matches(row: TaskRow, term: string): boolean {
  return row.name.includes(term) || !!row.children?.some((c) => matches(c, term))
}

const visibleRows = computed(() => {
  const term = search.value.trim()
  const out: { row: TaskRow; depth: number }[] = []
  const walk = (rows: TaskRow[], depth: number) => {
    for (const row of rows) {
      if (term && !matches(row, term)) continue
      out.push({ row, depth })
      if (row.children && (term || !collapsed.value.has(row.id))) walk(row.children, depth + 1)
    }
  }
  walk(data.value?.rows ?? [], 0)
  return out
})

// --- column picker -------------------------------------------------------------
const hidden = ref(new Set<ColumnId>())
const columnsOpen = ref(false)
const columnsEl = ref<HTMLElement | null>(null)
useClickOutside(columnsEl, () => (columnsOpen.value = false))
const shownColumns = computed(() => COLUMNS.filter((c) => !hidden.value.has(c.id)))
function toggleColumn(id: ColumnId) {
  const next = new Set(hidden.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  hidden.value = next
}

// --- fullscreen ------------------------------------------------------------------
const fullscreen = ref(false)

// --- report download ---------------------------------------------------------------
const downloading = ref<string | null>(null)
async function download(row: TaskRow) {
  downloading.value = row.id
  try {
    const { blob, filename } = await downloadNamedReport(row.id, filters.value)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: filename ?? `${row.name}.xlsx` })
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    downloading.value = null
  }
}

function cell(row: TaskRow, id: Exclude<ColumnId, 'report'>): string {
  const v = row[id]
  if (id === 'weightPct') return `${v}%`
  if (id === 'trendPct') return v === null ? '-' : `${(v as number) > 0 ? '+' : ''}${v}%`
  return formatNumber(v as number | null)
}
</script>

<template>
  <div v-if="fullscreen" class="backdrop" @click="fullscreen = false" />
  <DashCard title="משימות" :loading="loading" :error="error" :class="{ fullscreen }" class="tasks" @retry="reload">
    <template #actions>
      <input v-if="searchOpen" v-model="search" class="row-search" type="search" placeholder="חיפוש מסגרת" autofocus />
      <div ref="columnsEl" class="columns-anchor">
        <button type="button" class="icon-btn" :aria-expanded="columnsOpen" aria-label="בחירת עמודות" @click="columnsOpen = !columnsOpen">
          <AppIcon name="columns" :size="16" />
        </button>
        <div v-if="columnsOpen" class="popover columns-menu">
          <label v-for="c in COLUMNS" :key="c.id">
            <input type="checkbox" :checked="!hidden.has(c.id)" @change="toggleColumn(c.id)" />
            {{ c.label }}
          </label>
        </div>
      </div>
      <button type="button" class="icon-btn" :aria-pressed="searchOpen" aria-label="חיפוש בטבלה" @click="searchOpen = !searchOpen">
        <AppIcon name="filter" :size="16" />
      </button>
      <button type="button" class="icon-btn plain" :aria-label="fullscreen ? 'סגירת מסך מלא' : 'מסך מלא'" @click="fullscreen = !fullscreen">
        <AppIcon :name="fullscreen ? 'collapse' : 'expand'" :size="18" />
      </button>
    </template>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="name-col">מסגרת</th>
            <th v-for="c in shownColumns" :key="c.id">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ row, depth } in visibleRows" :key="row.id">
            <td class="name-col">
              <span class="name" :style="{ paddingInlineStart: `${depth * 28}px` }">
                <button
                  v-if="row.children?.length"
                  type="button"
                  class="toggle"
                  :aria-expanded="!collapsed.has(row.id)"
                  :aria-label="collapsed.has(row.id) ? 'הרחבה' : 'כיווץ'"
                  @click="toggleRow(row.id)"
                >
                  <AppIcon :name="collapsed.has(row.id) ? 'chevron-left' : 'chevron-down'" :size="16" />
                </button>
                <span v-else class="bullet" />
                {{ row.name }}
                <HoverTip v-if="row.indicatorId" placement="bottom" :width="230">
                  <button type="button" class="info" :aria-label="`פרטי המדד ${row.name}`"><AppIcon name="info" :size="15" /></button>
                  <template #tip><IndicatorTooltip :indicator-id="row.indicatorId" /></template>
                </HoverTip>
              </span>
            </td>
            <td v-for="c in shownColumns" :key="c.id" class="num-cell">
              <template v-if="c.id === 'report'">
                <button
                  v-if="row.hasReport"
                  type="button"
                  class="report"
                  :disabled="downloading === row.id"
                  :aria-label="`הורדת דוח שמי ${row.name}`"
                  @click="download(row)"
                >
                  <AppIcon name="excel" :size="18" />
                </button>
              </template>
              <span
                v-else-if="c.id === 'score'"
                class="num score"
                :style="{ color: scoreColor(row.score) }"
              >{{ cell(row, c.id) }}</span>
              <span
                v-else-if="c.id === 'trendPct'"
                class="num"
                :class="{ up: (row.trendPct ?? 0) > 0, down: (row.trendPct ?? 0) < 0 }"
              >{{ cell(row, c.id) }}</span>
              <span v-else class="num">{{ cell(row, c.id) }}</span>
            </td>
          </tr>
          <tr v-if="!loading && !visibleRows.length">
            <td :colspan="shownColumns.length + 1" class="empty">אין נתונים להצגה</td>
          </tr>
        </tbody>
      </table>
    </div>
  </DashCard>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgb(7 25 56 / 30%);
}
.tasks.fullscreen {
  position: fixed;
  z-index: 61;
  inset: 40px 40px auto;
  max-height: calc(100vh - 80px);
  box-shadow: var(--shadow-pop);
}
.tasks.fullscreen .table-wrap {
  max-height: calc(100vh - 160px);
  overflow: auto;
}
.row-search {
  height: 30px;
  width: 180px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  outline: none;
  font-size: 13px;
}
.columns-anchor {
  position: relative;
}
.columns-menu {
  top: calc(100% + 6px);
  inset-inline-end: 0;
  width: 170px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.columns-menu label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.columns-menu input {
  accent-color: var(--main-blue);
}
.table-wrap {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
thead th {
  position: sticky;
  top: 0;
  background: var(--bg);
  color: var(--text-medium);
  font-weight: 400;
  font-size: 12px;
  padding: 10px 12px;
  white-space: nowrap;
  text-align: center;
}
thead th:first-child {
  border-start-start-radius: var(--radius);
}
thead th:last-child {
  border-start-end-radius: var(--radius);
}
th.name-col,
td.name-col {
  text-align: start;
  padding-inline-start: 16px;
}
td {
  padding: 9px 12px;
  color: var(--darkest);
}
tbody tr:hover td {
  background: #fafcfe;
}
.num-cell {
  text-align: center;
}
.name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.toggle {
  display: grid;
  width: 18px;
  color: var(--darkest);
}
.bullet {
  width: 18px;
  display: grid;
  place-items: center;
}
.bullet::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-light);
}
.info {
  display: grid;
  color: var(--darkest);
}
.score {
  font-weight: 700;
}
.up {
  color: var(--success);
}
.down {
  color: var(--error);
}
.report {
  display: inline-grid;
  color: var(--darkest);
}
.report:disabled {
  opacity: 0.4;
  cursor: progress;
}
.empty {
  text-align: center;
  color: var(--text-medium);
  padding: 24px;
}
</style>
