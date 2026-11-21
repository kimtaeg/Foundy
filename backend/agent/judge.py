"""AI 판정과 근거 검증.

LLM은 조회한 데이터 안에서 판단만 하고, 근거(Evidence)는 코드가 조회 데이터에서 만든다.
AI가 인용한 상표 번호·문구가 실제 데이터에 없으면 그 근거는 버리고 판정을 unknown으로 내린다.
AI 판정은 high가 될 수 없다 (결과 스키마에서 low | ok | unknown만 받는다).
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field

from rules.engine import RuleResult

from .llm import LLM, LLMError
from .ports import StoreInput, ToolResult
from .prompts import judge as prompt
from .schemas import Evidence, ReportItem


class TrademarkJudgment(BaseModel):
    verdict: Literal["low", "ok", "unknown"]
    title: str
    reason: str
    cited_reg_nos: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)


class AdJudgment(BaseModel):
    verdict: Literal["low", "ok", "unknown"]
    title: str
    reason: str
    quotes: list[str] = Field(default_factory=list)


def _norm(name: str) -> str:
    return "".join(name.split()).lower()


def _distinct_names(candidates: list[str], own: str, others: list[str]) -> list[str]:
    """기존 이름·비슷하다고 본 상표와 글자가 겹치는 대체 이름은 버린다 (최대 2개)."""
    banned = [_norm(own)] + [_norm(o) for o in others if o]
    out: list[str] = []
    for c in candidates:
        n = _norm(c)
        if n and not any(n in b or b in n for b in banned) and c.strip() not in out:
            out.append(c.strip())
    return out[:2]


def _item(spec: dict, item_id: str, **kw) -> ReportItem:
    return ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], decided_by="ai", **kw)


def _data_evidence(res: ToolResult, value: str, url: str | None = None) -> Evidence:
    return Evidence(
        type="data", source=res.source, value=value, url=url,
        fetched_at=res.fetched_at, from_cache=res.from_cache, from_mock=res.from_mock,
    )


def judge_trademark(
    llm: LLM, store: StoreInput, res: ToolResult, spec: dict, item_id: str
) -> tuple[ReportItem, dict]:
    """상호가 등록 상표와 겹치는지. 두 번째 값은 선택지 만들 때 쓰는 부가 정보(alternatives)."""
    name = store.name
    if not res.ok or res.data is None:
        return _item(
            spec, item_id, verdict="unknown",
            title="상표가 겹치는지 확인할 수 없어요",
            reason="상표 정보를 조회하지 못했어요. 특허정보 검색서비스(KIPRIS)에서 직접 확인해 보세요.",
        ), {"alternatives": []}

    similar = res.data.get("similar") or []
    if not similar:
        if res.data.get("search_scope") == "name":
            return _item(
                spec, item_id, verdict="unknown", title="상표 유사 여부는 추가 확인이 필요해요",
                reason="제43류 등록 상표 명칭검색은 0건이지만, 발음·표기 유사 상표 전체의 부재를 확인한 결과는 아닙니다.",
                evidence=[_data_evidence(res, "제43류 등록 상표 명칭검색 후보 0건")],
            ), {"alternatives": []}
        return _item(
            spec, item_id, verdict="ok",
            title=f"'{name}'과(와) 비슷한 등록 상표가 없어요",
            reason="조회한 등록 상표 중에 비슷한 이름이 없었어요.",
            evidence=[_data_evidence(res, "비슷한 등록 상표 0건")],
        ), {"alternatives": []}

    by_reg = {s.get("reg_no"): s for s in similar if s.get("reg_no")}
    try:
        j = llm.parse(
            step="judge_trademark", tier="main", system=prompt.TRADEMARK_SYSTEM,
            user=prompt.TRADEMARK_USER.format(
                name=name, similar=json.dumps(similar, ensure_ascii=False)),
            schema=TrademarkJudgment,
        )
    except LLMError:
        return _item(
            spec, item_id, verdict="unknown",
            title="상표가 겹치는지 확인할 수 없어요",
            reason="AI 판단에 실패했어요. 비슷한 상표가 조회됐으니 목록을 직접 확인해 보세요.",
            evidence=[_data_evidence(res, f"비슷할 수 있는 등록 상표 {len(similar)}건 조회")],
        ), {"alternatives": []}

    cited = [r for r in dict.fromkeys(j.cited_reg_nos) if r in by_reg]
    evidence = [
        _data_evidence(
            res,
            f"등록 {r} '{by_reg[r].get('name')}' (제{by_reg[r].get('class_code')}류, {by_reg[r].get('status')})",
            by_reg[r].get("url"),
        )
        for r in cited
    ]
    verdict, reason = j.verdict, j.reason
    if verdict == "ok":
        evidence = evidence or [_data_evidence(res, f"조회된 등록 상표 {len(similar)}건 검토")]
    elif verdict == "low" and not evidence:
        verdict, reason = "unknown", "비슷하다고 본 상표를 조회 결과에서 특정하지 못했어요. 목록을 직접 확인해 보세요."
    alternatives = (
        _distinct_names(j.alternatives, name, [by_reg[r].get("name", "") for r in by_reg]) if verdict == "low" else []
    )
    return _item(spec, item_id, verdict=verdict, title=j.title, reason=reason, evidence=evidence), {
        "alternatives": alternatives
    }


def judge_ad_claims(llm: LLM, store: StoreInput, spec: dict, item_id: str) -> ReportItem | None:
    """메뉴·홍보 문구의 효능 표현. 문구가 없으면 점검하지 않는다(None)."""
    text = (store.menu_text or "").strip()
    if not text:
        return None
    src = "입력한 메뉴·홍보 문구"
    try:
        j = llm.parse(
            step="judge_ad_claims", tier="main", system=prompt.AD_SYSTEM,
            user=prompt.AD_USER.format(menu_text=text), schema=AdJudgment,
        )
    except LLMError:
        return _item(
            spec, item_id, verdict="unknown", title="메뉴 문구를 점검하지 못했어요",
            reason="AI 판단에 실패했어요. 효능을 암시하는 표현이 없는지 직접 확인해 보세요.",
        )
    quotes = [q.strip() for q in dict.fromkeys(j.quotes) if q.strip() and q.strip() in text]
    verdict, reason = j.verdict, j.reason
    if verdict == "low" and not quotes:
        verdict, reason = "unknown", "문제라고 본 표현을 원문에서 찾지 못했어요. 문구를 직접 확인해 보세요."
    evidence = [Evidence(type="data", source=src, value=q) for q in quotes]
    if verdict == "ok":
        evidence = [Evidence(type="data", source=src, value="입력한 문구 전체를 검토했어요")]
    return _item(spec, item_id, verdict=verdict, title=j.title, reason=reason, evidence=evidence)


class PermitJudgment(BaseModel):
    verdict: Literal["low", "ok", "unknown"]
    title: str
    reason: str
    required: list[str] = Field(default_factory=list)
    cited: list[str] = Field(default_factory=list)
    quotes: list[str] = Field(default_factory=list)


MAX_ARTICLE_CHARS = 3000


def _squash(text: str) -> str:
    return "".join((text or "").split())


def _law_evidence(res: ToolResult, art: dict, quote: str | None = None) -> Evidence:
    return Evidence(
        type="law", source=res.source, law_name=art.get("law_name"), article=art.get("article"),
        text=quote or (art.get("text") or "")[:MAX_ARTICLE_CHARS] or None, url=art.get("url"),
        fetched_at=res.fetched_at, from_cache=res.from_cache, from_mock=res.from_mock)


def _static_permit(spec: dict, item_id: str, res: ToolResult, fallback: bool = False) -> ReportItem:
    """AI 없이 만든 안내 카드. 조문 근거가 있으면 low(확인 권장), 없으면 근거가 없어 판단하지 않는다."""
    arts = (res.data or {}).get("articles", []) if res.ok else []
    evidence = [_law_evidence(res, a) for a in arts]
    verdict = "low" if evidence else "unknown"
    return ReportItem(
        item_id=item_id, check_id=spec["id"], stage=spec["stage"], decided_by="rule", ai_fallback=fallback,
        verdict=verdict, title=spec["title"], reason=spec["reason"], evidence=evidence)


def judge_law_card(
    llm: LLM, store: StoreInput, business_type: str | None, res: ToolResult, spec: dict, item_id: str,
    outcomes: list | None = None,
) -> ReportItem:
    """조회한 법령 조문을 AI가 읽고 이 가게의 영업신고 관련 할 일을 판정한다.

    - AI가 인용한 조문·문장이 조회한 원문에 실제로 있는지 코드가 검증한다. 없으면 그 근거는 버린다.
    - 근거를 검증하지 못하면 unknown이다. AI가 실패하면 규칙 묶음의 안내 카드로 대체한다.
    """
    arts = (res.data or {}).get("articles", []) if res.ok else []
    arts = [a for a in arts if a.get("text")]
    if not arts:
        return _static_permit(spec, item_id, res)  # 읽을 조문이 없으면 판단하지 않는다 (근거 없음 → unknown)

    by_key = {f"{a.get('law_name')} {a.get('article')}": a for a in arts}
    shown = [{"key": k, "law_name": a.get("law_name"), "article": a.get("article"),
              "text": (a.get("text") or "")[:MAX_ARTICLE_CHARS]} for k, a in by_key.items()]
    ctx_store = {"name": store.name, "sells_alcohol": store.answers.get("sells_alcohol"),
                 "uses_terrace": store.answers.get("uses_terrace"), "has_employees": store.answers.get("has_employees"),
                 "does_delivery": store.answers.get("does_delivery"), "area_sqm": store.area_sqm}
    topic = spec.get("topic")
    rules = [{"title": o.title, "status": o.status, "reason": o.reason} for o in (outcomes or [])]
    try:
        if topic:  # 영업신고 외의 법령 카드(원산지 표시·소방·근로계약 등)
            system = prompt.OBLIGATION_SYSTEM.replace("{topic}", topic)
            user = prompt.OBLIGATION_USER.format(
                business_type=business_type or "[확인 필요]", store=json.dumps(ctx_store, ensure_ascii=False),
                rules=json.dumps(rules, ensure_ascii=False), articles=json.dumps(shown, ensure_ascii=False))
        else:
            system = prompt.PERMIT_SYSTEM
            user = prompt.PERMIT_USER.format(
                business_type=business_type or "[확인 필요]", store=json.dumps(ctx_store, ensure_ascii=False),
                articles=json.dumps(shown, ensure_ascii=False))
        j = llm.parse(step="judge_law_card" if topic else "judge_permit_docs", tier="main", system=system, user=user, schema=PermitJudgment)
    except LLMError:
        return _static_permit(spec, item_id, res, fallback=True)

    cited = [k for k in dict.fromkeys(j.cited) if k in by_key]
    squashed = {k: _squash(by_key[k].get("text") or "") for k in cited}
    quotes: dict[str, list[str]] = {k: [] for k in cited}
    for q in dict.fromkeys(x.strip() for x in j.quotes if x.strip()):
        for k in cited:
            if _squash(q) and _squash(q) in squashed[k]:
                quotes[k].append(q)
                break
    verified = [k for k in cited if quotes[k]]
    verdict, reason = j.verdict, j.reason
    if verdict == "low" and not verified:
        verdict, reason = "unknown", "AI가 인용한 조문 문장을 조회한 원문에서 확인하지 못했어요. 구청 위생과에 직접 확인해 보세요."
    if verdict == "ok" and not cited:
        verdict, reason = "unknown", "해당하지 않는다고 본 근거 조문을 특정하지 못했어요. 구청 위생과에 직접 확인해 보세요."
    statuses = {o.status for o in (outcomes or [])}
    if verdict == "ok" and "applies" in statuses:  # 코드가 적용된다고 정한 의무를 AI가 해당 없다고 하면 따르지 않는다
        verdict, reason = "low", "이 가게에 적용되는 규정으로 확인됐어요. 아래 근거 조문을 확인해 보세요."
    elif verdict == "ok" and statuses == {"needs_check"}:
        verdict, reason = "unknown", "적용 여부를 판단할 정보가 부족해요. 관할 기관에 직접 확인해 보세요."
    evidence = [_law_evidence(res, by_key[k], " … ".join(quotes[k]) or None) for k in (verified or cited)]
    if verdict != "unknown" and j.required and verdict == "low":
        reason = f"{reason} 조문에 적힌 할 일: " + " / ".join(r.strip() for r in j.required[:4] if r.strip())
    return ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], decided_by="ai",
                      verdict=verdict, title=j.title, reason=reason, evidence=evidence)


judge_permit_docs = judge_law_card  # 영업신고 서류 카드 (조문 해석)


# ---- 건물 용도·위반건축물: AI가 건축물대장과 조문을 읽고 판정, 규칙표는 대조용 안전장치 ----
class BuildingJudgment(BaseModel):
    verdict: Literal["high", "low", "ok", "unknown"]
    title: str
    reason: str
    cited_uses: list[str] = Field(default_factory=list)
    cited: list[str] = Field(default_factory=list)
    quotes: list[str] = Field(default_factory=list)
    ok_business_types: list[str] = Field(default_factory=list)


class ViolationJudgment(BaseModel):
    verdict: Literal["high", "ok", "unknown"]
    title: str
    reason: str


BUSINESS_TYPES = ("휴게음식점", "일반음식점")


def _rule_building_card(spec: dict, item_id: str, rr: RuleResult, uses: list[str], b: ToolResult,
                        law: ToolResult, business_type: str | None, fallback: bool) -> tuple[ReportItem, dict]:
    """AI 없이 규칙표로 만든 건물 용도 카드 (AI 실패·건축물대장 없음일 때)."""
    from rules.engine import render_title

    ev = ([_data_evidence(b, ", ".join(uses))] if uses else [])
    ev += [_law_evidence(law, a) for a in ((law.data or {}).get("articles", []) if law.ok else [])]
    title = render_title(spec, rr.verdict, business_type=business_type) or rr.reason
    return (ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], title=title, verdict=rr.verdict,
                       decided_by="rule", ai_fallback=fallback, reason=rr.reason, evidence=ev),
            {"floor_uses": uses, "ok_business_types": rr.facts.get("ok_business_types", [])})


def judge_building_use_ai(
    llm: LLM, store: StoreInput, business_type: str | None, b: ToolResult, law: ToolResult, rr: RuleResult,
    spec: dict, item_id: str, pack: dict,
) -> tuple[ReportItem, dict]:
    """AI가 건축물대장의 층 용도와 조문을 읽고 신고 업종이 가능한지 판정한다.

    코드 검증: 인용한 용도는 건축물대장에 있어야 하고, high는 조문 인용이 검증돼야 한다. 규칙표(rr)와 high·ok가
    서로 어긋나면 low(구청 확인 권장)로 낮춘다. 규칙표가 판단할 수 없는데 AI가 high면 low로 낮춘다.
    """
    from rules.engine import judge_building_use as table

    uses = (b.data or {}).get("floor_uses", []) if b.ok else []
    rr_ok_types = [t for t in BUSINESS_TYPES if table(pack, t, uses).verdict == "ok"] if uses else []
    rr.facts["ok_business_types"] = rr_ok_types
    if not uses or business_type is None:
        return _rule_building_card(spec, item_id, rr, uses, b, law, business_type, fallback=False)

    arts = [a for a in ((law.data or {}).get("articles", []) if law.ok else []) if a.get("text")]
    by_key = {f"{a.get('law_name')} {a.get('article')}": a for a in arts}
    shown = [{"key": k, "text": (a.get("text") or "")[:MAX_ARTICLE_CHARS]} for k, a in by_key.items()]
    try:
        j = llm.parse(
            step="judge_building_use", tier="main", system=prompt.BUILDING_SYSTEM,
            user=prompt.BUILDING_USER.format(
                store=json.dumps({"name": store.name, "sells_alcohol": store.answers.get("sells_alcohol")},
                                 ensure_ascii=False),
                business_type=business_type, floor_uses=json.dumps(uses, ensure_ascii=False),
                articles=json.dumps(shown, ensure_ascii=False)),
            schema=BuildingJudgment,
        )
    except LLMError:
        return _rule_building_card(spec, item_id, rr, uses, b, law, business_type, fallback=True)

    cited_uses = [u for u in dict.fromkeys(j.cited_uses) if u in uses]
    cited = [k for k in dict.fromkeys(j.cited) if k in by_key]
    quotes: dict[str, list[str]] = {k: [] for k in cited}
    for q in dict.fromkeys(x.strip() for x in j.quotes if x.strip()):
        for k in cited:
            if _squash(q) in _squash(by_key[k].get("text") or ""):
                quotes[k].append(q)
                break
    law_verified = [k for k in cited if quotes[k]]
    verdict, reason = j.verdict, j.reason
    if verdict in ("high", "ok") and not cited_uses:
        verdict, reason = "unknown", "AI가 인용한 건물 용도를 건축물대장에서 확인하지 못했어요. 구청 건축과에 확인해 보세요."
    elif verdict == "high" and not law_verified:
        verdict = "low"
        reason += " (근거 조문을 원문에서 확인하지 못해 확인 권장으로 낮췄어요)"
    if verdict in ("high", "ok") and rr.verdict in ("high", "ok") and verdict != rr.verdict:
        verdict, reason = "low", "AI 판단과 규칙표가 달라서 확인 권장으로 낮췄어요. 구청 건축과에 확인해 보세요."
    elif verdict == "high" and rr.verdict == "unknown":
        verdict = "low"
        reason += " (규칙표로는 확인되지 않아 확인 권장으로 낮췄어요)"
    evidence = [_data_evidence(b, ", ".join(cited_uses or uses))]
    evidence += [_law_evidence(law, by_key[k], " … ".join(quotes[k]) or None) for k in (law_verified or cited)]
    ok_types = [t for t in dict.fromkeys(j.ok_business_types) if t in BUSINESS_TYPES and t in rr_ok_types]
    item = ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], decided_by="ai",
                      verdict=verdict, title=j.title, reason=reason, evidence=evidence)
    return item, {"floor_uses": uses, "ok_business_types": ok_types}


def judge_violation_ai(llm: LLM, b: ToolResult, spec: dict, item_id: str) -> ReportItem:
    """AI가 건축물대장의 위반건축물 표기를 읽고 판정한다. 표기 정보가 없으면 AI를 부르지 않고 판단 불가다."""
    from rules.engine import render_title

    violation = (b.data or {}).get("violation") if b.ok else None

    def rule_card(fallback: bool) -> ReportItem:
        if violation is True:
            v, reason, ev = "high", "건축물대장에 위반건축물로 표기돼 있어요.", [_data_evidence(b, "위반건축물 표기 있음")]
        elif violation is False:
            v, reason, ev = "ok", "건축물대장에 위반건축물 표기가 없어요.", [_data_evidence(b, "위반건축물 표기 없음")]
        else:
            v = "unknown"
            reason = "건축물대장 응답에 위반건축물 표기 정보가 없어요." if b.ok else "건축물대장을 조회하지 못했어요."
            ev = [_data_evidence(b, "위반건축물 표기 정보 없음")] if b.ok else []
        return ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], title=render_title(spec, v) or reason,
                          verdict=v, decided_by="rule", ai_fallback=fallback, reason=reason, evidence=ev)

    if violation is None:
        return rule_card(False)  # 읽을 표기가 없다 (AI가 추측하지 않는다)
    try:
        j = llm.parse(step="judge_violation", tier="main", system=prompt.VIOLATION_SYSTEM,
                      user=prompt.VIOLATION_USER.format(violation=json.dumps(violation)), schema=ViolationJudgment)
    except LLMError:
        return rule_card(True)
    expected = "high" if violation else "ok"
    verdict, reason = j.verdict, j.reason
    if verdict != expected:  # 표기 값과 다른 판정은 쓰지 않는다
        verdict, reason = expected, rule_card(False).reason
    ev = [_data_evidence(b, "위반건축물 표기 있음" if violation else "위반건축물 표기 없음")]
    return ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], decided_by="ai", verdict=verdict,
                      title=j.title if verdict == j.verdict else (render_title(spec, verdict) or j.title),
                      reason=reason, evidence=ev)
