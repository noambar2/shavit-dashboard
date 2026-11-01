const nf = new Intl.NumberFormat('en-US')

export const formatNumber = (n: number | null | undefined) => (n === null || n === undefined ? '-' : nf.format(n))

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
