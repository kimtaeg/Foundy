"""후보 자리 비교: 비용 계산(계산 도구) + AI 요약 + 자리별 현장 질문.

- 금액·㎡당 임대료·버틸 수 있는 기간은 calc/costs.py가 계산한다. AI는 숫자를 만들지 않는다.
- AI 요약 속 숫자가 제공된 값(계산 결과, 상권 지표)에 없으면 AI 요약을 버리고 규칙 요약으로 대체한다.
- 데이터가 없는 지표는 available: false 그대로 두고 지어내지 않는다.
"""

from __future__ import annotations

import json
import re

from pydantic import BaseModel, Field

from calc import costs
from rules.engine import derive_business_type, judge_building_use, load_pack

from .llm import LLM, LLMError
from .ports import Site, StoreInput
from .prompts import location as prompt
from .schemas import CompareResult, ListingResult, SiteCompareItem

MAX_QUESTIONS = 4
MAX_QUESTION_CHARS = 120


class SiteQuestions(BaseModel):
    site_id: str
    questions: list[str] = Field(default_factory=list)


class CompareLLM(BaseModel):
    summary: str
    site_questions: list[SiteQuestions] = Field(default_factory=list)


def site_building_check(pack: dict, business_type: str | None, site: Site) -> dict:
    """이 자리의 건축물대장 용도로 신고 업종이 가능한지 (규칙 판정)."""
    rr = judge_building_use(pack, business_type, site.floor_uses)
    return {"verdict": rr.verdict, "summary": rr.reason}


_TOKEN = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _numbers(obj) -> set[float]:
    """facts 안의 모든 숫자(문자열 속 숫자 포함)와, 만 원 단위로 읽을 수 있는 표기."""
    found: set[float] = set()
    if isinstance(obj, bool):
        return found
    if isinstance(obj, str):
        return {float(t.replace(",", "")) for t in _TOKEN.findall(obj)}
    if isinstance(obj, (int, float)):
        n = abs(obj)
        found.add(float(n))
        if n >= 10_000:
            found.add(round(n / 10_000, 1))
            if n % 10_000 == 0:
                found.add(float(n // 10_000))
        return found
    if isinstance(obj, dict):
        for v in obj.values():
            found |= _numbers(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            found |= _numbers(v)
    return found


def numbers_supported(text: str, facts) -> bool:
    """text의 두 자리 이상 숫자가 모두 facts에 있는 값이어야 한다. (한 자리 숫자는 '1층' 같은 표기라 본다)"""
    allowed = _numbers(facts)
    for tok in _TOKEN.findall(text):
        clean = tok.replace(",", "")
        if len(clean.split(".")[0]) < 2:
            continue
        if float(clean) not in allowed:
            return False
    return True


def _default_questions(site: Site, building: dict, business_type: str | None) -> list[str]:
    q: list[str] = []
    listing = site.listing or {}
    if listing.get("maintenance_krw"):
        q.append("관리비에 수도·전기·청소 등 어떤 항목이 포함되나요?")
    if listing.get("premium_krw"):
        q.append("권리금에 포함된 시설·집기 목록을 받을 수 있나요?")
    q.append("이전 임차인은 어떤 업종이었고, 왜 나갔나요?")
    q.append("계약 기간과 임대료 인상 조건은 어떻게 되나요?")
    if building.get("verdict") == "high":
        q.insert(0, f"이 건물에서 {business_type or '신고 업종'} 영업신고가 가능한지 확인할 수 있나요?")
    elif building.get("verdict") == "unknown":
        q.insert(0, "건축물대장에 위반건축물 표기가 있는지 확인해 주실 수 있나요?")
    return q[:MAX_QUESTIONS]


def _clean_questions(raw: list[str]) -> list[str]:
    out: list[str] = []
    for q in raw:
        q = " ".join(q.split())
        if q and len(q) <= MAX_QUESTION_CHARS and q not in out:
            out.append(q)
    return out[:MAX_QUESTIONS]


def _rule_summary(items: list[SiteCompareItem]) -> str:
    parts = []
    for it in items:
        r, bits = it.listing_result, [it.building_check.get("summary", "")]
        if (it.area_metrics or {}).get("same_type_count") is not None:
            bits.append(f"반경 내 같은 업종 {it.area_metrics['same_type_count']}곳")
        if r.monthly_fixed_krw is not None:
            bits.append(f"월 고정비 {r.monthly_fixed_krw:,}원")
        if r.initial_cost_krw is not None:
            bits.append(f"초기 비용 {r.initial_cost_krw:,}원")
        parts.append(f"{it.label} 자리: " + ", ".join(b for b in bits if b))
    return " / ".join(parts)


def compare_sites(
    llm: LLM, store: StoreInput, sites: list[Site], pack: dict | None = None, business_type: str | None = None,
) -> CompareResult:
    pack = pack or load_pack("cafe_restaurant")
    business_type = business_type or derive_business_type(pack, store.answers)
    funds = store.answers.get("funds_krw")

    items: list[SiteCompareItem] = []
    facts_sites: list[dict] = []
    base = sites[0] if sites else None
    for s in sites:
        building = site_building_check(pack, business_type, s)
        lr = costs.listing_result(s.listing, funds, s.area_avg_rent_per_m2)
        items.append(SiteCompareItem(site_id=s.site_id, label=s.label, building_check=building,
                                     area_metrics=s.area_metrics, listing_result=ListingResult(**lr)))
        fact = {"site_id": s.site_id, "label": s.label, "address": s.address, "building": building,
                "area_metrics": s.area_metrics if s.area_metrics else "데이터 없음", "costs": lr}
        if base and s is not base and base.listing and s.listing:
            delta = costs.site_cost_delta(base.listing, s.listing)
            if delta:
                fact["baseline_diff"] = {"baseline": base.label, **delta}
        facts_sites.append(fact)

    summary, summary_by = "", "ai"
    questions: dict[str, list[str]] = {}
    if len(sites) >= 1:
        try:
            r = llm.parse(
                step="compare_sites", tier="main", system=prompt.SYSTEM,
                user=prompt.USER.format(
                    store=json.dumps({"business_type": business_type, "funds_krw": funds}, ensure_ascii=False),
                    sites=json.dumps(facts_sites, ensure_ascii=False, default=str)),
                schema=CompareLLM,
            )
            valid = {s.site_id for s in sites}
            for sq in r.site_questions:
                if sq.site_id in valid and sq.site_id not in questions:
                    cleaned = _clean_questions(sq.questions)
                    if cleaned:
                        questions[sq.site_id] = cleaned
            summary = r.summary.strip()
            if not summary or not numbers_supported(summary, facts_sites):
                summary = ""
        except LLMError:
            pass

    if not summary:
        summary, summary_by = _rule_summary(items), "rule"
    for it, s in zip(items, sites):
        it.listing_result.site_questions = questions.get(s.site_id) or _default_questions(
            s, it.building_check, business_type)
    return CompareResult(sites=items, summary=summary, summary_by=summary_by)
