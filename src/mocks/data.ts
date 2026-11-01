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
    { id: 'beit-shemesh', label: 'לשכת גיוס בית שמש' },
    { id: 'netanya', label: 'לשכת גיוס נתניה' },
    { id: 'ashdod', label: 'לשכת גיוס אשדוד' },
    { id: 'rishon', label: 'לשכת גיוס ראשון לציון' },
    { id: 'kiryat-shmona', label: 'לשכת גיוס קריית שמונה' },
    { id: 'eilat', label: 'לשכת גיוס אילת' },
    { id: 'afula', label: 'לשכת גיוס עפולה' },
    { id: 'hadera', label: 'לשכת גיוס חדרה' },
    { id: 'petah-tikva', label: 'לשכת גיוס פתח תקווה' },
    { id: 'nazareth', label: 'לשכת גיוס נצרת' },
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
  ['חו"ל', 'או"ם', 'מיצוי', 'השתמטות', 'זימון', 'זימון מיוחד', 'צווי 12', 'מלש"בים', 'הכרזות מעמד', 'נפקדים', 'ועדות רפואיות', 'דחיות שירות'].map((name, i) => {
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
    return { id: `${prefix}-d${i}`, name, children, ...sumNodes(children, seed * 5 + i) }
  })

export const frameworksRoot: FrameworkNode[] = filterOptions.orgUnits.map((unit, i) => {
  const children = departments(unit.id, i * 3)
  return { id: unit.id, name: unit.label, children, ...sumNodes(children, i) }
})

