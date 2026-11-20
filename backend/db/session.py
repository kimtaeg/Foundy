"""DB 엔진·세션. 명세서 4장의 서버 처리는 각각 transaction() 하나로 묶는다."""

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import get_settings, sqlalchemy_url


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL 이 설정되지 않았습니다 (backend/.env 또는 Railway 서비스 변수)")
    # Railway 무료 플랜 메모리 절약: 작은 풀
    return create_engine(
        sqlalchemy_url(url),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
    )


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI 의존성: 요청마다 세션을 열고 닫는다. 변경 API는 마지막에 commit 한 번 (요청 = 트랜잭션 하나)."""
    session = _session_factory()()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def transaction(session: Session | None = None) -> Iterator[Session]:
    """한 처리 단위를 한 트랜잭션으로 묶는다. 예외가 나면 전부 롤백한다."""
    own = session is None
    s = session or _session_factory()()
    try:
        with s.begin():
            yield s
    finally:
        if own:
            s.close()
