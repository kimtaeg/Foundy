"""FastAPI 앱. 실행: uvicorn main:app --reload"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import alerts, checklist, demo, errors, health, me, runs, stores
from config import get_settings
from db.session import transaction
from services.analysis import AnalysisManager, expire_stale

logger = logging.getLogger(__name__)

# Vercel 미리보기 배포 주소
VERCEL_PREVIEW_REGEX = r"https://.*\.vercel\.app"


def cleanup_stale_runs() -> int:
    """서버 재시작으로 남은 실행을 실패 처리한다 (명세서 2-3)."""
    with transaction() as session:
        return expire_stale(session)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        cleaned = cleanup_stale_runs()
        if cleaned:
            logger.info("중단된 runs %d건을 failed로 정리했습니다", cleaned)
    except Exception as exc:  # DB가 안 돼도 서버는 뜬다 (/api/health 가 db:error 로 알린다)
        logger.warning("시작 정리 작업 실패 (%s)", type(exc).__name__)
    app.state.analysis_manager = AnalysisManager()
    try:
        yield
    finally:
        app.state.analysis_manager.close()


app = FastAPI(title="Foundy API", version=health.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().frontend_origins,
    allow_origin_regex=VERCEL_PREVIEW_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

errors.install(app)

for router in (health.router, demo.router, me.router, stores.router, checklist.router, alerts.router, runs.router):
    app.include_router(router)
