"""
Response/request shapes. They mirror src/api/types.ts in the frontend one-to-one,
and are serialised in camelCase (e.g. `change_pct` → `changePct`).
"""
from datetime import datetime
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


TaskStatusKey = Literal["treatment", "nearBreach", "breach", "paused"]
RatingKey = Literal["high", "medium", "low"]
ClassificationKey = Literal["processes", "routine"]


class Option(CamelModel):
    id: str
    label: str


class FilterOptions(CamelModel):
    task_status: List[Option]
    indicator_rating: List[Option]
    org_units: List[Option]
    professional_fields: List[Option]
    ramad_tevel_indications: List[Option]
    indicator_classifications: List[Option]


# --- KPIs ------------------------------------------------------------------

class Segment(CamelModel):
    key: str
    label: str
    count: int


class Distribution(CamelModel):
    total: int
    change_pct: Optional[float] = None
    segments: List[Segment]


class Score(CamelModel):
    value: float
    change_pct: float


class KpiSummary(CamelModel):
    score: Score
    task_status: Distribution
    indicator_rating: Distribution
    task_classification: Distribution


# --- מסגרות -----------------------------------------------------------------

class FrameworkItem(CamelModel):
    id: str
    name: str
    has_children: bool
    total: float
    breakdown: Optional[Dict[str, int]] = None
    score: Optional[float] = None


class BreadcrumbItem(CamelModel):
    id: Optional[str]
    name: str


class FrameworksResponse(CamelModel):
    path: List[BreadcrumbItem]
    items: List[FrameworkItem]


# --- History -----------------------------------------------------------------

class HistoryPoint(CamelModel):
    date: str
    value: float


class HistorySeries(CamelModel):
    key: str
    label: str
    points: List[HistoryPoint]


class HistoryResponse(CamelModel):
    series: List[HistorySeries]


# --- Tasks table -------------------------------------------------------------

class TaskRow(CamelModel):
    id: str
    name: str
    indicator_id: Optional[str] = None
    treatment: int
    near_breach: int
    breach: int
    paused: int
    total: int
    sla: Optional[int]
    weight_pct: float
    score: Optional[float]
    trend_pct: Optional[float]
    has_report: bool
    children: Optional[List["TaskRow"]] = None


TaskRow.model_rebuild()


class TasksResponse(CamelModel):
    rows: List[TaskRow]


class IndicatorDetails(CamelModel):
    id: str
    name: str
    description: str
    handling: str
    classification: str
    professional_field: str
    penalty: int
    note: Optional[str] = None


# --- Reports -----------------------------------------------------------------

class ReportColumn(CamelModel):
    key: str
    label: str
    type: Literal["text", "number", "date"]
    width: Optional[int] = None


# A task line: {column key: value}. Keys are already camelCase, so plain dicts are used.
ReportTask = Dict[str, Union[str, int, float, None]]


class ReportRowTasks(CamelModel):
    row_id: str
    tasks: List[ReportTask]


class ReportTasksResponse(CamelModel):
    columns: List[ReportColumn]
    rows: List[ReportRowTasks]


class ReportPage(CamelModel):
    columns: List[ReportColumn]
    total: int
    type_counts: Dict[str, int]
    facets: Dict[str, List[str]]
    tasks: List[ReportTask]


# --- Users, search, announcements ---------------------------------------------

class CurrentUser(CamelModel):
    employee_id: str
    full_name: str
    is_admin: bool


class CandidateSearchResult(CamelModel):
    id: str
    full_name: str
    id_number: str


class AnnouncementAuthor(CamelModel):
    employee_id: str
    full_name: str


class Announcement(CamelModel):
    id: str
    title: Optional[str] = None
    message: str
    severity: Literal["info", "warning"]
    created_at: datetime
    expires_at: datetime
    created_by: AnnouncementAuthor


class AnnouncementInput(CamelModel):
    title: Optional[str] = Field(default=None, max_length=80)
    message: str = Field(min_length=1, max_length=500)
    severity: Literal["info", "warning"]
    expires_at: datetime
