"""Report endpoints — sections 7 (Excel data) and 7b (in-app view) of API_CONTRACT.md."""
from datetime import date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..services import TASK_TYPES, DashboardFilters, OpenTask, Snapshot, dashboard_filters

router = APIRouter()

# The דוח שמי columns, in order. To add one: add it here and fill it in `task_line` below —
# the frontend builds its table and Excel from this list, no frontend change needed.
REPORT_COLUMNS = [
    schemas.ReportColumn(key="startDate", label="תאריך תחילה", type="date"),
    schemas.ReportColumn(key="runDate", label="תאריך ריצה", type="date"),
    schemas.ReportColumn(key="handlingDays", label="משך טיפול (ימים)", type="number"),
    schemas.ReportColumn(key="daysToBreach", label="ימים לחריגה", type="number"),
    schemas.ReportColumn(key="pauseEndDate", label="תאריך סיום השהייה", type="date"),
    schemas.ReportColumn(key="pauseReason", label="סיבת השהייה", type="text"),
    schemas.ReportColumn(key="personalNumber", label="מספר אישי", type="text"),
    schemas.ReportColumn(key="track", label="מסלול עתודה / שוחרים", type="text"),
    schemas.ReportColumn(key="corps", label="חיל", type="text"),
    schemas.ReportColumn(key="major", label="מגמה", type="text", width=20),
    schemas.ReportColumn(key="position", label="משרה לאיוש", type="text", width=20),
    schemas.ReportColumn(key="studyStartDate", label="תאריך תחילת לימודים", type="date"),
    schemas.ReportColumn(key="studyEndDate", label="תאריך סיום לימודים", type="date"),
]
TEXT_COLUMNS = [c.key for c in REPORT_COLUMNS if c.type == "text"]
MAX_FACET_VALUES = 50  # text columns with more distinct values (e.g. מספר אישי) get no filter


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def task_line(ot: OpenTask, as_of: date) -> Dict:
    """One task as `{column key: value}` (plus the fields the UI needs to compute סוג משימה)."""
    t, c = ot.task, ot.task.candidate
    return {
        "startDate": _iso(t.start_date),
        "runDate": as_of.isoformat(),
        "handlingDays": ot.handling_days,
        "daysToBreach": ot.days_to_breach,
        "pauseEndDate": _iso(t.pause_end_date),
        "pauseReason": t.pause_reason,
        "personalNumber": t.personal_number,
        "track": c.track,
        "corps": c.corps,
        "major": c.major,
        "position": c.position,
        "studyStartDate": _iso(c.study_start),
        "studyEndDate": _iso(c.study_end),
    }


def _tasks_under(snap: Snapshot, row_id: str) -> List[OpenTask]:
    """Open tasks (after dashboard filters incl. taskStatus) of every lowest-level row under `row_id`."""
    row = snap.by_id.get(row_id)
    if not row:
        raise HTTPException(404, "row not found")
    leaf_ids = {leaf.id for leaf in snap.leaves_under(row)}
    return [t for t in snap.tasks_matching_status() if t.leaf.id in leaf_ids]


@router.get("/reports/tasks", response_model=schemas.ReportTasksResponse)
def report_tasks(
    row_id: str = Query(alias="rowId"),
    f: DashboardFilters = Depends(dashboard_filters),
    db: Session = Depends(get_db),
):
    """All task lines for the Excel export, grouped by lowest-level row."""
    snap = Snapshot(db, f)
    by_row: Dict[str, List[Dict]] = {leaf.id: [] for leaf in snap.leaves_under(snap.by_id[row_id])} if row_id in snap.by_id else {}
    for t in _tasks_under(snap, row_id):
        by_row[t.leaf.id].append(task_line(t, snap.as_of))
    return schemas.ReportTasksResponse(
        columns=REPORT_COLUMNS,
        rows=[schemas.ReportRowTasks(row_id=rid, tasks=tasks) for rid, tasks in by_row.items()],
    )


@router.get("/reports/tasks/page", response_model=schemas.ReportPage)
def report_page(
    request: Request,
    row_id: str = Query(alias="rowId"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=10000, alias="pageSize"),
    sort_key: Optional[str] = Query(None, alias="sortKey"),
    sort_dir: str = Query("asc", alias="sortDir"),
    task_type: Optional[str] = Query(None, alias="taskType"),
    q: Optional[str] = None,
    leaf_row_id: Optional[str] = Query(None, alias="leafRowId"),
    f: DashboardFilters = Depends(dashboard_filters),
    db: Session = Depends(get_db),
):
    """One filtered, sorted page of a row's tasks, for the report view inside the system."""
    snap = Snapshot(db, f)
    tasks = _tasks_under(snap, row_id)
    lines = [(t, {**task_line(t, snap.as_of), "rowId": t.leaf.id}) for t in tasks]

    # Exact-match column filters arrive as f.<key>=value (e.g. f.corps=תקשוב).
    column_filters = {k[2:]: v for k, v in request.query_params.items() if k.startswith("f.") and v}
    needle = (q or "").strip()

    def passes(line: Dict) -> bool:
        if leaf_row_id and line["rowId"] != leaf_row_id:
            return False
        if needle and not any(needle in str(v) for v in line.values() if v is not None):
            return False
        return all(str(line.get(k) or "") == v for k, v in column_filters.items())

    base = [(t, line) for t, line in lines if passes(line)]
    type_counts = {k: 0 for k in TASK_TYPES}
    for t, _ in base:
        type_counts[t.type] += 1
    matching = [(t, line) for t, line in base if not task_type or t.type == task_type]

    if sort_key:
        def value(item):
            t, line = item
            return TASK_TYPES.index(t.type) if sort_key == "taskType" else line.get(sort_key)

        # Empty values always go last, in either direction.
        filled = [i for i in matching if value(i) is not None]
        empty = [i for i in matching if value(i) is None]
        matching = sorted(filled, key=value, reverse=sort_dir == "desc") + empty

    facets = {}
    for k in TEXT_COLUMNS:
        values = sorted({line[k] for _, line in lines if line.get(k)})
        if len(values) <= MAX_FACET_VALUES:
            facets[k] = values

    start = (page - 1) * page_size
    return schemas.ReportPage(
        columns=REPORT_COLUMNS,
        total=len(matching),
        type_counts=type_counts,
        facets=facets,
        tasks=[line for _, line in matching[start:start + page_size]],
    )
