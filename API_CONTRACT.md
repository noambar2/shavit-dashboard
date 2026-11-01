# מלש"ביה Dashboard — API Contract

This is everything the frontend needs from the backend. The UI already works against fake data. Once these endpoints exist, set `VITE_USE_MOCKS=false` and it switches over with no code changes.

- **TypeScript source of truth:** [`src/api/types.ts`](src/api/types.ts)
- **Where each endpoint is called:** [`src/api/dashboard.ts`](src/api/dashboard.ts)
- **Example responses:** [`src/mocks/data.ts`](src/mocks/data.ts) (the fake data has exactly the shapes below)

## General rules

| Topic | Rule |
| --- | --- |
| Base URL | All paths below are relative to `VITE_API_BASE_URL` (default `/api`). |
| Method | Everything is `GET`. |
| Format | JSON, UTF‑8. Field names are camelCase. |
| Dates | `YYYY-MM-DD`. |
| Percentages | Plain numbers: `12` means 12%. Negative = decrease. |
| Labels | Hebrew display labels come from the backend (`label`, `name`), so wording can change without a frontend release. |
| Auth | Requests are sent with `credentials: 'include'` (cookies). Tell the frontend if you need a bearer token instead; it's a single change in `src/api/http.ts`. |
| Errors | Any non‑2xx status shows a "שגיאה בטעינת הנתונים / נסה שוב" state on the affected card. The body is ignored. |
| Cancellation | The UI aborts in-flight requests when filters change, so expect cancelled connections. |

## Dashboard filters (query params)

Every `/dashboard/*` endpoint (and `/reports/named`) receives the current filters as query params. Empty filters are **omitted**, not sent as empty strings.

| Param | Type | Values | UI control |
| --- | --- | --- | --- |
| `scope` | always sent | `all` \| `bureaus` \| `hq` | כלל מיטב / לשכות / מפקדה |
| `date` | always sent | `YYYY-MM-DD` | Date picker. For `month`/`year` it's the first day of the period. |
| `dateGranularity` | always sent | `day` \| `month` \| `year` | Date picker tabs: יום / חודש / שנה |
| `taskStatus` | optional | `treatment` \| `nearBreach` \| `breach` \| `paused` | Filter menu, or clicking the סטטוס משימות donut |
| `indicatorRating` | optional | `high` \| `medium` \| `low` | Filter menu, or clicking the דירוג מדדים donut |
| `orgUnitId` | optional | id from `/filters/options` → `orgUnits` | מבנה ארגוני |
| `professionalFieldId` | optional | id from `/filters/options` → `professionalFields` | תחום מקצועי |
| `ramadTevelIndicationId` | optional | id from `/filters/options` → `ramadTevelIndications` | אינדיקציית רמ"ד תבל |
| `indicatorClassification` | optional | `processes` \| `routine` | Filter menu, or clicking the סיווג משימות donut |

Example:

```
GET /api/dashboard/kpis?scope=all&date=2026-12-13&dateGranularity=day&taskStatus=breach&professionalFieldId=medical-summons
```

Status keys and their Hebrew labels:

| key | label |
| --- | --- |
| `treatment` | לטיפול |
| `nearBreach` | עתידות לחרוג |
| `breach` | בחריגה |
| `paused` | בהשהייה |

---

## 1. Filter options

`GET /filters/options`. Loaded once, when the page opens. It provides the radio choices in the סינון menu and the labels shown on active filter chips.

```json
{
  "taskStatus": [
    { "id": "breach", "label": "משימות בחריגה" },
    { "id": "nearBreach", "label": "עתידות לחרוג" },
    { "id": "treatment", "label": "משימות לטיפול" },
    { "id": "paused", "label": "משימות בהשהייה" }
  ],
  "indicatorRating": [
    { "id": "high", "label": "מדדים גבוהים" },
    { "id": "medium", "label": "מדדים בינוניים" },
    { "id": "low", "label": "מדדים נמוכים" }
  ],
  "orgUnits": [{ "id": "jerusalem", "label": "לשכת גיוס ירושלים" }],
  "professionalFields": [{ "id": "medical-summons", "label": "רפואי - זימונים" }],
  "ramadTevelIndications": [{ "id": "tevel-jerusalem", "label": "אינדיקציית רמ\"ד תבל בלשכות גיוס" }],
  "indicatorClassifications": [
    { "id": "processes", "label": "תהליכים" },
    { "id": "routine", "label": "שגרה" }
  ]
}
```

