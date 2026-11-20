"""점검 카드 상태 변경 (DB 명세서 4-2 ~ 4-4). 호출하는 쪽이 한 트랜잭션으로 커밋한다."""

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from db.models import Alert, ChecklistItem, ReportItem, Store
from services.effective import EFFECT_KEYS, effective_store, effects_from_apply
from services.links import sync_links
from services.next_steps import VERDICT_ORDER, is_pending_decision, next_steps
from services.pack import extra_task, hidden_categories
from services.timeutil import now_utc

FIELD_LABELS = {"sells_alcohol": "주류 판매", "name": "가게 이름"}


class InvalidInput(Exception):
    pass


def current_verdict(card: Any) -> str:
    """선택했고 선택지에 apply.verdict 가 있으면 그 값, 아니면 저장된 판정 (DB 명세서 2-4 ev)."""
    if card.chosen_option:
        opt = find_option(card, card.chosen_option)
        verdict = ((opt or {}).get("apply") or {}).get("verdict")
        if verdict in VERDICT_ORDER:
            return verdict
    return card.verdict


def find_option(card: Any, option_id: str) -> dict | None:
    return next((o for o in card.options or [] if o.get("option_id") == option_id), None)


def load_state(session: Session, store: Store) -> tuple[list[ReportItem], list[ChecklistItem]]:
    cards = list(session.scalars(select(ReportItem).where(ReportItem.store_id == store.id).order_by(ReportItem.item_key)))
    items = list(session.scalars(select(ChecklistItem).where(ChecklistItem.store_id == store.id).order_by(ChecklistItem.item_key)))
    return cards, items


def decision_alert(store: Store, card: ReportItem) -> Alert:
    return Alert(
        store_id=store.id,
        dedupe_key=f"dec-{card.item_key}",
        type="decision",
        title=card.title,
        body=(card.user_action or {}).get("text"),
        cta={"label": "카드 열기", "page": "report", "item_id": card.item_key},
        is_example=store.is_demo,
    )


def _delete_alerts(session: Session, store: Store, *keys: str) -> None:
    session.execute(delete(Alert).where(Alert.store_id == store.id, Alert.dedupe_key.in_(keys)))


def reset_card(session: Session, store: Store, card: ReportItem, items: list[ChecklistItem]) -> list[ChecklistItem]:
    """카드 상태 비우기 (4-4). 남은 체크리스트 목록을 돌려준다. 자동 체크 동기화는 호출하는 쪽이 한다."""
    card.chosen_option = None
    card.chosen_at = None
    card.action_status = "pending"
    card.action_reply = None
    card.action_updated_at = None
    card.verdict_before = None
    card.resolved_title = None
    card.applied_effects = {}
    card.applied_changes = []
    for item in [i for i in items if i.source == "report" and i.origin_item_key == card.item_key]:
        session.delete(item)
    items = [i for i in items if not (i.source == "report" and i.origin_item_key == card.item_key)]
    _delete_alerts(session, store, f"next-{card.item_key}", f"dec-{card.item_key}")
    session.flush()
    if card.options:
        session.add(decision_alert(store, card))
    return items


@dataclass
class ChooseResult:
    applied: list[str] = field(default_factory=list)
    added_checklist: list[str] = field(default_factory=list)
    applied_changes: list[str] = field(default_factory=list)
    # 이전 선택을 비우기 전 ↔ 새 선택을 적용한 후 유효 값이 달라진 가게 값 (재분석 범위를 정한다)
    changed_fields: list[str] = field(default_factory=list)


def validate_option(card: ReportItem, option_id: str) -> dict:
    option = find_option(card, option_id)
    if option is None:
        raise InvalidInput(f"선택지 {option_id} 가 이 카드에 없습니다.")
    return option


