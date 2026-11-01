"""
Who is calling. Replace `current_user` with your real login (SSO / session cookie / token) —
everything else only depends on getting a `User` back.
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import DEMO_EMPLOYEE_ID
from .db import get_db
from .models import User


def current_user(
    x_employee_id: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    # DEMO ONLY: the employee id comes from a header (or DEMO_EMPLOYEE_ID). Never trust a
    # client-sent id in production — take it from the authenticated session instead.
    employee_id = x_employee_id or DEMO_EMPLOYEE_ID
    user = db.get(User, employee_id)
    if not user:
        raise HTTPException(401, "unknown user")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    """Admins are decided by the `is_admin` column of the users table (keyed by employee id)."""
    if not user.is_admin:
        raise HTTPException(403, "admins only")
    return user
