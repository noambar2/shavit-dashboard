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

## Features

- **Navbar:** tabs, candidate search that suggests results as you type, and (fake-data mode only) a מנהלן / משתמש רגיל test toggle
- **Filter bar:**
  - an icon filter menu: collapsible radio groups with search and a visible scrollbar
  - the כלל מיטב / לשכות / מפקדה toggle
  - a date picker for a day, a whole month or a whole year
  - labelled active-filter chips
  - refresh, with a "נתונים עדכניים ל…" timestamp
- **Admin announcements:** banners on the home page. Admins create, edit and delete them with an expiry date; regular users can hide one until the next page load.
- **KPI cards:** clicking a donut slice or legend row filters the whole dashboard. Large totals are shortened (373K), with the exact number on hover.
- **מסגרות:** stacked bars or score bars, drill-down with breadcrumbs, scrolls sideways when crowded
- **התפתחות היסטורית:** ציון, ציון אב and a dashed ממוצע line (in משימות mode, משימות and משימות אב)
- **משימות table:**
  - a tree of any depth
  - a generic per-column filter
  - show/hide columns
  - clickable counts and an eye icon that open the in-app report view
  - Excel export: a דוח שמי, or a דוח מרוכז (summary sheet plus one sheet per lowest-level row)
- **Report view:**
  - סוג משימה chips with counts
  - search
  - per-column filters
  - sorting and paging
  - Excel export of exactly what's shown
  - a shareable link (`?report=…&type=…`)
- **Full screen** for the table and both charts
- **Layouts:** wide (1280px and up) and narrow, plus loading and error (retry) states on every card

## Backend

`backend/` holds a working **FastAPI example server** that implements the whole contract, with an example database. See [backend/README.md](backend/README.md).

What the dashboard sends and receives:
- [API_CONTRACT.md](API_CONTRACT.md): the rules
- [API_EXAMPLES.md](API_EXAMPLES.md): real request/response examples for every endpoint

## Not designed yet

- The פרטי מלש"ב and משתמשים pages are placeholders
- The ⓘ texts on card titles are placeholder copy in `src/constants/colors.ts`

## Deploy (GitHub Pages)

Live at **https://noambar2.github.io/shavit-dashboard/**, running on the mock data.

This folder is published to its own repo, [noambar2/shavit-dashboard](https://github.com/noambar2/shavit-dashboard). Every push to `main` there runs `.github/workflows/deploy.yml`, which builds the app and deploys it. To publish changes from the parent repo:

```bash
git push https://github.com/noambar2/shavit-dashboard.git "$(git subtree split --prefix shavit-dashboard)":main
```