The ids for `taskStatus`, `indicatorRating` and `indicatorClassifications` **must** be the fixed keys listed above, because the donut charts use them too. The other lists can use any ids you like.

## 2. KPI cards (top row)

`GET /dashboard/kpis?{filters}`. One call fills all four cards.

```json
{
  "score": { "value": 93, "changePct": -12 },
  "taskStatus": {
    "total": 373027,
    "changePct": 30,
    "segments": [
      { "key": "breach", "label": "בחריגה", "count": 131261 },
      { "key": "nearBreach", "label": "עתידות לחרוג", "count": 99708 },
      { "key": "treatment", "label": "לטיפול", "count": 141992 },
      { "key": "paused", "label": "בהשהייה", "count": 66 }
    ]
  },
  "indicatorRating": {
    "total": 460,
    "segments": [
      { "key": "high", "label": "גבוהים", "count": 446 },
      { "key": "medium", "label": "בינוניים", "count": 10 },
      { "key": "low", "label": "נמוכים", "count": 4 }
    ]
  },
  "taskClassification": {
    "total": 373027,
    "segments": [
      { "key": "processes", "label": "תהליכים", "count": 291602 },
      { "key": "routine", "label": "שגרה", "count": 81425 }
    ]
  }
}
```

| Field | Shown as |
| --- | --- |
| `score.value` | Big number in the ציון ring (0–100). The ring fills to this percentage. |
| `score.changePct` | ↑/↓ arrow under the score, green or red. |
| `*.total` | Number in the middle of the donut. Not shown for `taskClassification`. |
| `*.changePct` | Optional. Leave it out to hide the arrow. |
| `segments` | Donut slices and legend rows, in the order you send them. Hover percentages are calculated by the UI. |

**Behaviour when a donut filter is active:** if `taskStatus=breach` is sent, keep returning **all** segments with their counts, and set `taskStatus.total` to the count of the selected segment (`131261`). The UI fades the other segments itself. The same applies to `indicatorRating` and `indicatorClassification`.

## 3. מסגרות (bar chart with drill-down)

`GET /dashboard/frameworks?{filters}&metric=tasks|scores&parentId={id}`

- `parentId` is omitted at the root level. When the user clicks a bar with `hasChildren: true`, the UI calls again with `parentId` set to that bar's `id`.
- `metric` comes from the משימות / ציונים toggle on the card.

