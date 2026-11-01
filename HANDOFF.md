# Handoff: moving the project and connecting it to real data

This folder holds two things:

| Part | Folder | What it is |
| --- | --- | --- |
| **Frontend** | `shavit-dashboard/` (this folder) | The Vue dashboard. It runs on fake data until connected. |
| **Example backend** | `shavit-dashboard/backend/` | A FastAPI server that already implements every endpoint, with an example database. Start from it, or use it as a reference. |

The full API definition is in **[API_CONTRACT.md](API_CONTRACT.md)**. The backend is documented in **[backend/README.md](backend/README.md)**.

---

## 1. What's on the USB

`shavit-dashboard.zip` contains everything that's needed and nothing that gets rebuilt:

| Included | Left out (rebuilt on the new machine) |
| --- | --- |
| `src/`, `index.html`, `package.json`, **`package-lock.json`**, `vite.config.ts`, `tsconfig*.json`, `.env.example`, `public/`, `.github/` | `node_modules/`: 130+ MB, rebuilt by `npm ci`, and contains Mac-only binaries |
| `backend/` (code, `requirements.txt`, `seed.py`, README) | `dist/`: build output |
| `API_CONTRACT.md`, `README.md`, `HANDOFF.md` | `.env` (personal settings), `backend/.venv/`, `backend/*.db`, `__pycache__/`, `.DS_Store` |

To rebuild the zip, run this from the folder that **contains** `shavit-dashboard`:

```bash
zip -r shavit-dashboard.zip shavit-dashboard -x "*/node_modules/*" "*/dist/*" "*/.env" "*.DS_Store" "*/.venv/*" "*/__pycache__/*" "*.db"
```

---

## 2. Running it on the new machine

### Frontend: needs Node.js 20+

```bash
cd shavit-dashboard
npm ci
cp .env.example .env          # Windows: copy .env.example .env
npm run dev                   # → http://localhost:5173 (fake data)
```

### Backend: needs Python 3.9+

```bash
cd shavit-dashboard/backend
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                # example database
uvicorn app.main:app --reload --port 8000     # API docs: http://localhost:8000/docs
```

### Connecting them

In the frontend's `.env`:

```ini
VITE_USE_MOCKS=false
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://localhost:8000
```

Restart `npm run dev`. The dashboard now reads from the server, and through it from the database. No CORS setup is needed in development, because Vite forwards `/api` to the server.

### Production

1. In `.env`, set `VITE_USE_MOCKS=false`. If the site lives under a sub-path, also set `VITE_BASE=/sub-path/`.
2. Run `npm run build`, then serve the `dist/` folder from any web server.
3. On that web server, **route `/api/*` to the backend**, and **fall back to `index.html`** for unknown paths.
4. The backend: run `uvicorn app.main:app --host 0.0.0.0 --port 8000`, behind the same web server or a reverse proxy.

> ⚠️ `.env` is applied at **build** time. If you change it, run `npm run build` again.

### No internet on the target machine?

- **Frontend:** build on a machine that has internet, then copy only `dist/` over. It's plain HTML, JS and CSS, so the target doesn't need Node.
- **Backend:** run `pip download -r requirements.txt -d wheels` on a machine with the **same OS and Python version**, copy the `wheels/` folder over, then run `pip install --no-index --find-links wheels -r requirements.txt`.
- **Font:** Noto Sans Hebrew loads from Google Fonts. Offline it falls back to the system font. Everything still works; it just looks slightly different.

---

## 3. Connecting each part of the screen to real data

Every frontend call is in **`src/api/dashboard.ts`**. Every server endpoint is in **`backend/app/routers/`**.

- **All at once:** set `VITE_USE_MOCKS=false`.
- **One part at a time:** keep mocks on, and in `src/api/dashboard.ts` delete the `if (USE_MOCKS) …` line of just the function you've finished.

