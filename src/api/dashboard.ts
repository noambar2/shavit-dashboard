/**
 * Every backend call the dashboard makes lives in this file.
 *
 * While `VITE_USE_MOCKS=true`, each function returns fake data from `src/mocks`.
 * Set it to `false` and the same functions call the real endpoints below — no
 * component needs to change.
 */
import { deleteRequest, getJson, sendJson, type Query } from './http'
import * as mock from '@/mocks/handlers'
import type {
  Announcement,
  AnnouncementInput,
  CandidateSearchResult,
  CurrentUser,
  DashboardFilters,
  FilterOptions,
  FrameworksResponse,
  HistoryResponse,
  IndicatorDetails,
  KpiSummary,
  MetricMode,
  ReportPage,
  ReportPageQuery,
  ReportTasksResponse,
  TasksResponse,
} from './types'

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

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

/**
 * GET /reports/tasks?rowId= — task lines for the Excel export of a table row.
 * The UI builds the .xlsx itself (דוח שמי for a lowest-level row, דוח מרוכז otherwise).
 */
export function getReportTasks(rowId: string, filters: DashboardFilters): Promise<ReportTasksResponse> {
  if (USE_MOCKS) return mock.getReportTasks(rowId, filters)
  return getJson('/reports/tasks', { ...filterQuery(filters), rowId })
}

/** GET /reports/tasks/page — one filtered/sorted page of a row's tasks, for the in-app report view. */
export function getReportPage(
  rowId: string,
  filters: DashboardFilters,
  query: ReportPageQuery,
  signal?: AbortSignal,
): Promise<ReportPage> {
  if (USE_MOCKS) return mock.getReportPage(rowId, filters, query)
  const { columnFilters, ...rest } = query
  const f = Object.fromEntries(Object.entries(columnFilters ?? {}).map(([k, v]) => [`f.${k}`, v]))
  return getJson('/reports/tasks/page', { ...filterQuery(filters), ...rest, ...f, rowId }, signal)
}

/** GET /candidates/search?q= — the חיפוש מלש"ב box in the navbar. */
export function searchCandidates(q: string, signal?: AbortSignal): Promise<CandidateSearchResult[]> {
  if (USE_MOCKS) return mock.searchCandidates(q)
  return getJson('/candidates/search', { q }, signal)
}

/** GET /me — the logged-in user, including whether they are an admin. */
export function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  if (USE_MOCKS) return mock.getCurrentUser()
  return getJson('/me', undefined, signal)
}

/** GET /announcements — announcements that haven't expired yet, newest first. */
export function getAnnouncements(signal?: AbortSignal): Promise<Announcement[]> {
  if (USE_MOCKS) return mock.getAnnouncements()
  return getJson('/announcements', undefined, signal)
}

/** POST /announcements — admins only. Returns the saved announcement. */
export function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  if (USE_MOCKS) return mock.createAnnouncement(input)
  return sendJson('POST', '/announcements', input)
}

/** PUT /announcements/:id — admins only. Returns the saved announcement. */
export function updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement> {
  if (USE_MOCKS) return mock.updateAnnouncement(id, input)
  return sendJson('PUT', `/announcements/${encodeURIComponent(id)}`, input)
}

/** DELETE /announcements/:id — admins only. */
export function deleteAnnouncement(id: string): Promise<void> {
  if (USE_MOCKS) return mock.deleteAnnouncement(id)
  return deleteRequest(`/announcements/${encodeURIComponent(id)}`)
}

/** Mock mode only: switch the fake user between admin and regular user (for testing). */
export function setMockAdmin(isAdmin: boolean) {
  if (USE_MOCKS) mock.setMockAdmin(isAdmin)
}
