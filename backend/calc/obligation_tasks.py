"""법령 분석 결과 → 체크리스트 작업 (코드가 한다. AI 아님).

흐름: 규칙 엔진이 가게 정보로 적용 여부를 판정(RuleOutcome)한 뒤, 적용·확인 필요인 규칙만 실행 가능한 작업으로 바꾼다.
- 조문이 검색됐다는 것만으로는 작업을 만들지 않는다. 적용 요건을 통과한 규칙(applies)과, 입력이 부족해 확인이 필요한 규칙(needs_check)만 쓴다.
- 규칙 묶음의 task 가 template 이면 기본 체크리스트 항목을 법적 의무로 격상하고, 없으면 새 작업을 만든다.
- 날짜: due_date 는 권장 준비일(개업일 + offset_days)이다. 법령이 개업 전 기한을 정한 규칙(statutory)만 statutory_deadline 을 따로 적는다.
- 근거: 점검 카드가 검증해 인용한 조문(Evidence)이 있으면 legal_analysis, 규칙만으로 만들었으면 rule_engine 이다.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from agent.schemas import ChecklistItem, Contact, Evidence
from rules.applicability import APPLIES, INPUT_LABELS, NEEDS_CHECK, RuleOutcome
from rules.engine import contact_of, documents_of

PRIORITY_ORDER = {"high": 0, "normal": 1, "low": 2}


def _law_evidence(items: list[Any], check_id: str | None, law_name: str | None, article: str | None) -> list[Evidence]:
    """점검 카드가 검증해 인용한 조문. 같은 법령의 조문만 쓰고, 같은 조문이 있으면 그것을 먼저 둔다."""
    if not check_id or not law_name:
        return []
    found = [e for card in items if card.check_id == check_id for e in card.evidence
             if e.type == "law" and e.law_name == law_name and not e.from_mock]
    return sorted(found, key=lambda e: (article is not None and (e.article or "") != article))


def task_type_of(spec: dict, rule: dict, outcome: RuleOutcome) -> str:
    """필수 / 조건부 / 권장. 규칙 묶음이 정했으면 그 값, 아니면 적용 여부와 조건으로 정한다."""
    if spec.get("task_type"):
        return spec["task_type"]
    if outcome.status == NEEDS_CHECK:
        return "conditional"  # 입력이 부족하거나 예외가 걸려 적용 여부를 확인해야 한다
    store_specific = set((rule.get("conditions") or {})) - {"business_type"}
    return "conditional" if store_specific else "legal_obligation"


def _fact_text(key: str, value: Any, condition: Any) -> str:
    label = INPUT_LABELS.get(key, key)
    if key == "area_sqm":
        shown = f"{value:g}㎡"
        if isinstance(condition, dict) and "min" in condition:
            return f"{label} {shown} (기준 {condition['min']:g}㎡ 이상)"
        if isinstance(condition, dict) and "max" in condition:
            return f"{label} {shown} (기준 {condition['max']:g}㎡ 이하)"
        return f"{label} {shown}"
    if isinstance(value, bool):
        return f"{label}: {'예' if value else '아니요'}"
    if key == "floor":
        return f"{label} {value}층" if value > 0 else f"{label} 지하 {abs(value)}층"
    return f"{label} {value}"


def reason_of(rule: dict, outcome: RuleOutcome, facts: dict) -> str:
    """왜 이 작업이 필요한지. 적용이면 규칙 조건과 가게 값으로, 확인 필요이면 엔진이 설명한 이유 그대로 쓴다."""
    if outcome.status == NEEDS_CHECK:
        return outcome.reason + (f" (확인할 입력: {', '.join(outcome.missing_inputs)})" if outcome.missing_inputs else "")
    parts = [_fact_text(k, facts[k], cond) for k, cond in (rule.get("conditions") or {}).items() if facts.get(k) is not None]
    return ("이 가게가 " + " · ".join(parts) + " 조건에 해당해 적용돼요.") if parts else outcome.reason


def _sources(rule: dict, outcome: RuleOutcome, evidence: list[Evidence], card_id: str | None,
             template: str | None) -> list[dict]:
    out: list[dict] = []
    if template:
        out.append({"type": "template", "id": template})
    out.append({"type": "rule", "rule_id": outcome.rule_id, "review_status": rule.get("review_status", "draft")})
    law = {"type": "law", "law_name": outcome.law_name, "article": outcome.article_label}
    out.append({**law, "url": evidence[0].url} if evidence and evidence[0].url else law)
    if outcome.check_id:
        out.append({"type": "inspection", "check_id": outcome.check_id, "item_id": card_id})
    return out


def apply_obligations(
    pack: dict, outcomes: list[RuleOutcome], checklist: list[ChecklistItem], cards: list[Any],
    card_of: dict[str, str], calc: Any, opening_date: date, sigungu: str | None = None, facts: dict | None = None,
) -> list[ChecklistItem]:
    """기본 체크리스트에 법적 의무·조건부 작업을 합친다. 적용되지 않는 규칙은 아무것도 하지 않는다."""
    rules = {r["rule_id"]: r for r in pack.get("applicability_rules") or []}
    facts = facts or {}
    out = list(checklist)
    for outcome in outcomes:
        rule = rules.get(outcome.rule_id) or {}
        spec = rule.get("task")
        if not spec or outcome.status not in (APPLIES, NEEDS_CHECK):
            continue
        evidence = _law_evidence(cards, outcome.check_id, outcome.law_name, outcome.article_label)
        law_basis = {"law_name": outcome.law_name, "article": outcome.article_label,
                     "url": next((e.url for e in evidence if e.url), None)}
        card_id = card_of.get(outcome.check_id) if outcome.check_id else None
        reason = reason_of(rule, outcome, facts)
        common = dict(
            task_type=task_type_of(spec, rule, outcome), priority=spec.get("priority", "normal"), reason=reason,
            law_basis=law_basis, obligation_rule_id=outcome.rule_id,
            sources=_sources(rule, outcome, evidence, card_id, spec.get("template")))
        statutory = spec.get("statutory")
        if statutory:  # 법령이 개업 전 기한을 정한 경우만. 개업일 전날까지로 둔다
            common.update(statutory_deadline=opening_date - timedelta(days=1), statutory_basis=statutory["basis"])
        if spec.get("template"):
            idx = next((i for i, c in enumerate(out) if c.rule_key == spec["template"]), None)
            if idx is None:
                continue  # 기본 항목이 이 가게에 숨겨져 있으면(예: 직원 없음) 만들지 않는다
            base = out[idx]
            merged = [*base.evidence, *evidence]
            out[idx] = base.model_copy(update={**common, "evidence": merged})  # 점검 카드 연결은 report_links 가 정한다
            continue
        if any(c.item_id == spec["id"] for c in out):
            continue
        d = calc.checklist_dates(opening_date, spec["offset_days"])
        contact = contact_of(pack, spec.get("contact"), sigungu)
        out.append(ChecklistItem(
            item_id=spec["id"], rule_key=spec["id"], task=spec["task"], category=spec["category"],
            due_date=d["due_date"], dday=d["dday"], group_label=spec["group"], agency=spec.get("agency"),
            contact=Contact(**contact) if contact else None, source="rule",
            source_type="legal_analysis" if evidence else "rule_engine",
            deadline_type="after_opening" if spec["offset_days"] > 0 else "before_opening",
            documents=[], evidence=list(evidence), report_item_ids=[card_id] if card_id else [], **common))
    return out


def counts_by_type(items: list[Any]) -> dict[str, int]:
    out = {"legal_obligation": 0, "conditional": 0, "preparation": 0}
    for i in items:
        out[i.task_type] = out.get(i.task_type, 0) + 1
    return out
