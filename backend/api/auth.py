"""소셜 로그인·로그아웃 (API 명세서 1장 인증과 계정).

흐름: POST /api/auth/social/start {provider, browser_hash} → 프론트가 authorize_url 로 이동
     → 제공자가 redirect_uri 로 code·state 전달 → POST /api/auth/social {provider, code, state, browser_nonce}
     → 서버가 state 와 브라우저 결속을 대조하고 코드를 교환해 토큰 발급.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import AuthToken, current_token
from db.models import User
from db.session import get_db
from api.errors import ApiError
from services import oauth, password as pw, store_setup
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
    return _session(user, store_setup.read_identity(db, user))


class SignupBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str
    name: str


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str


def _session(user: User, identity: dict) -> dict:
    return {"access_token": issue_token(str(user.id)), **identity}


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupBody, request: Request, db: Session = Depends(get_db)) -> dict:
    """아이디·비밀번호로 가입하고 바로 로그인한다."""
    pw.check_signup(pw.client_ip(request))
    username = pw.validate_username(body.username)
    password = pw.validate_password(body.password)
    name = pw.validate_name(body.name)
    taken = ApiError(409, "USERNAME_TAKEN", "이미 사용 중인 아이디입니다.")
    if db.scalar(select(User.id).where(User.username == username)):
        raise taken
    user = User(provider="local", username=username, password_hash=pw.hash_password(password), name=name)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # 같은 아이디의 동시 가입
        db.rollback()
        raise taken from None
    return _session(user, store_setup.account_identity(user))


@router.post("/login")
def login(body: LoginBody, request: Request, db: Session = Depends(get_db)) -> dict:
    """아이디·비밀번호 로그인. 아이디가 없거나 비밀번호가 틀리면 같은 401 이다."""
    username = (body.username or "").strip().lower()
    ip = pw.client_ip(request)
    pw.check_login(ip, username)
    row = db.execute(store_setup.identity_query().where(User.username == username, User.provider == "local")).one_or_none()
    user = row[0] if row else None
    if not pw.verify_password(body.password or "", user.password_hash if user else None):
        pw.login_failed(ip, username)
        raise ApiError(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.")
    pw.login_succeeded(ip, username)
    return _session(user, store_setup.account_identity(*row))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: AuthToken = Depends(current_token), db: Session = Depends(get_db)) -> Response:
    """이 요청에 쓴 토큰만 폐기한다. 다른 기기의 토큰과 다시 로그인해 받은 새 토큰은 그대로 쓸 수 있다."""
    revoke(db, token.raw, token.claims, token.user.id)
    purge_expired(db)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
