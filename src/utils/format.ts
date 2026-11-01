const nf = new Intl.NumberFormat('en-US')

export const formatNumber = (n: number | null | undefined) => (n === null || n === undefined ? '-' : nf.format(n))

/** Numbers from 100,000 up are shortened: 373,027 → 373K, 1,234,567 → 1.2M (smaller ones stay exact). */
export const COMPACT_FROM = 100_000
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
export const formatCompact = (n: number) => (Math.abs(n) >= COMPACT_FROM ? compact.format(n) : nf.format(n))

export const formatPct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%')

/** `2026-12-13` → `13/12/2026` */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** `2026-01-01` → `01/01/26` (chart axis) */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** Score colour thresholds used in the table and score bars. */
export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text)'
  if (score >= 90) return 'var(--success)'
  if (score >= 70) return 'var(--warning)'
  return 'var(--error)'
}

/** Date → `01/11/2026 14:32` */
export function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
