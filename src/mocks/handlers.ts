/**
 * Mock implementations of every function in `src/api/dashboard.ts`.
 * They fake latency and react a little to filters so the UI behaves like it
 * would against a real backend. Delete this folder once the backend is live.
 */
import type {
  BreadcrumbItem,
  CandidateSearchResult,
  DashboardFilters,
  Distribution,
  FilterOptions,
  FrameworksResponse,
  HistoryResponse,
  IndicatorDetails,
  KpiSummary,
  MetricMode,
  TaskRow,
  TaskStatusKey,
  TasksResponse,
} from '@/api/types'
import {
  candidates,
  fallbackIndicator,
  filterOptions,
  frameworksRoot,
  historyDates,
  historyParentTasks,
  historyScores,
  historyTasks,
  historyTargetScores,
  indicators,
  kpis,
  taskRows,
  toFrameworkItem,
  type FrameworkNode,
} from './data'

const STATUS_KEYS: TaskStatusKey[] = ['treatment', 'nearBreach', 'breach', 'paused']

function delay<T>(value: T, ms = 250 + Math.random() * 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))
}

/** A stable 0.45–1 multiplier per filter combination, so changing filters visibly changes numbers. */
function filterFactor(filters: DashboardFilters): number {
  const { scope, date, dateGranularity, taskStatus: _ignored, ...rest } = filters
  const key = JSON.stringify({ scope, date, dateGranularity, ...rest })
  const isDefault = scope === 'all' && Object.values(rest).every((v) => !v)
  if (isDefault && dateGranularity === 'day') return 1
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return 0.45 + (Math.abs(hash) % 55) / 100
}

const scale = (n: number, f: number) => Math.round(n * f)

function scaleDistribution<K extends string>(d: Distribution<K>, f: number, only?: K): Distribution<K> {
  const segments = d.segments.map((s) => ({ ...s, count: scale(s.count, f) }))
  const total = only
    ? (segments.find((s) => s.key === only)?.count ?? 0)
    : segments.reduce((a, s) => a + s.count, 0)
  return { ...d, total, segments }
}

export function getFilterOptions(): Promise<FilterOptions> {
  return delay(filterOptions, 150)
}

export function getKpis(filters: DashboardFilters): Promise<KpiSummary> {
  const f = filterFactor(filters)
  return delay({
    score: { value: Math.min(100, Math.round(kpis.score.value * (0.9 + f / 10))), changePct: kpis.score.changePct },
    taskStatus: scaleDistribution(kpis.taskStatus, f, filters.taskStatus),
    indicatorRating: scaleDistribution(kpis.indicatorRating, f, filters.indicatorRating),
    taskClassification: scaleDistribution(kpis.taskClassification, f, filters.indicatorClassification),
  })
}

function findPath(nodes: FrameworkNode[], id: string, trail: FrameworkNode[] = []): FrameworkNode[] | null {
  for (const node of nodes) {
    const next = [...trail, node]
    if (node.id === id) return next
    if (node.children) {
      const found = findPath(node.children, id, next)
      if (found) return found
    }
  }
  return null
}

export function getFrameworks(
  filters: DashboardFilters,
  params: { metric: MetricMode; parentId?: string | null },
): Promise<FrameworksResponse> {
  const f = filterFactor(filters)
  const trail = params.parentId ? (findPath(frameworksRoot, params.parentId) ?? []) : []
  const level = trail.length ? (trail[trail.length - 1].children ?? []) : frameworksRoot
  const path: BreadcrumbItem[] = [{ id: null, name: 'לשכות' }, ...trail.map((n) => ({ id: n.id, name: n.name }))]

  const items = level.map((node) => {
    const breakdown = Object.fromEntries(
      STATUS_KEYS.map((k) => [k, filters.taskStatus && filters.taskStatus !== k ? 0 : scale(node.breakdown[k], f)]),
    ) as Record<TaskStatusKey, number>
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
    return params.metric === 'scores'
      ? { ...toFrameworkItem(node), total: node.score, score: node.score }
      : { ...toFrameworkItem(node), total, breakdown }
  })
  return delay({ path, items })
}

export function getHistory(filters: DashboardFilters, params: { metric: MetricMode }): Promise<HistoryResponse> {
  const f = filterFactor(filters)
  const points = (values: number[], factor = 1) =>
    historyDates.map((date, i) => ({ date, value: Math.round(values[i] * factor * 10) / 10 }))

  const series =
    params.metric === 'scores'
      ? [
          { key: 'score', label: 'ציון', points: points(historyScores) },
          { key: 'target', label: 'יעד', points: points(historyTargetScores) },
        ]
      : [
          { key: 'tasks', label: 'משימות', points: points(historyTasks, f) },
          { key: 'parentTasks', label: 'משימות אב', points: points(historyParentTasks, f) },
        ]
  return delay({ series })
}

function scaleRow(row: TaskRow, f: number, status?: TaskStatusKey): TaskRow {
  const counts = Object.fromEntries(
    STATUS_KEYS.map((k) => [k, status && status !== k ? 0 : scale(row[k], f)]),
  ) as Record<TaskStatusKey, number>
  return {
    ...row,
    ...counts,
    total: STATUS_KEYS.reduce((a, k) => a + counts[k], 0),
    children: row.children?.map((c) => scaleRow(c, f, status)),
  }
}

export function getTasks(filters: DashboardFilters): Promise<TasksResponse> {
  const f = filterFactor(filters)
  return delay({ rows: taskRows.map((r) => scaleRow(r, f, filters.taskStatus)) })
}

function findRow(rows: TaskRow[], predicate: (r: TaskRow) => boolean): TaskRow | undefined {
  for (const r of rows) {
    if (predicate(r)) return r
    const child = r.children && findRow(r.children, predicate)
    if (child) return child
  }
}

export function getIndicator(id: string): Promise<IndicatorDetails> {
  const name = findRow(taskRows, (r) => r.indicatorId === id)?.name ?? id
  return delay(indicators[id] ?? fallbackIndicator(id, name), 200)
}

export async function downloadNamedReport(rowId: string): Promise<{ blob: Blob; filename?: string }> {
  const row = findRow(taskRows, (r) => r.id === rowId)
  const header = 'שם,מספר אישי,סטטוס,ימים פתוחים'
  const lines = candidates.slice(0, 20).map((c, i) => `${c.fullName},${c.idNumber},${['לטיפול', 'עתידה לחרוג', 'בחריגה'][i % 3]},${(i * 3) % 40}`)
  // The real backend should return an .xlsx file; the mock returns CSV (with BOM so Excel reads Hebrew).
  const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  return delay({ blob, filename: `דוח שמי - ${row?.name ?? rowId}.csv` }, 300)
}

export function searchCandidates(q: string): Promise<CandidateSearchResult[]> {
  const term = q.trim()
  const results = term ? candidates.filter((c) => c.fullName.includes(term) || c.idNumber.startsWith(term)) : []
  return delay(results.slice(0, 8), 150)
}
