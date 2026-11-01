"""Dashboard endpoints — sections 1–6 of API_CONTRACT.md."""
from dataclasses import replace
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import schemas
from ..config import FRAMEWORKS_ROOT_NAME
from ..db import get_db
from ..models import Framework, FrameworkScore, Indicator, ProfessionalField, RamadTevelIndication
from ..services import TASK_TYPES, DashboardFilters, Snapshot, dashboard_filters, pct_change, rating_for

router = APIRouter()

STATUS_LABELS = {"breach": "בחריגה", "nearBreach": "עתידות לחרוג", "treatment": "לטיפול", "paused": "בהשהייה"}
RATING_LABELS = {"high": "גבוהים", "medium": "בינוניים", "low": "נמוכים"}
CLASSIFICATION_LABELS = {"processes": "תהליכים", "routine": "שגרה"}


@router.get("/filters/options", response_model=schemas.FilterOptions)
def filter_options(db: Session = Depends(get_db)):
    tops = db.scalars(select(Framework).where(Framework.parent_id.is_(None)).order_by(Framework.sort_order)).all()
    return schemas.FilterOptions(
        task_status=[schemas.Option(id=k, label=f"משימות {v}" if k != "nearBreach" else v) for k, v in STATUS_LABELS.items()],
        indicator_rating=[schemas.Option(id=k, label=f"מדדים {v}") for k, v in RATING_LABELS.items()],
        org_units=[schemas.Option(id=f.id, label=f.name) for f in tops],
        professional_fields=[schemas.Option(id=p.id, label=p.name) for p in db.scalars(select(ProfessionalField)).all()],
        ramad_tevel_indications=[schemas.Option(id=r.id, label=r.name) for r in db.scalars(select(RamadTevelIndication)).all()],
        indicator_classifications=[schemas.Option(id=k, label=v) for k, v in CLASSIFICATION_LABELS.items()],
    )


@router.get("/dashboard/kpis", response_model=schemas.KpiSummary, response_model_exclude_none=True)
def kpis(f: DashboardFilters = Depends(dashboard_filters), db: Session = Depends(get_db)):
    # Each donut shows all its segments even when one of them is the active filter,
    # so load without the rating / classification filters and apply them per donut.
    base = replace(f, indicator_rating=None, indicator_classification=None)
    snap = Snapshot(db, base)
    prev = Snapshot(db, base, as_of=f.previous_as_of)

    def rating_ok(s: Snapshot, t) -> bool:
        return not f.indicator_rating or rating_for(s.scores.get(t.leaf.id)) == f.indicator_rating

    def class_ok(t) -> bool:
        return not f.indicator_classification or (t.leaf.indicator and t.leaf.indicator.classification == f.indicator_classification)

    def status_ok(t) -> bool:
        return not f.task_status or t.type == f.task_status

    def distribution(counts: dict, labels: dict, selected: Optional[str], change: Optional[float] = None):
        total = counts.get(selected, 0) if selected else sum(counts.values())
        segments = [schemas.Segment(key=k, label=labels[k], count=counts.get(k, 0)) for k in labels]
        return schemas.Distribution(total=total, change_pct=change, segments=segments)

    # סטטוס משימות
    def status_counts(s: Snapshot) -> dict:
        counts = {k: 0 for k in TASK_TYPES}
        for t in s.open_tasks:
            if rating_ok(s, t) and class_ok(t):
                counts[t.type] += 1
        return counts

    now_status, prev_status = status_counts(snap), status_counts(prev)
    sel = f.task_status
    now_total = now_status.get(sel, 0) if sel else sum(now_status.values())
    prev_total = prev_status.get(sel, 0) if sel else sum(prev_status.values())

    # סיווג משימות
    class_counts = {k: 0 for k in CLASSIFICATION_LABELS}
    for t in snap.open_tasks:
        if rating_ok(snap, t) and status_ok(t) and t.leaf.indicator:
            class_counts[t.leaf.indicator.classification] += 1

    # דירוג מדדים — counts indicators (lowest-level frameworks with a מדד), not tasks
    rating_counts = {k: 0 for k in RATING_LABELS}
    for root in snap.roots():
        for leaf in snap.leaves_under(root):
            if leaf.indicator and snap._leaf_passes(leaf) and (not f.indicator_classification or leaf.indicator.classification == f.indicator_classification):
                r = rating_for(snap.scores.get(leaf.id))
                if r:
                    rating_counts[r] += 1

    # ציון — average of the visible top-level frameworks
    def avg_score(s: Snapshot, scores) -> float:
        vals = [v for v in (s.score_of(r, scores) for r in s.roots()) if v is not None]
        return round(sum(vals) / len(vals)) if vals else 0

    score_now, score_prev = avg_score(snap, snap.scores), avg_score(snap, snap.prev_scores)

    return schemas.KpiSummary(
        score=schemas.Score(value=score_now, change_pct=pct_change(score_now, score_prev)),
        task_status=schemas.Distribution(
            total=now_total,
            change_pct=pct_change(now_total, prev_total),
            segments=[schemas.Segment(key=k, label=STATUS_LABELS[k], count=now_status[k]) for k in ["breach", "nearBreach", "treatment", "paused"]],
        ),
        indicator_rating=distribution(rating_counts, RATING_LABELS, f.indicator_rating),
        task_classification=distribution(class_counts, CLASSIFICATION_LABELS, f.indicator_classification),
    )


