import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getReportTasks } from '@/api/dashboard'
import type { TaskRow } from '@/api/types'
import { useFiltersStore } from '@/stores/filters'
import { buildReport, isLeaf, saveFile } from '@/reports/excel'
import { todayIso } from '@/reports/taskType'
import { useFiltersLabel } from './useFiltersLabel'

type Status =
  | { state: 'idle' }
  | { state: 'working'; kind: 'named' | 'consolidated'; name: string }
  | { state: 'done'; filename: string }
  | { state: 'error'; name: string }

/** Exports a tasks-table row to Excel and tracks progress for the toast. */
export function useReportExport() {
  const { filters } = storeToRefs(useFiltersStore())
  const filtersLabel = useFiltersLabel()
  const status = ref<Status>({ state: 'idle' })
  const busy = computed(() => status.value.state === 'working')
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  async function exportRow(row: TaskRow) {
    if (busy.value) return
    clearTimeout(hideTimer)
    status.value = { state: 'working', kind: isLeaf(row) ? 'named' : 'consolidated', name: row.name }
    try {
      const { columns, rows } = await getReportTasks(row.id, filters.value)
      const tasksByRow = new Map(rows.map((r) => [r.rowId, r.tasks]))
      const today = todayIso()
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
