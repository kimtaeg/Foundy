"""선택지 적용 (POST /choose, 코드가 한다. AI 아님).

선택지의 apply를 그대로 실행한다: 가게 값 효과(applied_effects)를 카드에 붙이고,
체크리스트에 새로 생기는 항목(adds_checklist)을 만든다. 가게 원본(stores)은 고치지 않는다.
"""

from __future__ import annotations

from datetime import date

from agent.ports import Calc
from agent.schemas import ChecklistItem, Contact, Document, ReportItem
from rules.engine import contact_of, documents_of

from .impacts import drop_derived, reset_card


def _effects(payload: dict) -> dict:
    """update_store payload에서 유효 값에 덧씌울 효과만 뽑는다 (허용: sells_alcohol, name)."""
    out: dict = {}
    answers = payload.get("answers") or {}
    if "sells_alcohol" in answers:
        out["sells_alcohol"] = bool(answers["sells_alcohol"])
    if payload.get("name"):
        out["name"] = str(payload["name"])
    return out


def effective_store(store, items: list[ReportItem]):
    """가게 원본 + 선택된 카드들의 효과. 카드를 초기화하면 원본으로 돌아간다."""
    answers = dict(store.answers)
    name = store.name
    for i in items:
        if not i.chosen_option:
            continue
        if "sells_alcohol" in i.applied_effects:
            answers["sells_alcohol"] = i.applied_effects["sells_alcohol"]
        if "name" in i.applied_effects:
            name = i.applied_effects["name"]
    return store.model_copy(update={"answers": answers, "name": name})


def _extra_item(
    pack: dict, task_id: str, origin: ReportItem, option_id: str, opening: date, calc: Calc, sigungu: str | None,
) -> ChecklistItem:
    t = next(t for t in pack["extra_tasks"] if t["id"] == task_id)
    d = calc.checklist_dates(opening, t["offset_days"])
    contact = contact_of(pack, t.get("contact"), sigungu)
    return ChecklistItem(
        item_id=task_id, rule_key=task_id, task=t["task"], category=t["category"], group_label=t["group"],
        due_date=d["due_date"], dday=d["dday"], agency=t.get("agency"),
        contact=Contact(**contact) if contact else None,
        documents=[Document(**doc) for doc in documents_of(pack, task_id, sigungu)], source="report",
        report_item_ids=[origin.item_id], origin_item_id=origin.item_id, origin_option=option_id)


def apply_choice(
    pack: dict, items: list[ReportItem], checklist: list[ChecklistItem], item_id: str, option_id: str,
    opening: date, calc: Calc, sigungu: str | None = None,
) -> tuple[list[ReportItem], list[ChecklistItem], dict]:
    """선택을 적용한 (카드 목록, 체크리스트, 응답용 요약). 이미 다른 선택이 있으면 먼저 되돌린다."""
    card = next((i for i in items if i.item_id == item_id), None)
    option = next((o for o in (card.options if card else []) if o.option_id == option_id), None)
    if not card or not option:
        raise ValueError("없는 카드 또는 선택지")
    if card.chosen_option:
        items, checklist = clear_choice(items, checklist, item_id)
        card = next(i for i in items if i.item_id == item_id)
    new_tasks = [_extra_item(pack, t, card, option_id, opening, calc, sigungu) for t in option.apply.adds_checklist
                 if not any(c.item_id == t for c in checklist)]
    effects = _effects(option.apply.payload) if option.apply.type == "update_store" else {}
    changes = [f"체크리스트에 추가: {c.task}" for c in new_tasks]
    updated = card.model_copy(update={
        "chosen_option": option_id, "action_status": "pending", "applied_effects": effects,
        "applied_changes": changes,
        "added_to_checklist": card.added_to_checklist + [c.item_id for c in new_tasks]})
    items = [updated if i.item_id == item_id else i for i in items]
    summary = {"item_id": item_id, "chosen_option": option_id, "added_checklist": [c.item_id for c in new_tasks],
               "applied_effects": effects, "needs_reanalyze": option.apply.needs_reanalyze}
    return items, checklist + new_tasks, summary


def clear_choice(
    items: list[ReportItem], checklist: list[ChecklistItem], item_id: str,
) -> tuple[list[ReportItem], list[ChecklistItem]]:
    """선택 되돌리기: 카드 상태와 그 선택으로 생긴 체크리스트 항목을 지운다."""
    dropped = {c.item_id for c in checklist if c.origin_item_id == item_id}
    items = [reset_card(i).model_copy(update={"added_to_checklist": [x for x in i.added_to_checklist if x not in dropped]})
             if i.item_id == item_id else i for i in items]
    return items, drop_derived(checklist, {item_id})
