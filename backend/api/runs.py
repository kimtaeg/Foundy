"""분석 요청·폴링·SSE. 스트림도 Bearer 토큰으로 소유를 확인한다."""

import asyncio
import json
from typing import Literal
import uuid

from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import SignedToken, owned_store, signed_token
from api.errors import ApiError, forbidden, invalid_input, unauthorized
from db.models import Run, Store, User
from db.session import get_db
from services.analysis import ACTIVE, create_run, normalize_scope, read_run, read_run_state

router = APIRouter()


class AnalyzeBody(BaseModel):
    scope: list[Literal["building", "law", "trademark", "checklist", "grants"]] | None = None


@router.post("/api/stores/{store_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
def analyze(request: Request, body: AnalyzeBody | None = None, store: Store = Depends(owned_store),
            db: Session = Depends(get_db)) -> dict:
    scope = normalize_scope(body.scope if body else None)
    run_id = create_run(db, store, request.app.state.analysis_manager, scope)
    return {"run_id": str(run_id), "status": "queued"}


def owned_run(run_id: str, token: SignedToken = Depends(signed_token), db: Session = Depends(get_db)) -> Run:
    try:
        key = uuid.UUID(run_id)
    except ValueError:
        key = None
    result = db.execute(select(User.id, Run, Store.user_id).select_from(User).outerjoin(Run, Run.id == key)
                        .outerjoin(Store, Store.id == Run.store_id).where(token.user_filter())).one_or_none()
    if result is None:
        raise unauthorized()
    user_id, row, owner_id = result
    if row is None:
        raise ApiError(404, "RUN_NOT_FOUND", "분석 실행을 찾을 수 없습니다.")
    if owner_id != user_id:
        raise forbidden()
    return row


@router.get("/api/runs/{run_id}")
def get_run(row: Run = Depends(owned_run), db: Session = Depends(get_db)) -> dict:
    state = read_run_state(db, row)
    if db.dirty:
        db.commit()
    return state


@router.get("/api/runs/{run_id}/stream")
def stream(request: Request, row: Run = Depends(owned_run), db: Session = Depends(get_db),
           last_event_id: int | None = Header(default=None, alias="Last-Event-ID")):
    if last_event_id is not None and last_event_id < 0:
        raise invalid_input("Last-Event-ID는 0 이상이어야 합니다.")
    key = row.id
    initial = get_run(row, db)
    db.close()  # SSE 연결 동안 요청 인증용 DB 연결을 점유하지 않는다.

    async def events():
        cursor = last_event_id or 0
        loop = asyncio.get_running_loop()
        heartbeat = loop.time()
        state = initial
        while not await request.is_disconnected():
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
            if await request.is_disconnected():
                return
            state = await asyncio.to_thread(read_run, key)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
