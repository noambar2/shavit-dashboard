"""
Business logic shared by the endpoints.

The main idea: `Snapshot` loads the frameworks tree and the tasks that are open at the
selected date (after the dashboard filters), and every endpoint aggregates from it.
That keeps the example short and readable. With millions of tasks, move the counting
into SQL (GROUP BY framework_id, task type) — the endpoint code wouldn't need to change.
"""
import calendar
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional

from fastapi import Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .config import NEAR_BREACH_DAYS
from .models import Framework, FrameworkScore, Task

TASK_TYPES = ["breach", "nearBreach", "treatment", "paused"]


# ---------------------------------------------------------------------------
# Dashboard filters (the query string every /dashboard/* request carries)
# ---------------------------------------------------------------------------

@dataclass
class DashboardFilters:
    scope: str = "all"
    selected_date: date = field(default_factory=date.today)
    date_granularity: str = "day"
    task_status: Optional[str] = None
    indicator_rating: Optional[str] = None
    org_unit_id: Optional[str] = None
    professional_field_id: Optional[str] = None
    ramad_tevel_indication_id: Optional[str] = None
    indicator_classification: Optional[str] = None

    @property
    def as_of(self) -> date:
        """The day the numbers are calculated for: the chosen day, or the end of the chosen month/year (never in the future)."""
        d = self.selected_date
        if self.date_granularity == "month":
            d = d.replace(day=calendar.monthrange(d.year, d.month)[1])
        elif self.date_granularity == "year":
            d = d.replace(month=12, day=31)
        return min(d, date.today())

    @property
    def previous_as_of(self) -> date:
        """Same point one period earlier — for the ↑/↓ change percentages."""
        if self.date_granularity == "year":
            return self.as_of.replace(year=self.as_of.year - 1)
        if self.date_granularity == "month":
            return self.as_of - timedelta(days=30)
        return self.as_of - timedelta(days=1)


def dashboard_filters(
    scope: str = "all",
    date_: date = Query(default_factory=date.today, alias="date"),
    date_granularity: str = Query("day", alias="dateGranularity"),
    task_status: Optional[str] = Query(None, alias="taskStatus"),
    indicator_rating: Optional[str] = Query(None, alias="indicatorRating"),
    org_unit_id: Optional[str] = Query(None, alias="orgUnitId"),
    professional_field_id: Optional[str] = Query(None, alias="professionalFieldId"),
    ramad_tevel_indication_id: Optional[str] = Query(None, alias="ramadTevelIndicationId"),
    indicator_classification: Optional[str] = Query(None, alias="indicatorClassification"),
) -> DashboardFilters:
    """FastAPI dependency that reads the filters from the query string."""
    return DashboardFilters(
        scope, date_, date_granularity, task_status, indicator_rating, org_unit_id,
        professional_field_id, ramad_tevel_indication_id, indicator_classification,
    )


# ---------------------------------------------------------------------------
# סוג משימה — same rule as the frontend (src/reports/taskType.ts)
# ---------------------------------------------------------------------------

def task_type(days_to_breach: int, pause_end: Optional[date], as_of: date) -> str:
    if pause_end is not None and pause_end >= as_of:
        return "paused"
    if days_to_breach < 0:
        return "breach"
    if days_to_breach <= NEAR_BREACH_DAYS:
        return "nearBreach"
    return "treatment"


def rating_for(score: Optional[float]) -> Optional[str]:
    """דירוג מדדים: high ≥ 90, medium ≥ 70, low below that."""
    if score is None:
        return None
    return "high" if score >= 90 else "medium" if score >= 70 else "low"


# ---------------------------------------------------------------------------
# Snapshot
# ---------------------------------------------------------------------------

@dataclass
class OpenTask:
    task: Task
    leaf: Framework
    handling_days: int
    days_to_breach: int
    type: str


