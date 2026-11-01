# מלש"ביה — Dashboard

A Vue 3 implementation of the home dashboard from the Figma file **שביט**. It currently runs on fake data. The backend contract is in **[API_CONTRACT.md](API_CONTRACT.md)**.

## Run it

```bash
npm install
cp .env.example .env    # mocks are on by default
npm run dev
```

`npm run build` type-checks the project and produces `dist/`.

## Stack

Vue 3 (`<script setup>` + TypeScript), Vite, Pinia (filter state), Vue Router, ECharts via `vue-echarts`. The layout is right-to-left Hebrew, using the Noto Sans Hebrew font.

## Where things are

```
src/
  api/
    types.ts         ← request/response types (the contract)
    dashboard.ts     ← every backend call; switches between mocks and the real API
    http.ts          ← fetch wrapper (base URL, query string, errors, file download)
  mocks/             ← fake data and fake handlers (delete once the backend is live)
  stores/filters.ts  ← all dashboard filters: scope, date, filter menu, donut clicks
  composables/
    useFetch.ts      ← useDashboardData(): reloads a card when filters or refresh change
  components/
    layout/          ← navbar + candidate search
    filters/         ← סינונים menu, scope toggle, date picker, active chips
    kpi/             ← ציון card + reusable donut card
    charts/          ← מסגרות (drill-down bars) and התפתחות היסטורית (lines)
    table/           ← משימות tree table + indicator tooltip
  constants/colors.ts ← palette colours and the ⓘ texts on card titles
  styles/base.css    ← design tokens from the Figma palette
```

## How data flows

1. Every filter control writes to the Pinia store (`stores/filters.ts`).
2. Each card calls `useDashboardData(loader)`. Whenever the filters change, or the user presses refresh (🔄), the card calls its function in `api/dashboard.ts` with the full filter object.
3. `api/dashboard.ts` returns mock data while `VITE_USE_MOCKS=true`, and calls the real endpoint otherwise.

## Implemented from the Figma

- Navbar with tabs and a candidate search that suggests results as you type
- Filter bar: filter menu (collapsible radio groups, with search where the design has it), כלל מיטב / לשכות / מפקדה toggle, day / month / year date picker, active filter chips, clear all, refresh
- KPI cards. Clicking a donut slice or legend row filters the whole dashboard; the other slices fade and a reset (איפוס סינונים) button appears
- מסגרות: stacked bars, drill-down with breadcrumbs, a משימות / ציונים toggle, detailed tooltips
- התפתחות היסטורית: smooth lines, משימות / ציונים toggle
- משימות table: expand/collapse rows, fullscreen view, show/hide columns, search rows, ⓘ indicator tooltip, דוח שמי download
- Loading and error (retry) states on every card

## Not designed yet

- The פרטי מלש"ב and משתמשים pages are placeholders
- The ⓘ texts on card titles are placeholder copy in `src/constants/colors.ts`
