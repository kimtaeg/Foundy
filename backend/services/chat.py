"""AI 상담: 상담방·메시지 저장, 이 가게 데이터를 읽는 도구 묶기, 질문 하나를 처리해 이벤트로 흘려보내기.

- 도구가 읽는 데이터는 상담방의 가게 것만이다 (상담방 소유 확인은 API가 한다).
- 스트리밍 중에는 짧은 트랜잭션을 그때그때 연다 (응답을 보내는 동안 요청 세션은 이미 닫혀 있다).
- 사업장 정보는 매 질문마다 DB에서 새로 읽고, 대화 기록에는 사용자 질문과 AI 최종 답변만 다시 넘긴다.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Iterator

from sqlalchemy import select

from agent.assistant import ToolBox, history_messages, run_turn
from agent.cost import CostTracker
from agent.llm import LLMError, make_llm
from db.models import ChatCitation, ChatMessage, ChatSession, ChatToolCall, CostLog, ReportItem, Run, Store
from db.session import transaction
from services import serializers
from services.cards import load_state
from services.pack import get_pack
from services.timeutil import iso_kst, now_utc, today_kst

logger = logging.getLogger(__name__)
FAILED = "지금은 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
TITLE_CHARS = 30


def session_view(row: ChatSession) -> dict:
    return {"session_id": str(row.id), "store_id": str(row.store_id), "title": row.title,
            "created_at": iso_kst(row.created_at), "updated_at": iso_kst(row.updated_at)}


def message_view(row: ChatMessage, citations: list[ChatCitation]) -> dict:
    return {"message_id": str(row.id), "role": row.role, "content": row.content, "actions": row.actions or [],
            "citations": [{"source_type": c.source_type, "source_id": c.source_id, "title": c.source_title,
                           "url": c.source_url, "article": c.article_number} for c in citations],
            "created_at": iso_kst(row.created_at)}


def list_messages(session, chat: ChatSession) -> list[dict]:
    """화면에 보여 줄 대화 (사용자 질문과 AI 최종 답변). 도구 요청·결과 메시지는 빼고 출처를 붙인다."""
    rows = list(session.scalars(select(ChatMessage).where(ChatMessage.session_id == chat.id)
                                .order_by(ChatMessage.created_at)))
    shown = [r for r in rows if r.role == "user" or (r.role == "assistant" and not r.tool_calls)]
    ids = [r.id for r in shown if r.role == "assistant"]
    cites: dict[uuid.UUID, list[ChatCitation]] = {}
    if ids:
        for c in session.scalars(select(ChatCitation).where(ChatCitation.message_id.in_(ids))):
            cites.setdefault(c.message_id, []).append(c)
    return [message_view(r, cites.get(r.id, [])) for r in shown]


# ---------- 도구가 읽는 데이터 (이 가게만) ----------

def _profile(session, store: Store) -> dict:
    # 유효 값(선택 효과 반영)에는 점검 카드만 필요하다. 체크리스트까지 읽지 않는다 (질문마다 읽으므로 가볍게)
    cards = list(session.scalars(select(ReportItem).where(ReportItem.store_id == store.id).order_by(ReportItem.item_key)))
    data = serializers.store(get_pack(store), store, cards)
    eff = data["effective"]
    return {"name": eff["name"], "business_type": eff["business_type"], "business_type_input": data["business_type_input"],
            "address": data["address"], "address_detail": data["address_detail"], "opening_date": data["opening_date"],
            "area_sqm": float(store.area_sqm) if store.area_sqm is not None else None,
            "answers": eff["answers"], "owner_birth_year": data["owner_birth_year"]}


def make_readers(store_id: uuid.UUID) -> dict[str, Any]:
    def with_store(fn):
        def call(*args):
            with transaction() as session:
                store = session.get(Store, store_id)
                return fn(session, store, *args)
        return call

    def checklist(session, store):
        cards, items = load_state(session, store)
        return serializers.checklist(get_pack(store), store, cards, items, "timeline")

    def report(session, store):
        cards, items = load_state(session, store)
        run = session.scalars(select(Run).where(Run.store_id == store.id, Run.status == "done")
                              .order_by(Run.finished_at.desc()).limit(1)).first()
        return serializers.report(get_pack(store), store, cards, items, run, None)

    def documents(session, store):
        from services import documents as docs

        rows = docs.read_requirements(session, store)
        if not rows:
            return {"requirements": [], "summary": None}
        _, items = load_state(session, store)
        return docs.documents_response(session, get_pack(store), store, rows, items, today_kst(), "")

    def laws(session, store, query: str):
        from law_rag import retriever
        from law_rag.embedder import make_embedder

        keywords = [w for w in query.split() if len(w) >= 2][:6]
        hits = retriever.search(session, query=query, keywords=keywords, names=get_pack(store)["law_sources"],
                                embedder=make_embedder(), top_k=5)
        return retriever.merge_by_article(hits)

    def grants(session, store):
        from services import grants as grant_service

        return grant_service.view(session, store)

    return {"get_business_profile": with_store(_profile), "get_checklist": with_store(checklist),
            "get_report": with_store(report), "get_documents": with_store(documents),
            "search_laws": with_store(laws), "search_support_programs": with_store(grants)}


# ---------- 질문 처리 ----------

def ask(chat_id: uuid.UUID, question: str, llm=None, readers: dict | None = None) -> Iterator[tuple[str, dict]]:
    """질문을 처리하며 이벤트를 낸다: tool · delta · reset · done · error.

    응답 속도를 위해 DB 저장은 질문이 끝날 때 한 트랜잭션으로 한다 (질문·도구 요청·도구 결과·최종 답·출처·비용).
    최종 답은 저장 전에 먼저 보내고, 연결이 끊겨도(GeneratorExit) 저장은 한다.
    """
    asked_at = now_utc()
    with transaction() as session:  # 시작 전 읽기는 한 번에
        chat, store = session.execute(
            select(ChatSession, Store).join(Store, Store.id == ChatSession.store_id).where(ChatSession.id == chat_id)).one()
        store_id = chat.store_id
        # 이전 대화는 최근 것만 읽는다 (AI에는 최근 12개만 넘긴다)
        past = [(role, content) for role, content in reversed(session.execute(
            select(ChatMessage.role, ChatMessage.content)
            .where(ChatMessage.session_id == chat_id, ChatMessage.tool_calls.is_(None), ChatMessage.role != "tool")
            .order_by(ChatMessage.created_at.desc()).limit(24)).all())]
        profile = _profile(session, store)

    cost = CostTracker()
    pending: list[Any] = [ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="user", content=question, created_at=asked_at)]

    def stamp() -> datetime:
        # 같은 질문 안의 메시지 순서를 created_at 으로 지킨다 (저장은 나중에 한꺼번에 한다)
        return max(now_utc(), asked_at) + timedelta(microseconds=len(pending))

    try:
        try:
            llm = llm or make_llm(cost)
        except LLMError as exc:
            yield _failure(chat_id, pending, stamp(), str(exc))
            return
        box = ToolBox(readers or make_readers(store_id))
        try:
            for kind, value in run_turn(llm, profile=profile, history=history_messages(past), question=question,
                                        box=box, today=today_kst()):
                if kind == "assistant_tools":
                    pending.append(ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="assistant",
                                               content=value["content"] or "", tool_calls=value["tool_calls"],
                                               created_at=stamp()))
                elif kind == "tool":
                    msg = ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="tool", content=_short(value["result"]),
                                      tool_call_id=value["call_id"], created_at=stamp())
                    pending.append(msg)
                    pending.append(ChatToolCall(session_id=chat_id, message_id=msg.id, tool_name=value["name"],
                                                arguments=value["arguments"], result=value["result"],
                                                status=value["status"], created_at=msg.created_at))
                    yield "tool", {"name": value["name"], "label": value["label"], "status": value["status"]}
                elif kind == "delta":
                    yield "delta", {"text": value}
                elif kind == "reset":
                    yield "reset", {}
                elif kind == "done":
                    msg = ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="assistant",
                                      content=value["content"] or FAILED, actions=value["actions"], created_at=stamp())
                    cites = [ChatCitation(id=uuid.uuid4(), message_id=msg.id, **{k: c[k] for k in (
                        "source_type", "source_id", "source_title", "source_url", "article_number")})
                        for c in value["citations"]]
                    pending.append(msg)
                    pending.extend(cites)
                    yield "done", message_view(msg, cites)
                    return
        except LLMError as exc:
            logger.warning("상담 답변 실패: %s", exc)
            yield _failure(chat_id, pending, stamp(), FAILED)
    finally:
        _persist(chat_id, store_id, question, pending, cost)


def _failure(chat_id, pending: list, at: datetime, message: str) -> tuple[str, dict]:
    msg = ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="assistant", content=message, actions=[], created_at=at)
    pending.append(msg)
    return "error", {"message": message, "reply": message_view(msg, [])}


def _persist(chat_id, store_id, question: str, pending: list, cost: CostTracker) -> None:
    """이번 질문에서 생긴 기록을 한 트랜잭션으로 저장한다 (부모 행이 먼저 들어가도록 순서대로)."""
    try:
        with transaction() as session:
            chat = session.get(ChatSession, chat_id)
            if chat is None:  # 그사이 상담방이 지워졌다
                return
            if not chat.title:
                chat.title = question[:TITLE_CHARS]
            chat.updated_at = now_utc()
            messages = [p for p in pending if isinstance(p, ChatMessage)]
            session.add_all(messages)
            session.flush()
            session.add_all([p for p in pending if not isinstance(p, ChatMessage)])
            _save_cost(session, store_id, cost)
    except Exception:  # noqa: BLE001 - 저장 실패는 답변 표시를 막지 않는다 (다음에 다시 열면 이 대화가 빠진다)
        logger.exception("상담 기록 저장 실패")


def _save_cost(session, store_id, cost: CostTracker) -> None:
    for c in cost.rows:
        session.add(CostLog(run_id=None, store_id=store_id, step=c.step, model=c.model,
                            input_tokens=c.input_tokens, output_tokens=c.output_tokens, cost_krw=c.cost_krw))


def _short(result: Any, limit: int = 4000) -> str:
    import json

    text = json.dumps(result, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[:limit] + "…"
