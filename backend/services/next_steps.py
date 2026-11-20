"""다음으로 할 일 (DB 명세서 5-5). 코드가 정렬하고 최대 5개. 저장하지 않는다."""

from typing import Any

VERDICT_ORDER = {"high": 0, "low": 1, "unknown": 2, "ok": 3}
MAX_STEPS = 5
MAX_TASKS = 2


def _mmdd(d) -> str:
    return d.strftime("%m.%d")


def is_pending_decision(card: Any) -> bool:
    return bool(card.options) and card.chosen_option is None


def recommended_label(card: Any) -> str | None:
    rec = card.recommendation or {}
    return next((o.get("label") for o in card.options or [] if o.get("option_id") == rec.get("option_id")), None)


def current_user_action(card: Any) -> dict | None:
    """선택한 선택지에 user_action 이 있으면 그것, 없으면 카드 기본 값 (foundy curAction)."""
    if card.chosen_option:
        opt = next((o for o in card.options or [] if o.get("option_id") == card.chosen_option), None)
        if opt and opt.get("user_action"):
            return opt["user_action"]
    return card.user_action


def next_steps(cards: list[Any], items: list[Any], excl: str | None = None, hidden: set[str] | frozenset = frozenset()) -> list[dict]:
    steps: list[dict] = []
    new_keys = set()

    # 1. 이 카드의 선택으로 새로 생긴 할 일
    if excl:
        for item in sorted((i for i in items if i.origin_item_key == excl and not i.done), key=lambda i: i.due_date):
            new_keys.add(item.item_key)
            steps.append({"kind": "new", "title": item.task,
                          "sub": f"이 선택으로 새로 생긴 할 일 · 예정 {_mmdd(item.due_date)}",
                          "go": {"page": "checklist", "item_id": item.item_key}})

    others = [c for c in cards if c.item_key != excl]

    # 2. 결정하기 (high 먼저)
    for card in sorted((c for c in others if is_pending_decision(c)),
                       key=lambda c: (VERDICT_ORDER.get(c.verdict, 9), c.item_key)):
        label = recommended_label(card)
        steps.append({"kind": "decide", "title": f"결정하기 · {card.title}",
                      "sub": f"추천: {label}" if label else "선택지를 골라 주세요",
                      "go": {"page": "report", "item_id": card.item_key}})

    # 3. 직접 할 일 (선택을 마쳤거나 선택지가 없고 아직 pending)
    for card in sorted(others, key=lambda c: (VERDICT_ORDER.get(c.verdict, 9), c.item_key)):
        action = current_user_action(card)
        if is_pending_decision(card) or card.action_status != "pending" or not action:
            continue
        est = action.get("est_minutes")
        steps.append({"kind": "do", "title": action["text"], "sub": f"약 {est}분" if est else "",
                      "go": {"page": "report", "item_id": card.item_key}})

    # 4. 가장 가까운 체크리스트 2개
    todo = sorted((i for i in items if not i.done and i.item_key not in new_keys and i.category not in hidden),
                  key=lambda i: (i.due_date, i.item_key))
    for item in todo[:MAX_TASKS]:
        sub = f"예정 {_mmdd(item.due_date)}" + (f" · {item.agency}" if item.agency else "")
        steps.append({"kind": "task", "title": item.task, "sub": sub,
                      "go": {"page": "checklist", "item_id": item.item_key}})

    return steps[:MAX_STEPS]
