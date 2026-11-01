/**
 * API contract between the dashboard UI and the backend.
 *
 * Every endpoint the UI calls is listed in `src/api/dashboard.ts`, and every
 * request/response shape is defined here. `API_CONTRACT.md` in the project
 * root documents the same contract with JSON examples.
 *
 * Conventions:
 * - Dates are ISO strings: `YYYY-MM-DD`.
 * - Percentages are plain numbers (12 means 12%), and may be negative.
 * - Display labels (Hebrew) come from the backend so wording can change without a UI release.
 */

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** The segmented control in the filter bar: כלל מיטב / לשכות / מפקדה */
export type Scope = 'all' | 'bureaus' | 'hq'

/** The date picker tabs: יום / חודש / שנה */
export type DateGranularity = 'day' | 'month' | 'year'

/** Toggle shown on the frameworks and history charts: משימות / ציונים */
export type MetricMode = 'tasks' | 'scores'

/** לטיפול / עתידות לחרוג / בחריגה / בהשהייה */
export type TaskStatusKey = 'treatment' | 'nearBreach' | 'breach' | 'paused'

/** גבוהים / בינוניים / נמוכים */
export type RatingKey = 'high' | 'medium' | 'low'

/** תהליכים / שגרה */
export type ClassificationKey = 'processes' | 'routine'

// ---------------------------------------------------------------------------
// Filters — sent as query-string params on every dashboard request
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  scope: Scope
  /** The selected date (for `month`/`year` granularity, the first day of that period). */
  date: string
  dateGranularity: DateGranularity
  taskStatus?: TaskStatusKey
  indicatorRating?: RatingKey
  /** מבנה ארגוני — id from `FilterOptions.orgUnits` */
  orgUnitId?: string
  /** תחום מקצועי — id from `FilterOptions.professionalFields` */
  professionalFieldId?: string
  /** אינדיקציית רמ"ד תבל — id from `FilterOptions.ramadTevelIndications` */
  ramadTevelIndicationId?: string
  /** סיווג המדד */
  indicatorClassification?: ClassificationKey
}

/** The filter keys the user can set from the filter menu / chart legends. */
export type FilterKey = Exclude<keyof DashboardFilters, 'scope' | 'date' | 'dateGranularity'>

export interface Option<T extends string = string> {
  id: T
  label: string
}

/** GET /filters/options */
export interface FilterOptions {
  taskStatus: Option<TaskStatusKey>[]
  indicatorRating: Option<RatingKey>[]
  orgUnits: Option[]
  professionalFields: Option[]
  ramadTevelIndications: Option[]
  indicatorClassifications: Option<ClassificationKey>[]
}

// ---------------------------------------------------------------------------
// KPI cards (top row)
// ---------------------------------------------------------------------------

export interface Segment<K extends string = string> {
  key: K
  label: string
  count: number
}

export interface Distribution<K extends string = string> {
  /** Number shown in the middle of the donut. */
  total: number
  /** Change vs. the previous period, shown under the total (e.g. ↑30%). Omit to hide. */
  changePct?: number
  segments: Segment<K>[]
}

/** GET /dashboard/kpis */
export interface KpiSummary {
  /** ציון card: 0–100 */
  score: { value: number; changePct: number }
  /** סטטוס משימות card */
  taskStatus: Distribution<TaskStatusKey>
  /** דירוג מדדים card */
  indicatorRating: Distribution<RatingKey>
  /** סיווג משימות card */
  taskClassification: Distribution<ClassificationKey>
}

// ---------------------------------------------------------------------------
// מסגרות — stacked bar chart with drill-down
// ---------------------------------------------------------------------------

export interface FrameworkItem {
  id: string
  name: string
  /** True when clicking the bar drills down into child frameworks. */
  hasChildren: boolean
  /** Number shown above the bar. */
  total: number
  /** `metric=tasks`: task counts per status (stacked bars). */
  breakdown?: Record<TaskStatusKey, number>
  /** `metric=scores`: score 0–100 (single bar). */
  score?: number
}

export interface BreadcrumbItem {
  /** `null` = the root level. */
  id: string | null
  name: string
}

/** GET /dashboard/frameworks?parentId=&metric= */
export interface FrameworksResponse {
  /** Path from the root to the current level, root first. */
  path: BreadcrumbItem[]
  items: FrameworkItem[]
}

// ---------------------------------------------------------------------------
// התפתחות היסטורית — line chart
// ---------------------------------------------------------------------------

