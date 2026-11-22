"""AI 상담 API: 상담방 만들기·목록·삭제, 대화 기록, 메시지 보내기(SSE 스트리밍)."""

import json
import uuid

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import SignedToken, owned_store, signed_token
from api.errors import ApiError, unauthorized
from db.models import ChatSession, Store, User
from db.session import get_db
from services import chat as service

router = APIRouter(prefix="/api/chat/sessions")


def _not_found() -> ApiError:
    return ApiError(404, "CHAT_SESSION_NOT_FOUND", "상담방을 찾을 수 없습니다.")


def owned_session(session_id: str, token: SignedToken = Depends(signed_token), db: Session = Depends(get_db)) -> ChatSession:
    """내 상담방만 쓴다. 다른 사람의 상담방은 있는지도 알리지 않는다 (404)."""
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        sid = None
    result = db.execute(select(User.id, ChatSession).select_from(User).outerjoin(
        ChatSession, (ChatSession.id == sid) & (ChatSession.user_id == User.id),
    ).where(token.user_filter())).one_or_none()
    if result is None:
        raise unauthorized()
    _, row = result
    if row is None:
        raise _not_found()
    return row


class CreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    store_id: str
    title: str | None = Field(default=None, max_length=60)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_session(body: CreateBody, token: SignedToken = Depends(signed_token), db: Session = Depends(get_db)) -> dict:
    store = owned_store(body.store_id, token, db)
    row = ChatSession(user_id=token.user_id, store_id=store.id, title=body.title)
    db.add(row)
    db.flush()
    view = service.session_view(row)
    db.commit()
    return view


@router.get("")
def list_sessions(include_messages: bool = Query(default=False), store: Store = Depends(owned_store),
                  db: Session = Depends(get_db)) -> dict:
    query = (select(ChatSession).where(ChatSession.store_id == store.id, ChatSession.user_id == store.user_id)
             .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc()))
    if include_messages:
        chat = db.scalar(query.limit(1))
        return {"items": [service.session_view(chat)] if chat else [],
                "messages": service.list_messages(db, chat) if chat else []}
    return {"items": [service.session_view(row) for row in db.scalars(query)]}


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
def send_message(body: MessageBody, chat: ChatSession = Depends(owned_session),
                 db: Session = Depends(get_db)) -> StreamingResponse:
    """질문을 보내고 답을 SSE로 받는다.

    event: tool  data: {"name","label","status"}  — 도구를 실행했다 (예: 법령 검색)
    event: delta data: {"text"}                   — 답변 글자
    event: reset data: {}                         — 지금까지 받은 글자를 지운다 (AI가 도구를 더 부르기로 함)
    event: done  data: 저장된 답변 메시지 (content·citations·actions)
    event: error data: {"message", "reply"?}      — reply는 오류 안내가 대화에 저장된 경우에만 포함
    """
    chat_id, question = chat.id, body.content.strip()
    db.close()

    def events():
        for event, data in service.ask(chat_id, question):
            yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