@router.get("/dashboard/frameworks", response_model=schemas.FrameworksResponse)
def frameworks(
    metric: str = "tasks",
    parent_id: Optional[str] = Query(None, alias="parentId"),
    f: DashboardFilters = Depends(dashboard_filters),
    db: Session = Depends(get_db),
):
    snap = Snapshot(db, f)
    parent = snap.by_id.get(parent_id) if parent_id else None
    if parent_id and not parent:
        raise HTTPException(404, "framework not found")
    level = snap.children.get(parent.id, []) if parent else snap.roots()

    path = [schemas.BreadcrumbItem(id=None, name=FRAMEWORKS_ROOT_NAME)]
    if parent:
        path += [schemas.BreadcrumbItem(id=a.id, name=a.name) for a in reversed(snap.ancestors(parent, include_self=True))]

    by_leaf = snap.counts_by_leaf(snap.tasks_matching_status())
    items = []
    for fw in level:
        has_children = bool(snap.children.get(fw.id))
        if metric == "scores":
            raw = snap.score_of(fw)
            score = round(raw) if raw is not None else None
            items.append(schemas.FrameworkItem(id=fw.id, name=fw.name, has_children=has_children, total=score or 0, score=score))
        else:
            breakdown = snap.subtree_counts(fw, by_leaf)
            items.append(schemas.FrameworkItem(id=fw.id, name=fw.name, has_children=has_children, total=sum(breakdown.values()), breakdown=breakdown))
    return schemas.FrameworksResponse(path=path, items=items)


@router.get("/dashboard/history", response_model=schemas.HistoryResponse)
def history(metric: str = "tasks", f: DashboardFilters = Depends(dashboard_filters), db: Session = Depends(get_db)):
    """Five points, one month apart, ending at the selected date."""
    days = [f.as_of - timedelta(days=30 * i) for i in reversed(range(5))]

    if metric == "scores":
        snap = Snapshot(db, f)
        root_ids = [r.id for r in snap.roots()]
        score_pts, parent_pts = [], []
        for d in days:
            rows = db.execute(
                select(FrameworkScore.framework_id, FrameworkScore.score, FrameworkScore.parent_score)
                .where(FrameworkScore.framework_id.in_(root_ids), FrameworkScore.day <= d)
                .order_by(FrameworkScore.day)
            ).all()
            latest = {fid: (s, p) for fid, s, p in rows}
            s_vals = [s for s, _ in latest.values()]
            p_vals = [p for _, p in latest.values() if p is not None]
            score_pts.append(schemas.HistoryPoint(date=d.isoformat(), value=round(sum(s_vals) / len(s_vals), 1) if s_vals else 0))
            parent_pts.append(schemas.HistoryPoint(date=d.isoformat(), value=round(sum(p_vals) / len(p_vals), 1) if p_vals else 0))
        return schemas.HistoryResponse(series=[
            schemas.HistorySeries(key="score", label="ציון", points=score_pts),
            schemas.HistorySeries(key="parentScore", label="ציון אב", points=parent_pts),
        ])

    tasks_pts, parent_pts = [], []
    for d in days:
        snap = Snapshot(db, f, as_of=d)
        tasks = snap.tasks_matching_status()
        tasks_pts.append(schemas.HistoryPoint(date=d.isoformat(), value=len(tasks)))
        parent_pts.append(schemas.HistoryPoint(date=d.isoformat(), value=sum(1 for t in tasks if t.task.is_parent)))
    return schemas.HistoryResponse(series=[
        schemas.HistorySeries(key="tasks", label="משימות", points=tasks_pts),
        schemas.HistorySeries(key="parentTasks", label="משימות אב", points=parent_pts),
    ])


@router.get("/dashboard/tasks", response_model=schemas.TasksResponse)
def tasks_table(f: DashboardFilters = Depends(dashboard_filters), db: Session = Depends(get_db)):
    snap = Snapshot(db, f)
    by_leaf = snap.counts_by_leaf(snap.tasks_matching_status())

    def to_row(fw: Framework) -> schemas.TaskRow:
        counts = snap.subtree_counts(fw, by_leaf)
        kids: List[Framework] = snap.children.get(fw.id, [])
        score = snap.score_of(fw)
        prev = snap.score_of(fw, snap.prev_scores)
        return schemas.TaskRow(
            id=fw.id,
            name=fw.name,
            indicator_id=fw.indicator_id,
            treatment=counts["treatment"],
            near_breach=counts["nearBreach"],
            breach=counts["breach"],
            paused=counts["paused"],
            total=sum(counts.values()),
            sla=fw.sla_days,
            weight_pct=fw.weight_pct,
            score=round(score) if score is not None else None,
            trend_pct=pct_change(score, prev) if score is not None and prev and score != prev else None,
            has_report=True,
            children=[to_row(k) for k in kids] or None,
        )

    return schemas.TasksResponse(rows=[to_row(r) for r in snap.roots()])


@router.get("/indicators/{indicator_id}", response_model=schemas.IndicatorDetails)
def indicator(indicator_id: str, db: Session = Depends(get_db)):
    ind = db.get(Indicator, indicator_id)
    if not ind:
        raise HTTPException(404, "indicator not found")
    return schemas.IndicatorDetails(
        id=ind.id,
        name=ind.name,
        description=ind.description,
        handling=ind.handling,
        classification=CLASSIFICATION_LABELS.get(ind.classification, ind.classification),
        professional_field=ind.professional_field.name if ind.professional_field else "-",
        penalty=ind.penalty,
        note=ind.note,
    )
