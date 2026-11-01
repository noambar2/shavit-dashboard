import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getFilterOptions } from '@/api/dashboard'
import type { DashboardFilters, DateGranularity, FilterKey, FilterOptions, Option, Scope } from '@/api/types'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Which `FilterOptions` list holds the choices for each filter key. */
export const OPTIONS_FOR: Record<FilterKey, keyof FilterOptions> = {
  taskStatus: 'taskStatus',
  indicatorRating: 'indicatorRating',
  orgUnitId: 'orgUnits',
  professionalFieldId: 'professionalFields',
  ramadTevelIndicationId: 'ramadTevelIndications',
  indicatorClassification: 'indicatorClassifications',
}

/** Section titles in the filter menu, in display order. */
export const FILTER_SECTIONS: { key: FilterKey; title: string; searchable?: boolean }[] = [
  { key: 'taskStatus', title: 'סטטוס משימות' },
  { key: 'indicatorRating', title: 'דירוג מדדים' },
  { key: 'orgUnitId', title: 'מבנה ארגוני', searchable: true },
  { key: 'professionalFieldId', title: 'תחום מקצועי', searchable: true },
  { key: 'ramadTevelIndicationId', title: 'אינדיקציית רמ"ד תבל' },
  { key: 'indicatorClassification', title: 'סיווג המדד' },
]

export const useFiltersStore = defineStore('filters', () => {
  const scope = ref<Scope>('all')
  const date = ref(todayIso())
  const dateGranularity = ref<DateGranularity>('day')
  const selected = ref<Partial<Record<FilterKey, string>>>({})
  const options = ref<FilterOptions | null>(null)
  /** Bumped by the refresh button; data loaders watch it. */
  const refreshKey = ref(0)
  /** When dashboard data was last fetched successfully (shown next to the refresh button). */
  const lastUpdated = ref<Date | null>(null)
  /** Number of dashboard requests in flight. */
  const pending = ref(0)

  const filters = computed<DashboardFilters>(() => ({
    scope: scope.value,
    date: date.value,
    dateGranularity: dateGranularity.value,
    ...(selected.value as Partial<DashboardFilters>),
  }))

  const activeChips = computed(() =>
    FILTER_SECTIONS.flatMap(({ key }) => {
      const id = selected.value[key]
      if (!id) return []
      const list = (options.value?.[OPTIONS_FOR[key]] ?? []) as Option[]
      return [{ key, label: list.find((o) => o.id === id)?.label ?? id }]
    }),
  )

  async function loadOptions() {
    if (!options.value) options.value = await getFilterOptions()
  }

  function setFilter(key: FilterKey, value: string | undefined) {
    const next = { ...selected.value }
    if (value) next[key] = value
    else delete next[key]
    selected.value = next
  }

  /** Clicking the active legend item again clears it. */
  function toggleFilter(key: FilterKey, value: string) {
    setFilter(key, selected.value[key] === value ? undefined : value)
  }

  function clearAll() {
    selected.value = {}
  }

  function setDate(iso: string, granularity: DateGranularity) {
    date.value = iso
    dateGranularity.value = granularity
  }

  function refresh() {
    refreshKey.value++
  }

  return {
    scope,
    date,
    dateGranularity,
    selected,
    options,
    refreshKey,
    lastUpdated,
    pending,
    filters,
    activeChips,
    loadOptions,
    setFilter,
    toggleFilter,
    clearAll,
    setDate,
    refresh,
  }
})
