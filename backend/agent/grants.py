"""정책 알림: 지원사업 공고문의 자격 조건을 뽑고 이 가게가 해당하는지 AI가 판정한다.

역할 분담
- AI: 공고문에서 조건 추출(원문 인용), 숫자로 못 정하는 조건의 판단, 쉬운 말 요약
- 계산 도구(calc/match.py): 나이·업력·지역 대조
- 코드: 인용 문장이 공고문 원문에 있는지·숫자가 인용에 있는지 검증, 근거 생성, 결과 집계
판정은 조회한 공고문 안에서만 한다. 근거를 확인하지 못한 조건은 unknown이고, 명확히 맞지 않는 공고는 목록에서 뺀다.
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from calc import match

from .llm import LLM, LLMError
from .ports import Calc, StoreInput, ToolResult
from .prompts import grants as prompt
from .schemas import (
    ChecklistItem, Evidence, GrantCheck, GrantEligibility, GrantMatch, GrantsResult, GrantSummary,
)

MAX_NOTICE_CHARS = 6000


class Condition(BaseModel):
    kind: Literal["age_max", "age_min", "business_years_max", "region", "other"]
    text: str
    quote: str
    number: int | None = None
    regions: list[str] = Field(default_factory=list)
    ai_result: Literal["pass", "fail", "unknown"] | None = None


class GrantExtraction(BaseModel):
    conditions: list[Condition] = Field(default_factory=list)
    who: str = "[확인 필요]"
    how_much: str = "[확인 필요]"
    until: str | None = None
    what_to_submit: list[str] = Field(default_factory=list)


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def _parse_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _check(c: Condition, store: StoreInput, notice: str, grant: dict, today: date) -> tuple[GrantCheck, bool]:
    """조건 하나를 대조한다. 두 번째 값은 '명확히 맞지 않음(fail)'인지."""
    quote = c.quote.strip()
    verified = bool(quote) and _norm(quote) in _norm(notice)
    evidence = (
        Evidence(type="notice", source=grant.get("source") or "공고문", text=quote, url=grant.get("url"))
        if verified else None
    )
    if not verified:
        return GrantCheck(condition=c.text, result="unknown", note="공고문에서 이 조건의 원문을 확인하지 못했어요"), False

    if c.kind in ("age_max", "age_min", "business_years_max"):
        if c.number is None or str(c.number) not in quote:
            if not (c.kind == "business_years_max" and c.number == 0):
                return GrantCheck(condition=c.text, result="unknown", evidence=evidence,
                                  note="공고문 문장에서 기준 숫자를 확인하지 못했어요"), False
        if c.kind == "age_max":
            res, note = match.age_max(store.owner_birth_year, c.number, today)
        elif c.kind == "age_min":
            res, note = match.age_min(store.owner_birth_year, c.number, today)
        else:
            res, note = match.business_years_max(store.opening_date, c.number, today)
    elif c.kind == "region":
        res, note = match.region(f"{store.address} {store.address_detail or ''}", c.regions)
    else:
        res = c.ai_result or "unknown"
        note = "" if res == "pass" else "공고문과 가게 정보만으로는 확실하지 않아요" if res == "unknown" else "공고문 조건에 맞지 않아요"

    if res == "fail":
        return GrantCheck(condition=c.text, result="unknown", evidence=evidence, note=note), True
    return GrantCheck(condition=c.text, result="pass" if res == "pass" else "unknown", evidence=evidence, note=note), False


def _eligibility(checks: list[GrantCheck]) -> str:
    passed = sum(1 for c in checks if c.result == "pass")
    if passed == 0:
        return "unknown"
    return "eligible" if passed == len(checks) else "partial"


def judge_grants(llm: LLM, store: StoreInput, res: ToolResult, today: date | None = None) -> GrantsResult:
    today = today or date.today()
    if not res.ok or not res.data:
        return GrantsResult(ok=False, fetched_at=res.fetched_at)

    facts = {"name": store.name, "address": store.address, "opening_date": str(store.opening_date),
             "owner_birth_year": store.owner_birth_year, "business_type": store.business_type_input,
             "answers": store.answers}
    items: list[GrantMatch] = []
    excluded = closed = 0
    for g in res.data.get("grants", []):
        deadline = _parse_date(g.get("deadline"))
        if deadline and deadline < today:
            closed += 1
            continue
        notice = (g.get("text") or "")[:MAX_NOTICE_CHARS]
        try:
            ex = llm.parse(
                step="grants_extract", tier="main", system=prompt.SYSTEM,
                user=prompt.USER.format(store=json.dumps(facts, ensure_ascii=False),
                                        title=g.get("title", ""), notice=notice),
                schema=GrantExtraction,
            )
        except LLMError:
            items.append(GrantMatch(
                grant_id=g.get("grant_id", ""), title=g.get("title", ""), source=g.get("source", ""),
                url=g.get("url"), deadline=deadline,
                eligibility=GrantEligibility(result="unknown"),
                summary=GrantSummary(until=deadline.isoformat() if deadline else None)))
            continue

        checks: list[GrantCheck] = []
        failed = False
        seen: set[str] = set()
        for c in ex.conditions:
            if _norm(c.text) in seen:
                continue
            seen.add(_norm(c.text))
            check, fail = _check(c, store, notice, g, today)
            checks.append(check)
            failed = failed or fail
        if failed:
            excluded += 1
            continue
        until = deadline.isoformat() if deadline else (ex.until if _parse_date(ex.until) else None)
        items.append(GrantMatch(
            grant_id=g.get("grant_id", ""), title=g.get("title", ""), source=g.get("source", ""),
            url=g.get("url"), deadline=deadline,
            eligibility=GrantEligibility(result=_eligibility(checks), checks=checks),
            summary=GrantSummary(who=ex.who, how_much=ex.how_much, until=until,
                                 what_to_submit=ex.what_to_submit)))

    order = {"eligible": 0, "partial": 1, "unknown": 2}
    items.sort(key=lambda m: (order[m.eligibility.result], m.deadline or date.max))
    return GrantsResult(ok=True, fetched_at=res.fetched_at, items=items, excluded_count=excluded, closed_count=closed)


def grant_checklist_items(
    result: GrantsResult, calc: Calc, opening_date: date, start_index: int = 0, today: date | None = None
) -> list[ChecklistItem]:
    """신청 가능성이 있는(eligible·partial) 공고의 마감일을 체크리스트(정책)에 추가한다.

    항목 id는 g-<공고 id>다 (c-NN은 규칙 묶음의 기본 항목). 제출서류는 서류함이 아니라 지원사업 상세에서 보여 준다.
    start_index는 예전 호출 형태와 맞추려고 남겨 둔 인자로 쓰지 않는다.
    """
    today = today or date.today()
    out: list[ChecklistItem] = []
    for m in result.items:
        if m.eligibility.result == "unknown" or not m.deadline or m.deadline < today:
            continue
        d = calc.date_info(opening_date, m.deadline)
        out.append(ChecklistItem(
            item_id=f"g-{m.grant_id}", task=f"{m.title} 신청 마감", category="정책",
            due_date=d["due_date"], dday=d["dday"], group_label=d["group_label"], agency=m.source,
            source="grant",
            evidence=[Evidence(type="notice", source=m.source, text=f"신청 기간: ~{m.deadline.isoformat()}", url=m.url)]))
        m.added_to_checklist = True
    return out
