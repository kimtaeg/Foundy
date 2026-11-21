"""AI 상담 API: 상담방 만들기·목록·삭제, 대화 기록, 메시지 보내기(SSE 스트리밍)."""

import json
import uuid

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import current_user, owned_store
from api.errors import ApiError
from db.models import ChatSession, Store, User
from db.session import get_db
from services import chat as service

router = APIRouter(prefix="/api/chat/sessions")


def _not_found() -> ApiError:
    return ApiError(404, "CHAT_SESSION_NOT_FOUND", "상담방을 찾을 수 없습니다.")


def owned_session(session_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ChatSession:
    """내 상담방만 쓴다. 다른 사람의 상담방은 있는지도 알리지 않는다 (404)."""
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise _not_found() from None
    row = db.get(ChatSession, sid)
    if row is None or row.user_id != user.id:
        raise _not_found()
    return row


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    store_id: str
    title: str | None = Field(default=None, max_length=60)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_session(body: CreateBody, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    store = owned_store(body.store_id, user, db)
    row = ChatSession(user_id=user.id, store_id=store.id, title=body.title)
    db.add(row)
    db.flush()
    db.refresh(row)
    view = service.session_view(row)
    db.commit()
    return view


@router.get("")
def list_sessions(store_id: str = Query(), user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    store: Store = owned_store(store_id, user, db)
    rows = db.scalars(select(ChatSession).where(ChatSession.store_id == store.id, ChatSession.user_id == user.id)
                      .order_by(ChatSession.updated_at.desc()))
    return {"items": [service.session_view(r) for r in rows]}


@router.get("/{session_id}/messages")
def list_messages(chat: ChatSession = Depends(owned_session), db: Session = Depends(get_db)) -> dict:
    return {"session": service.session_view(chat), "items": service.list_messages(db, chat)}


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(chat: ChatSession = Depends(owned_session), db: Session = Depends(get_db)) -> None:
    db.delete(chat)
    db.commit()


class MessageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=1000)


@router.post("/{session_id}/messages")
def send_message(body: MessageBody, chat: ChatSession = Depends(owned_session)) -> StreamingResponse:
    """질문을 보내고 답을 SSE로 받는다.

    event: tool  data: {"name","label","status"}  — 도구를 실행했다 (예: 법령 검색)
    event: delta data: {"text"}                   — 답변 글자
    event: reset data: {}                         — 지금까지 받은 글자를 지운다 (AI가 도구를 더 부르기로 함)
    event: done  data: 답변 메시지 (content·citations·actions)
    event: error data: {"message","reply"}
    """
    chat_id, question = chat.id, body.content.strip()

    def events():
        for event, data in service.ask(chat_id, question):
            yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
