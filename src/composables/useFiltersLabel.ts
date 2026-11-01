import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const SCOPES = { all: 'כלל מיטב', bureaus: 'לשכות', hq: 'מפקדה' } as const

/** e.g. "נתונים ל: כל נובמבר 2026 · כלל מיטב · משימות בחריגה" — printed on reports. */
export function useFiltersLabel() {
  const { filters, activeChips } = storeToRefs(useFiltersStore())
  return computed(() => {
    const { date, dateGranularity, scope } = filters.value
    const [y, m, d] = date.split('-')
    const when =
      dateGranularity === 'year' ? `כל שנת ${y}` : dateGranularity === 'month' ? `כל ${MONTHS[+m - 1]} ${y}` : `${d}/${m}/${y}`
    return [`נתונים ל: ${when}`, SCOPES[scope], ...activeChips.value.map((c) => c.label)].join(' · ')
  })
}
