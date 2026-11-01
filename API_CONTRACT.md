# מלש"ביה Dashboard — API Contract

This is everything the frontend needs from the backend (13 endpoints). The UI already works against fake data. Once these endpoints exist, set `VITE_USE_MOCKS=false` and it switches over with no code changes.

- **TypeScript source of truth:** [`src/api/types.ts`](src/api/types.ts)
- **Where each endpoint is called:** [`src/api/dashboard.ts`](src/api/dashboard.ts)
- **Example responses:** [`src/mocks/data.ts`](src/mocks/data.ts) (the fake data has exactly the shapes below)

## General rules

| Topic | Rule |
| --- | --- |
| Base URL | All paths below are relative to `VITE_API_BASE_URL` (default `/api`). |
| Method | Everything is `GET`, except creating, editing and deleting announcements (sections 10–12). |
| Format | JSON, UTF‑8. Field names are camelCase. |
| Dates | `YYYY-MM-DD`. Announcement timestamps are full ISO date-times (`2026-11-08T21:59:59.999Z`). |
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
- The card opens on **ציונים** (`metric=scores`). In that mode, send exactly two series, with these keys:

  ```json
  {
    "series": [
      { "key": "score", "label": "ציון", "points": [{ "date": "2026-01-01", "value": 78 }] },
      { "key": "parentScore", "label": "ציון אב", "points": [{ "date": "2026-01-01", "value": 84 }] }
    ]
  }
  ```

  The UI adds a third, dashed line, **ממוצע**, calculated as (ציון + ציון אב) ÷ 2 for each date. **Don't send it.**
- In **משימות** mode (`metric=tasks`), send `tasks` (משימות) and `parentTasks` (משימות אב), as in the example above.
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
| `hasReport` | Shows the Excel icon in the ייצוא לאקסל column (section 7): a דוח שמי for lowest-level rows, a דוח מרוכז for rows with children. |

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

## 7. Excel export: דוח שמי and דוח מרוכז

`GET /reports/tasks?{filters}&rowId={row id}`. Called when the user clicks the Excel icon in the "ייצוא לאקסל" column.

**The backend returns JSON, and the browser builds the `.xlsx` itself** (sheets, right-to-left layout, styling, links between sheets). That means no Excel library is needed on the server.

What the user gets depends on the row:

| Row clicked | File |
| --- | --- |
| Lowest-level row (no children) | **דוח שמי**: one sheet listing the row's tasks. |
| Row with children, at any depth | **דוח מרוכז**: a summary sheet first, with the clicked row on top and **every** row under it below, indented by level, just like the table. Then one דוח שמי sheet for **each lowest-level row** under it. Each lowest-level name on the summary sheet links to its sheet, and each sheet links back. |

The response has one entry in `rows` per lowest-level row under `rowId`. If `rowId` is itself lowest-level, there's just that one entry.

```json
{
  "columns": [
    { "key": "startDate", "label": "תאריך תחילה", "type": "date" },
    { "key": "runDate", "label": "תאריך ריצה", "type": "date" },
    { "key": "handlingDays", "label": "משך טיפול (ימים)", "type": "number" },
    { "key": "daysToBreach", "label": "ימים לחריגה", "type": "number" },
    { "key": "pauseEndDate", "label": "תאריך סיום השהייה", "type": "date" },
    { "key": "pauseReason", "label": "סיבת השהייה", "type": "text" },
    { "key": "personalNumber", "label": "מספר אישי", "type": "text" },
    { "key": "track", "label": "מסלול עתודה / שוחרים", "type": "text" },
    { "key": "corps", "label": "חיל", "type": "text" },
    { "key": "major", "label": "מגמה", "type": "text", "width": 20 },
    { "key": "position", "label": "משרה לאיוש", "type": "text", "width": 20 },
    { "key": "studyStartDate", "label": "תאריך תחילת לימודים", "type": "date" }
  ],
  "rows": [
    {
      "rowId": "mitzui-tzav12",
      "tasks": [
        {
          "startDate": "2026-10-02",
          "runDate": "2026-11-01",
          "handlingDays": 30,
          "daysToBreach": -2,
          "pauseEndDate": null,
          "pauseReason": null,
          "personalNumber": "5234567",
          "track": "יעד",
          "corps": "תקשוב",
          "major": "הנדסת חשמל",
          "position": "מהנדס/ת מערכות",
          "studyStartDate": "2024-10-01"
        }
      ]
    }
  ]
}
```

