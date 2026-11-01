/**
 * Builds the Excel exports for the משימות table:
 * - דוח שמי    — a lowest-level row: one sheet listing its tasks.
 * - דוח מרוכז  — a row with children: a summary sheet (the row + every row under it, like the table)
 *                plus one דוח שמי sheet per lowest-level row under it.
 *
 * ExcelJS is loaded on demand, so it doesn't slow down the first page load.
 */
import type { Workbook, Worksheet } from 'exceljs'
import type { ReportColumn, ReportTask, TaskRow } from '@/api/types'
import { NEAR_BREACH_DAYS } from '@/config'
import { formatDateTime } from '@/utils/format'

// ---------------------------------------------------------------------------
// סוג משימה
// ---------------------------------------------------------------------------

export type ReportTaskType = 'paused' | 'breach' | 'nearBreach' | 'treatment'

export const TASK_TYPE_LABELS: Record<ReportTaskType, string> = {
  breach: 'משימות בחריגה',
  nearBreach: 'עתידות לחרוג',
  treatment: 'משימות לטיפול',
  paused: 'משימות בהשהייה',
}

const TASK_TYPE_COLORS: Record<ReportTaskType, string> = {
  breach: 'FFE04A5D',
  nearBreach: 'FFD8891F',
  treatment: 'FF0E9384',
  paused: 'FF3D6DEB',
}

/** Computed from `daysToBreach` and `pauseEndDate`. See `NEAR_BREACH_DAYS` in src/config.ts. */
export function taskType(task: ReportTask, today: string): ReportTaskType {
  const pauseEnd = task.pauseEndDate
  const days = Number(task.daysToBreach)
  if (typeof pauseEnd === 'string' && pauseEnd >= today) return 'paused'
  if (days < 0) return 'breach'
  if (days <= NEAR_BREACH_DAYS) return 'nearBreach'
  return 'treatment'
}

// ---------------------------------------------------------------------------
// Shared styling
// ---------------------------------------------------------------------------

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5EDFF' } } as const
const MAIN_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FB' } } as const
const BORDER = { style: 'thin', color: { argb: 'FFE1EBF5' } } as const
const FONT = 'Arial'
const DATE_FMT = 'dd/mm/yyyy'

/** `YYYY-MM-DD` → a UTC Date, so Excel shows the same calendar day in every timezone. */
const excelDate = (iso: string | number | null): Date | string | number | null => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Excel sheet names: max 31 chars, no []:*?/\ and unique within the workbook. */
function sheetName(wb: Workbook, wanted: string): string {
  const base = wanted.replace(/[[\]:*?/\\]/g, '-').slice(0, 31).trim() || 'גיליון'
  let name = base
  for (let i = 2; wb.getWorksheet(name); i++) name = `${base.slice(0, 31 - ` (${i})`.length)} (${i})`
  return name
}

const linkTo = (sheet: string) => `#'${sheet.replace(/'/g, "''")}'!A1`

function styleHeader(ws: Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber)
  row.font = { name: FONT, bold: true, color: { argb: 'FF071938' } }
  row.height = 22
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
}

function addTitle(ws: Worksheet, title: string, meta: string) {
  ws.getCell('A1').value = title
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true, color: { argb: 'FF002A99' } }
  ws.getCell('A2').value = meta
  ws.getCell('A2').font = { name: FONT, size: 10, color: { argb: 'FF68727D' } }
}

// ---------------------------------------------------------------------------
// דוח שמי sheet
// ---------------------------------------------------------------------------

const NAMED_HEADER_ROW = 4
/** Always the first column; computed by the UI, not sent by the backend. */
const TASK_TYPE_COLUMN: ReportColumn = { key: '__taskType', label: 'סוג משימה', type: 'text', width: 18 }

function cellValue(task: ReportTask, col: ReportColumn) {
  const v = task[col.key]
  if (v === null || v === undefined) return null
  if (col.type === 'date') return excelDate(v)
  if (col.type === 'number') return typeof v === 'number' ? v : Number(v)
  return String(v)
}