export interface HistoryPoint {
  date: string
  value: number
}

export interface HistorySeries {
  key: string
  label: string
  points: HistoryPoint[]
}

/** GET /dashboard/history?metric= */
export interface HistoryResponse {
  series: HistorySeries[]
}

// ---------------------------------------------------------------------------
// משימות — tree table
// ---------------------------------------------------------------------------

export interface TaskRow {
  id: string
  name: string
  /** When set, the row shows an ⓘ icon that loads `GET /indicators/:indicatorId`. */
  indicatorId?: string
  treatment: number
  nearBreach: number
  breach: number
  paused: number
  total: number
  /** SLA in days. `null` renders as "-". */
  sla: number | null
  /** משקל, as a percentage. */
  weightPct: number
  /** ציון 0–100. `null` renders as "-". */
  score: number | null
  /** מגמה, change in percent. `null` renders as "-". */
  trendPct: number | null
  /**
   * Whether this row can be exported to Excel: a lowest-level row exports its
   * דוח שמי, a row with children exports a דוח מרוכז (see GET /reports/tasks).
   */
  hasReport: boolean
  children?: TaskRow[]
}

/** GET /dashboard/tasks */
export interface TasksResponse {
  rows: TaskRow[]
}

// ---------------------------------------------------------------------------
// Indicator details — the tooltip on ⓘ icons in the table
// ---------------------------------------------------------------------------

/** GET /indicators/:id */
export interface IndicatorDetails {
  id: string
  name: string
  /** מהות המדד */
  description: string
  /** טיפול במדד */
  handling: string
  /** סיווג המדד */
  classification: string
  /** תחום מקצועי */
  professionalField: string
  /** קנס */
  penalty: number
  /** Optional footnote, e.g. "לא ניתן להפיק נתוני זמן אמת בינשוף". */
  note?: string
}

// ---------------------------------------------------------------------------
// Navbar search
// ---------------------------------------------------------------------------

/** GET /candidates/search?q= */
export interface CandidateSearchResult {
  id: string
  fullName: string
  /** Personal / ID number, shown next to the name. */
  idNumber: string
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/** GET /me — who is logged in. The backend decides `isAdmin` from the employee id. */
export interface CurrentUser {
  employeeId: string
  fullName: string
  isAdmin: boolean
}

// ---------------------------------------------------------------------------
// Announcements — banners on the home page, managed by admins
// ---------------------------------------------------------------------------

/** `info` = blue banner, `warning` = orange banner. */
export type AnnouncementSeverity = 'info' | 'warning'

/** One item from GET /announcements */
export interface Announcement {
  id: string
  /** Optional bold heading before the message. */
  title?: string
  message: string
  severity: AnnouncementSeverity
  /** ISO date-time, e.g. `2026-11-08T21:59:59.000Z`. */
  createdAt: string
  /** ISO date-time. The announcement is hidden from this moment on. */
  expiresAt: string
  createdBy: { employeeId: string; fullName: string }
}

/** Body of POST /announcements and PUT /announcements/:id (admins only). */
export interface AnnouncementInput {
  title?: string
  message: string
  severity: AnnouncementSeverity
  expiresAt: string
}

// ---------------------------------------------------------------------------
// Excel reports — דוח שמי (named) and דוח מרוכז (consolidated)
// ---------------------------------------------------------------------------

/** How a report column is written to Excel: dates become real date cells, numbers stay numeric. */
export type ReportColumnType = 'text' | 'number' | 'date'

/** One column of the דוח שמי. The backend decides which columns exist and in what order. */
export interface ReportColumn {
  /** Key of the value in each task object. */
  key: string
  /** Column header in Excel. */
  label: string
  type: ReportColumnType
  /** Optional column width in Excel characters. */
  width?: number
}

/**
 * One task line: `{ [column.key]: value }`. Dates are `YYYY-MM-DD`, empty values are `null`.
 * Every task MUST include `daysToBreach` and `pauseEndDate` (even if they aren't listed as
 * columns), because the UI computes the סוג משימה column from them — see src/config.ts.
 */
export type ReportTask = Record<string, string | number | null>

/**
 * GET /reports/tasks?rowId=
 * `columns` describes the דוח שמי sheets; `rows` has one entry per lowest-level row under
 * `rowId` (or just `rowId` itself if it has no children).
 */
export interface ReportTasksResponse {
  columns: ReportColumn[]
  rows: { rowId: string; tasks: ReportTask[] }[]
}
