/**
 * Mock implementations of every function in `src/api/dashboard.ts`.
 * They fake latency and react a little to filters so the UI behaves like it
 * would against a real backend. Delete this folder once the backend is live.
 */
import type {
  Announcement,
  AnnouncementInput,
  BreadcrumbItem,
  CandidateSearchResult,
  CurrentUser,
  DashboardFilters,
  Distribution,
  FilterOptions,
  FrameworksResponse,
  HistoryResponse,
  IndicatorDetails,
  KpiSummary,
  MetricMode,
  ReportColumn,
  ReportPage,
  ReportPageQuery,
  ReportTask,
  ReportTaskType,
  ReportTasksResponse,
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
  historyParentScores,
  indicators,
  kpis,
  taskRows,
  toFrameworkItem,
  reportValues,
  type FrameworkNode,
} from './data'
import * as announcements from './announcements'
import { TASK_TYPES, taskType, todayIso } from '@/reports/taskType'

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
          { key: 'parentScore', label: 'ציון אב', points: points(historyParentScores) },
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

/** Small deterministic PRNG so each row always gets the same fake people. */
function seeded(seedText: string) {
  let h = 2166136261
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function leavesOf(row: TaskRow): TaskRow[] {
  return row.children?.length ? row.children.flatMap(leavesOf) : [row]
}

/** The columns the backend currently sends. Adding one here (and to the tasks) is all a new column needs. */
const REPORT_COLUMNS: ReportColumn[] = [
  { key: 'startDate', label: 'תאריך תחילה', type: 'date' },
  { key: 'runDate', label: 'תאריך ריצה', type: 'date' },
  { key: 'handlingDays', label: 'משך טיפול (ימים)', type: 'number' },
  { key: 'daysToBreach', label: 'ימים לחריגה', type: 'number' },
  { key: 'pauseEndDate', label: 'תאריך סיום השהייה', type: 'date' },
  { key: 'pauseReason', label: 'סיבת השהייה', type: 'text' },
  { key: 'personalNumber', label: 'מספר אישי', type: 'text' },
  { key: 'track', label: 'מסלול עתודה / שוחרים', type: 'text' },
  { key: 'corps', label: 'חיל', type: 'text' },
  { key: 'major', label: 'מגמה', type: 'text', width: 20 },
  { key: 'position', label: 'משרה לאיוש', type: 'text', width: 20 },
  // Extra columns, to show the report adapts to whatever the backend sends:
  { key: 'studyStartDate', label: 'תאריך תחילת לימודים', type: 'date' },
  { key: 'studyEndDate', label: 'תאריך סיום לימודים', type: 'date' },
]

function fakeTasks(row: TaskRow, runDate: string): ReportTask[] {
  const rand = seeded(row.id)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const [ry, rm, rd] = runDate.split('-').map(Number)
  const run = new Date(ry, rm - 1, rd)
  // Local calendar day (toISOString would shift it by the timezone).
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const count = 25 + Math.floor(rand() * 40)
  return Array.from({ length: count }, () => {
    const handlingDays = 1 + Math.floor(rand() * 45)
    const start = new Date(run)
    start.setDate(run.getDate() - handlingDays)
    const paused = rand() < 0.08
    const pauseEnd = new Date(run)
    pauseEnd.setDate(run.getDate() + 3 + Math.floor(rand() * 20))
    const studyStart = new Date(run.getFullYear() - 1 - Math.floor(rand() * 3), 9, 1)
    const studyEnd = new Date(studyStart.getFullYear() + 3 + Math.floor(rand() * 2), 6, 30)
    return {
      startDate: iso(start),
      runDate,
      handlingDays,
      daysToBreach: (row.sla ?? 30) - handlingDays,
      pauseEndDate: paused ? iso(pauseEnd) : null,
      pauseReason: paused ? pick(reportValues.pauseReasons) : null,
      personalNumber: String(5_000_000 + Math.floor(rand() * 4_000_000)),
      track: pick(reportValues.tracks),
      corps: pick(reportValues.corps),
      major: pick(reportValues.majors),
      position: pick(reportValues.positions),
      studyStartDate: iso(studyStart),
      studyEndDate: iso(studyEnd),
    }
  })
}

export function getReportTasks(rowId: string, filters: DashboardFilters): Promise<ReportTasksResponse> {
  const row = findRow(taskRows, (r) => r.id === rowId)
  if (!row) return Promise.reject(new Error('404 Not Found'))
  const rows = leavesOf(row).map((leaf) => ({ rowId: leaf.id, tasks: fakeTasks(leaf, filters.date) }))
  // A bit slower than other calls, so the "preparing your report" message is visible.
  return delay({ columns: REPORT_COLUMNS, rows }, 900 + rows.length * 150)
}

export function getReportPage(rowId: string, filters: DashboardFilters, query: ReportPageQuery): Promise<ReportPage> {
  const row = findRow(taskRows, (r) => r.id === rowId)
  if (!row) return Promise.reject(new Error('404 Not Found'))
  const today = todayIso()
  const all: ReportPage['tasks'] = leavesOf(row).flatMap((leaf) =>
    fakeTasks(leaf, filters.date).map((t) => Object.assign({}, t, { rowId: leaf.id })),
  )

  // Every filter except סוג משימה (the chips show counts per type under the other filters).
  const q = query.q?.trim()
  const base = all.filter(
    (t) =>
      (!query.leafRowId || t.rowId === query.leafRowId) &&
      (!q || Object.values(t).some((v) => v !== null && String(v).includes(q))) &&
      Object.entries(query.columnFilters ?? {}).every(([k, v]) => String(t[k] ?? '') === v),
  )
  const typeCounts = Object.fromEntries(TASK_TYPES.map((k) => [k, 0])) as Record<ReportTaskType, number>
  for (const t of base) typeCounts[taskType(t, today)]++
  const matching = query.taskType ? base.filter((t) => taskType(t, today) === query.taskType) : base

  if (query.sortKey) {
    const dir = query.sortDir === 'desc' ? -1 : 1
    const key = query.sortKey
    const value = (t: ReportTask) => (key === 'taskType' ? TASK_TYPES.indexOf(taskType(t, today)) : t[key])
    matching.sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (va === vb) return 0
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'he')) * dir
    })
  }

  // Distinct values per text column; columns with too many (like מספר אישי) get no filter.
  const MAX_FACET_VALUES = 50
  const facets = Object.fromEntries(
    REPORT_COLUMNS.filter((c) => c.type === 'text')
      .map((c) => [c.key, [...new Set(all.map((t) => t[c.key]).filter((v): v is string => typeof v === 'string' && v !== ''))]] as const)
      .filter(([, values]) => values.length <= MAX_FACET_VALUES)
      .map(([key, values]) => [key, [...values].sort((a: string, b: string) => a.localeCompare(b, 'he'))]),
  )

  const start = (query.page - 1) * query.pageSize
  return delay(
    { columns: REPORT_COLUMNS, total: matching.length, typeCounts, facets, tasks: matching.slice(start, start + query.pageSize) },
    250,
  )
}

export function searchCandidates(q: string): Promise<CandidateSearchResult[]> {
  const term = q.trim()
  const results = term ? candidates.filter((c) => c.fullName.includes(term) || c.idNumber.startsWith(term)) : []
  return delay(results.slice(0, 8), 150)
}

export function getCurrentUser(): Promise<CurrentUser> {
  return delay(announcements.mockUser, 100)
}

export function getAnnouncements(): Promise<Announcement[]> {
  return delay(announcements.active(), 150)
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  await delay(null, 300)
  return announcements.create(input)
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement> {
  await delay(null, 300)
  return announcements.update(id, input)
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await delay(null, 250)
  announcements.remove(id)
}

export const setMockAdmin = announcements.setMockAdmin
