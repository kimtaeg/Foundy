"""조문에서 의무 찾기.

규칙 묶음의 점검·적용 규칙이 다루지 않는 의무를 AI가 저장된 조문(RAG)을 읽고 찾는다.

- AI가 고른 조문 key 가 검색한 조문에 있고, 인용 문장이 그 조문 원문에 실제로 있어야 채택한다. 하나라도 어긋나면 버린다.
- 규칙 묶음이 이미 다루는 조문(점검 카드의 근거 조문·적용 규칙의 조문)은 AI에 넘기지 않는다.
- 채택한 의무는 점검 카드(확인 권장, 판정 주체 ai)와 체크리스트 작업(legal_analysis)이 된다. 카드·작업 id 는 조문 key 로 정해
  다시 분석해도 같은 조문이면 같은 항목이 된다.
- 날짜는 코드가 계산한다 (group_offsets). AI는 기한을 정하지 않는다.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field

from rules.ai_applicability import _quote_in, _squash

from .judge import _law_evidence
from .llm import LLM, LLMError
from .ports import StoreInput, ToolResult
from .prompts import discover as prompt
from .schemas import Category, ChecklistItem, Contact, Evidence, GroupLabel, ReportItem, Stage, UserAction

logger = logging.getLogger(__name__)

PREFIX = "law_found:"  # 찾은 의무 카드의 check_id 접두사 (규칙 묶음 checks 에는 없다)
MAX_PER_ARTICLE = 2  # 별표처럼 의무가 여러 개 적힌 조문에서 고를 수 있는 최대 개수
DEFAULT_OFFSETS = {"계약 전": -56, "개업 4주 전": -28, "개업 직전": -7, "개업 후": 7}


class FoundObligation(BaseModel):
    law_key: str
    quote: str
    status: Literal["applies", "needs_check"]
    missing_info: str = ""
    title: str
    reason: str
    task: str
    agency: str = ""
    category: Category
    group: GroupLabel
    stage: Stage


class Discovery(BaseModel):
    items: list[FoundObligation] = Field(default_factory=list)


@dataclass
class Found:
    key: str  # 조문 key 해시 (카드·작업 id)
    obligation: FoundObligation
    article: dict
    evidence: Evidence


def is_found(check_id: str | None) -> bool:
    return bool(check_id) and check_id.startswith(PREFIX)


def _article_key(art: dict) -> str:
    return f"{art.get('law_name')} {art.get('article')}"


def _base_label(label: str | None) -> str:
    """'제37조의2 (제목)' → '제37조의2'. 규칙 묶음의 label 과 비교할 때 쓴다."""
    return (label or "").split("(")[0].strip()


def covered_keys(pack: dict, laws: dict[str, ToolResult]) -> set[str]:
    """규칙 묶음이 이미 다루는 조문: 점검 카드가 조회한 조문 + 적용 규칙이 가리키는 조문."""
    keys: set[str] = set()
    for res in laws.values():
        for art in (res.data or {}).get("articles", []) if res.ok else []:
            keys.add(f"{art.get('law_name')} {_base_label(art.get('article'))}")
    for rule in pack.get("applicability_rules") or []:
        law = rule.get("law") or {}
        if law.get("law_name") and law.get("label"):
            keys.add(f"{law['law_name']} {_base_label(law['label'])}")
    return keys


def covered_topics(pack: dict) -> list[str]:
    """AI가 같은 내용을 다시 고르지 않도록 넘기는 이미 다루는 의무 이름."""
    topics = [c.get("title") or c["id"] for c in pack.get("checks", []) if not c.get("deferred")]
    topics += [r.get("title") for r in pack.get("applicability_rules") or [] if r.get("title")]
    topics += [t.get("task") for t in pack.get("checklist") or [] if t.get("task")]
    return list(dict.fromkeys(t for t in topics if t))


def discover(
    llm: LLM, pack: dict, store: StoreInput, business_type: str | None, res: ToolResult | None,
    laws: dict[str, ToolResult],
) -> list[Found]:
    """검색한 조문에서 이 가게의 새 의무를 찾는다. 조문이 없거나 AI가 실패하면 빈 목록 (기존 점검 결과는 그대로다)."""
    conf = (pack.get("law_rag") or {}).get("discovery") or {}
    if res is None or not res.ok or res.from_mock:
        return []
    covered = covered_keys(pack, laws)
    arts = [a for a in (res.data or {}).get("articles", [])
            if a.get("text") and f"{a.get('law_name')} {_base_label(a.get('article'))}" not in covered]
    arts = arts[: int(conf.get("max_articles", 20))]
    if not arts:
        return []
    by_key = {_article_key(a): a for a in arts}
    max_items = int(conf.get("max_items", 6))
    ctx_store = {"sells_alcohol": store.answers.get("sells_alcohol"), "uses_terrace": store.answers.get("uses_terrace"),
                 "has_employees": store.answers.get("has_employees"), "does_delivery": store.answers.get("does_delivery"),
                 "area_sqm": store.area_sqm, "address_detail": store.address_detail}
    limit = int(conf.get("max_article_chars", 2500))
    shown = [{"key": k, "title": a.get("title") or "", "text": a["text"][:limit]} for k, a in by_key.items()]
    try:
        out = llm.parse(
            step="discover_obligations", tier="main", system=prompt.SYSTEM.replace("{max_items}", str(max_items)),
            user=prompt.USER.format(
                business_type=business_type or "[확인 필요]",
                store=json.dumps(ctx_store, ensure_ascii=False, separators=(",", ":")),
                covered=json.dumps(covered_topics(pack), ensure_ascii=False, separators=(",", ":")),
                articles=json.dumps(shown, ensure_ascii=False, separators=(",", ":"))),
            schema=Discovery)
    except LLMError as exc:
        logger.warning("의무 찾기 실패: %s", exc)
        return []

    return accept(out.items, by_key, res, max_items)


def accept(items: list[FoundObligation], by_key: dict[str, dict], res: ToolResult, max_items: int) -> list[Found]:
    """AI가 고른 의무 중 검증을 통과한 것만 남긴다 (외부 호출 없음).

    - law_key 가 검색한 조문에 있어야 하고, 인용 문장이 그 원문에 있어야 한다.
    - 같은 조문·같은 문장은 한 번만, 조문 하나에서 MAX_PER_ARTICLE 개까지, 전체 max_items 개까지.
    """
    out = items
    found: list[Found] = []
    per_article: dict[str, int] = {}
    seen: set[str] = set()
    for ob in out:
        law_key = ob.law_key.strip()
        art = by_key.get(law_key)
        if art is None:
            continue  # 검색한 조문에 없는 key (지어낸 조문)
        if not _quote_in(ob.quote, art["text"]):
            continue  # 인용 문장이 원문에 없다
        if not (ob.title.strip() and ob.task.strip() and ob.reason.strip()):
            continue
        # 같은 조문의 같은 문장이면 같은 의무다. id 는 조문 + 인용 문장 앞부분으로 정해 다시 분석해도 같은 항목이 되게 한다
        anchor = f"{law_key}|{_squash(ob.quote)[:40]}"
        if anchor in seen or per_article.get(law_key, 0) >= MAX_PER_ARTICLE:
            continue
        seen.add(anchor)
        per_article[law_key] = per_article.get(law_key, 0) + 1
        key = hashlib.sha1(anchor.encode("utf-8")).hexdigest()[:8]
        found.append(Found(key=key, obligation=ob, article=art, evidence=_law_evidence(res, art, ob.quote.strip())))
        if len(found) >= max_items:
            break
    return found


def card_of(found: Found) -> ReportItem:
    ob = found.obligation
    reason = ob.reason.strip()
    if ob.status == "needs_check" and ob.missing_info.strip():
        reason = f"{reason} 확인할 것: {ob.missing_info.strip()}"
    return ReportItem(
        item_id=f"r-x{found.key}", check_id=f"{PREFIX}{found.key}", stage=ob.stage, title=ob.title.strip(),
        verdict="low", decided_by="ai", reason=reason, evidence=[found.evidence],
        user_action=UserAction(type="visit", text=ob.task.strip()))


def task_of(found: Found, pack: dict, calc: Any, opening_date: date, card_id: str | None,
            contact: dict | None = None) -> ChecklistItem:
    ob = found.obligation
    offsets = {**DEFAULT_OFFSETS, **((pack.get("law_rag") or {}).get("discovery") or {}).get("group_offsets", {})}
    offset = int(offsets.get(ob.group, -28))
    d = calc.checklist_dates(opening_date, offset)
    art = found.article
    law = {"type": "law", "law_name": art.get("law_name"), "article": art.get("article")}
    if art.get("url"):
        law["url"] = art["url"]
    sources = [law]
    if card_id:
        sources.append({"type": "inspection", "check_id": f"{PREFIX}{found.key}", "item_id": card_id})
    item_id = f"o-x{found.key}"
    return ChecklistItem(
        item_id=item_id, rule_key=item_id, task=ob.task.strip()[:60], category=ob.category,
        due_date=d["due_date"], dday=d["dday"], group_label=ob.group, agency=ob.agency.strip() or None,
        contact=Contact(**contact) if contact else None, source="rule",
        report_item_ids=[card_id] if card_id else [], evidence=[found.evidence],
        task_type="legal_obligation" if ob.status == "applies" else "conditional", source_type="legal_analysis",
        priority="normal", deadline_type="after_opening" if offset > 0 else "before_opening",
        reason=ob.reason.strip() if ob.status == "applies" else f"{ob.reason.strip()} {ob.missing_info.strip()}".strip(),
        law_basis={"law_name": art.get("law_name"), "article": art.get("article"), "url": art.get("url")},
        sources=sources)
