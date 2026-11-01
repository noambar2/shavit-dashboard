"""
Example database schema. Adapt the table/column names to your real database — the API
layer (services.py, routers/) only relies on the fields used there.

    frameworks ──┬── frameworks (parent_id: a tree of any depth: ענף → מדור → משרד → צוות …)
                 ├── indicators (a lowest-level framework measures one מדד)
                 ├── framework_scores (score per framework per date)
                 └── tasks ── candidates (מלש"ב)
    indicators ── professional_fields, ramad_tevel_indications
    users, announcements
"""
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Framework(Base):
    """A row in the משימות table / a bar in the מסגרות chart. Lowest-level rows have tasks."""

    __tablename__ = "frameworks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    parent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("frameworks.id"), index=True)
    # 'bureaus' (לשכות) or 'hq' (מפקדה) — the כלל מיטב / לשכות / מפקדה toggle.
    scope: Mapped[str] = mapped_column(String(16), default="bureaus")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    sla_days: Mapped[Optional[int]] = mapped_column(Integer)
    weight_pct: Mapped[float] = mapped_column(Float, default=0)
    indicator_id: Mapped[Optional[str]] = mapped_column(ForeignKey("indicators.id"))

    parent: Mapped[Optional["Framework"]] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[List["Framework"]] = relationship(back_populates="parent", order_by="Framework.sort_order")
    indicator: Mapped[Optional["Indicator"]] = relationship()


class ProfessionalField(Base):
    """תחום מקצועי"""

    __tablename__ = "professional_fields"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class RamadTevelIndication(Base):
    """אינדיקציית רמ"ד תבל"""

    __tablename__ = "ramad_tevel_indications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class Indicator(Base):
    """מדד — shown in the ⓘ tooltip of the table."""

    __tablename__ = "indicators"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)  # מהות המדד
    handling: Mapped[str] = mapped_column(Text)  # טיפול במדד
    classification: Mapped[str] = mapped_column(String(16))  # 'processes' (תהליכים) | 'routine' (שגרה)
    professional_field_id: Mapped[Optional[str]] = mapped_column(ForeignKey("professional_fields.id"))
    ramad_tevel_id: Mapped[Optional[str]] = mapped_column(ForeignKey("ramad_tevel_indications.id"))
    penalty: Mapped[int] = mapped_column(Integer, default=0)  # קנס
    note: Mapped[Optional[str]] = mapped_column(Text)

    professional_field: Mapped[Optional[ProfessionalField]] = relationship()


class FrameworkScore(Base):
    """ציון per framework per date (typically written by a nightly job)."""

    __tablename__ = "framework_scores"

    framework_id: Mapped[str] = mapped_column(ForeignKey("frameworks.id"), primary_key=True)
    day: Mapped[date] = mapped_column("date", Date, primary_key=True)
    score: Mapped[float] = mapped_column(Float)
    parent_score: Mapped[Optional[float]] = mapped_column(Float)  # ציון אב


class Candidate(Base):
    """מלש"ב — the person a task is about."""

    __tablename__ = "candidates"

    personal_number: Mapped[str] = mapped_column(String(16), primary_key=True)  # מספר אישי
    id_number: Mapped[str] = mapped_column(String(16), index=True)  # ת"ז
    full_name: Mapped[str] = mapped_column(String(200), index=True)
    track: Mapped[Optional[str]] = mapped_column(String(100))  # מסלול עתודה / שוחרים
    corps: Mapped[Optional[str]] = mapped_column(String(100))  # חיל
    major: Mapped[Optional[str]] = mapped_column(String(100))  # מגמה
    position: Mapped[Optional[str]] = mapped_column(String(100))  # משרה לאיוש
    study_start: Mapped[Optional[date]] = mapped_column(Date)  # תאריך תחילת לימודים
    study_end: Mapped[Optional[date]] = mapped_column(Date)  # תאריך סיום לימודים


class Task(Base):
    """משימה. Open = started and not yet ended at the selected date."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    framework_id: Mapped[str] = mapped_column(ForeignKey("frameworks.id"), index=True)
    personal_number: Mapped[str] = mapped_column(ForeignKey("candidates.personal_number"), index=True)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    sla_days: Mapped[int] = mapped_column(Integer)
    pause_end_date: Mapped[Optional[date]] = mapped_column(Date)
    pause_reason: Mapped[Optional[str]] = mapped_column(String(200))
    is_parent: Mapped[bool] = mapped_column(Boolean, default=False)  # משימת אב

    candidate: Mapped[Candidate] = relationship()


class User(Base):
    __tablename__ = "users"

    employee_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(String(500))
    severity: Mapped[str] = mapped_column(String(16))  # 'info' | 'warning'
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.employee_id"))

    created_by: Mapped[User] = relationship()
