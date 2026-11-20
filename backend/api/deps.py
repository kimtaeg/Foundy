"""인증·소유 확인 의존성. 모든 /api/stores/{store_id}/* 는 owned_store 를 거친다."""

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from api.errors import forbidden, store_not_found, unauthorized
from db.models import Store, User
from db.session import get_db
from services.auth import decode_token, is_revoked

bearer = HTTPBearer(auto_error=False)


def _uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None


class AuthToken:
    """요청에 쓴 토큰 원문과 클레임 (로그아웃이 이 토큰만 폐기할 때 쓴다)."""

    def __init__(self, raw: str, claims: dict, user: User):
        self.raw, self.claims, self.user = raw, claims, user


def current_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                  db: Session = Depends(get_db)) -> AuthToken:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    raw = credentials.credentials.strip()
    claims = decode_token(raw)
    user_id = _uuid((claims or {}).get("sub") or "")
    user = db.get(User, user_id) if user_id else None
    if user is None or is_revoked(db, raw, claims):  # 로그아웃한 토큰은 401
        raise unauthorized()
    return AuthToken(raw, claims, user)


def current_user(token: AuthToken = Depends(current_token)) -> User:
    return token.user


def owned_store(store_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Store:
    sid = _uuid(store_id)
    store = db.get(Store, sid) if sid else None
    if store is None:
        raise store_not_found()
    if store.user_id != user.id:
        raise forbidden()
    return store
