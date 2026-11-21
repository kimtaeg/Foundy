"""법령 적용 판정: 규칙 엔진의 결과를 바탕으로, AI가 조문 원문을 읽고 이 가게에 적용되는지 다시 판정한다.

- 규칙 엔진(`rules/applicability.py`)의 결과는 안전장치다. AI가 실패하거나 근거를 검증하지 못하면 그 결과를 쓴다.
- AI가 인용한 조문 key와 문장이 조회한 원문에 실제로 있어야 `applies`·`not_applicable`을 받아들인다.
- 조문이 규칙보다 우선이다. 조문 원문으로 검증된 AI 판정은 규칙 엔진 결과와 달라도 따른다 (입력이 비어 있어도 조문이 단정하면 단정한다).
- 조문을 읽을 수 없는 규정(조회 실패·연결된 조문 점검 없음)은 규칙 엔진 결과를 그대로 쓴다.
"""

from __future__ import annotations

import json
import re
from dataclasses import replace
from typing import Literal

from pydantic import BaseModel, Field

from agent.llm import LLM, LLMError
from agent.ports import ToolResult
from agent.prompts import judge as prompt
from rules.applicability import INPUT_LABELS, NEEDS_CHECK, RuleOutcome

MAX_ARTICLE_CHARS = 2500
AI_NOTE = "AI가 조문을 읽고 판단했어요. "


class RuleJudgment(BaseModel):
    rule_id: str
    status: Literal["applies", "not_applicable", "needs_check"]
    reason: str
    missing_inputs: list[str] = Field(default_factory=list)
    cited: list[str] = Field(default_factory=list)
    quote: str = ""


class ApplicabilityJudgment(BaseModel):
    rules: list[RuleJudgment]


def _squash(text: str) -> str:
    return "".join((text or "").split())


def _quote_in(quote: str, text: str) -> bool:
    """인용문이 원문에 있는지. AI가 길이를 줄이려 넣은 말줄임(…, ...)으로 나뉜 조각은 각각 원문에 순서대로 있어야 한다."""
    pieces = [_squash(p) for p in re.split(r"…|\.{2,}|⋯", quote)]
    haystack, pos = _squash(text), 0
    pieces = [p for p in pieces if len(p) >= 6]  # 너무 짧은 조각은 근거가 되지 못한다
    if not pieces:
        return False
    for piece in pieces:
        found = haystack.find(piece, pos)
        if found < 0:
            return False
        pos = found + len(piece)
    return True


def _articles(res: ToolResult | None) -> dict[str, dict]:
    if res is None or not res.ok:
        return {}
    arts = (res.data or {}).get("articles", [])
    return {f"{a.get('law_name')} {a.get('article')}": a for a in arts if a.get("text")}


def refine_obligations(
    llm: LLM, pack: dict, store, business_type: str | None, baseline: list[RuleOutcome],
    laws: dict[str, ToolResult], facts: dict,
) -> list[RuleOutcome]:
    """규칙 엔진 결과(baseline)를 AI 판정으로 바꾼 결과. 순서·개수는 baseline 과 같다."""
    rules_by_id = {r["rule_id"]: r for r in pack.get("applicability_rules") or []}
    shown, by_rule = [], {}
    for outcome in baseline:
        rule = rules_by_id.get(outcome.rule_id) or {}
        arts = _articles(laws.get(outcome.check_id)) if outcome.check_id else {}
        if not arts:
            continue  # 읽을 조문이 없으면 AI가 판단할 근거가 없다
        by_rule[outcome.rule_id] = arts
        shown.append({
            "rule_id": outcome.rule_id, "title": outcome.title, "law": f"{outcome.law_name} {outcome.article_label}",
            "required_action": outcome.required_action,
            "articles": [{"key": k, "text": (a.get("text") or "")[:MAX_ARTICLE_CHARS]} for k, a in arts.items()],
        })
    if not shown:
        return baseline
    try:
        j = llm.parse(
            step="judge_applicability", tier="main", system=prompt.APPLICABILITY_SYSTEM, schema=ApplicabilityJudgment,
            user=prompt.APPLICABILITY_USER.format(
                business_type=business_type or "[확인 필요]", store=json.dumps(facts, ensure_ascii=False),
                rules=json.dumps(shown, ensure_ascii=False)))
    except LLMError:
        return baseline

    judged = {r.rule_id: r for r in j.rules}
    out: list[RuleOutcome] = []
    for outcome in baseline:
        verdict = judged.get(outcome.rule_id)
        arts = by_rule.get(outcome.rule_id)
        out.append(_merge(outcome, verdict, arts) if verdict and arts else outcome)
    return out


def _merge(outcome: RuleOutcome, ai: RuleJudgment, arts: dict[str, dict]) -> RuleOutcome:
    reason = AI_NOTE + ai.reason.strip()
    if ai.status == NEEDS_CHECK:
        # 화면에 입력 항목으로 보여 줄 수 있는 키만 받는다 (AI가 지어낸 이름은 버린다)
        missing = [k for k in dict.fromkeys(ai.missing_inputs + outcome.missing_inputs) if k in INPUT_LABELS]
        return replace(outcome, status=NEEDS_CHECK, reason=reason, missing_inputs=missing)

    # 단정(applies·not_applicable)은 인용한 문장이 원문에 실제로 있을 때만 받아들인다
    verified = any(k in arts and _quote_in(ai.quote, arts[k].get("text") or "") for k in ai.cited)
    if not verified:
        return outcome
    return replace(outcome, status=ai.status, reason=reason, missing_inputs=[])