| ✓ | On screen | Endpoint | Frontend function | Backend | Contract § |
| --- | --- | --- | --- | --- | --- |
| ☐ | Filter menu choices and chip labels | `GET /filters/options` | `getFilterOptions` | `dashboard.py` | 1 |
| ☐ | ציון · סטטוס משימות · דירוג מדדים · סיווג משימות | `GET /dashboard/kpis` | `getKpis` | `dashboard.py` | 2 |
| ☐ | מסגרות chart, with drill-down | `GET /dashboard/frameworks` | `getFrameworks` | `dashboard.py` | 3 |
| ☐ | התפתחות היסטורית (ציון, ציון אב, ממוצע) | `GET /dashboard/history` | `getHistory` | `dashboard.py` | 4 |
| ☐ | משימות table (tree of any depth) | `GET /dashboard/tasks` | `getTasks` | `dashboard.py` | 5 |
| ☐ | ⓘ tooltip on table rows | `GET /indicators/{id}` | `getIndicator` | `dashboard.py` | 6 |
| ☐ | Excel: דוח שמי / דוח מרוכז | `GET /reports/tasks` | `getReportTasks` | `reports.py` | 7 |
| ☐ | Report view inside the system (eye icon, clickable counts) | `GET /reports/tasks/page` | `getReportPage` | `reports.py` | 7b |
| ☐ | Navbar search (חיפוש מלש"ב) | `GET /candidates/search` | `searchCandidates` | `users.py` | 8 |
| ☐ | Admin or regular user | `GET /me` | `getCurrentUser` | `users.py` | 9 |
| ☐ | Announcements banner | `GET /announcements` | `getAnnouncements` | `users.py` | 10 |
| ☐ | Create / edit an announcement (admins) | `POST` / `PUT /announcements` | `createAnnouncement` / `updateAnnouncement` | `users.py` | 11 |
| ☐ | Delete an announcement (admins) | `DELETE /announcements/{id}` | `deleteAnnouncement` | `users.py` | 12 |
| ☐ | ⓘ texts next to card titles | *(static text, not an API)* | `CARD_INFO` in `src/constants/colors.ts` | | |

### Rules both sides must agree on

1. **Filters on every `/dashboard/*` request:** `scope`, `date`, `dateGranularity`, plus any active filters (left out when empty).
2. **Fixed ids:** status `treatment` / `nearBreach` / `breach` / `paused`, rating `high` / `medium` / `low`, classification `processes` / `routine`.
3. **סוג משימה threshold:** `NEAR_BREACH_DAYS` is 5. It appears in **two places**, `src/config.ts` and `backend/app/config.py`, and they must stay equal.
4. **Donut filters:** return every segment, and set `total` to the selected segment's count.
5. **History:** every series has the same dates. In ציונים mode send `score` and `parentScore`; the UI calculates ממוצע itself.
6. **Report columns are generic:** add a column on the server (`REPORT_COLUMNS` in `reports.py`) and it appears in the Excel export and in the in-app view. No frontend change needed.
7. **Admins** are decided on the server from the employee id (the `users.is_admin` column). Admin-only endpoints must return `403` for everyone else.
8. **Empty values are `null`, numbers are numbers:** `12` means 12%, and dates are `YYYY-MM-DD`.

### Debugging a connection

1. Open http://localhost:8000/docs and try the endpoint directly there.
2. In the browser, press F12, open **Network**, and filter by `api`. You can see the exact params that were sent and the response that came back.
3. **"שגיאה בטעינת הנתונים"** on a card means the request failed (a non-200 status, or the server is down).
4. **Wrong or empty numbers** mean the JSON shape doesn't match. Compare the field names with `src/api/types.ts` or `backend/app/schemas.py`.

### Once everything is live

- Set `VITE_USE_MOCKS=false` permanently.
- Optionally delete `src/mocks/`, along with the `import * as mock` line and the `if (USE_MOCKS)` lines in `src/api/dashboard.ts`. That also removes the "מצב בדיקה" admin toggle, which only appears in mock mode.
