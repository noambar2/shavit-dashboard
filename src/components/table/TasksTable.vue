<script setup lang="ts">
import { computed, ref } from 'vue'
import { getTasks } from '@/api/dashboard'
import type { Option, TaskRow } from '@/api/types'
import { useDashboardData } from '@/composables/useFetch'
import { useClickOutside } from '@/composables/useClickOutside'
import { formatNumber, scoreColor } from '@/utils/format'
import DashCard from '@/components/common/DashCard.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import HoverTip from '@/components/common/HoverTip.vue'
import FilterAccordion, { type FilterSection } from '@/components/filters/FilterAccordion.vue'
import IndicatorTooltip from './IndicatorTooltip.vue'
import ReportToast from './ReportToast.vue'
import { useReportExport } from '@/composables/useReportExport'

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
  { id: 'report', label: 'ייצוא לאקסל' },
]

const { data, loading, error, reload } = useDashboardData((f, signal) => getTasks(f, signal))

// --- expand / collapse -------------------------------------------------------
const collapsed = ref(new Set<string>())
function toggleRow(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

// --- column filters (filter button) ------------------------------------------
// Generic: every column in COLUMNS (plus מסגרת) gets a section, with options taken
// from the values in the data, so a new column is filterable without extra code.
type FilterColumnId = 'name' | Exclude<ColumnId, 'report'>
const FILTER_COLUMNS: { id: FilterColumnId; label: string }[] = [
  { id: 'name', label: 'מסגרת' },
  ...COLUMNS.filter((c): c is { id: Exclude<ColumnId, 'report'>; label: string } => c.id !== 'report'),
]

const columnFilters = ref<Record<string, string | undefined>>({})
const activeFilters = computed(() =>
  Object.entries(columnFilters.value).filter((e): e is [FilterColumnId, string] => e[1] !== undefined),
)
const filtersOpen = ref(false)
const filtersEl = ref<HTMLElement | null>(null)
useClickOutside(filtersEl, () => (filtersOpen.value = false))

/** The value as shown in the table — filters compare on exactly this text. */
const display = (row: TaskRow, id: FilterColumnId) => (id === 'name' ? row.name : cell(row, id))

const allRows = computed(() => {
  const flat: TaskRow[] = []
  const walk = (rows: TaskRow[]) => rows.forEach((r) => (flat.push(r), r.children && walk(r.children)))
  walk(data.value?.rows ?? [])
  return flat
})

/** Numbers sort numerically, text alphabetically, "-" last. */
function sortValues(values: string[]): string[] {
  const num = (v: string) => Number(v.replace(/[,%+]/g, ''))
  return values.sort((a, b) => {
    if (a === '-' || b === '-') return a === '-' ? 1 : -1
    const na = num(a)
    const nb = num(b)
    return Number.isNaN(na) || Number.isNaN(nb) ? a.localeCompare(b, 'he') : na - nb
  })
}

const filterSections = computed<FilterSection[]>(() =>
  FILTER_COLUMNS.map((c) => {
    const values = sortValues([...new Set(allRows.value.map((r) => display(r, c.id)))])
    return {
      key: c.id,
      title: c.label,
      searchable: c.id === 'name' || values.length > 8,
      options: values.map((v): Option => ({ id: v, label: v })),
    }
  }),
)

function setColumnFilter(key: string, value: string | undefined) {
  columnFilters.value = { ...columnFilters.value, [key]: value }
}

const matchesFilters = (row: TaskRow) => activeFilters.value.every(([id, value]) => display(row, id) === value)

/**
 * Rows to render. While filtering, a row shows if it matches every active filter; its parents
 * stay visible (marked `context`, drawn faded) so the tree still makes sense.
 */
const visibleRows = computed(() => {
  const filtering = activeFilters.value.length > 0
  const walk = (rows: TaskRow[], depth: number): { row: TaskRow; depth: number; context: boolean }[] =>
    rows.flatMap((row) => {
      const kids = row.children ? walk(row.children, depth + 1) : []
      if (!filtering) return [{ row, depth, context: false }, ...(collapsed.value.has(row.id) ? [] : kids)]
      const self = matchesFilters(row)
      return self || kids.length ? [{ row, depth, context: !self }, ...kids] : []
    })
  return walk(data.value?.rows ?? [], 0)
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

// --- Excel export: דוח שמי for a lowest-level row, דוח מרוכז for a row with children ---
const report = useReportExport()
const reportLabel = (row: TaskRow) => (row.children?.length ? 'דוח מרוכז' : 'דוח שמי')

function cell(row: TaskRow, id: Exclude<ColumnId, 'report'>): string {
  const v = row[id]
  if (id === 'weightPct') return `${v}%`
  if (id === 'trendPct') return v === null ? '-' : `${(v as number) > 0 ? '+' : ''}${v}%`
  return formatNumber(v as number | null)
}
</script>

<template>
  <DashCard title="משימות" :loading="loading" :error="error" expandable class="tasks" @retry="reload">
    <template #actions>
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
      <div ref="filtersEl" class="filters-anchor">
        <button
          type="button"
          class="icon-btn"
          :class="{ on: activeFilters.length }"
          :aria-expanded="filtersOpen"
          aria-label="סינון הטבלה"
          @click="filtersOpen = !filtersOpen"
        >
          <AppIcon name="filter" :size="16" />
          <span v-if="activeFilters.length" class="badge">{{ activeFilters.length }}</span>
        </button>
        <FilterAccordion
          v-if="filtersOpen"
          class="table-filter"
          :sections="filterSections"
          :selected="columnFilters"
          initially-open="name"
          @select="setColumnFilter"
          @clear="columnFilters = {}"
        />
      </div>
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
          <tr v-for="{ row, depth, context } in visibleRows" :key="row.id" :class="{ context }">
            <td class="name-col">
              <span class="name" :style="{ paddingInlineStart: `${depth * 20}px` }">
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
                <HoverTip v-if="row.hasReport" :text="reportLabel(row)" placement="top" :width="90">
                  <button
                    type="button"
                    class="report"
                    :disabled="report.busy.value"
                    :aria-label="`ייצוא ${reportLabel(row)} לאקסל: ${row.name}`"
                    @click="report.exportRow(row)"
                  >
                    <AppIcon name="excel" :size="18" />
                  </button>
                </HoverTip>
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
            <td :colspan="shownColumns.length + 1" class="empty">
              <template v-if="activeFilters.length">
                אין שורות שמתאימות לסינון ·
                <button type="button" class="clear-filters" @click="columnFilters = {}">ניקוי הסינון</button>
              </template>
              <template v-else>אין נתונים להצגה</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </DashCard>
  <ReportToast :status="report.status.value" @dismiss="report.dismiss" />
</template>

<style scoped>
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
/* Toolbar sits at the left edge of the card, so open the menu towards the right. */
.table-filter {
  inset-inline-start: auto;
  inset-inline-end: 0;
  z-index: 20;
}
tr.context td {
  opacity: 0.45;
}
.clear-filters {
  color: var(--main-blue);
  text-decoration: underline;
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
  flex: 1;
  min-height: 0;
  margin-top: 12px;
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
  background: var(--bg);
  color: var(--text-medium);
  font-weight: 400;
  font-size: 12px;
  padding: 8px 6px;
  line-height: 1.25;
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
  padding: 7px 8px;
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