def choose(session: Session, pack: dict, store: Store, card: ReportItem, option_id: str) -> ChooseResult:
    option = validate_option(card, option_id)
    cards, items = load_state(session, store)
    # 이전 선택의 효과가 사라지는 것도 변화이므로 초기화 전에 유효 값을 잡는다
    before = effective_store(pack, store, cards)
    if card.chosen_option is not None:
        items = reset_card(session, store, card, items)

    apply = option.get("apply") or {}
    effects = effects_from_apply(apply)
    now = now_utc()

    old_verdict = current_verdict(card)
    card.chosen_option = option_id
    card.chosen_at = now
    card.applied_effects = effects
    card.action_status = "pending"
    new_verdict = current_verdict(card)
    card.verdict_before = old_verdict if new_verdict != old_verdict else None
    card.resolved_title = apply.get("resolved_title")
    after = effective_store(pack, store, cards)

    changed_fields = [k for k in EFFECT_KEYS if before.get(k) != after.get(k)]
    changes = []
    for key in changed_fields:
        if before.get(key) != after.get(key):
            changes.append(f"{FIELD_LABELS.get(key, key)}: {_fmt(before.get(key))} → {_fmt(after.get(key))}")
    if before.get("business_type") != after.get("business_type"):
        changes.append(f"신고 업종: {before.get('business_type')} → {after.get('business_type')} (규칙)")

    existing = {i.item_key for i in items}
    added = []
    for key in apply.get("adds_checklist") or []:
        spec = extra_task(pack, key)
        if spec is None or key in existing:
            continue
        item = ChecklistItem(
            store_id=store.id, item_key=key, rule_key=key, source="report", task=spec["task"], category=spec["category"],
            group_label=spec["group"], offset_days=spec["offset_days"], contact_key=spec.get("contact"),
            due_date=store.opening_date + timedelta(days=spec["offset_days"]), agency=spec.get("agency"),
            origin_item_key=card.item_key, origin_option=option_id, evidence=[], done=False, auto_checked=False,
        )
        session.add(item)
        items.append(item)
        added.append(key)
        changes.append(f"체크리스트에 추가: {spec['task']}")
    if card.verdict_before:
        changes.append(f"판정 변경: {card.verdict_before} → {new_verdict}")
    if not changes:
        changes.append(f"선택을 기록했어요: {option.get('label', option_id)}")
    card.applied_changes = changes

    session.flush()  # reset_card 가 다시 만든 decision 알림까지 반영한 뒤 지운다
    _delete_alerts(session, store, f"dec-{card.item_key}")
    sync_links(pack, cards, items, now)
    session.flush()
    return ChooseResult(
        applied=[k for k in effects if before.get(k) != after.get(k)],
        added_checklist=added,
        applied_changes=changes,
        changed_fields=changed_fields,
    )


def _fmt(value: Any) -> str:
    if value is True:
        return "예"
    if value is False:
        return "아니요"
    return str(value)


def set_action(session: Session, pack: dict, store: Store, card: ReportItem, status: str, reply: str | None) -> tuple[list[str], list[dict]]:
    """할 일 진행 상태 (4-3). (자동 체크된 item_key 목록, next_steps) 를 돌려준다."""
    now = now_utc()
    card.action_status = status
    if reply is not None:
        card.action_reply = reply
    card.action_updated_at = now

    cards, items = load_state(session, store)
    auto_checked = sync_links(pack, cards, items, now)
    eff = effective_store(pack, store, cards)
    hidden = {h["category"] for h in hidden_categories(pack, eff)}
    steps = next_steps(cards, items, excl=card.item_key, hidden=hidden)

    _delete_alerts(session, store, f"next-{card.item_key}")
    if status == "done":
        _delete_alerts(session, store, f"dec-{card.item_key}")
    session.flush()
    if status in ("sent", "done"):
        n = len(steps)
        head = f"“{card.title}” 완료 · 다음 할 일 {n}개" if status == "done" else f"“{card.title}” 문의함 · 먼저 할 일 {n}개"
        body = " → ".join(s["title"] for s in steps[:3]) or "모든 점검을 마쳤어요"
        session.add(Alert(store_id=store.id, dedupe_key=f"next-{card.item_key}", type="next", title=head, body=body,
                          cta={"label": "카드 열기", "page": "report", "item_id": card.item_key}, is_example=False))
    elif status == "pending" and is_pending_decision(card):
        # 결정 대기로 돌아가면 decision 알림을 다시 둔다
        _delete_alerts(session, store, f"dec-{card.item_key}")
        session.flush()
        session.add(decision_alert(store, card))
    session.flush()
    return auto_checked, steps


def set_checklist_done(item: ChecklistItem, done: bool) -> None:
    """사용자가 직접 체크 (4-4a). 자동 해제 대상이 아니다."""
    item.done = done
    item.done_at = now_utc() if done else None
    item.auto_checked = False
