# מלש"ביה API — example backend (FastAPI)

A working example of the backend the dashboard expects. It implements **all 13 endpoints in [../API_CONTRACT.md](../API_CONTRACT.md)**, returns exactly the JSON the frontend reads (`src/api/types.ts`), and comes with an example database, so you can run the whole system end to end on day one. Then swap the example database for the real one.

- **Python 3.9+**
- FastAPI + SQLAlchemy 2. Works with SQLite (default), PostgreSQL, SQL Server or Oracle.
- Interactive API docs at **http://localhost:8000/docs** once it's running.

## Run it

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                       # creates shavit.db with example data
uvicorn app.main:app --reload --port 8000
```

Then point the dashboard at it. In the frontend's `.env`:

```ini
VITE_USE_MOCKS=false
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://localhost:8000
```

and run `npm run dev`. The dashboard now reads everything from this server.

## Where things are

```
backend/
  requirements.txt
  seed.py              ← creates the tables and fills them with example data
  app/
    main.py            ← the FastAPI app; every route is under /api
    config.py          ← settings from environment variables (database, NEAR_BREACH_DAYS, CORS…)
    db.py              ← database connection / session per request
    models.py          ← the tables (SQLAlchemy). Adapt these to your real database.
    schemas.py         ← the JSON shapes (Pydantic), matching src/api/types.ts, sent as camelCase
    services.py        ← shared logic: filters, task type (סוג משימה), the "snapshot" of open tasks
    auth.py            ← who is calling + admin check (replace with real login)
    routers/
      dashboard.py     ← /filters/options, /dashboard/kpis, /frameworks, /history, /tasks, /indicators/{id}
      reports.py       ← /reports/tasks (Excel data), /reports/tasks/page (in-app report view)
      users.py         ← /me, /candidates/search, /announcements (GET/POST/PUT/DELETE)
```

## The example tables

| Table | What it holds |
| --- | --- |
| `frameworks` | The tree of מסגרות (any depth: לשכה → מדור → קבוצה, or ענף → מדור → משרד → צוות → מדד). The same tree feeds both the מסגרות chart and the משימות table. Lowest-level rows have an indicator, an SLA and tasks. `scope` is `bureaus` (לשכות) or `hq` (מפקדה). |
| `indicators` | מדד details for the ⓘ tooltip: מהות, טיפול, סיווג (`processes`/`routine`), תחום מקצועי, קנס. |
| `framework_scores` | ציון (and ציון אב) per framework per date, usually written by a nightly job. |
| `tasks` | One row per משימה: start / end date, SLA, pause end + reason, `is_parent` (משימת אב). |
| `candidates` | The מלש"ב behind each task: מספר אישי, ת"ז, name, מסלול, חיל, מגמה, משרה, study dates. |
| `users` | Employee id + `is_admin`. **Admins are decided here, by employee id.** |
| `announcements` | Home-page announcements with an expiry time. |
| `professional_fields`, `ramad_tevel_indications` | Lookup lists for the filter menu. |

## How the numbers are calculated

- **Open tasks at a date:** `start_date ≤ date` and `end_date` is empty or after the date. For a month or year, the date is the end of that period (never in the future).
- **סוג משימה**, from `days_to_breach = sla_days − days since start`:

  | Condition (checked in this order) | סוג משימה |
  | --- | --- |
  | `pause_end_date ≥ date` | בהשהייה |
  | `days_to_breach < 0` | בחריגה |
  | `days_to_breach ≤ NEAR_BREACH_DAYS` (5) | עתידה לחרוג |
  | otherwise | לטיפול |

  **This must stay identical to `src/config.ts` in the frontend.** Change both together.
- **דירוג מדדים** is based on each indicator's latest score: ≥ 90 high, ≥ 70 medium, otherwise low.
- **Change percentages (↑/↓)** compare with one period earlier: the previous day, about a month earlier, or the previous year.
- **A parent row's score** is its own score if it has one, otherwise the average of its children's.

`services.py` loads the open tasks for the filters and counts them in Python, which keeps the example easy to follow. For very large data, move the counting into SQL (`GROUP BY framework_id` plus the task type as a `CASE` expression). The endpoints stay the same.

## Connecting the real database

1. **Set `DATABASE_URL`**, for example:
   ```bash
   export DATABASE_URL="postgresql+psycopg://user:pass@host:5432/shavit"      # pip install "psycopg[binary]"
   export DATABASE_URL="mssql+pyodbc://user:pass@host/shavit?driver=ODBC+Driver+18+for+SQL+Server"  # pip install pyodbc
   export DATABASE_URL="oracle+oracledb://user:pass@host:1521/?service_name=SHAVIT"                 # pip install oracledb
   ```
2. **Map the models to the real tables.** In `models.py`, change `__tablename__` and the column names (`mapped_column("REAL_COLUMN_NAME", …)`) so they match the real tables. Nothing else needs to change. Don't run `seed.py` against a real database: it drops tables.
3. **Remove the auto-create** `Base.metadata.create_all(engine)` from `main.py` once the tables already exist.
4. **Use real login.** Replace `current_user` in `auth.py` with your real authentication (SSO, session cookie, token). Today it trusts an `X-Employee-Id` header, or falls back to `DEMO_EMPLOYEE_ID`, which is **for development only**.

## Settings (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./shavit.db` | Any SQLAlchemy URL. |
| `NEAR_BREACH_DAYS` | `5` | The עתידה לחרוג threshold. Keep it equal to the frontend's. |
| `DEMO_EMPLOYEE_ID` | `1111111` | Who you are when no login is wired in. `1111111` is an admin and `7654321` is a regular user in the example data. |
| `CORS_ORIGINS` | `http://localhost:5173` | Only needed when the browser calls the API directly, not through the Vite proxy. |
| `FRAMEWORKS_ROOT_NAME` | `לשכות` | Top breadcrumb in the מסגרות chart. |

## Trying it as a regular user

```bash
curl -H "X-Employee-Id: 7654321" http://localhost:8000/api/me
curl -X DELETE -H "X-Employee-Id: 7654321" http://localhost:8000/api/announcements/welcome   # → 403
```

Or start the server with `DEMO_EMPLOYEE_ID=7654321`. The dashboard then hides the admin tools.
