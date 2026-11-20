"""내 가게 챗봇: 이 가게의 저장된 점검 결과 안에서만 답하고, 조건 변경은 제안만 한다.

- 통화 준비·오늘 뭐부터·서류 질문은 규칙 묶음과 코드(next_steps)로 답한다. AI를 부르지 않고, 전화번호·링크·질문 목록은
  AI가 만들지 않는다.
- AI는 답과 인용할 항목 id를 고르고, 근거(Evidence)는 코드가 그 항목에서 가져온다.
- 사실을 묻는 질문인데 인용할 근거가 없으면 답을 버리고 '판단 불가'로 바꾼다.
- 동작 제안(actions)은 코드가 값과 id를 검증하고 requires_confirm을 붙인다. 반영은 사용자가 확인한 뒤 백엔드 API로 한다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
import re
from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field

from calc.next_steps import next_steps
from rules.engine import call_questions, contact_of, derive_business_type, load_pack

from .llm import LLM, LLMError
from .ports import StoreInput
from .prompts import chat as prompt
from .schemas import (
    CallPrep, ChatAction, ChatReply, ChecklistItem, Contact, Evidence, ReportItem,
)

NOTE = "이 가게의 조회 결과 안에서만 답했습니다. 최종 판단은 관할 기관에 확인하세요."
OUT_OF_SCOPE = "이 가게의 점검 결과로는 알 수 없어요. 구청이나 세무서 같은 관할 기관에 확인해 보세요."
FAILED = "지금은 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
NAV_TARGETS = ("dashboard", "report", "checklist", "docs", "grants", "mypage")  # map은 상권 분석을 붙일 때 추가
MAX_HISTORY_TURNS = 10
MAX_TEXT = 1000
MAX_ACTIONS = 2
KIND_OF = {"grounded": "grounded", "change_request": "change", "out_of_scope": "oos", "chitchat": "chitchat"}

# 범위 밖 질문에 문의할 기관을 고르는 키워드 (규칙 묶음 contacts의 키). 번호는 AI가 만들지 않는다.
TOPIC_CONTACTS = [
    (r"세금|부가세|부가가치세|종합소득세|사업자등록|세무|홈택스", "tax"),
    (r"4대보험|근로|고용|임금|퇴직", "labor"),
    (r"건물|건축|용도|위반건축|증축", "build"),
    (r"영업신고|위생|건강진단|식품", "hyg"),
]
CALL_RE = re.compile(r"전화|통화")
TODAY_RE = re.compile(r"오늘.*(뭐|무엇|어떤|할 일)|뭐부터|무엇부터|뭐 먼저")
DOCS_RE = re.compile(r"서류|양식|발급|어디서 받")
# 서류 질문의 키워드 → 체크리스트 항목 id
DOC_TOPICS = [
    (r"영업\s*신고|위생", "c-04"), (r"건축물대장|임대차", "c-01"), (r"상표", "c-02"), (r"사업자", "c-03"),
    (r"근로계약|4대보험|고용", "c-08"), (r"간판|옥외", "c-07"), (r"원산지|가격\s*표시|표시", "c-09"),
]


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
    turns = [{"role": h["role"], "content": _clip(str(h.get("content") or ""))}
             for h in history if isinstance(h, dict) and h.get("role") in ("user", "assistant")]
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


def _store_summary(ctx: ChatContext, payload: dict) -> list[str]:
    """변경 제안의 전→후 미리보기. 개업일이면 체크리스트 날짜를 새 개업일로 다시 계산해 보여 준다."""
    out: list[str] = []
    if "opening_date" in payload:
        new = date.fromisoformat(payload["opening_date"])
        out.append(f"개업일 {ctx.store.opening_date} → {new}")
        example = next((c for c in ctx.checklist if c.dday is not None and c.source == "rule" and c.due_date), None)
        if example:
            out.append(f"체크리스트 날짜 재계산 (예: {example.task} {example.due_date:%m.%d} → "
                       f"{new + timedelta(days=example.dday):%m.%d})")
    if "name" in payload:
        out.append(f"가게 이름 {ctx.store.name} → {payload['name']}")
    labels = {"sells_alcohol": "술 판매", "uses_terrace": "테라스", "has_employees": "직원 고용", "funds_krw": "준비 자금"}
    for k, v in (payload.get("answers") or {}).items():
        before = ctx.store.answers.get(k)
        out.append(f"{labels[k]}: {_show(before)} → {_show(v)}")
    return out


def _show(v) -> str:
    return "미입력" if v is None else ("예" if v is True else "아니오" if v is False else f"{v:,}" if isinstance(v, int) else str(v))


def _choice_summary(pack: dict, item: ReportItem, option_id: str) -> list[str]:
    opt = next(o for o in item.options if o.option_id == option_id)
    out = [f"{item.title} → “{opt.label}” 선택"]
    tasks = {t["id"]: t["task"] for t in pack.get("extra_tasks", [])}
    out += [f"체크리스트에 추가: {tasks.get(t, t)}" for t in opt.apply.adds_checklist]
    if opt.apply.needs_reanalyze:
        out.append("선택을 적용하면 영향받는 점검이 다시 계산돼요")
    return out


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
            out.append(ChatAction(type="update_store", label=label, payload=payload,
                                  summary=_store_summary(ctx, payload)))
        elif a.type == "choose_option":
            item = reports.get(a.item_id or "")
            if item and a.option_id in {o.option_id for o in item.options}:
                out.append(ChatAction(type="choose_option", label=label,
                                      payload={"item_id": item.item_id, "option_id": a.option_id},
                                      summary=_choice_summary(pack, item, a.option_id)))
        elif a.type == "check_item":
            if a.item_id in checks:
                task = next(c.task for c in ctx.checklist if c.item_id == a.item_id)
                out.append(ChatAction(type="check_item", label=label,
                                      payload={"item_id": a.item_id, "done": a.done is not False},
                                      summary=[f"“{task}”를 완료로 표시"]))
        elif a.type == "navigate":
            if a.target in NAV_TARGETS:
                out.append(ChatAction(type="navigate", label=label, payload={"page": a.target},
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


def _contacts_for(pack: dict, message: str) -> list[Contact]:
    """질문 주제로 문의할 기관을 고른다 (번호는 규칙 묶음에서만). 주제를 모르면 정부민원안내콜센터."""
    keys = [k for pat, k in TOPIC_CONTACTS if re.search(pat, message)] or ["gen"]
    out = []
    for k in dict.fromkeys(keys):
        c = contact_of(pack, k)
        if c:
            out.append(Contact(**c))
    return out


FOLLOW_UP = ["왜 이런가요?", "안 하면 어떻게 되나요?", "다른 방법은 없나요?", "전화로 문의할 땐 뭐라고 하죠?"]


def _follow_up(kind: str, focus_view: dict | None) -> list[str]:
    return FOLLOW_UP if focus_view and kind == "grounded" else []


def _call_target(ctx: ChatContext, focus_view: dict | None) -> ReportItem | None:
    """통화 준비 대상 카드: 고정된 카드 → 아직 안 한 문의 할 일이 있는 카드."""
    by = {i.item_id: i for i in ctx.report_items}
    if focus_view and focus_view["type"] == "report_item" and by[focus_view["id"]].contact:
        return by[focus_view["id"]]
    return next((i for i in ctx.report_items if i.contact and i.user_action and i.user_action.type == "send"
                 and i.action_status == "pending" and i.verdict != "ok"), None)


def _call_reply(ctx: ChatContext, pack: dict, focus_view: dict | None) -> ChatReply:
    item = _call_target(ctx, focus_view)
    biz = derive_business_type(pack, ctx.store.answers)
    if not item:
        gen = contact_of(pack, "gen")
        return ChatReply(kind="oos", answer="지금 통화로 확인할 점검 항목이 없어요. 궁금한 기관을 모르면 정부민원안내콜센터에서 연결해 줘요.",
                         contacts=[Contact(**gen)] if gen else [], note=NOTE)
    c = item.contact
    where = f"{ctx.store.address} {ctx.store.address_detail or ''}".strip()
    steps = [
        f"인사: “안녕하세요, 카페·음식점 창업을 준비 중인 예비 창업자입니다. {c.agency} 담당자를 연결해 주실 수 있을까요?”",
        f"상황 설명: {where}에서 {biz or '[확인 필요]'} 영업을 준비 중이라고 말씀드리세요.",
        "질문: 아래 질문을 순서대로 여쭤보세요.",
        "마무리: 담당자 이름과 답변 시점을 메모하고, 통화가 끝나면 이 카드에 결과를 기록하세요.",
    ]
    prep = CallPrep(item_id=item.item_id, contact=c, steps=steps,
                    questions=call_questions(pack, item.check_id, biz) if item.check_id in {k["id"] for k in pack["checks"]} else [])
    phone = f"{c.phone}{' (예시 번호 · 걸기 전 확인)' if c.is_example else ''}" if c.phone else "확인 필요"
    return ChatReply(kind="grounded", answer=f"“{item.title}”을 {c.agency}에 문의할 때 준비할 것이에요. 전화번호는 {phone}예요." + (f" {c.tip}." if c.tip else ""),
                     call_prep=prep, contacts=[c],
                     actions=[ChatAction(type="navigate", label="카드 열기", payload={"page": "report", "item_id": item.item_id},
                                         requires_confirm=False)], note=NOTE)


def _today_reply(ctx: ChatContext, pack: dict) -> ChatReply:
    steps = next_steps(pack, ctx.report_items, ctx.checklist)
    decide = next((s for s in steps if s.kind == "decide"), None)
    do = next((s for s in steps if s.kind == "do"), None)
    task = next((s for s in steps if s.kind == "task"), None)
    if not (decide or do or task):
        return ChatReply(kind="grounded", answer="점검 리포트의 모든 항목을 마쳤어요. 체크리스트로 이어가세요.", note=NOTE)
    lines = []
    if decide:
        lines.append(f"1) 결정: {decide.title.removeprefix('결정하기 · ')} ({decide.sub})")
    if do:
        lines.append(f"{len(lines) + 1}) 직접 할 일: {do.title} · {do.sub}")
    if task and not (decide and do):
        lines.append(f"{len(lines) + 1}) 가까운 체크리스트: {task.title} · {task.sub}")
    actions: list[ChatAction] = []
    if decide:
        item = next(i for i in ctx.report_items if i.item_id == decide.go["item_id"])
        if item.recommendation:
            actions.append(ChatAction(type="choose_option", label="추천 선택지 적용",
                                      payload={"item_id": item.item_id, "option_id": item.recommendation.option_id},
                                      summary=_choice_summary(pack, item, item.recommendation.option_id)))
    return ChatReply(kind="change" if actions else "grounded", answer="오늘은 이 순서로 하세요.\n" + "\n".join(lines),
                     actions=actions, note=NOTE)


def _docs_reply(ctx: ChatContext, message: str) -> ChatReply:
    by = {c.item_id: c for c in ctx.checklist}
    target = next((by[i] for pat, i in DOC_TOPICS if re.search(pat, message) and i in by and by[i].documents), None)
    target = target or next((c for c in sorted(ctx.checklist, key=lambda c: c.due_date or date.max)
                             if not c.done and c.documents), None)
    if not target:
        return ChatReply(kind="oos", answer="이 가게의 체크리스트에서 필요한 서류 안내를 찾지 못했어요. 관할 기관에 확인해 보세요.", note=NOTE)
    parts = [f"“{target.task}”에 필요한 서류는 {', '.join(d.name for d in target.documents)}이에요."]
    for d in target.documents:
        parts.append(f"- {d.name}: {d.agency} — {d.guide}")
    parts.append("서류를 대신 작성하거나 제출하지는 않아요. 링크는 서류함에서 열 수 있어요.")
    contacts = [d.contact for d in target.documents if d.contact]
    return ChatReply(kind="grounded", answer="\n".join(parts), contacts=contacts,
                     actions=[ChatAction(type="navigate", label="서류함 열기", payload={"page": "docs", "item_id": target.item_id},
                                         requires_confirm=False)], note=NOTE)


def _direct_reply(ctx: ChatContext, pack: dict, message: str, focus_view: dict | None) -> ChatReply | None:
    """AI 없이 코드·규칙 묶음으로 답하는 질문: 통화 준비, 오늘 뭐부터, 서류."""
    if CALL_RE.search(message):
        return _call_reply(ctx, pack, focus_view)
    if TODAY_RE.search(message):
        return _today_reply(ctx, pack)
    if DOCS_RE.search(message):
        return _docs_reply(ctx, message)
    return None


def suggestions(ctx: ChatContext, focus: dict | None = None) -> list[str]:
    """상황별 추천 질문 (코드). 고정된 항목이 있으면 그 항목에 맞는 후속 질문."""
    if focus and focus.get("id") and any(i.item_id == focus["id"] for i in ctx.report_items):
        return FOLLOW_UP[:]
    out = ["오늘 뭐부터 하죠?"]
    pending = [i for i in ctx.report_items if i.options and not i.chosen_option]
    if pending:
        out.append(f"{pending[0].title} 선택지 뭐가 달라요?")
    if any(i.contact and i.user_action and i.action_status == "pending" and i.verdict != "ok" for i in ctx.report_items):
        out.append("구청에 전화하기 전에 뭘 준비하죠?")
    out.append("영업신고에 필요한 서류가 뭐예요?")
    out.append("개업일을 한 달 미루고 싶어요")
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

    direct = _direct_reply(ctx, pack, message, focus_view)
    if direct:
        return direct

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
        # 근거를 댈 수 없는 사실 답변은 내보내지 않는다. 문의할 기관 전화번호는 규칙 묶음에서 고른다.
        return ChatReply(kind="oos", answer=OUT_OF_SCOPE, contacts=_contacts_for(pack, message), note=NOTE)

    actions = _build_actions(ctx, pack, r.actions) if r.kind == "change_request" else []
    if r.kind == "change_request" and not actions:
        return ChatReply(kind="chitchat", answer="어떻게 바꿀지 정확히 알려주세요. 예: \"개업일을 4월 1일로 바꿔줘\"", note=NOTE)
    return ChatReply(kind=KIND_OF[r.kind], answer=r.answer.strip(), evidence=evidence if r.kind == "grounded" else [],
                     actions=actions, follow_up=_follow_up(r.kind, focus_view), note=NOTE)