function addNamedSheet(
  wb: Workbook,
  row: TaskRow,
  tasks: ReportTask[],
  backendColumns: ReportColumn[],
  meta: string,
  today: string,
  backLink?: string,
  /** Sheet tab name, when it should differ from the row name (e.g. to tell apart rows with the same name). */
  sheetTitle?: string,
) {
  const columns = [TASK_TYPE_COLUMN, ...backendColumns]
  const ws = wb.addWorksheet(sheetName(wb, sheetTitle ?? row.name), {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: NAMED_HEADER_ROW }],
  })
  addTitle(ws, `דוח שמי – ${row.name}`, `${meta} · ${tasks.length} משימות`)
  if (backLink) {
    ws.getCell('A3').value = { text: '→ חזרה לדוח המרוכז', hyperlink: linkTo(backLink) }
    ws.getCell('A3').font = { name: FONT, color: { argb: 'FF0046FE' }, underline: true }
  }

  ws.columns = columns.map((c) => ({
    width: c.width ?? Math.max(11, Math.min(24, c.label.length + 4)),
  }))
  ws.getRow(NAMED_HEADER_ROW).values = columns.map((c) => c.label)
  styleHeader(ws, NAMED_HEADER_ROW)

  tasks.forEach((t, i) => {
    const type = taskType(t, today)
    const r = ws.getRow(NAMED_HEADER_ROW + 1 + i)
    r.values = [TASK_TYPE_LABELS[type], ...backendColumns.map((c) => cellValue(t, c))]
    r.font = { name: FONT }
    r.getCell(1).font = { name: FONT, bold: true, color: { argb: TASK_TYPE_COLORS[type] } }
    columns.forEach((c, idx) => {
      const cell = r.getCell(idx + 1)
      if (c.type === 'date') cell.numFmt = DATE_FMT
      if (c.key === 'daysToBreach' && Number(t.daysToBreach) < 0) cell.font = { name: FONT, color: { argb: 'FFE04A5D' } }
    })
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: BORDER }
      cell.alignment = { horizontal: 'center' }
    })
  })

  ws.autoFilter = {
    from: { row: NAMED_HEADER_ROW, column: 1 },
    to: { row: NAMED_HEADER_ROW + Math.max(tasks.length, 1), column: columns.length },
  }
  return ws.name
}

// ---------------------------------------------------------------------------
// דוח מרוכז summary sheet
// ---------------------------------------------------------------------------

const SUMMARY_COLUMNS = [
  { header: 'מסגרת', width: 30 },
  { header: 'משימות לטיפול', width: 13 },
  { header: 'עתידות לחרוג', width: 13 },
  { header: 'משימות בחריגה', width: 13 },
  { header: 'משימות בהשהייה', width: 13 },
  { header: 'סה"כ', width: 11 },
  { header: 'SLA', width: 8 },
  { header: 'משקל', width: 8 },
  { header: 'ציון', width: 8 },
  { header: 'מגמה', width: 8 },
]

function summaryValues(row: TaskRow, name: string | { text: string; hyperlink: string }) {
  return [
    name,
    row.treatment,
    row.nearBreach,
    row.breach,
    row.paused,
    row.total,
    row.sla ?? '-',
    row.weightPct / 100,
    row.score ?? '-',
    row.trendPct === null ? '-' : row.trendPct / 100,
  ]
}

function styleSummaryRow(ws: Worksheet, rowNumber: number, opts: { bold?: boolean; fill?: boolean; link?: boolean } = {}) {
  const r = ws.getRow(rowNumber)
  r.font = { name: FONT, bold: opts.bold }
  r.getCell(8).numFmt = '0%'
  r.getCell(10).numFmt = '+0%;-0%;0%'
  r.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.border = { bottom: BORDER }
    cell.alignment = { horizontal: col === 1 ? 'right' : 'center' }
    if (opts.fill) cell.fill = MAIN_ROW_FILL
  })
  if (opts.link) r.getCell(1).font = { name: FONT, bold: opts.bold, color: { argb: 'FF0046FE' }, underline: true }
}

/** Every row under `row`, depth-first, with its depth (1 = direct child) and ancestors (closest first). */
function descendants(row: TaskRow, depth = 1, ancestors: TaskRow[] = []): { row: TaskRow; depth: number; ancestors: TaskRow[] }[] {
  const chain = [row, ...ancestors]
  return (row.children ?? []).flatMap((c) => [{ row: c, depth, ancestors: chain }, ...descendants(c, depth + 1, chain)])
}

