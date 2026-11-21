"""법령 적용 조건 규칙 엔진: 가게 정보가 조문의 적용 요건에 맞는지 코드로 판정한다 (AI가 정하지 않는다).

결과는 내부 상태다. 화면의 판정값(위반 소지 높음·확인 권장·판단 불가·문제 없음)과는 별개이고,
어떤 조문을 읽고 어떤 카드를 만들지 정하는 데 쓴다.
- applies: 필요한 조건이 모두 충족됨
- not_applicable: 적용 요건에 해당하지 않음이 확인됨
- needs_check: 입력이 부족하거나 예외가 걸릴 수 있어 확인이 필요함
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

APPLIES, NOT_APPLICABLE, NEEDS_CHECK = "applies", "not_applicable", "needs_check"

INPUT_LABELS = {
    "business_type": "신고 업종", "area_sqm": "영업장 면적", "floor": "층수", "has_employees": "직원 고용 여부",
    "sells_alcohol": "주류 판매 여부", "uses_terrace": "테라스·옥외 영업 여부", "does_delivery": "배달 여부",
}


@dataclass
class RuleOutcome:
    rule_id: str
    title: str
    status: str
    reason: str
    check_id: str | None = None
    law_name: str | None = None
    article_label: str | None = None
    required_action: str | None = None
    missing_inputs: list[str] = field(default_factory=list)


def floor_from_detail(detail: str | None) -> int | None:
    """'1층' → 1, '지하 1층'·'B1' → -1. 층을 읽을 수 없으면 None (아는 척하지 않는다)."""
    text = (detail or "").strip()
    if not text:
        return None
    match = re.search(r"(?:지하|B)\s*(\d+)", text, re.I)
    if match:
        return -int(match.group(1))
    match = re.search(r"(\d+)\s*층", text)
    return int(match.group(1)) if match else None


def facts_of(store, business_type: str | None) -> dict:
    """규칙이 보는 값. 모르는 값은 None 으로 둔다."""
    answers = store.answers or {}
    area = getattr(store, "area_sqm", None)
    return {
        "business_type": business_type,
        "area_sqm": float(area) if area is not None else None,
        "floor": floor_from_detail(getattr(store, "address_detail", None)),
        "has_employees": answers.get("has_employees"),
        "sells_alcohol": answers.get("sells_alcohol"),
        "uses_terrace": answers.get("uses_terrace"),
        "does_delivery": answers.get("does_delivery"),
    }


def _matches(condition, value) -> bool:
    """condition: 값 목록, {min,max}, {in:[…]}, {not_in:[…]}, 또는 true/false."""
    if isinstance(condition, bool):
        return bool(value) is condition
    if isinstance(condition, list):
        return value in condition
    if isinstance(condition, dict):
        if "min" in condition and not value >= condition["min"]:
            return False
        if "max" in condition and not value <= condition["max"]:
            return False
        if "in" in condition and value not in condition["in"]:
            return False
        if "not_in" in condition and value in condition["not_in"]:
            return False
        return True
    return value == condition


def evaluate_rule(rule: dict, facts: dict) -> RuleOutcome:
    law = rule.get("law") or {}
    base = dict(rule_id=rule["rule_id"], title=rule["title"], check_id=rule.get("check_id"),
                law_name=law.get("law_name"), article_label=law.get("label"),
                required_action=rule.get("required_action"))

    missing: list[str] = []
    for key, condition in (rule.get("conditions") or {}).items():
        value = facts.get(key)
        if value is None:
            missing.append(key)
        elif not _matches(condition, value):
            label = INPUT_LABELS.get(key, key)
            return RuleOutcome(**base, status=NOT_APPLICABLE, reason=f"{label} 조건이 이 규정의 적용 대상이 아니에요.")
    if missing:
        names = ", ".join(INPUT_LABELS.get(k, k) for k in missing)
        return RuleOutcome(**base, status=NEEDS_CHECK, missing_inputs=missing,
                           reason=f"{names}을(를) 알면 적용 여부를 판단할 수 있어요.")

    for exception in rule.get("exceptions") or []:
        when = exception.get("when") or {}
        if when and all(facts.get(k) is not None and _matches(c, facts[k]) for k, c in when.items()):
            return RuleOutcome(**base, status=NEEDS_CHECK, reason=exception.get("note") or "예외에 해당할 수 있어 확인이 필요해요.")
    return RuleOutcome(**base, status=APPLIES, reason=rule.get("applies_reason") or "이 가게 조건에 적용돼요.")


def evaluate_rules(pack: dict, store, business_type: str | None) -> list[RuleOutcome]:
    facts = facts_of(store, business_type)
    return [evaluate_rule(rule, facts) for rule in pack.get("applicability_rules") or []]
