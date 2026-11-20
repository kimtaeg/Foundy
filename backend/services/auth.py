"""로그인 토큰 (HS256 JWT, sub = user_id, 7일). 소셜 로그인은 아직 없고 예시 계정만 발급한다."""

import logging
import secrets
from datetime import timedelta
from functools import lru_cache

import jwt

from config import get_settings
from services.timeutil import now_utc

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)
logger = logging.getLogger(__name__)


@lru_cache
def _secret() -> str:
    secret = get_settings().jwt_secret
    if not secret:
        logger.warning("JWT_SECRET 이 없어 임시 키를 씁니다. 서버를 다시 시작하면 기존 토큰이 무효가 됩니다.")
        secret = secrets.token_urlsafe(48)
    return secret


def issue_token(user_id: str) -> str:
    now = now_utc()
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + TOKEN_TTL}, _secret(), algorithm=ALGORITHM)


def read_token(token: str) -> str | None:
    """유효하면 user_id, 아니면 None (만료·서명 오류·형식 오류 모두)."""
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM], options={"require": ["sub", "exp"]})
    except jwt.PyJWTError:
        return None
    return payload.get("sub")
