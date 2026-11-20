"""인증·소유 확인 의존성. 모든 /api/stores/{store_id}/* 는 owned_store 를 거친다."""

import uuid

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from api.errors import forbidden, store_not_found, unauthorized
from db.models import Store, User
from db.session import get_db
from services.auth import read_token


def _uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise unauthorized()
    user_id = _uuid(read_token(authorization[7:].strip()) or "")
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise unauthorized()
    return user


def owned_store(store_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Store:
    sid = _uuid(store_id)
    store = db.get(Store, sid) if sid else None
    if store is None:
        raise store_not_found()
    if store.user_id != user.id:
        raise forbidden()
    return store
