"""소셜 로그인·로그아웃 (API 명세서 1장 인증과 계정).

흐름: POST /api/auth/social/start {provider, browser_hash} → 프론트가 authorize_url 로 이동
     → 제공자가 redirect_uri 로 code·state 전달 → POST /api/auth/social {provider, code, state, browser_nonce}
     → 서버가 state 와 브라우저 결속을 대조하고 코드를 교환해 토큰 발급.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import AuthToken, current_token
from db.models import Store, User
from db.session import get_db
from services import oauth, serializers
from services.auth import issue_token, purge_expired, revoke

router = APIRouter(prefix="/api/auth")

Provider = Literal["kakao", "google", "naver"]
DEFAULT_NAME = "사용자"


# 브라우저 결속: 32바이트 무작위 값의 base64url(패딩 없음, 43자)과 그 SHA-256 hex(64자)
BROWSER_NONCE = r"^[A-Za-z0-9_-]{43}$"
BROWSER_HASH = r"^[0-9a-f]{64}$"


class StartBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Provider
    redirect_uri: str | None = None
    browser_hash: str = Field(pattern=BROWSER_HASH)


class SocialBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Provider
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)
    browser_nonce: str = Field(pattern=BROWSER_NONCE)


@router.post("/social/start")
def start(body: StartBody, db: Session = Depends(get_db)) -> dict:
    purge_expired(db)
    result = oauth.start_login(db, body.provider, body.redirect_uri, body.browser_hash)
    db.commit()
    return result


def _find_or_create_user(db: Session, profile: oauth.SocialProfile) -> User:
    query = select(User).where(User.provider == profile.provider, User.provider_user_id == profile.provider_user_id)
    user = db.scalar(query)
    if user is not None:
        return user  # 같은 소셜 계정 = 같은 사용자. 이름은 마이페이지에서 바꾼 값을 유지한다
    user = User(provider=profile.provider, provider_user_id=profile.provider_user_id, name=profile.name or DEFAULT_NAME)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # 같은 계정의 동시 첫 로그인
        db.rollback()
        user = db.scalar(query)
    return user


@router.post("/social")
def social_login(body: SocialBody, db: Session = Depends(get_db)) -> dict:
    redirect_uri = oauth.consume_state(db, body.provider, body.state, body.browser_nonce)
    profile = oauth.exchange_code(body.provider, body.code, body.state, redirect_uri)
    user = _find_or_create_user(db, profile)
    store_id = db.scalar(select(Store.id).where(Store.user_id == user.id))
    return {"access_token": issue_token(str(user.id)), "user": serializers.user(user),
            "store_id": str(store_id) if store_id else None}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: AuthToken = Depends(current_token), db: Session = Depends(get_db)) -> Response:
    """이 요청에 쓴 토큰만 폐기한다. 다른 기기의 토큰과 다시 로그인해 받은 새 토큰은 그대로 쓸 수 있다."""
    revoke(db, token.raw, token.claims, token.user.id)
    purge_expired(db)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
