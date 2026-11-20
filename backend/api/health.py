"""GET /api/health. DB가 안 돼도 200으로 응답한다 (Railway 헬스체크가 DB 문제로 배포를 막지 않게)."""

import logging

from fastapi import APIRouter
from sqlalchemy import text

from config import get_settings
from db.session import get_engine

router = APIRouter()
logger = logging.getLogger(__name__)

VERSION = "0.1.0"


def check_db() -> str:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok"
    except Exception as exc:  # 연결·설정 오류 모두 "error"로 응답한다
        logger.warning("health: DB 확인 실패 (%s)", type(exc).__name__)
        return "error"


@router.get("/api/health")
def health() -> dict:
    return {"status": "ok", "mock": get_settings().use_mock, "db": check_db(), "version": VERSION}