/** Sums the children; `spread` nudges the averaged score so parents don't all land on the same number. */
function sumNodes(nodes: FrameworkNode[], spread = 0): Pick<FrameworkNode, 'breakdown' | 'score'> {
  const breakdown = { treatment: 0, nearBreach: 0, breach: 0, paused: 0 }
  for (const n of nodes) for (const k of Object.keys(breakdown) as TaskStatusKey[]) breakdown[k] += n.breakdown[k]
  const avg = nodes.reduce((a, n) => a + n.score, 0) / nodes.length
  const score = Math.max(40, Math.min(100, Math.round(avg + ((spread * 37) % 41) - 18)))
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
export const historyParentScores = [84, 80, 86, 85, 89]

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

/** A lowest-level indicator row with made-up but stable numbers (`k` varies them). */
const leaf = (id: string, name: string, k: number): TaskRow => {
  const [t, n, b, p] = [20 + ((k * 13) % 60), 15 + ((k * 7) % 40), 80 + ((k * 37) % 300), k % 4 === 0 ? 1 : 0]
  return row(id, name, [t, n, b, p, t + n + b + p, 14 + ((k * 5) % 30), 1 + (k % 4), 50 + ((k * 17) % 50)], {
    indicatorId: `ind-${id}`,
    trendPct: k % 3 === 0 ? (k % 2 ? 3 : -5) : null,
  })
}

/** A parent row whose counts are the sum of its children and whose score is their average. */
const group = (id: string, name: string, children: TaskRow[]): TaskRow => {
  const sum = (key: 'treatment' | 'nearBreach' | 'breach' | 'paused' | 'total' | 'weightPct') => children.reduce((a, c) => a + c[key], 0)
  const scores = children.map((c) => c.score).filter((v): v is number => v !== null)
  const score = scores.length ? Math.round(scores.reduce((a, v) => a + v, 0) / scores.length) : null
  return row(id, name, [sum('treatment'), sum('nearBreach'), sum('breach'), sum('paused'), sum('total'), null, sum('weightPct'), score], { children })
}

/** ענף ← מדור ← משרד ← צוות ← מדד: five levels deep, to exercise the tree, filters and Excel export. */
const deepBranch = group('anaf', 'ענף כוח אדם', [
  group('anaf-gius', 'מדור גיוס', [
    group('anaf-gius-jlm', 'משרד ירושלים', [
      group('anaf-gius-jlm-miun', 'צוות מיון', [
        leaf('anaf-gius-jlm-miun-1', 'ראיונות אישיים', 1),
        leaf('anaf-gius-jlm-miun-2', 'מבחני מיון', 2),
      ]),
      group('anaf-gius-jlm-refua', 'צוות רפואה', [
        leaf('anaf-gius-jlm-refua-1', 'בדיקות רפואיות', 3),
        leaf('anaf-gius-jlm-refua-2', 'השלמת מסמכים', 4),
        leaf('anaf-gius-jlm-refua-3', 'ועדות ערר', 5),
      ]),
    ]),
    group('anaf-gius-hfa', 'משרד חיפה', [
      group('anaf-gius-hfa-miun', 'צוות מיון', [
        leaf('anaf-gius-hfa-miun-1', 'ראיונות אישיים', 6),
        leaf('anaf-gius-hfa-miun-2', 'מבחני מיון', 7),
      ]),
    ]),
    leaf('anaf-gius-bs', 'משרד באר שבע', 8),
  ]),
  group('anaf-klita', 'מדור קליטה', [
    group('anaf-klita-north', 'משרד צפון', [
      leaf('anaf-klita-north-1', 'שיבוץ ראשוני', 9),
      leaf('anaf-klita-north-2', 'מעקב קליטה', 10),
    ]),
    leaf('anaf-klita-south', 'משרד דרום', 11),
  ]),
])

export const taskRows: TaskRow[] = [
  row('tom', 'מדור תו"ם', [8371, 2008, 11059, 3, 21441, null, 15, 100]),
  deepBranch,
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
      // Three levels deep, to show how a דוח מרוכז handles grandchildren.
      row('zimun-first', 'צו ראשון', [301, 140, 1100, 0, 1541, 14, 6, 88], {
        children: [
          row('zimun-first-jlm', 'צו ראשון - ירושלים', [180, 80, 650, 0, 910, 14, 3, 91], { indicatorId: 'ind-first' }),
          row('zimun-first-hfa', 'צו ראשון - חיפה', [121, 60, 450, 0, 631, 14, 3, 84], { indicatorId: 'ind-first' }),
        ],
      }),
      row('zimun-medical', 'ועדות רפואיות', [211, 148, 850, 1, 1210, 30, 4, 74], { indicatorId: 'ind-medical', trendPct: 2 }),
    ],
  }),
  // More groups, so there's enough to scroll in the table (also in full screen).
  ...['גיוס', 'מיון', 'קליטה', 'עתודה', 'שוחררים', 'רפואה', 'פרט', 'משמעת'].map((name, g) => {
    const children = ['א', 'ב', 'ג'].map((suffix, c) => {
      const k = (g * 3 + c) % 7
      const [t, n, b, p] = [30 + k * 11, 60 + k * 17, 400 + k * 133, k % 3 === 0 ? 1 : 0]
      return row(`g${g}-c${c}`, `${name} - ${suffix}`, [t, n, b, p, t + n + b + p, 14 + k * 5, 2 + (k % 4), 55 + ((k * 13) % 45)], {
        indicatorId: `ind-g${g}-c${c}`,
        trendPct: k % 2 ? null : k - 3,
      })
    })
    const sum = (key: 'treatment' | 'nearBreach' | 'breach' | 'paused' | 'total') => children.reduce((a, c) => a + c[key], 0)
    return row(`g${g}`, name, [sum('treatment'), sum('nearBreach'), sum('breach'), sum('paused'), sum('total'), null, 5, 60 + ((g * 17) % 40)], { children })
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

// ---------------------------------------------------------------------------
// Named report (דוח שמי) task lines
// ---------------------------------------------------------------------------

export const reportValues = {
  tracks: ['יעד', 'פעמי עתידים'],
  corps: ['חיל האוויר', 'חיל הים', 'אמ"ן', 'תקשוב', 'הנדסה קרבית', 'שריון'],
  majors: ['הנדסת חשמל', 'הנדסת מכונות', 'מדעי המחשב', 'הנדסת תעשייה וניהול', 'הנדסה אזרחית'],
  positions: ['מהנדס/ת מערכות', 'קצין/ת תקשוב', 'מפתח/ת תוכנה', 'מהנדס/ת חשמל', 'מנהל/ת פרויקטים'],
  pauseReasons: ['המתנה למסמכים', 'ועדה רפואית', 'שהייה בחו"ל', 'ערעור בתהליך'],
}
