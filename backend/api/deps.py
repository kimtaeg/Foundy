"""인증·소유 확인 의존성. 모든 /api/stores/{store_id}/* 는 owned_store 를 거친다."""

import uuid
from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.errors import forbidden, store_not_found, unauthorized
from db.models import Store, User
from db.session import get_db
from services.auth import decode_token, revoked_token_exists

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


@dataclass(frozen=True)
class SignedToken:
    raw: str
    claims: dict
    user_id: uuid.UUID

    def user_filter(self):
        return (User.id == self.user_id) & ~revoked_token_exists(self.raw, self.claims)


def signed_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> SignedToken:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    raw = credentials.credentials.strip()
    claims = decode_token(raw)
    user_id = _uuid((claims or {}).get("sub") or "")
    if user_id is None:
        raise unauthorized()
    return SignedToken(raw, claims, user_id)


def current_token(token: SignedToken = Depends(signed_token), db: Session = Depends(get_db)) -> AuthToken:
    user = db.scalar(select(User).where(token.user_filter()))
    if user is None:  # 없는 사용자와 로그아웃한 토큰은 401
        raise unauthorized()
    return AuthToken(token.raw, token.claims, user)


def current_user(token: AuthToken = Depends(current_token)) -> User:
    return token.user


def owned_store(store_id: str, token: SignedToken = Depends(signed_token), db: Session = Depends(get_db)) -> Store:
    sid = _uuid(store_id)
    # 사용자·폐기 여부와 가게를 한 스냅샷에서 확인한다. 없는 가게의 404도 유지한다.
    row = db.execute(select(User.id, Store).select_from(User).outerjoin(Store, Store.id == sid)
                     .where(token.user_filter())).one_or_none()
    if row is None:
        raise unauthorized()
    user_id, store = row
    if store is None:
        raise store_not_found()
    if store.user_id != user_id:
        raise forbidden()
    return store
