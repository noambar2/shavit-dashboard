/**
 * Fake data used while `VITE_USE_MOCKS=true`.
 * Shapes match `src/api/types.ts` exactly, so these double as response examples.
 */
import type {
  CandidateSearchResult,
  FilterOptions,
  FrameworkItem,
  IndicatorDetails,
  KpiSummary,
  TaskRow,
  TaskStatusKey,
} from '@/api/types'

export const filterOptions: FilterOptions = {
  taskStatus: [
    { id: 'breach', label: 'משימות בחריגה' },
    { id: 'nearBreach', label: 'עתידות לחרוג' },
    { id: 'treatment', label: 'משימות לטיפול' },
    { id: 'paused', label: 'משימות בהשהייה' },
  ],
  indicatorRating: [
    { id: 'high', label: 'מדדים גבוהים' },
    { id: 'medium', label: 'מדדים בינוניים' },
    { id: 'low', label: 'מדדים נמוכים' },
  ],
  orgUnits: [
    { id: 'jerusalem', label: 'לשכת גיוס ירושלים' },
    { id: 'tel-hashomer', label: 'לשכת גיוס תל השומר' },
    { id: 'haifa', label: 'לשכת גיוס חיפה' },
    { id: 'beer-sheva', label: 'לשכת גיוס באר שבע' },
    { id: 'tiberias', label: 'לשכת גיוס טבריה' },
  ],
  professionalFields: [
    { id: 'medical-summons', label: 'רפואי - זימונים' },
    { id: 'community', label: 'קהילה' },
    { id: 'individual', label: 'פרט' },
    { id: 'reserves', label: 'עתודות ושוחררים' },
  ],
  ramadTevelIndications: [
    { id: 'tevel-jerusalem', label: 'אינדיקציית רמ"ד תבל בלשכות גיוס' },
    { id: 'tevel-hq', label: 'אינדיקציית רמ"ד תבל במפקדה' },
  ],
  indicatorClassifications: [
    { id: 'processes', label: 'תהליכים' },
    { id: 'routine', label: 'שגרה' },
  ],
}

export const kpis: KpiSummary = {
  score: { value: 93, changePct: -12 },
  taskStatus: {
    total: 373_027,
    changePct: 30,
    segments: [
      { key: 'breach', label: 'בחריגה', count: 131_261 },
      { key: 'nearBreach', label: 'עתידות לחרוג', count: 99_708 },
      { key: 'treatment', label: 'לטיפול', count: 141_992 },
      { key: 'paused', label: 'בהשהייה', count: 66 },
    ],
  },
  indicatorRating: {
    total: 460,
    segments: [
      { key: 'high', label: 'גבוהים', count: 446 },
      { key: 'medium', label: 'בינוניים', count: 10 },
      { key: 'low', label: 'נמוכים', count: 4 },
    ],
  },
  taskClassification: {
    total: 373_027,
    segments: [
      { key: 'processes', label: 'תהליכים', count: 291_602 },
      { key: 'routine', label: 'שגרה', count: 81_425 },
    ],
  },
}

// ---------------------------------------------------------------------------
// Frameworks hierarchy: לשכות → לשכה → מדור → task groups
// ---------------------------------------------------------------------------

export interface FrameworkNode {
  id: string
  name: string
  breakdown: Record<TaskStatusKey, number>
  score: number
  children?: FrameworkNode[]
}

const leafGroups = (prefix: string, seed: number): FrameworkNode[] =>
  ['חו"ל', 'או"ם', 'מיצוי', 'השתמטות', 'זימון', 'זימון מיוחד'].map((name, i) => {
    const s = (seed + i * 7) % 11
    return {
      id: `${prefix}-g${i}`,
      name,
      breakdown: { treatment: 3 + ((s * 3) % 6), nearBreach: (s * 5) % 5, breach: (s * 2) % 6, paused: s % 4 === 0 ? 1 : 0 },
      score: 55 + ((s * 13) % 45),
    }
  })

const departments = (prefix: string, seed: number): FrameworkNode[] =>
  ['מדור תו"ם', 'מדור מיון', 'מדור קליטה', 'מדור פרט', 'מדור רפואה'].map((name, i) => {
    const children = leafGroups(`${prefix}-d${i}`, seed + i)
    return { id: `${prefix}-d${i}`, name, children, ...sumNodes(children) }
  })

export const frameworksRoot: FrameworkNode[] = filterOptions.orgUnits.map((unit, i) => {
  const children = departments(unit.id, i * 3)
  return { id: unit.id, name: unit.label, children, ...sumNodes(children) }
})

