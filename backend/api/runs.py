"""분석 요청·폴링·SSE. 스트림도 Bearer 토큰으로 소유를 확인한다."""

import asyncio
import json
from typing import Literal
import uuid

from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import current_user, owned_store
from api.errors import ApiError, forbidden, invalid_input
from db.models import Run, Store, User
from db.session import get_db
from services.analysis import ACTIVE, create_run, normalize_scope, read_run

router = APIRouter()


class AnalyzeBody(BaseModel):
    scope: list[Literal["building", "law", "trademark", "checklist", "grants"]] | None = None


@router.post("/api/stores/{store_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
def analyze(request: Request, body: AnalyzeBody | None = None, store: Store = Depends(owned_store),
            db: Session = Depends(get_db)) -> dict:
    scope = normalize_scope(body.scope if body else None)
    run_id = create_run(db, store, request.app.state.analysis_manager, scope)
    return {"run_id": str(run_id), "status": "queued"}


def owned_run(run_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Run:
    try:
        key = uuid.UUID(run_id)
    except ValueError:
        raise ApiError(404, "RUN_NOT_FOUND", "분석 실행을 찾을 수 없습니다.") from None
    row = db.get(Run, key)
    if row is None:
        raise ApiError(404, "RUN_NOT_FOUND", "분석 실행을 찾을 수 없습니다.")
    store = db.get(Store, row.store_id)
    if store is None or store.user_id != user.id:
        raise forbidden()
    return row


@router.get("/api/runs/{run_id}")
def get_run(row: Run = Depends(owned_run), db: Session = Depends(get_db)) -> dict:
    key = row.id
    db.close()
    return read_run(key)


@router.get("/api/runs/{run_id}/stream")
def stream(request: Request, row: Run = Depends(owned_run), db: Session = Depends(get_db),
           last_event_id: int | None = Header(default=None, alias="Last-Event-ID")):
    if last_event_id is not None and last_event_id < 0:
        raise invalid_input("Last-Event-ID는 0 이상이어야 합니다.")
    key = row.id
    db.close()  # SSE 연결 동안 요청 인증용 DB 연결을 점유하지 않는다.

    async def events():
        cursor = last_event_id or 0
        loop = asyncio.get_running_loop()
        heartbeat = loop.time()
        while not await request.is_disconnected():
            state = await asyncio.to_thread(read_run, key)
            for index, record in enumerate(state["events"][cursor:], start=cursor + 1):
                event, data = record["event"], record["data"]
                if event == "done":
                    data = {**data, "run_id": str(key)}
                yield f"id: {index}\nevent: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                cursor = index
                if state["trigger"] == "demo":
                    await asyncio.sleep(0.05)
            if state["status"] not in ACTIVE:
                return
            if loop.time() - heartbeat >= 5:
                yield ": keep-alive\n\n"
                heartbeat = loop.time()
            await asyncio.sleep(0.25)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