class Snapshot:
    """Frameworks tree + open tasks at `as_of`, after every filter except `taskStatus`."""

    def __init__(self, db: Session, filters: DashboardFilters, as_of: Optional[date] = None):
        self.db = db
        self.filters = filters
        self.as_of = as_of or filters.as_of

        frameworks = db.scalars(select(Framework).options(joinedload(Framework.indicator))).unique().all()
        self.by_id: Dict[str, Framework] = {f.id: f for f in frameworks}
        self.children: Dict[Optional[str], List[Framework]] = defaultdict(list)
        for f in sorted(frameworks, key=lambda f: f.sort_order):
            self.children[f.parent_id].append(f)

        self.scores = self._scores_at(self.as_of)
        self.prev_scores = self._scores_at(filters.previous_as_of if as_of is None else self.as_of - timedelta(days=30))

        allowed_leaves = {f.id for f in frameworks if self._leaf_passes(f)}
        tasks = db.scalars(
            select(Task)
            .options(joinedload(Task.candidate))
            .where(Task.framework_id.in_(allowed_leaves))
            .where(Task.start_date <= self.as_of)
            .where((Task.end_date.is_(None)) | (Task.end_date > self.as_of))
        ).all()
        self.open_tasks: List[OpenTask] = []
        for t in tasks:
            handling = (self.as_of - t.start_date).days
            days = t.sla_days - handling
            self.open_tasks.append(OpenTask(t, self.by_id[t.framework_id], handling, days, task_type(days, t.pause_end_date, self.as_of)))

    # --- filters ---------------------------------------------------------------

    def _leaf_passes(self, f: Framework) -> bool:
        """Whether tasks of this framework count under the current filters (except taskStatus)."""
        flt = self.filters
        top = self.top_of(f)
        if flt.scope != "all" and top.scope != flt.scope:
            return False
        if flt.org_unit_id and flt.org_unit_id not in {a.id for a in self.ancestors(f, include_self=True)}:
            return False
        ind = f.indicator
        if flt.professional_field_id and (not ind or ind.professional_field_id != flt.professional_field_id):
            return False
        if flt.ramad_tevel_indication_id and (not ind or ind.ramad_tevel_id != flt.ramad_tevel_indication_id):
            return False
        if flt.indicator_classification and (not ind or ind.classification != flt.indicator_classification):
            return False
        if flt.indicator_rating and rating_for(self.scores.get(f.id)) != flt.indicator_rating:
            return False
        return True

    def tasks_matching_status(self) -> List[OpenTask]:
        status = self.filters.task_status
        return [t for t in self.open_tasks if not status or t.type == status]

    # --- tree helpers --------------------------------------------------------

    def ancestors(self, f: Framework, include_self: bool = False) -> List[Framework]:
        chain = [f] if include_self else []
        while f.parent_id:
            f = self.by_id[f.parent_id]
            chain.append(f)
        return chain

    def top_of(self, f: Framework) -> Framework:
        return (self.ancestors(f, include_self=True))[-1]

    def is_leaf(self, f: Framework) -> bool:
        return not self.children.get(f.id)

    def leaves_under(self, f: Framework) -> List[Framework]:
        kids = self.children.get(f.id)
        return [f] if not kids else [leaf for k in kids for leaf in self.leaves_under(k)]

    def roots(self) -> List[Framework]:
        """Top-level frameworks visible under the scope / מבנה ארגוני filters."""
        if self.filters.org_unit_id and self.filters.org_unit_id in self.by_id:
            return [self.by_id[self.filters.org_unit_id]]
        return [f for f in self.children[None] if self.filters.scope == "all" or f.scope == self.filters.scope]

    # --- counting ----------------------------------------------------------------

    def counts_by_leaf(self, tasks: Iterable[OpenTask]) -> Dict[str, Dict[str, int]]:
        counts: Dict[str, Dict[str, int]] = defaultdict(lambda: {k: 0 for k in TASK_TYPES})
        for t in tasks:
            counts[t.leaf.id][t.type] += 1
        return counts

    def subtree_counts(self, f: Framework, by_leaf: Dict[str, Dict[str, int]]) -> Dict[str, int]:
        total = {k: 0 for k in TASK_TYPES}
        for leaf in self.leaves_under(f):
            for k, v in by_leaf.get(leaf.id, {}).items():
                total[k] += v
        return total

    # --- scores --------------------------------------------------------------------

    def _scores_at(self, day: date) -> Dict[str, float]:
        """Latest score of every framework on or before `day`."""
        rows = self.db.execute(
            select(FrameworkScore.framework_id, FrameworkScore.score)
            .where(FrameworkScore.day <= day)
            .order_by(FrameworkScore.day)
        ).all()
        return {fid: score for fid, score in rows}  # later dates overwrite earlier ones

    def score_of(self, f: Framework, scores: Optional[Dict[str, float]] = None) -> Optional[float]:
        """A framework's own score, or the average of its children's when it has none."""
        scores = self.scores if scores is None else scores
        if f.id in scores:
            return round(scores[f.id], 1)
        kid_scores = [s for s in (self.score_of(k, scores) for k in self.children.get(f.id, [])) if s is not None]
        return round(sum(kid_scores) / len(kid_scores), 1) if kid_scores else None


def pct_change(now: float, before: float) -> float:
    return round((now - before) / before * 100) if before else 0
