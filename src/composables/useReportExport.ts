import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getReportTasks } from '@/api/dashboard'
import type { TaskRow } from '@/api/types'
import { useFiltersStore } from '@/stores/filters'
import { buildReport, isLeaf, saveFile } from '@/reports/excel'

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const SCOPES = { all: 'כלל מיטב', bureaus: 'לשכות', hq: 'מפקדה' } as const

type Status =
  | { state: 'idle' }
  | { state: 'working'; kind: 'named' | 'consolidated'; name: string }
  | { state: 'done'; filename: string }
  | { state: 'error'; name: string }

/** Exports a tasks-table row to Excel and tracks progress for the toast. */
export function useReportExport() {
  const store = useFiltersStore()
  const { filters, activeChips } = storeToRefs(store)
  const status = ref<Status>({ state: 'idle' })
  const busy = computed(() => status.value.state === 'working')
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  /** e.g. "נתונים ל: כל נובמבר 2026 · כלל מיטב · משימות בחריגה" — printed at the top of every sheet. */
  const filtersLabel = computed(() => {
    const { date, dateGranularity, scope } = filters.value
    const [y, m, d] = date.split('-')
    const when =
      dateGranularity === 'year' ? `כל שנת ${y}` : dateGranularity === 'month' ? `כל ${MONTHS[+m - 1]} ${y}` : `${d}/${m}/${y}`
    return [`נתונים ל: ${when}`, SCOPES[scope], ...activeChips.value.map((c) => c.label)].join(' · ')
  })

  async function exportRow(row: TaskRow) {
    if (busy.value) return
    clearTimeout(hideTimer)
    status.value = { state: 'working', kind: isLeaf(row) ? 'named' : 'consolidated', name: row.name }
    try {
      const { columns, rows } = await getReportTasks(row.id, filters.value)
      const tasksByRow = new Map(rows.map((r) => [r.rowId, r.tasks]))
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const { blob, filename } = await buildReport(row, { columns, tasksByRow }, { filtersLabel: filtersLabel.value, today })
      saveFile(blob, filename)
      status.value = { state: 'done', filename }
      hideTimer = setTimeout(() => (status.value = { state: 'idle' }), 4000)
    } catch {
      status.value = { state: 'error', name: row.name }
    }
  }

  function dismiss() {
    clearTimeout(hideTimer)
    status.value = { state: 'idle' }
  }

  return { status, busy, exportRow, dismiss }
}
