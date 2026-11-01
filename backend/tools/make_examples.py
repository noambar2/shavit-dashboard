"""
Calls every endpoint of a running API and writes API_EXAMPLES.md: one simple example per
endpoint — what the dashboard sends, and the JSON it gets back.

    uvicorn app.main:app --port 8000      # in another terminal
    python tools/make_examples.py         # writes ../API_EXAMPLES.md
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
FILTERS = {"scope": "all", "date": date.today().isoformat(), "dateGranularity": "day"}
# Lists are cut to their first item + "..." — except these small fixed sets, shown in full.
FULL_LISTS = {"taskStatus", "indicatorRating", "indicatorClassifications", "professionalFields",
              "ramadTevelIndications", "segments", "series", "path", "pauseReason", "track"}
INLINE_WIDTH = 90  # objects/lists that fit in this many characters are printed on one line


def call(method, path, query=None, body=None):
    url = BASE + path + ("?" + urllib.parse.urlencode(query) if query else "")
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"null")


def shorten(value, key=None):
    if isinstance(value, list):
        if key in FULL_LISTS or len(value) <= 1:
            return [shorten(v) for v in value]
        return [shorten(value[0]), "..."]
    if isinstance(value, dict):
        return {k: shorten(v, k) for k, v in value.items()}
    return value


def pretty(value, indent=0):
    """JSON with short objects/lists kept on one line, so examples read easily."""
    one_line = json.dumps(value, ensure_ascii=False, separators=(", ", ": "))
    if not isinstance(value, (dict, list)) or len(one_line) + indent <= INLINE_WIDTH:
        return one_line
    pad, inner = " " * indent, " " * (indent + 2)
    if isinstance(value, dict):
        items = [f'{inner}{json.dumps(k, ensure_ascii=False)}: {pretty(v, indent + 2)}' for k, v in value.items()]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    items = [inner + pretty(v, indent + 2) for v in value]
    return "[\n" + ",\n".join(items) + f"\n{pad}]"


sections = []


def example(title, note, method, path, query=None, body=None):
    resp = call(method, path, query, body)
    # Shown un-encoded (q=כהן, not q=%D7%9B…) so it's readable.
    url = "/api" + path + ("?" + "&".join(f"{k}={v}" for k, v in query.items()) if query else "")
    part = [f"## {title}", "", note, "", "**שולחים**", "", "```http", f"{method} {url}"]
    if body is not None:
        part += ["", pretty(body)]
    part += ["```", "", "**מקבלים**", ""]
    part += ["```json", pretty(shorten(resp)), "```"] if resp is not None else ["*(בלי גוף תשובה — סטטוס 204)*"]
    sections.append("\n".join(part))
    return resp


def first_leaf_with_indicator(rows):
    for r in rows:
        if r.get("indicatorId"):
            return r
        found = first_leaf_with_indicator(r.get("children") or [])
        if found:
            return found


def main():
    example("1. אפשרויות סינון", "נטען פעם אחת בפתיחת הדף.", "GET", "/filters/options")
    example("2. כרטיסי KPI", "ארבעת הכרטיסים העליונים. כל קריאה ל-`/dashboard/*` כוללת את אותם פרמטרי סינון.",
            "GET", "/dashboard/kpis", FILTERS)
    example("3. מסגרות", "הגרף. בלי `parentId` = הרמה העליונה; לחיצה על עמודה שולחת `parentId` שלה.",
            "GET", "/dashboard/frameworks", {**FILTERS, "metric": "scores"})
    example("4. התפתחות היסטורית", "הגרף נפתח על ציונים. את קו הממוצע הפרונט מחשב לבד.",
            "GET", "/dashboard/history", {**FILTERS, "metric": "scores"})
    tasks = example("5. טבלת משימות", "עץ בכל עומק — `children` רק בשורות שיש להן.", "GET", "/dashboard/tasks", FILTERS)
    leaf = first_leaf_with_indicator(tasks["rows"])
    example("6. פרטי מדד (ⓘ)", "נטען בריחוף ראשון על ⓘ.", "GET", f"/indicators/{leaf['indicatorId']}")
    example("7. נתונים לאקסל", "כל המשימות של שורה. את קובץ האקסל הדפדפן בונה.",
            "GET", "/reports/tasks", {**FILTERS, "rowId": leaf["id"]})
    example("8. דוח בתוך המערכת", "עמוד אחד מהדוח, אחרי סינון/מיון בשרת (כאן: בחריגה, ממוין לפי ימים לחריגה).",
            "GET", "/reports/tasks/page",
            {**FILTERS, "rowId": tasks["rows"][0]["id"], "page": 1, "pageSize": 50, "taskType": "breach", "sortKey": "daysToBreach", "sortDir": "asc"})
    example("9. חיפוש מלש\"ב", "תוך כדי הקלדה בתיבת החיפוש.", "GET", "/candidates/search", {"q": "כהן"})
    example("10. המשתמש המחובר", "קובע אם להציג את כלי המנהלן.", "GET", "/me")
    example("11. הודעות", "רק הודעות שעוד לא פגו.", "GET", "/announcements")

    expires = (datetime.now(timezone.utc) + timedelta(days=7)).replace(hour=21, minute=59, second=59, microsecond=0)
    body = {"title": "עדכון", "message": "נוספו מדדים חדשים לתחום הרפואי.", "severity": "info",
            "expiresAt": expires.isoformat().replace("+00:00", "Z")}
    created = example("12. יצירת הודעה (מנהלן)", "עריכה זהה: `PUT /api/announcements/{id}` עם אותו גוף. למי שאינו מנהלן — 403.",
                      "POST", "/announcements", body=body)
    example("13. מחיקת הודעה (מנהלן)", "מוחקים הודעה. למי שאינו מנהלן — 403.", "DELETE", f"/announcements/{created['id']}")

    header = """# דוגמאות API

לכל נקודת קצה: **מה הפרונט שולח** ו**איזה JSON הוא מקבל**. התשובות אמיתיות, משרת הדוגמה שב-`backend/`.
רשימות קוצרו לפריט אחד + `"..."` (חוץ מרשימות קבועות וקצרות, שמוצגות במלואן). ההסבר המלא על כל שדה נמצא ב-[API_CONTRACT.md](API_CONTRACT.md).

"""
    OUT.write_text(header + "\n\n---\n\n".join(sections) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(sections)} examples)")


if __name__ == "__main__":
    main()
