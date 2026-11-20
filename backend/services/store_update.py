"""마이페이지 가게 정보 수정 (DB 명세서 4-5, API 명세서 3장 PATCH /stores).

영향 범위는 규칙 묶음의 impacts 표로 코드가 정한다 (AI 아님).
저장 전 미리보기(dry_run)와 실제 저장은 같은 plan_update 결과를 쓴다.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from db.models import Alert, ChangeLog, ChecklistItem, ReportItem, Store
from rules.engine import impact_of
from services.analysis import reanalysis_scope
from services.cards import find_option, reset_card
from services.effective import STORE_KEYS, effective_store
from services.links import sync_links
from services.pack import business_type
from services.timeutil import now_utc

# 규칙 묶음 impacts 키 → API 필드 이름 (answers.* 는 요청 본문의 answers 안에 온다)
API_FIELDS = {
    "name": "name",
    "business_type_input": "business_type_input",
    "address": "address",
    "address_detail": "address_detail",
    "opening_date": "opening_date",
    "owner_birth_year": "owner_birth_year",
    "sells_alcohol": "answers.sells_alcohol",
    "uses_terrace": "answers.uses_terrace",
    "has_employees": "answers.has_employees",
    "funds_krw": "answers.funds_krw",
}
LABELS = {
    "name": "가게 이름", "business_type_input": "업종", "address": "주소", "address_detail": "층·호수",
    "opening_date": "개업일", "owner_birth_year": "출생 연도", "sells_alcohol": "주류 판매",
    "uses_terrace": "테라스 사용", "has_employees": "직원 고용", "funds_krw": "준비 자금",
}
STEP_LABELS = {"building": "건축물대장", "law": "조문", "trademark": "상표", "checklist": "체크리스트"}
KEEP_CHANGES = 10  # 변경 기록·change 알림은 최근 10건만 둔다


@dataclass
class Change:
    field: str  # 규칙 묶음 키
    before: Any
    after: Any


@dataclass
class UpdatePlan:
    changes: list[Change]
    impacts: list[str]
    reset_cards: list[ReportItem]
    scope: list[str]  # 재분석 범위. 비면 재분석하지 않는다
    recomputed: list[str]
    lines: list[str] = field(default_factory=list)

    @property
    def fields(self) -> list[str]:
        return [c.field for c in self.changes]

    @property
    def needs_reanalyze(self) -> bool:
        return bool(self.scope)


def _fmt(value: Any) -> str:
    if value is True:
        return "예"
    if value is False:
        return "아니요"
    if value is None or value == "":
        return "없음"
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _json(value: Any) -> Any:
    return value.isoformat() if isinstance(value, date) else value


def _with_changes(store: Store, changes: list[Change]) -> SimpleNamespace:
    values = {k: getattr(store, k) for k in STORE_KEYS}
    values.update({c.field: c.after for c in changes if c.field in STORE_KEYS})
    return SimpleNamespace(**values)


def _when_items_to_add(pack: dict, items: list[ChecklistItem], changed: set[str], effective: dict) -> list[dict]:
    """when 조건 값을 바꿔 참이 됐는데 아직 없는 기본 체크리스트 항목 (예: 직원 없음 → 있음 → 고용 항목)."""
    if not any(i.source == "rule" for i in items):
        return []  # 아직 분석 전이라 체크리스트가 없으면 분석이 만든다
    existing = {i.item_key for i in items}
    return [e for e in pack.get("checklist") or []
            if e.get("when") in changed and effective.get(e["when"]) and e["id"] not in existing]


def plan_update(pack: dict, store: Store, cards: list[ReportItem], items: list[ChecklistItem],
                patch: dict[str, Any]) -> UpdatePlan:
    """DB를 바꾸지 않고 영향만 계산한다 (미리보기·실제 저장 공용)."""
    changes = [Change(k, getattr(store, k), v) for k, v in patch.items() if getattr(store, k) != v]
    fields = [c.field for c in changes]
    rule = impact_of(pack, fields)
    reset_cards = [c for c in cards if c.check_id in rule["reset"]
                   and (c.chosen_option is not None or c.action_status != "pending")]

    # 초기화로 선택 효과가 사라져 유효 값이 바뀌는 것도 영향 범위에 넣는다 (예: 술 빼기 선택이 풀림)
    before = effective_store(pack, store, cards)
    after = effective_store(pack, _with_changes(store, changes), [c for c in cards if c not in reset_cards])
    implied = [k for k in STORE_KEYS if before[k] != after[k] and k not in fields]
    impacts = list(rule["run"])
    impacts += [s for s in impact_of(pack, implied)["run"] if s not in impacts]

    scope = reanalysis_scope(impacts)
    added = _when_items_to_add(pack, items, set(fields), after)
    recomputed = ["checklist"] if ({"dates", "checklist"} & set(impacts) or reset_cards or added) else []

    lines = [f"{LABELS[c.field]}: {_fmt(c.before)} → {_fmt(c.after)}" for c in changes]
    lines += [f"“{c.title}” 카드 선택 초기화 (다시 결정 대기)" for c in reset_cards]
    lines += [f"체크리스트에 추가: {e['task']}" for e in added]
    if "dates" in impacts:
        lines.append("체크리스트 날짜를 새 개업일 기준으로 다시 계산")
    if scope:
        lines.append("다시 반영: " + "·".join(STEP_LABELS[s] for s in scope if s != "checklist") + " 다시 조회")
    return UpdatePlan(changes=changes, impacts=impacts, reset_cards=reset_cards, scope=scope,
                      recomputed=recomputed, lines=lines)


def apply_update(session: Session, pack: dict, store: Store, cards: list[ReportItem], items: list[ChecklistItem],
                 plan: UpdatePlan) -> ChangeLog:
    """plan을 저장한다. 커밋은 호출하는 쪽이 한다 (재분석 run과 같은 트랜잭션)."""
    now = now_utc()
    reset_rows = [{"item_id": c.item_key, "title": c.title,
                   "chosen_label": (find_option(c, c.chosen_option) or {}).get("label") if c.chosen_option else None}
                  for c in plan.reset_cards]
    for card in plan.reset_cards:
        items = reset_card(session, store, card, items)

    fields = set(plan.fields)
    for change in plan.changes:
        setattr(store, change.field, change.after)
    if fields & {"address", "address_detail"}:
        store.address_codes = None  # 다음 분석에서 새 주소로 다시 조회한다 (옛 코드로 건축물대장을 찾지 않도록)
    effective = effective_store(pack, store, cards)
    store.business_type = business_type(pack, effective["sells_alcohol"])
    store.updated_at = now

    if "opening_date" in fields:
        for item in items:
            item.due_date = store.opening_date + timedelta(days=item.offset_days)
    for entry in _when_items_to_add(pack, items, fields, effective):
        item = ChecklistItem(
            store_id=store.id, item_key=entry["id"], rule_key=entry["id"], source="rule", task=entry["task"],
            category=entry["category"], group_label=entry["group"], offset_days=entry["offset_days"],
            due_date=store.opening_date + timedelta(days=entry["offset_days"]), agency=entry.get("agency"),
            contact_key=entry.get("contact"), evidence=[], done=False, auto_checked=False,
        )
        session.add(item)
        items.append(item)
    session.flush()
    sync_links(pack, cards, items, now)

    log = ChangeLog(store_id=store.id, impacts=plan.impacts, reset_items=reset_rows, lines=plan.lines,
                    changed=[{"field": API_FIELDS[c.field], "from": _json(c.before), "to": _json(c.after)}
                             for c in plan.changes])
    session.add(log)
    session.flush()
    session.add(Alert(store_id=store.id, dedupe_key=f"chg-{log.id}", type="change",
                      title="가게 정보를 바꿔 다시 반영했어요", body=" · ".join(plan.lines[:3]),
                      cta={"label": "마이페이지 열기", "page": "mypage"},
                      diff={"changed": log.changed}, is_example=False))
    session.flush()
    _prune_changes(session, store)
    return log


def _prune_changes(session: Session, store: Store) -> None:
    keep = list(session.scalars(select(ChangeLog.id).where(ChangeLog.store_id == store.id)
                                .order_by(ChangeLog.created_at.desc(), ChangeLog.id.desc()).limit(KEEP_CHANGES)))
    session.execute(delete(ChangeLog).where(ChangeLog.store_id == store.id, ChangeLog.id.not_in(keep)))
    session.execute(delete(Alert).where(Alert.store_id == store.id, Alert.type == "change",
                                        Alert.dedupe_key.not_in([f"chg-{i}" for i in keep])))


def plan_response(store: Store, plan: UpdatePlan, run_id: Any = None, dry_run: bool = False) -> dict:
    return {
        "store_id": str(store.id),
        "dry_run": dry_run,
        "changed": [{"field": API_FIELDS[c.field], "from": _json(c.before), "to": _json(c.after)} for c in plan.changes],
        "impacts": plan.impacts,
        "reset_items": [{"item_id": c.item_key, "title": c.title,
                         "chosen_label": (find_option(c, c.chosen_option) or {}).get("label") if c.chosen_option else None}
                        for c in plan.reset_cards],
        "recomputed": plan.recomputed,
        "needs_reanalyze": plan.needs_reanalyze,
        "run_id": str(run_id) if run_id else None,
    }
