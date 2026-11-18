"""내 가게 챗봇: 이 가게의 저장된 점검 결과 안에서만 답하고, 조건 변경은 제안만 한다.

- AI는 답과 인용할 항목 id를 고르고, 근거(Evidence)는 코드가 그 항목에서 가져온다.
- 사실을 묻는 질문인데 인용할 근거가 없으면 답을 버리고 '판단 불가'로 바꾼다.
- 동작 제안(actions)은 코드가 값과 id를 검증하고 requires_confirm을 붙인다. 반영은 사용자가 확인한 뒤 백엔드 API로 한다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from rules.engine import load_pack

from .llm import LLM, LLMError
from .ports import StoreInput
from .prompts import chat as prompt
from .schemas import ChatAction, ChatReply, ChecklistItem, Evidence, ReportItem

NOTE = "이 가게의 조회 결과 안에서만 답했습니다. 최종 판단은 관할 기관에 확인하세요."
OUT_OF_SCOPE = "이 가게의 점검 결과로는 알 수 없어요. 구청이나 세무서 같은 관할 기관에 확인해 보세요."
FAILED = "지금은 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
NAV_TARGETS = ("report", "checklist", "map", "grants")
MAX_HISTORY_TURNS = 10
MAX_TEXT = 1000
MAX_ACTIONS = 2


class LLMAction(BaseModel):
    """LLM이 쓰는 동작 제안. 자유 형식 dict를 쓸 수 없어서 평평한 필드로 받고 코드가 payload로 만든다."""

    type: Literal["update_store", "choose_option", "check_item", "navigate"]
    label: str
    opening_date: str | None = None
    name: str | None = None
    sells_alcohol: bool | None = None
    uses_terrace: bool | None = None
    has_employees: bool | None = None
    funds_krw: int | None = None
    item_id: str | None = None
    option_id: str | None = None
    done: bool | None = None
    target: str | None = None


class ChatLLMReply(BaseModel):
    kind: Literal["grounded", "change_request", "chitchat", "out_of_scope"]
    answer: str
    cited_ids: list[str] = Field(default_factory=list)
    actions: list[LLMAction] = Field(default_factory=list)


@dataclass
class ChatContext:
    """백엔드가 DB에서 읽어 넘기는 이 가게의 저장된 결과."""

    store: StoreInput
    report_items: list[ReportItem] = field(default_factory=list)
    checklist: list[ChecklistItem] = field(default_factory=list)
    today: date = field(default_factory=date.today)


def _clip(text: str) -> str:
    return text[:MAX_TEXT]


def _history(history: list[dict]) -> list[dict]:
    turns = [{"role": h.get("role"), "content": _clip(str(h.get("content", "")))}
             for h in history if h.get("role") in ("user", "assistant")]
    return turns[-MAX_HISTORY_TURNS:]


def _report_view(item: ReportItem) -> dict:
    return {
        "id": item.item_id, "check_id": item.check_id, "title": item.title, "verdict": item.verdict,
        "reason": item.reason, "consequence": item.consequence,
        "options": [{"id": o.option_id, "label": o.label, "summary": o.summary} for o in item.options],
        "chosen_option": item.chosen_option,
        "evidence": [{"source": e.source, "value": e.value, "law": e.law_name, "article": e.article}
                     for e in item.evidence],
    }


def _checklist_view(c: ChecklistItem) -> dict:
    return {"id": c.item_id, "task": c.task, "category": c.category, "due_date": str(c.due_date),
            "dday": c.dday, "done": c.done}


def _build_actions(ctx: ChatContext, pack: dict, raw: list[LLMAction]) -> list[ChatAction]:
    reports = {i.item_id: i for i in ctx.report_items}
    checks = {c.item_id for c in ctx.checklist}
    out: list[ChatAction] = []
    for a in raw:
        label = a.label.strip()
        if not label:
            continue
        if a.type == "update_store":
            payload: dict = {}
            if a.opening_date:
                try:
                    d = date.fromisoformat(a.opening_date)
                except ValueError:
                    continue
                if d < ctx.today:
                    continue
                payload["opening_date"] = d.isoformat()
            if a.name and a.name.strip():
                payload["name"] = a.name.strip()[:50]
            answers = {k: v for k in ("sells_alcohol", "uses_terrace", "has_employees")
                       if (v := getattr(a, k)) is not None}
            if a.funds_krw is not None and a.funds_krw >= 0:
                answers["funds_krw"] = a.funds_krw
            if answers:
                payload["answers"] = answers
            if not payload:
                continue
            out.append(ChatAction(type="update_store", label=label, payload=payload))
        elif a.type == "choose_option":
            item = reports.get(a.item_id or "")
            if item and a.option_id in {o.option_id for o in item.options}:
                out.append(ChatAction(type="choose_option", label=label,
                                      payload={"item_id": item.item_id, "option_id": a.option_id}))
        elif a.type == "check_item":
            if a.item_id in checks:
                out.append(ChatAction(type="check_item", label=label,
                                      payload={"item_id": a.item_id, "done": a.done is not False}))
        elif a.type == "navigate":
            if a.target in NAV_TARGETS:
                out.append(ChatAction(type="navigate", label=label, payload={"target": a.target},
                                      requires_confirm=False))
    return out[:MAX_ACTIONS]


def _evidence(ctx: ChatContext, cited: list[str]) -> list[Evidence]:
    by_report = {i.item_id: i for i in ctx.report_items}
    by_check = {c.item_id: c for c in ctx.checklist}
    seen: set[tuple] = set()
    out: list[Evidence] = []
    for cid in dict.fromkeys(cited):
        src = by_report.get(cid) or by_check.get(cid)
        for e in (src.evidence if src else []):
            key = (e.type, e.source, e.value, e.article)
            if key not in seen:
                seen.add(key)
                out.append(e)
    return out


def chat(
    llm: LLM, ctx: ChatContext, message: str, history: list[dict] | None = None,
    focus: dict | None = None, pack: dict | None = None,
) -> ChatReply:
    pack = pack or load_pack("cafe_restaurant")
    reports = {i.item_id: i for i in ctx.report_items}
    focus_id = (focus or {}).get("id")
    focus_view = None
    if focus_id and (focus or {}).get("type") == "report_item" and focus_id in reports:
        focus_view = {"type": "report_item", "id": focus_id}
    elif focus_id and (focus or {}).get("type") == "checklist_item" and focus_id in {c.item_id for c in ctx.checklist}:
        focus_view = {"type": "checklist_item", "id": focus_id}

    store = ctx.store
    try:
        r = llm.parse(
            step="chat", tier="main", system=prompt.SYSTEM,
            user=prompt.USER.format(
                today=ctx.today.isoformat(),
                store=json.dumps({"name": store.name, "address": store.address, "opening_date": str(store.opening_date),
                                  "answers": store.answers}, ensure_ascii=False),
                report=json.dumps([_report_view(i) for i in ctx.report_items], ensure_ascii=False),
                checklist=json.dumps([_checklist_view(c) for c in ctx.checklist], ensure_ascii=False),
                focus=json.dumps(focus_view, ensure_ascii=False),
                history=json.dumps(_history(history or []), ensure_ascii=False),
                message=json.dumps(_clip(message), ensure_ascii=False),
            ),
            schema=ChatLLMReply,
        )
    except LLMError:
        return ChatReply(answer=FAILED, note=NOTE)

    evidence = _evidence(ctx, r.cited_ids)
    if r.kind == "out_of_scope" or (r.kind == "grounded" and not evidence):
        # 근거를 댈 수 없는 사실 답변은 내보내지 않는다
        return ChatReply(answer=OUT_OF_SCOPE, note=NOTE)

    actions = _build_actions(ctx, pack, r.actions) if r.kind == "change_request" else []
    if r.kind == "change_request" and not actions:
        return ChatReply(answer="어떻게 바꿀지 정확히 알려주세요. 예: \"개업일을 4월 1일로 바꿔줘\"", note=NOTE)
    return ChatReply(answer=r.answer.strip(), evidence=evidence if r.kind == "grounded" else [],
                     actions=actions, note=NOTE)