function sumNodes(nodes: FrameworkNode[]): Pick<FrameworkNode, 'breakdown' | 'score'> {
  const breakdown = { treatment: 0, nearBreach: 0, breach: 0, paused: 0 }
  for (const n of nodes) for (const k of Object.keys(breakdown) as TaskStatusKey[]) breakdown[k] += n.breakdown[k]
  const score = Math.round(nodes.reduce((a, n) => a + n.score, 0) / nodes.length)
  return { breakdown, score }
}

export function toFrameworkItem(node: FrameworkNode): Omit<FrameworkItem, 'breakdown' | 'score' | 'total'> {
  return { id: node.id, name: node.name, hasChildren: !!node.children?.length }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export const historyDates = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01']
export const historyTasks = [2, 11, 7, 18, 14]
export const historyParentTasks = [4, 9, 8.5, 8.5, 15.5]
export const historyScores = [78, 84, 81, 90, 93]
export const historyTargetScores = [85, 85, 85, 90, 90]

// ---------------------------------------------------------------------------
// Tasks table
// ---------------------------------------------------------------------------

const row = (
  id: string,
  name: string,
  values: [number, number, number, number, number, number | null, number, number | null],
  extra: Partial<TaskRow> = {},
): TaskRow => {
  const [treatment, nearBreach, breach, paused, total, sla, weightPct, score] = values
  return { id, name, treatment, nearBreach, breach, paused, total, sla, weightPct, score, trendPct: null, hasReport: true, ...extra }
}

export const taskRows: TaskRow[] = [
  row('tom', 'מדור תו"ם', [8371, 2008, 11059, 3, 21441, null, 15, 100]),
  row('mitzui', 'מיצוי', [249, 406, 3700, 0, 4355, null, 0, 100], {
    children: [
      row('mitzui-tzav12', 'צווי 12', [42, 181, 1732, 0, 1955, 30, 5, 86], { indicatorId: 'ind-tzav12' }),
      row('mitzui-malshabim', 'מלש"בים', [42, 181, 1732, 0, 1955, 30, 5, 96], { indicatorId: 'ind-malshabim', trendPct: 4 }),
    ],
  }),
  row('hishtamtut', 'השתמטות', [249, 406, 3700, 0, 4355, null, 0, 50], {
    children: [
      row('hishtamtut-status', 'הכרזות מעמד', [42, 181, 1732, 0, 1955, 30, 5, 96], { indicatorId: 'ind-status' }),
      row('hishtamtut-absent', 'נפקדים', [61, 210, 1205, 2, 1478, 21, 5, 62], { indicatorId: 'ind-absent', trendPct: -8 }),
      row('hishtamtut-abroad', 'שוהים בחו"ל', [33, 95, 664, 0, 792, 45, 3, 71], { indicatorId: 'ind-abroad' }),
    ],
  }),
  row('zimun', 'זימון', [512, 288, 1950, 1, 2751, null, 10, 81], {
    children: [
      row('zimun-first', 'צו ראשון', [301, 140, 1100, 0, 1541, 14, 6, 88], { indicatorId: 'ind-first' }),
      row('zimun-medical', 'ועדות רפואיות', [211, 148, 850, 1, 1210, 30, 4, 74], { indicatorId: 'ind-medical', trendPct: 2 }),
    ],
  }),
]

export const indicators: Record<string, IndicatorDetails> = {
  'ind-tzav12': {
    id: 'ind-tzav12',
    name: 'צווי 12',
    description: 'להציג מלש"בים על סיבת סטטוס צו 12',
    handling: 'להכריז השתמטות או להעביר סטטוס בהתאם',
    classification: 'תהליכים',
    professionalField: 'תו"ם - מיצוי',
    penalty: 0,
    note: 'לא ניתן להפיק נתוני זמן אמת בינשוף',
  },
}

export function fallbackIndicator(id: string, name: string): IndicatorDetails {
  return {
    id,
    name,
    description: `מעקב אחר משימות פתוחות במדד "${name}"`,
    handling: 'לטפל במשימות לפי סדר העדיפויות ולעדכן סטטוס',
    classification: 'שגרה',
    professionalField: 'תו"ם',
    penalty: 0,
  }
}

const firstNames = ['נועה', 'איתי', 'מאיה', 'יונתן', 'תמר', 'אורי', 'שירה', 'דניאל', 'רוני', 'עומר', 'יעל', 'אלון']
const lastNames = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'דהן', 'אזולאי']

export const candidates: CandidateSearchResult[] = Array.from({ length: 60 }, (_, i) => ({
  id: `c${i + 1}`,
  fullName: `${firstNames[i % firstNames.length]} ${lastNames[(i * 7) % lastNames.length]}`,
  idNumber: String(300_000_000 + i * 104_729).slice(0, 9),
}))
