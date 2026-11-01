/**
 * Every backend call the dashboard makes lives in this file.
 *
 * While `VITE_USE_MOCKS=true`, each function returns fake data from `src/mocks`.
 * Set it to `false` and the same functions call the real endpoints below — no
 * component needs to change.
 */
import { getBlob, getJson, type Query } from './http'
import * as mock from '@/mocks/handlers'
import type {
  CandidateSearchResult,
  DashboardFilters,
  FilterOptions,
  FrameworksResponse,
  HistoryResponse,
  IndicatorDetails,
  KpiSummary,
  MetricMode,
  TasksResponse,
} from './types'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

/** Filters become query params, e.g. `?scope=all&date=2026-12-13&dateGranularity=day&taskStatus=breach` */
function filterQuery(filters: DashboardFilters): Query {
  return { ...filters }
}

/** GET /filters/options — the choices shown in the filter menu. */
export function getFilterOptions(signal?: AbortSignal): Promise<FilterOptions> {
  if (USE_MOCKS) return mock.getFilterOptions()
  return getJson('/filters/options', undefined, signal)
}

/** GET /dashboard/kpis — the four cards in the top row. */
export function getKpis(filters: DashboardFilters, signal?: AbortSignal): Promise<KpiSummary> {
  if (USE_MOCKS) return mock.getKpis(filters)
  return getJson('/dashboard/kpis', filterQuery(filters), signal)
}

/** GET /dashboard/frameworks — the מסגרות bar chart. `parentId` omitted = root level. */
export function getFrameworks(
  filters: DashboardFilters,
  params: { metric: MetricMode; parentId?: string | null },
  signal?: AbortSignal,
): Promise<FrameworksResponse> {
  if (USE_MOCKS) return mock.getFrameworks(filters, params)
  return getJson('/dashboard/frameworks', { ...filterQuery(filters), ...params }, signal)
}

/** GET /dashboard/history — the התפתחות היסטורית line chart. */
export function getHistory(
  filters: DashboardFilters,
  params: { metric: MetricMode },
  signal?: AbortSignal,
): Promise<HistoryResponse> {
  if (USE_MOCKS) return mock.getHistory(filters, params)
  return getJson('/dashboard/history', { ...filterQuery(filters), ...params }, signal)
}

/** GET /dashboard/tasks — the משימות tree table. */
export function getTasks(filters: DashboardFilters, signal?: AbortSignal): Promise<TasksResponse> {
  if (USE_MOCKS) return mock.getTasks(filters)
  return getJson('/dashboard/tasks', filterQuery(filters), signal)
}

/** GET /indicators/:id — details for the ⓘ tooltip in the table. */
export function getIndicator(id: string, signal?: AbortSignal): Promise<IndicatorDetails> {
  if (USE_MOCKS) return mock.getIndicator(id)
  return getJson(`/indicators/${encodeURIComponent(id)}`, undefined, signal)
}

/** GET /reports/named?rowId= — the דוח שמי Excel file for a table row. */
export function downloadNamedReport(
  rowId: string,
  filters: DashboardFilters,
): Promise<{ blob: Blob; filename?: string }> {
  if (USE_MOCKS) return mock.downloadNamedReport(rowId)
  return getBlob('/reports/named', { ...filterQuery(filters), rowId })
}

/** GET /candidates/search?q= — the חיפוש מלש"ב box in the navbar. */
export function searchCandidates(q: string, signal?: AbortSignal): Promise<CandidateSearchResult[]> {
  if (USE_MOCKS) return mock.searchCandidates(q)
  return getJson('/candidates/search', { q }, signal)
}
