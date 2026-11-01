"""
Calls every endpoint of a running API and writes API_EXAMPLES.md: for each one, the exact
request (method, URL, query params, body) and the real JSON that came back.

    uvicorn app.main:app --port 8000      # in another terminal
    python tools/make_examples.py         # writes ../API_EXAMPLES.md

Long lists are shortened to their first items so the file stays readable.
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api"
OUT = Path(__file__).resolve().parents[2] / "API_EXAMPLES.md"
TODAY = date.today().isoformat()
FILTERS = {"scope": "all", "date": TODAY, "dateGranularity": "day"}
KEEP = 2  # items kept from long lists
SHORT_LIST = 6  # lists up to this long are shown in full (e.g. the fixed status ids)
FULL_KEYS = {"columns"}  # always shown in full: the report column definitions


def call(method, path, query=None, body=None, headers=None):
    url = BASE + path + ("?" + urllib.parse.urlencode(query) if query else "")
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def shorten(value, depth=0):
    """Keep the first KEEP items of every long list (recursively) and note how many were cut."""
    if isinstance(value, list):
        keep = len(value) if len(value) <= SHORT_LIST else KEEP
        items = [shorten(v, depth + 1) for v in value[:keep]]
        if len(value) > keep:
            items.append(f"… {len(value) - KEEP} more")
        return items
    if isinstance(value, dict):
        return {k: v if k in FULL_KEYS else shorten(v, depth + 1) for k, v in value.items()}
    return value


sections = []


def example(title, note, method, path, query=None, body=None, headers=None, shorten_response=True):
    status, resp = call(method, path, query, body, headers)
    shown_path = BASE.split("//", 1)[1].split("/", 1)[1] if "/" in BASE.split("//", 1)[1] else ""
    url = f"/{shown_path}{path}" + ("?" + urllib.parse.urlencode(query, safe=",") if query else "")
    lines = [f"## {title}", "", note, "", "**Request**", "", "```http", f"{method} {url}"]
    for k, v in (headers or {}).items():
        lines.append(f"{k}: {v}")
    if body is not None:
        lines += ["Content-Type: application/json", "", json.dumps(body, ensure_ascii=False, indent=2)]
    lines += ["```", ""]
    if query:
        lines += ["| Param | Value |", "| --- | --- |"] + [f"| `{k}` | `{v}` |" for k, v in query.items()] + [""]
    lines += [f"**Response** `{status}`", ""]
    if resp is not None:
        lines += ["```json", json.dumps(shorten(resp) if shorten_response else resp, ensure_ascii=False, indent=2), "```", ""]
    else:
        lines += ["*(no body)*", ""]
    sections.append("\n".join(lines))
    return resp


def first_leaf_with_indicator(rows):
    for r in rows:
        if r.get("indicatorId"):
            return r
        found = first_leaf_with_indicator(r.get("children") or [])
        if found:
            return found


def main():
    example("1. Filter options", "Loaded once, when the page opens: the choices in the סינון menu.", "GET", "/filters/options")

    example("2. KPI cards", "The four cards in the top row. Every `/dashboard/*` call carries the same filter params.",
            "GET", "/dashboard/kpis", FILTERS)
    example("2b. KPI cards with a donut filter", "After clicking בחריגה: every segment is still returned, and `total` is the selected one.",
            "GET", "/dashboard/kpis", {**FILTERS, "taskStatus": "breach"})

    fr = example("3. מסגרות — top level, tasks", "`parentId` omitted = top level.", "GET", "/dashboard/frameworks", {**FILTERS, "metric": "tasks"})
    example("3b. מסגרות — drill down", "After clicking a bar: `parentId` = that bar's `id`.",
            "GET", "/dashboard/frameworks", {**FILTERS, "metric": "tasks", "parentId": fr["items"][0]["id"]})
    example("3c. מסגרות — scores", "The ציונים toggle: `score` instead of `breakdown`.", "GET", "/dashboard/frameworks", {**FILTERS, "metric": "scores"})

    example("4. התפתחות היסטורית — scores", "Default mode. The UI adds the ממוצע line itself.",
            "GET", "/dashboard/history", {**FILTERS, "metric": "scores"}, shorten_response=False)
    example("4b. התפתחות היסטורית — tasks", "The משימות toggle.", "GET", "/dashboard/history", {**FILTERS, "metric": "tasks"}, shorten_response=False)

    tasks = example("5. משימות table", "A tree of any depth; `children` only on rows that have them.", "GET", "/dashboard/tasks", FILTERS)
    leaf = first_leaf_with_indicator(tasks["rows"])

    example("6. Indicator details (ⓘ)", "Called the first time the user hovers an ⓘ.", "GET", f"/indicators/{leaf['indicatorId']}")

    example("7. Excel export data", "All task lines of a row (one entry per lowest-level row under it). The browser builds the .xlsx.",
            "GET", "/reports/tasks", {**FILTERS, "rowId": leaf["id"]})

    example("7b. Report view — first page", "The in-app report view, opened by clicking a count in the table (here: בחריגה).",
            "GET", "/reports/tasks/page", {**FILTERS, "rowId": tasks["rows"][0]["id"], "page": 1, "pageSize": 50, "taskType": "breach"})
    example("7c. Report view — search, filter and sort", "Typing in the search box, filtering חיל = תקשוב, sorting by ימים לחריגה.",
            "GET", "/reports/tasks/page",
            {**FILTERS, "rowId": tasks["rows"][0]["id"], "page": 1, "pageSize": 50, "sortKey": "daysToBreach", "sortDir": "asc", "f.corps": "תקשוב"})

    example("8. Candidate search", "The חיפוש מלש\"ב box, called as the user types.", "GET", "/candidates/search", {"q": "כהן"})

    example("9. Current user — admin", "Decides whether the admin tools show.", "GET", "/me")
    example("9b. Current user — regular", "(The demo server takes the employee id from this header; production uses the real login.)",
            "GET", "/me", headers={"X-Employee-Id": "7654321"})

    example("10. Announcements", "Only announcements that haven't expired, newest first.", "GET", "/announcements")

    expires = (datetime.now(timezone.utc) + timedelta(days=7)).replace(hour=21, minute=59, second=59, microsecond=999000)
    body = {"title": "עדכון", "message": "נוספו מדדים חדשים לתחום הרפואי.", "severity": "info",
            "expiresAt": expires.isoformat().replace("+00:00", "Z")}
    created = example("11. Create an announcement (admin)", "The \"פרסום הודעה\" button.", "POST", "/announcements", body=body)
    example("11b. Edit an announcement (admin)", "The same body as create. A missing `title` removes it.",
            "PUT", f"/announcements/{created['id']}", body={**body, "title": None, "severity": "warning"})
    example("11c. Create — not an admin", "Admin-only endpoints refuse everyone else.", "POST", "/announcements",
            body=body, headers={"X-Employee-Id": "7654321"})
    example("12. Delete an announcement (admin)", "", "DELETE", f"/announcements/{created['id']}")

    header = f"""# API examples — real requests and responses

Generated by `backend/tools/make_examples.py` from the example server on {TODAY}.
Every request is exactly what the dashboard sends; every response is what the server returned.
Lists longer than {SHORT_LIST} items are cut to their first {KEEP} ("… N more"). The rules behind each field are in [API_CONTRACT.md](API_CONTRACT.md).

All paths are relative to the API base (`/api`). Dates are `YYYY-MM-DD`, empty values are `null`.

**Contents:** {" · ".join(s.splitlines()[0][3:] for s in sections)}

"""
    OUT.write_text(header + "\n---\n\n".join(sections), encoding="utf-8")
    print(f"wrote {OUT} ({len(sections)} examples)")


if __name__ == "__main__":
    main()
