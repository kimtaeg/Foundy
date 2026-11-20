"""다음으로 할 일 선택·정렬 (코드가 한다. AI 아님). 최대 5개.

순서: 이번 선택으로 새로 생긴 할 일 → 아직 결정하지 않은 카드(위반 소지 높음 먼저) →
다른 카드의 직접 할 일 → 아직 끝내지 않은 체크리스트 중 기한이 빠른 2개.
"""

from __future__ import annotations

from datetime import date

from agent.schemas import ChecklistItem, NextStep, ReportItem

MAX_STEPS = 5


def _short(item: ReportItem) -> str:
    return item.title


def next_steps(
    pack: dict, items: list[ReportItem], checklist: list[ChecklistItem], excl: str | None = None,
) -> list[NextStep]:
    """excl: 방금 실행·완료한 카드 id. 그 카드의 선택으로 생긴 체크리스트 항목(origin_item_id)이 맨 앞에 온다."""
    out: list[NextStep] = []
    new_ids = {c.item_id for c in checklist if excl and c.origin_item_id == excl and not c.done}
    for c in checklist:
        if c.item_id in new_ids:
            out.append(NextStep(kind="new", title=c.task, sub=f"이 선택으로 새로 생긴 할 일 · 예정 {c.due_date:%m.%d}",
                                go={"page": "checklist", "item_id": c.item_id}))
    pending = [i for i in items if i.item_id != excl and i.options and not i.chosen_option]
    for i in sorted(pending, key=lambda x: x.verdict != "high"):
        rec = next((o for o in i.options if i.recommendation and o.option_id == i.recommendation.option_id), None)
        out.append(NextStep(kind="decide", title=f"결정하기 · {_short(i)}",
                            sub=f"추천: {rec.label}" if rec else "선택지를 비교해 하나를 고르세요",
                            go={"page": "report", "item_id": i.item_id}))
    for i in items:
        if i.item_id == excl or not i.user_action or i.action_status != "pending":
            continue
        if i.options and not i.chosen_option:
            continue  # 결정부터 해야 하는 카드는 위에서 다룬다
        if i.verdict == "ok":
            continue
        minutes = f" ({i.user_action.est_minutes}분)" if i.user_action.est_minutes else ""
        out.append(NextStep(kind="do", title=f"{i.user_action.text}{minutes}", sub=f"결과 카드 · {_short(i)}",
                            go={"page": "report", "item_id": i.item_id}))
    todo = sorted((c for c in checklist if not c.done and c.item_id not in new_ids), key=lambda c: c.due_date or date.max)
    for c in todo[:2]:
        phone = f" ☎ {c.contact.phone}{' (예시)' if c.contact.is_example else ''}" if c.contact and c.contact.phone else ""
        out.append(NextStep(kind="task", title=c.task,
                            sub=f"체크리스트 · 예정 {c.due_date:%m.%d} · {c.agency or ''}{phone}",
                            go={"page": "checklist", "item_id": c.item_id}))
    return out[:MAX_STEPS]
