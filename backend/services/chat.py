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

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import aggregate_order_by

from agent.assistant import ToolBox, history_messages, run_turn
from agent.cost import CostTracker
from agent.llm import make_llm
from db.models import ChatCitation, ChatMessage, ChatSession, ChatToolCall, CostLog, ReportItem, Run, Store
from db.session import transaction
from services import serializers
from services.cards import load_state
from services.pack import get_pack
from services.timeutil import iso_kst, now_utc, today_kst

logger = logging.getLogger(__name__)
FAILED = "지금은 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
SAVE_FAILED = "대화 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
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
    rows = session.execute(select(ChatMessage, ChatCitation).outerjoin(
        ChatCitation, (ChatCitation.message_id == ChatMessage.id) & (ChatMessage.role == "assistant"),
    ).where(ChatMessage.session_id == chat.id, ChatMessage.role.in_(("user", "assistant")))
        .order_by(ChatMessage.created_at, ChatMessage.id))
    shown: dict[ChatMessage, list[ChatCitation]] = {}
    for message, citation in rows:
        if message.role == "assistant" and message.tool_calls:
            continue
        citations = shown.setdefault(message, [])
        if citation is not None:
            citations.append(citation)
    return [message_view(message, citations) for message, citations in shown.items()]


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


def make_readers(store_id: uuid.UUID, profile: dict) -> dict[str, Any]:
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
        # 영업신고 의무 질문에 행정처분 조문만 검색되는 경우를 막는다.
        scope_article = {"law_name": "식품위생법 시행령", "label": "제25조"}
        pins = [scope_article] if "영업신고" in "".join(query.split()) else []
        hits = retriever.search(session, query=query, keywords=keywords, names=get_pack(store)["law_sources"],
                                embedder=make_embedder(), pins=pins, top_k=4 if pins else 5)
        articles = retriever.merge_by_article(hits)
        if pins:
            articles.sort(key=lambda article: (article["law_name"], article["article"]) !=
                          (scope_article["law_name"], scope_article["label"]))
        return articles

    def grants(session, store):
        from services import grants as grant_service

        return grant_service.view(session, store)

    # 질문을 시작할 때 읽은 사업장 정보를 이 질문 안에서만 재사용한다.
    return {"get_business_profile": lambda: profile, "get_checklist": with_store(checklist),
            "get_report": with_store(report), "get_documents": with_store(documents),
            "search_laws": with_store(laws), "search_support_programs": with_store(grants)}


# ---------- 질문 처리 ----------

def _turn_context(chat_id: uuid.UUID) -> tuple[uuid.UUID, list, dict]:
    with transaction() as session:
        # 최근 대화를 한 행에 담아 사업장 정보와 함께 읽는다.
        recent = (select(ChatMessage.role, ChatMessage.content, ChatMessage.created_at, ChatMessage.id)
            .where(ChatMessage.session_id == chat_id, ChatMessage.tool_calls.is_(None), ChatMessage.role != "tool")
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(24).subquery())
        past_query = select(func.jsonb_agg(aggregate_order_by(
            func.jsonb_build_array(recent.c.role, recent.c.content), recent.c.created_at, recent.c.id,
        ))).scalar_subquery()
        store, history = session.execute(select(Store, past_query).select_from(ChatSession)
            .join(Store, Store.id == ChatSession.store_id).where(ChatSession.id == chat_id)).one()
        return store.id, history or [], _profile(session, store)


def ask(chat_id: uuid.UUID, question: str, llm=None, readers: dict | None = None) -> Iterator[tuple[str, dict]]:
    """질문을 처리하며 이벤트를 낸다: tool · delta · reset · done · error.

    글자는 즉시 보내고, 최종 이벤트는 대화 기록 저장 결과를 확인한 뒤 보낸다.
    연결이 끊겨도(GeneratorExit) 그때까지 수집한 기록을 저장한다.
    """
    asked_at = now_utc()
    try:
        store_id, past, profile = _turn_context(chat_id)
    except Exception as exc:
        logger.warning("상담 정보 조회 실패 (%s)", type(exc).__name__)
        yield "error", {"message": FAILED}
        return

    cost = CostTracker()
    pending: list[Any] = [ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="user", content=question, created_at=asked_at)]

    def stamp() -> datetime:
        # 같은 질문 안의 메시지 순서를 created_at 으로 지킨다 (저장은 나중에 한꺼번에 한다)
        return max(now_utc(), asked_at) + timedelta(microseconds=len(pending))

    try:
        llm = llm or make_llm(cost)
        box = ToolBox(readers or make_readers(store_id, profile))
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
                terminal = "done", message_view(msg, cites)
                pending.append(msg)
                pending.extend(cites)
                break
        else:
            terminal = _failure(chat_id, pending, stamp(), FAILED)
    except Exception as exc:
        logger.warning("상담 답변 실패 (%s)", type(exc).__name__)
        terminal = _failure(chat_id, pending, stamp(), FAILED)
    finally:
        saved = _persist(chat_id, store_id, question, pending, cost)

    if saved:
        yield terminal
    else:
        yield "error", {"message": SAVE_FAILED}


def _failure(chat_id, pending: list, at: datetime, message: str) -> tuple[str, dict]:
    msg = ChatMessage(id=uuid.uuid4(), session_id=chat_id, role="assistant", content=message, actions=[], created_at=at)
    pending.append(msg)
    return "error", {"message": message, "reply": message_view(msg, [])}


def _persist(chat_id, store_id, question: str, pending: list, cost: CostTracker) -> bool:
    """이번 질문에서 생긴 기록을 한 트랜잭션으로 저장한다 (부모 행이 먼저 들어가도록 순서대로)."""
    try:
        with transaction() as session:
            changed = session.execute(update(ChatSession).where(ChatSession.id == chat_id).values(
                title=func.coalesce(func.nullif(ChatSession.title, ""), question[:TITLE_CHARS]),
                updated_at=now_utc(),
            )).rowcount
            if not changed:  # 그사이 상담방이 지워졌다
                return False
            messages = [p for p in pending if isinstance(p, ChatMessage)]
            session.add_all(messages)
            session.flush()
            session.add_all([p for p in pending if not isinstance(p, ChatMessage)])
            _save_cost(session, store_id, cost)
    except Exception as exc:
        logger.warning("상담 기록 저장 실패 (%s)", type(exc).__name__)
        return False
    return True


def _save_cost(session, store_id, cost: CostTracker) -> None:
    for c in cost.rows:
        session.add(CostLog(run_id=None, store_id=store_id, step=c.step, model=c.model,
                            input_tokens=c.input_tokens, output_tokens=c.output_tokens, cost_krw=c.cost_krw))


def _short(result: Any, limit: int = 4000) -> str:
    import json

    text = json.dumps(result, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[:limit] + "…"