/**
 * Sheet names for the lowest-level rows. A name used more than once gets the closest ancestor
 * that tells the rows apart, e.g. "משרד ירושלים - ראיונות אישיים" vs "משרד חיפה - ראיונות אישיים".
 */
function leafSheetTitles(leaves: { row: TaskRow; ancestors: TaskRow[] }[]): Map<string, string> {
  const titles = new Map<string, string>()
  const byName = new Map<string, typeof leaves>()
  for (const l of leaves) byName.set(l.row.name, [...(byName.get(l.row.name) ?? []), l])
  for (const [name, group] of byName) {
    if (group.length === 1) {
      titles.set(group[0].row.id, name)
      continue
    }
    const depth = Math.max(...group.map((g) => g.ancestors.length))
    let level = 0
    while (level < depth && new Set(group.map((g) => g.ancestors[level]?.name)).size < group.length) level++
    for (const g of group) titles.set(g.row.id, g.ancestors[level] ? `${g.ancestors[level].name} - ${name}` : name)
  }
  return titles
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReportContext {
  /** e.g. "נתונים ל: 01/11/2026 · כלל מיטב · משימות בחריגה" */
  filtersLabel: string
  /** `YYYY-MM-DD`, used to decide whether a pause is still active. */
  today: string
}

export const isLeaf = (row: TaskRow) => !row.children?.length

/** Builds the workbook for `row` and returns it as an .xlsx Blob plus a file name. */
export async function buildReport(
  row: TaskRow,
  report: { columns: ReportColumn[]; tasksByRow: Map<string, ReportTask[]> },
  ctx: ReportContext,
): Promise<{ blob: Blob; filename: string }> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'מלש"ביה'
  wb.created = new Date()
  const meta = `הופק: ${formatDateTime(new Date())} · ${ctx.filtersLabel}`
  const day = ctx.today.split('-').reverse().join('-')

  if (isLeaf(row)) {
    addNamedSheet(wb, row, report.tasksByRow.get(row.id) ?? [], report.columns, meta, ctx.today)
    return { blob: await toBlob(wb), filename: `דוח שמי - ${row.name} - ${day}.xlsx` }
  }

  // Summary sheet first, so it opens on it; named sheets are added after and linked from it.
  const summary = wb.addWorksheet(sheetName(wb, 'דוח מרוכז'), { views: [{ rightToLeft: true }] })
  summary.columns = SUMMARY_COLUMNS.map((c) => ({ width: c.width }))
  addTitle(summary, `דוח מרוכז – ${row.name}`, meta)

  summary.getRow(4).values = SUMMARY_COLUMNS.map((c) => c.header)
  styleHeader(summary, 4)
  summary.getRow(5).values = summaryValues(row, row.name)
  styleSummaryRow(summary, 5, { bold: true, fill: true })

  summary.getCell('A7').value = 'פירוט תתי מסגרות'
  summary.getCell('A7').font = { name: FONT, size: 12, bold: true, color: { argb: 'FF071938' } }
  summary.getCell('A8').value = 'לחיצה על שם מסגרת בכחול פותחת את הדוח השמי שלה'
  summary.getCell('A8').font = { name: FONT, size: 9, color: { argb: 'FF68727D' } }
  summary.getRow(9).values = SUMMARY_COLUMNS.map((c) => c.header)
  styleHeader(summary, 9)

  let line = 10
  const rows = descendants(row)
  const titles = leafSheetTitles(rows.filter((r) => isLeaf(r.row)))

  for (const { row: child, depth } of rows) {
    const indent = '    '.repeat(depth - 1)
    if (isLeaf(child)) {
      const title = titles.get(child.id) ?? child.name
      const sheet = addNamedSheet(wb, child, report.tasksByRow.get(child.id) ?? [], report.columns, meta, ctx.today, summary.name, title)
      summary.getRow(line).values = summaryValues(child, { text: indent + child.name, hyperlink: linkTo(sheet) })
      styleSummaryRow(summary, line, { link: true })
    } else {
      summary.getRow(line).values = summaryValues(child, indent + child.name)
      styleSummaryRow(summary, line, { bold: true })
    }
    line++
  }

  return { blob: await toBlob(wb), filename: `דוח מרוכז - ${row.name} - ${day}.xlsx` }
}

async function toBlob(wb: Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
