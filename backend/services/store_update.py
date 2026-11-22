"""마이페이지 가게 정보 수정 (DB 명세서 4-5, API 명세서 3장 PATCH /stores).

영향 범위는 규칙 묶음의 impacts 표로 코드가 정한다 (AI 아님).
저장 전 미리보기(dry_run)와 실제 저장은 같은 plan_update 결과를 쓴다.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from sqlalchemy import String, cast, delete, select
from sqlalchemy.orm import Session

from db.models import Alert, ChangeLog, ChecklistItem, ReportItem, Store
from rules.engine import impact_of
from services.analysis import reanalysis_scope
from services.cards import find_option, reset_card
from services.effective import STORE_KEYS, effective_store
from services.links import sync_links
from services.pack import business_type
from services.timeutil import now_utc, today_kst

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
    "does_delivery": "answers.does_delivery",
    "area_sqm": "area_sqm",
}
LABELS = {
    "name": "가게 이름", "business_type_input": "업종", "address": "주소", "address_detail": "층·호수",
    "opening_date": "개업일", "owner_birth_year": "출생 연도", "sells_alcohol": "주류 판매",
    "uses_terrace": "테라스 사용", "has_employees": "직원 고용", "funds_krw": "준비 자금",
    "does_delivery": "배달 영업", "area_sqm": "영업장 면적",
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
    if isinstance(value, Decimal):
        return f"{value:g}㎡"
    return str(value)


def _json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
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


def apply_profile_fields(pack: dict, store: Store, cards: list[ReportItem], plan: UpdatePlan) -> dict:
    for change in plan.changes:
        setattr(store, change.field, change.after)
    if {"address", "address_detail"}.intersection(plan.fields):
        store.address_codes = None  # 다음 분석에서 새 주소로 다시 조회한다 (옛 코드로 건축물대장을 찾지 않도록)
    if "address" in plan.fields:
        # 옛 주소의 법정동(region)을 남기면 임대료 상권 매칭이 이전 동의 상권을 고른다 (#193).
        # 다음 분석에서 새 주소로 확인한 법정동으로 채우고, 그 전에는 권역·서울 평균으로 비교한다
        store.region = None
    effective = effective_store(pack, store, cards)
    store.business_type = business_type(pack, effective["sells_alcohol"])
    store.updated_at = now_utc()
    return effective


def apply_update(session: Session, pack: dict, store: Store, cards: list[ReportItem], items: list[ChecklistItem],
                 plan: UpdatePlan) -> tuple[Alert, list[str]]:
    """plan을 저장한다. 커밋은 호출하는 쪽이 한다 (재분석 run과 같은 트랜잭션)."""
    reset_rows = [{"item_id": c.item_key, "title": c.title,
                   "chosen_label": (find_option(c, c.chosen_option) or {}).get("label") if c.chosen_option else None}
                  for c in plan.reset_cards]
    for card in plan.reset_cards:
        items = reset_card(session, store, card, items)

    fields = set(plan.fields)
    effective = apply_profile_fields(pack, store, cards, plan)
    now = store.updated_at

    if "opening_date" in fields:
        for item in items:
            item.due_date = store.opening_date + timedelta(days=item.offset_days)
            if item.statutory_basis:  # 개업 전 법정 기한은 개업 전날이다 (권장 준비일과 별개로 같이 옮긴다)
                item.statutory_deadline = store.opening_date - timedelta(days=1)
    for entry in _when_items_to_add(pack, items, fields, effective):
        item = ChecklistItem(
            store_id=store.id, item_key=entry["id"], rule_key=entry["id"], source="rule", task=entry["task"],
            category=entry["category"], group_label=entry["group"], offset_days=entry["offset_days"],
            due_date=store.opening_date + timedelta(days=entry["offset_days"]), agency=entry.get("agency"),
            contact_key=entry.get("contact"), evidence=[], done=False, auto_checked=False,
        )
        session.add(item)
        items.append(item)
    sync_links(pack, cards, items, now)

    log = ChangeLog(id=uuid4(), store_id=store.id, impacts=plan.impacts, reset_items=reset_rows, lines=plan.lines,
                    changed=[{"field": API_FIELDS[c.field], "from": _json(c.before), "to": _json(c.after)}
                             for c in plan.changes])
    alert = Alert(store_id=store.id, dedupe_key=f"chg-{log.id}", type="change",
                  title="가게 정보를 바꿔 다시 반영했어요", body=" · ".join(plan.lines[:3]),
                  cta={"label": "마이페이지 열기", "page": "mypage"},
                  diff={"changed": log.changed}, is_example=False)
    session.add_all([log, alert])
    session.flush()
    return alert, _prune_changes(session, store)


def _prune_changes(session: Session, store: Store) -> list[str]:
    kept = (select(ChangeLog.id).where(ChangeLog.store_id == store.id)
            .order_by(ChangeLog.created_at.desc(), ChangeLog.id.desc()).limit(KEEP_CHANGES).cte())
    pruned = (delete(ChangeLog).where(ChangeLog.store_id == store.id, ChangeLog.id.not_in(select(kept.c.id)))
              .cte())
    alert_keys = select("chg-" + cast(kept.c.id, String))
    removed = session.scalars(delete(Alert).where(Alert.store_id == store.id, Alert.type == "change",
                                                Alert.dedupe_key.not_in(alert_keys)).add_cte(pruned)
                              .returning(Alert.id).execution_options(synchronize_session=False))
    return [str(alert_id) for alert_id in removed]


def checklist_dates(items: list[ChecklistItem]) -> dict:
    today = today_kst()
    return {
        "as_of": today.isoformat(),
        "items": [{
            "item_id": item.item_key, "due_date": item.due_date.isoformat(),
            "dday": (item.due_date - today).days,
            "statutory_deadline": item.statutory_deadline.isoformat() if item.statutory_deadline else None,
        } for item in items],
    }


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