```json
{
  "path": [
    { "id": null, "name": "לשכות" },
    { "id": "jerusalem", "name": "לשכת הגיוס ירושלים" },
    { "id": "jerusalem-d0", "name": "מדור תו\"ם" }
  ],
  "items": [
    {
      "id": "jerusalem-d0-g0",
      "name": "חו\"ל",
      "hasChildren": false,
      "total": 24,
      "breakdown": { "treatment": 9, "nearBreach": 3, "breach": 2, "paused": 0 }
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `path` | The breadcrumb, root first. The root item has `id: null`. Clicking a crumb reloads with that `parentId`. |
| `items[].total` | Number shown above the bar. |
| `items[].breakdown` | Send this when `metric=tasks`. Values are stacked bottom to top: treatment, nearBreach, breach, paused. |
| `items[].score` | Send this when `metric=scores` (0–100) instead of `breakdown`. The bar is coloured green (≥ 90), orange (≥ 70) or red (below 70). |

## 4. התפתחות היסטורית (line chart)

`GET /dashboard/history?{filters}&metric=tasks|scores`

```json
{
  "series": [
    {
      "key": "tasks",
      "label": "משימות",
      "points": [
        { "date": "2026-01-01", "value": 2 },
        { "date": "2026-02-01", "value": 11 }
      ]
    },
    {
      "key": "parentTasks",
      "label": "משימות אב",
      "points": [
        { "date": "2026-01-01", "value": 4 },
        { "date": "2026-02-01", "value": 9 }
      ]
    }
  ]
}
```

- Each series becomes one line. Its `label` is used in the legend and tooltip. Line colours are assigned by position: the first series is light blue, the second is dark blue.
- **Every series must have the same dates in the same order.** The x‑axis is taken from the first series.
- You choose the time range and interval (daily, monthly, …) based on `date` and `dateGranularity`.

## 5. משימות (tree table)

`GET /dashboard/tasks?{filters}`

```json
{
  "rows": [
    {
      "id": "mitzui",
      "name": "מיצוי",
      "treatment": 249,
      "nearBreach": 406,
      "breach": 3700,
      "paused": 0,
      "total": 4355,
      "sla": null,
      "weightPct": 0,
      "score": 100,
      "trendPct": null,
      "hasReport": true,
      "children": [
        {
          "id": "mitzui-tzav12",
          "name": "צווי 12",
          "indicatorId": "ind-tzav12",
          "treatment": 42,
          "nearBreach": 181,
          "breach": 1732,
          "paused": 0,
          "total": 1955,
          "sla": 30,
          "weightPct": 5,
          "score": 86,
          "trendPct": 4,
          "hasReport": true
        }
      ]
    }
  ]
}
```

| Field | Column |
| --- | --- |
| `name` | מסגרת. Rows with `children` get an expand/collapse arrow. |
| `indicatorId` | Optional. Adds an ⓘ icon that loads `/indicators/:id` (section 6). |
| `treatment` / `nearBreach` / `breach` / `paused` / `total` | משימות לטיפול / עתידות לחרוג / משימות בחריגה / משימות בהשהייה / סה"כ |
| `sla` | SLA in days. `null` shows as "-". |
| `weightPct` | משקל, shown as "5%". |
| `score` | ציון (0–100), coloured green, orange or red. `null` shows as "-". |
| `trendPct` | מגמה, shown as "+4%" or "-8%". `null` shows as "-". |
| `hasReport` | Shows the Excel icon in the דוח שמי column (section 7). |

The tree can be any depth. Search, collapse and column hiding all happen in the browser, so there's no need for paging or sorting parameters.

## 6. Indicator details (ⓘ tooltip)

`GET /indicators/{indicatorId}`. Called on first hover and cached for the rest of the session.

```json
{
  "id": "ind-tzav12",
  "name": "צווי 12",
  "description": "להציג מלש\"בים על סיבת סטטוס צו 12",
  "handling": "להכריז השתמטות או להעביר סטטוס בהתאם",
  "classification": "תהליכים",
  "professionalField": "תו\"ם - מיצוי",
  "penalty": 0,
  "note": "לא ניתן להפיק נתוני זמן אמת בינשוף"
}
```

`description` = מהות המדד, `handling` = טיפול במדד, `classification` = סיווג המדד, `professionalField` = תחום מקצועי, `penalty` = קנס. `note` is optional.

## 7. דוח שמי (named report download)

`GET /reports/named?{filters}&rowId={row id}`

- Return the file itself (preferably `.xlsx`) with a `Content-Disposition` header so the browser saves it under the right name:
  ```
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename*=UTF-8''%D7%93%D7%95%D7%97.xlsx
  ```
- If there's no filename header, the UI falls back to `{row name}.xlsx`.

## 8. Navbar search (חיפוש מלש"ב)

`GET /candidates/search?q={text}`. Called as the user types, 250 ms after they stop. Return up to about 8 results.

```json
[
  { "id": "c1", "fullName": "נועה כהן", "idNumber": "300000000" }
]
```

Clicking a result goes to `/candidate/{id}`. That page isn't designed yet.

---

## Running the frontend against your backend

```bash
cp .env.example .env
# in .env:
VITE_USE_MOCKS=false
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://localhost:8080   # your server; the dev server proxies /api to it
npm install
npm run dev
```

With the proxy, the browser only talks to the Vite dev server, so CORS isn't needed during development. In production, serve the built `dist/` folder and route `/api` to the backend, or set `VITE_API_BASE_URL` to the full API URL and enable CORS.
