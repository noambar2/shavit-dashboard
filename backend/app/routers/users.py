"""Current user, candidate search and announcements — sections 8–12 of API_CONTRACT.md."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import admin_user, current_user
from ..db import get_db
from ..models import Announcement, Candidate, User

router = APIRouter()


@router.get("/me", response_model=schemas.CurrentUser)
def me(user: User = Depends(current_user)):
    return schemas.CurrentUser(employee_id=user.employee_id, full_name=user.full_name, is_admin=user.is_admin)


@router.get("/candidates/search", response_model=List[schemas.CandidateSearchResult])
def search_candidates(q: str = "", db: Session = Depends(get_db)):
    q = q.strip()
    if not q:
        return []
    rows = db.scalars(
        select(Candidate)
        .where(or_(Candidate.full_name.contains(q), Candidate.personal_number.startswith(q), Candidate.id_number.startswith(q)))
        .order_by(Candidate.full_name)
        .limit(8)
    ).all()
    return [schemas.CandidateSearchResult(id=c.personal_number, full_name=c.full_name, id_number=c.id_number) for c in rows]


# --- announcements ------------------------------------------------------------
# Times are stored as naive UTC and returned with "Z", so browsers read them correctly.

def _utc_naive(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _out(a: Announcement) -> schemas.Announcement:
    return schemas.Announcement(
        id=a.id,
        title=a.title,
        message=a.message,
        severity=a.severity,
        created_at=a.created_at.replace(tzinfo=timezone.utc),
        expires_at=a.expires_at.replace(tzinfo=timezone.utc),
        created_by=schemas.AnnouncementAuthor(employee_id=a.created_by.employee_id, full_name=a.created_by.full_name),
    )


def _validate(body: schemas.AnnouncementInput) -> None:
    if _utc_naive(body.expires_at) <= datetime.utcnow():
        raise HTTPException(422, "expiresAt must be in the future")


@router.get("/announcements", response_model=List[schemas.Announcement])
def list_announcements(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.scalars(
        select(Announcement).where(Announcement.expires_at > datetime.utcnow()).order_by(Announcement.created_at.desc())
    ).all()
    return [_out(a) for a in rows]


@router.post("/announcements", response_model=schemas.Announcement, status_code=201)
def create_announcement(body: schemas.AnnouncementInput, db: Session = Depends(get_db), admin: User = Depends(admin_user)):
    _validate(body)
    a = Announcement(
        id=uuid.uuid4().hex,
        title=body.title or None,
        message=body.message.strip(),
        severity=body.severity,
        created_at=datetime.utcnow(),
        expires_at=_utc_naive(body.expires_at),
        created_by_id=admin.employee_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _out(a)


@router.put("/announcements/{announcement_id}", response_model=schemas.Announcement)
def update_announcement(
    announcement_id: str, body: schemas.AnnouncementInput, db: Session = Depends(get_db), _: User = Depends(admin_user)
):
    a = db.get(Announcement, announcement_id)
    if not a:
        raise HTTPException(404, "announcement not found")
    _validate(body)
    a.title = body.title or None
    a.message = body.message.strip()
    a.severity = body.severity
    a.expires_at = _utc_naive(body.expires_at)
    db.commit()
    return _out(a)


@router.delete("/announcements/{announcement_id}", status_code=204)
def delete_announcement(announcement_id: str, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    a = db.get(Announcement, announcement_id)
    if not a:
        raise HTTPException(404, "announcement not found")
    db.delete(a)
    db.commit()
    return Response(status_code=204)
