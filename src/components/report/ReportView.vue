<script setup lang="ts">
/**
 * The דוח שמי shown inside the system, over the dashboard: the tasks behind a table row,
 * with סוג משימה chips, search, column filters, sorting and paging (all done by the server,
 * see GET /reports/tasks/page). "ייצוא לאקסל" downloads exactly what the filters show.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getReportPage } from '@/api/dashboard'
import type { Option, ReportColumn, ReportPageQuery, ReportTask, ReportTaskType, TaskRow } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { useClickOutside } from '@/composables/useClickOutside'
import { useFiltersLabel } from '@/composables/useFiltersLabel'
import { useFiltersStore } from '@/stores/filters'
import { buildListReport, isLeaf, leafTitlesUnder, saveFile } from '@/reports/excel'
import { TASK_TYPES, TASK_TYPE_SHORT, taskType, todayIso } from '@/reports/taskType'
import { formatDate, formatNumber } from '@/utils/format'
import AppIcon from '@/components/common/AppIcon.vue'
import FilterAccordion, { type FilterSection } from '@/components/filters/FilterAccordion.vue'

const props = defineProps<{ row: TaskRow; initialType?: ReportTaskType }>()
const emit = defineEmits<{ close: []; 'update:type': [type: ReportTaskType | undefined] }>()

const PAGE_SIZES = [25, 50, 100]
const ROW_KEY = '__row'

const consolidated = computed(() => !isLeaf(props.row))
const leafTitles = computed(() => leafTitlesUnder(props.row))
const today = todayIso()

// --- query state (sent to the server) ---------------------------------------------------
const page = ref(1)
const pageSize = ref(50)
const sortKey = ref<string | undefined>()
const sortDir = ref<'asc' | 'desc'>('asc')
const type = ref<ReportTaskType | undefined>(props.initialType)
const search = ref('')
const q = ref('')
const columnFilters = ref<Record<string, string | undefined>>({})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (q.value = v.trim()), 300)
})
watch(type, (t) => emit('update:type', t))
// Any filter or sort change starts again from page 1.
watch([type, q, columnFilters, pageSize, sortKey, sortDir], () => (page.value = 1), { deep: true })

function buildQuery(overrides: Partial<ReportPageQuery> = {}): ReportPageQuery {
  const { [ROW_KEY]: leafRowId, ...rest } = columnFilters.value
  return {
    page: page.value,
    pageSize: pageSize.value,
    sortKey: sortKey.value,
    sortDir: sortKey.value ? sortDir.value : undefined,
    taskType: type.value,
    q: q.value || undefined,
    leafRowId,
    columnFilters: Object.fromEntries(Object.entries(rest).filter((e): e is [string, string] => !!e[1])),
    ...overrides,
  }
}

const { data, loading, error, reload } = useDashboardData(
  (filters, signal) => getReportPage(props.row.id, filters, buildQuery(), signal),
  [page, pageSize, sortKey, sortDir, type, q, columnFilters],
)

// --- columns ----------------------------------------------------------------------------
const TYPE_COLUMN: ReportColumn = { key: 'taskType', label: 'סוג משימה', type: 'text' }
const ROW_COLUMN: ReportColumn = { key: ROW_KEY, label: 'מסגרת', type: 'text' }
const backendColumns = computed(() => data.value?.columns ?? [])
const columns = computed(() => [TYPE_COLUMN, ...(consolidated.value ? [ROW_COLUMN] : []), ...backendColumns.value])

function toggleSort(key: string) {
  if (key === ROW_KEY) return
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') sortDir.value = 'desc'
  else sortKey.value = undefined
}

function display(task: ReportTask & { rowId: string }, col: ReportColumn): string {
  if (col.key === ROW_KEY) return leafTitles.value.get(task.rowId) ?? task.rowId
  const v = task[col.key]
  if (v === null || v === undefined || v === '') return '-'
  if (col.type === 'date') return formatDate(String(v).slice(0, 10))
  if (col.type === 'number') return formatNumber(Number(v))
  return String(v)
}

// --- column filter menu -----------------------------------------------------------------
const filtersOpen = ref(false)
const filtersEl = ref<HTMLElement | null>(null)
useClickOutside(filtersEl, () => (filtersOpen.value = false))
const activeFilterCount = computed(() => Object.values(columnFilters.value).filter(Boolean).length)

const filterSections = computed<FilterSection[]>(() => {
  const opts = (values: string[]): Option[] => values.map((v) => ({ id: v, label: v }))
  const rowSection: FilterSection[] = consolidated.value
    ? [{ key: ROW_KEY, title: 'מסגרת', searchable: true, options: [...leafTitles.value].map(([id, label]) => ({ id, label })) }]
    : []
  const facets = data.value?.facets ?? {}
  return [
    ...rowSection,
    ...backendColumns.value
      .filter((c) => facets[c.key]?.length)
      .map((c) => ({ key: c.key, title: c.label, searchable: facets[c.key].length > 8, options: opts(facets[c.key]) })),
  ]
})

function setColumnFilter(key: string, value: string | undefined) {
  columnFilters.value = { ...columnFilters.value, [key]: value }
}

// --- paging -----------------------------------------------------------------------------
const total = computed(() => data.value?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeText = computed(() => {
  if (!total.value) return 'אין משימות להצגה'
  const from = (page.value - 1) * pageSize.value + 1
  const to = Math.min(page.value * pageSize.value, total.value)
  return `מציג ${formatNumber(from)}–${formatNumber(to)} מתוך ${formatNumber(total.value)}`
})
const allCount = computed(() => TASK_TYPES.reduce((a, t) => a + (data.value?.typeCounts[t] ?? 0), 0))

const tableWrap = ref<HTMLElement | null>(null)
watch(page, () => nextTick(() => tableWrap.value?.scrollTo({ top: 0 })))

// --- Excel export of what's on screen ---------------------------------------------------
const { filters } = storeToRefs(useFiltersStore())
const filtersLabel = useFiltersLabel()
const exporting = ref(false)
const exportError = ref(false)

async function exportView() {
  exporting.value = true
  exportError.value = false
  try {
    const all = await getReportPage(props.row.id, filters.value, buildQuery({ page: 1, pageSize: Math.max(total.value, 1) }))
    const tasks = all.tasks.map((t) => (consolidated.value ? { ...t, [ROW_KEY]: leafTitles.value.get(t.rowId) ?? t.rowId } : t))
    const viewFilters = [
      type.value && TASK_TYPE_SHORT[type.value],
      q.value && `חיפוש: ${q.value}`,
      ...Object.entries(columnFilters.value)
        .filter(([, v]) => v)
        .map(([k, v]) => `${columns.value.find((c) => c.key === k)?.label}: ${k === ROW_KEY ? leafTitles.value.get(v!) : v}`),
    ].filter(Boolean)
    const label = [filtersLabel.value, ...viewFilters].join(' · ')
    const cols = consolidated.value ? [ROW_COLUMN, ...all.columns] : all.columns
    const { blob, filename } = await buildListReport(props.row.name, cols, tasks, { filtersLabel: label, today })
    saveFile(blob, filename)
  } catch {
    exportError.value = true
  } finally {
    exporting.value = false
  }
}

// --- close on Esc (unless the filter menu is open, then close that first) ----------------
const onKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  if (filtersOpen.value) filtersOpen.value = false
  else emit('close')
}
// Capture phase: runs before the filter menu's own Esc handler, so we still see it as open.
onMounted(() => document.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click="emit('close')" />
    <section class="report-view" role="dialog" aria-modal="true" aria-labelledby="report-title" dir="rtl">
      <header class="head">
        <div>
          <h2 id="report-title">{{ consolidated ? 'דוח מרוכז' : 'דוח שמי' }} – {{ row.name }}</h2>
          <p class="meta">{{ filtersLabel }}</p>
        </div>
        <div class="head-actions">
          <span v-if="exportError" class="export-error">הייצוא נכשל</span>
          <button type="button" class="export" :disabled="exporting || !total" @click="exportView">
            <AppIcon name="excel" :size="16" />
            {{ exporting ? 'מכין קובץ…' : 'ייצוא לאקסל' }}
          </button>
          <button type="button" class="icon-btn plain" aria-label="סגירה" @click="emit('close')">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
      </header>

      <div class="toolbar">
        <div class="types" role="radiogroup" aria-label="סוג משימה">
          <button type="button" role="radio" :aria-checked="!type" :class="{ active: !type }" @click="type = undefined">
            הכל <span class="num count">{{ formatNumber(allCount) }}</span>
          </button>
          <button
            v-for="t in TASK_TYPES"
            :key="t"
            type="button"
            role="radio"
            :aria-checked="type === t"
            :class="[t, { active: type === t }]"
            @click="type = t"
          >
            <span class="dot" />
            {{ TASK_TYPE_SHORT[t] }} <span class="num count">{{ formatNumber(data?.typeCounts[t] ?? 0) }}</span>
          </button>
        </div>

        <div class="tools">
          <label class="search">
            <AppIcon name="search" :size="14" />
            <input v-model="search" type="search" placeholder="חיפוש (מספר אישי, חיל, מגמה…)" />
          </label>
          <div ref="filtersEl" class="filters-anchor">
            <button
              type="button"
              class="icon-btn"
              :class="{ on: activeFilterCount }"
              :aria-expanded="filtersOpen"
              aria-label="סינון לפי עמודות"
              @click="filtersOpen = !filtersOpen"
            >
              <AppIcon name="filter" :size="16" />
              <span v-if="activeFilterCount" class="badge">{{ activeFilterCount }}</span>
            </button>
            <FilterAccordion
              v-if="filtersOpen"
              class="column-filter"
              :sections="filterSections"
              :selected="columnFilters"
              :loading="!data"
              :initially-open="filterSections[0]?.key"
              @select="setColumnFilter"
              @clear="columnFilters = {}"
            />
          </div>
        </div>
      </div>

      <div ref="tableWrap" class="table-wrap scroll-hint">
        <table>
          <thead>
            <tr>
              <th v-for="c in columns" :key="c.key" :class="{ sortable: c.key !== ROW_KEY }" :aria-sort="sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined">
                <button v-if="c.key !== ROW_KEY" type="button" class="sort" @click="toggleSort(c.key)">
                  {{ c.label }}
                  <AppIcon v-if="sortKey === c.key" :name="sortDir === 'asc' ? 'arrow-up' : 'arrow-down'" :size="12" />
                </button>
                <template v-else>{{ c.label }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in data?.tasks ?? []" :key="i">
              <td v-for="c in columns" :key="c.key">
                <span v-if="c.key === 'taskType'" class="tag" :class="taskType(t, today)">{{ TASK_TYPE_SHORT[taskType(t, today)] }}</span>
                <span v-else :class="{ num: c.type !== 'text', negative: c.key === 'daysToBreach' && Number(t.daysToBreach) < 0 }">
                  {{ display(t, c) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="error" class="state error">
          שגיאה בטעינת הדוח · <button type="button" class="link" @click="reload">נסה שוב</button>
        </div>
        <div v-else-if="data && !data.tasks.length" class="state">אין משימות שמתאימות לסינון</div>
        <div v-if="loading" class="loading"><span class="spinner" /></div>
      </div>

      <footer class="pager">
        <span class="range num">{{ rangeText }}</span>
        <label class="size">
          שורות בעמוד
          <select v-model.number="pageSize">
            <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
        <div class="pages">
          <button type="button" class="icon-btn plain" aria-label="עמוד קודם" :disabled="page <= 1" @click="page--">
            <AppIcon name="chevron-right" :size="16" />
          </button>
          <span class="num">עמוד {{ page }} מתוך {{ pageCount }}</span>
          <button type="button" class="icon-btn plain" aria-label="עמוד הבא" :disabled="page >= pageCount" @click="page++">
            <AppIcon name="chevron-left" :size="16" />
          </button>
        </div>
      </footer>
    </section>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgb(7 25 56 / 35%);
}
.report-view {
  position: fixed;
  z-index: 71;
  inset: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 22px 12px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  font-family: var(--font);
  color: var(--text);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 18px;
  color: var(--darkest);
}
.meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-medium);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.export {
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
.export:hover:not(:disabled) {
  background: var(--selected-bg);
}
.export:disabled {
  opacity: 0.5;
  cursor: progress;
}
.export-error {
  font-size: 12px;
  color: var(--error);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.types button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--darkest);
}
.types button.active {
  border-color: var(--main-blue);
  background: var(--selected-bg);
  color: var(--main-blue);
  font-weight: 600;
}
.types .count {
  color: var(--text-medium);
  font-size: 12px;
}
.types .dot {
  width: 8px;
  height: 8px;
}
.types .breach .dot {
  background: var(--error);
}
.types .nearBreach .dot {
  background: var(--warning);
}
.types .treatment .dot {
  background: var(--success);
}
.types .paused .dot {
  background: var(--graph-blue);
}
.tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 260px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-medium);
}
.search input {
  flex: 1;
  border: 0;
  background: transparent;
  outline: none;
}
.filters-anchor {
  position: relative;
}
.filters-anchor .icon-btn {
  position: relative;
}
.icon-btn.on {
  background: var(--main-blue);
  color: #fff;
}
.badge {
  position: absolute;
  top: -4px;
  inset-inline-end: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--error);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
}
.column-filter {
  inset-inline-start: auto;
  inset-inline-end: 0;
  z-index: 5;
}
.table-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  background: var(--bg);
  color: var(--text-medium);
  font-weight: 400;
  font-size: 12px;
  white-space: nowrap;
  text-align: center;
}
th:not(.sortable) {
  padding: 9px 10px;
}
.sort {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 9px 10px;
  color: inherit;
}
.sort:hover {
  color: var(--darkest);
}
th[aria-sort] .sort {
  color: var(--main-blue);
  font-weight: 600;
}
td {
  padding: 7px 10px;
  text-align: center;
  white-space: nowrap;
  color: var(--darkest);
  border-bottom: 1px solid #f0f4f9;
}
tbody tr:hover td {
  background: #fafcfe;
}
.negative {
  color: var(--error);
  font-weight: 600;
}
.tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.tag.breach {
  background: #fdecee;
  color: #c4384b;
}
.tag.nearBreach {
  background: #fef3e3;
  color: #b8700f;
}
.tag.treatment {
  background: #e3f7f4;
  color: #0e8577;
}
.tag.paused {
  background: #e8eefd;
  color: #2c55c6;
}
.state {
  padding: 32px;
  text-align: center;
  color: var(--text-medium);
}
.state.error {
  color: var(--error);
}
.link {
  color: var(--main-blue);
  text-decoration: underline;
}
.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(255 255 255 / 55%);
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--neutral-tint);
  border-top-color: var(--main-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.pager {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 12px;
  color: var(--text-medium);
}
.range {
  margin-inline-end: auto;
}
.size select {
  margin-inline-start: 6px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font: inherit;
}
.pages {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--darkest);
}
.pages .icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
