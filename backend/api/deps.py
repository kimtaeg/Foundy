"""인증·소유 확인 의존성. 모든 /api/stores/{store_id}/* 는 owned_store 를 거친다."""

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from api.errors import forbidden, store_not_found, unauthorized
from db.models import Store, User
from db.session import get_db
from services.auth import read_token

bearer = HTTPBearer(auto_error=False)


def _uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    user_id = _uuid(read_token(credentials.credentials.strip()) or "")
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