**The columns are generic.** The backend decides which columns exist and in what order. To add a column (say, תאריך סיום לימודים), add it to `columns` and to each task. The frontend doesn't change.

| `columns[]` field | Meaning |
| --- | --- |
| `key` | Name of the field in each task object. |
| `label` | Column header in Excel. |
| `type` | `date` (send `YYYY-MM-DD`; it becomes a real Excel date), `number` or `text`. **Send personal numbers as `text`** so leading zeros aren't lost. |
| `width` | Optional column width. |

**סוג משימה is always the first column, and the UI calculates it.** So every task **must** include `daysToBreach` and `pauseEndDate`, even if you don't list them as columns:

| Condition (checked in this order) | סוג משימה |
| --- | --- |
| `pauseEndDate` is today or later | משימות בהשהייה |
| `daysToBreach` < 0 | משימות בחריגה |
| `daysToBreach` ≤ **5** | עתידות לחרוג |
| otherwise | משימות לטיפול |

The **5** is `NEAR_BREACH_DAYS` in `src/config.ts`. Change it there, and **use the same number on the server** when counting tasks for the dashboard, otherwise the dashboard and Excel won't agree.

While the file is being built, the user sees "מרכזים עבורכם את הדוחות…". A failed request shows an error message with a retry option.

## 7b. Report view inside the system (paged)

`GET /reports/tasks/page?{filters}&rowId={row id}&page=&pageSize=&...`

This endpoint powers the **in-app report view**, the same דוח שמי shown inside the dashboard instead of downloaded. The user opens it in either of two ways:
- the eye icon in the "דוח" column;
- clicking a count in the table, such as "1,732" under משימות בחריגה. That opens the view already filtered to that סוג משימה. Clicking a סה"כ count opens it unfiltered.

The tasks are the same as in section 7 (same `columns`, same task objects), but the **server filters, sorts and pages** them, because a report can have thousands of lines.

| Param | Meaning |
| --- | --- |
| `rowId` | The table row, which can be at any level. For a row with children, return the tasks of **every lowest-level row** under it. |
| `page`, `pageSize` | Paging (1-based). The UI uses 25, 50 or 100. When exporting the filtered view to Excel, it requests `page=1&pageSize={total}`. |
| `sortKey`, `sortDir` | A column `key` (or `taskType`) and `asc`/`desc`. Omitted = your default order. |
| `taskType` | `breach` \| `nearBreach` \| `treatment` \| `paused`. Same rules as section 7 (`NEAR_BREACH_DAYS`). |
| `q` | Free-text search. Match at least מספר אישי; matching other text columns too is welcome. |
| `leafRowId` | Only tasks of this lowest-level row (the מסגרת filter in a consolidated view). |
| `f.{key}` | Exact-match filter on a text column, e.g. `f.corps=תקשוב`. Several can be combined. |

Plus all the usual dashboard filters (scope, date, etc.).

