"""로그인 토큰 (HS256 JWT, sub = user_id, 7일)과 로그아웃 폐기 (API 명세서 1장).

- 새 토큰에는 jti(토큰 고유 id)를 넣는다. 로그아웃하면 그 토큰만 revoked_tokens 에 남겨 이후 요청을 401로 막는다.
- jti 가 없는 옛 토큰(이 변경 전에 발급한 예시 계정 토큰 등)은 만료될 때까지 그대로 쓸 수 있고,
  로그아웃하면 토큰 문자열의 sha256 으로 폐기한다.
- 폐기 기록은 토큰 만료 시각이 지나면 purge_expired 로 지운다 (어차피 만료돼 401이다).
"""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from config import get_settings
from db.models import OAuthState, RevokedToken
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
    return jwt.encode({"sub": user_id, "jti": str(uuid.uuid4()), "iat": now, "exp": now + TOKEN_TTL},
                      _secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    """서명·만료가 유효하면 클레임, 아니면 None. 폐기 여부는 DB에서 별도로 확인한다."""
    try:
        return jwt.decode(token, _secret(), algorithms=[ALGORITHM], options={"require": ["sub", "exp"]})
    except jwt.PyJWTError:
        return None


def read_token(token: str) -> str | None:
    """유효하면 user_id, 아니면 None (만료·서명 오류·형식 오류 모두). 폐기 여부는 보지 않는다."""
    claims = decode_token(token)
    return claims.get("sub") if claims else None


def token_key(token: str, claims: dict) -> str:
    jti = claims.get("jti")
    if jti:
        return f"jti:{jti}"
    return "sha256:" + hashlib.sha256(token.encode()).hexdigest()


def revoked_token_exists(token: str, claims: dict):
    return select(RevokedToken.token_key).where(RevokedToken.token_key == token_key(token, claims)).exists()


def revoke(session: Session, token: str, claims: dict, user_id: uuid.UUID) -> None:
    """이 토큰만 폐기한다. 같은 토큰을 다시 폐기해도 오류가 아니다."""
    expires_at = datetime.fromtimestamp(claims["exp"], tz=timezone.utc)
    session.execute(insert(RevokedToken).values(token_key=token_key(token, claims), user_id=user_id,
                                                expires_at=expires_at).on_conflict_do_nothing())


def purge_expired(session: Session) -> int:
    """만료된 폐기 기록과 소셜 로그인 state 를 지운다. 지운 행 수."""
    now = now_utc()
    tokens = session.execute(delete(RevokedToken).where(RevokedToken.expires_at < now)).rowcount or 0
    states = session.execute(delete(OAuthState).where(OAuthState.expires_at < now)).rowcount or 0
    return tokens + states