```json
{
  "columns": [ { "key": "startDate", "label": "תאריך תחילה", "type": "date" } ],
  "total": 1732,
  "typeCounts": { "breach": 1732, "nearBreach": 181, "treatment": 42, "paused": 0 },
  "facets": {
    "corps": ["אמ\"ן", "הנדסה קרבית", "חיל האוויר", "תקשוב"],
    "major": ["הנדסת חשמל", "הנדסת מכונות"]
  },
  "tasks": [
    { "rowId": "mitzui-tzav12", "startDate": "2026-10-02", "daysToBreach": -2, "pauseEndDate": null, "personalNumber": "5234567" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `total` | How many tasks match **all** filters. The pager uses it ("מציג 1–50 מתוך 1,732"). |
| `typeCounts` | Counts per סוג משימה, applying every filter **except** `taskType`. These are the numbers on the chips (הכל / בחריגה / עתידה לחרוג / …). |
| `facets` | Distinct values per **text** column, for the column filter menu. A column with no entry gets no filter. Skip columns with too many values, such as מספר אישי. |
| `tasks[].rowId` | Which lowest-level row the task belongs to. In a consolidated view, the UI shows it as the מסגרת column. |

Every task still needs `daysToBreach` and `pauseEndDate`. The UI colours the סוג משימה tag from them.

## 8. Navbar search (חיפוש מלש"ב)

`GET /candidates/search?q={text}`. Called as the user types, 250 ms after they stop. Return up to about 8 results.

```json
[
  { "id": "c1", "fullName": "נועה כהן", "idNumber": "300000000" }
]
```

Clicking a result goes to `/candidate/{id}`. That page isn't designed yet.

## 9. Current user

`GET /me`. Called once, when the page loads. The backend decides who is an admin, **based on the employee id**. The frontend never holds a list of admin ids.

```json
{ "employeeId": "7654321", "fullName": "ישראל ישראלי", "isAdmin": true }
```

- `isAdmin: true` shows the admin tools (the "הודעה חדשה" button, plus edit and delete on each announcement).
- If this call fails, the dashboard still works, just without announcements or admin tools.

## 10. Announcements: list

`GET /announcements`. Called on page load and after every create, edit or delete.

Return **only announcements that haven't expired** (`expiresAt` later than now), newest first:

```json
[
  {
    "id": "a1",
    "title": "עדכון מערכת",
    "message": "ביום חמישי בין 18:00 ל-20:00 המערכת תהיה בתחזוקה.",
    "severity": "warning",
    "createdAt": "2026-10-31T09:12:00.000Z",
    "expiresAt": "2026-11-07T21:59:59.999Z",
    "createdBy": { "employeeId": "1111111", "fullName": "מנהל מערכת" }
  }
]
```

| Field | Meaning |
| --- | --- |
| `title` | Optional bold heading. |
| `message` | The text, up to 500 characters. |
| `severity` | `info` (blue banner) or `warning` (orange banner). |
| `expiresAt` | When the banner disappears. The UI also hides an expired banner by itself, without a reload. |
| `createdBy` | Shown to admins next to the expiry date. Fill it in from the logged-in user; don't trust a value from the client. |

Regular users can hide a banner with the eye button. It stays hidden only until the next page load, and nothing is stored, so the backend doesn't need to track it.

## 11. Announcements: create and edit (admins only)

`POST /announcements` creates one, and `PUT /announcements/{id}` edits one. Both take the same JSON body:

```json
{
  "title": "עדכון מערכת",
  "message": "ביום חמישי בין 18:00 ל-20:00 המערכת תהיה בתחזוקה.",
  "severity": "warning",
  "expiresAt": "2026-11-07T21:59:59.999Z"
}
```

- `title` is optional. When editing, a missing `title` means "remove the title".
- The admin picks a duration (a day, 3 days, a week, a month, or a specific date). The UI turns that into `expiresAt` = **the end of the chosen day** in the admin's local time, so the backend just stores what it receives.
- Respond with the saved announcement, in the same shape as one item from section 10, with `id`, `createdAt` and `createdBy` filled in.
- **Validate on the server too:** `message` must be 1–500 characters, `severity` must be `info` or `warning`, and `expiresAt` must be in the future.

## 12. Announcements: delete (admins only)

`DELETE /announcements/{id}`. Return any 2xx status. The body is ignored.

**Security:** sections 11 and 12 must check on the server that the logged-in user is an admin, and return `403` if not. Hiding the buttons in the UI is not protection on its own.

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
