"""예시 계정(이서연 씨 사례) 시드. docs/DB 명세서.md 9장.

mocks/demo/seoyeon.json 은 API 응답 형태라 DB 스키마와 다르다.
build_demo_rows() 가 DB 없이 행 dict로 바꾸고, insert_demo() 가 한 트랜잭션으로 넣는다.
외부 API·LLM을 부르지 않는다.
"""

import json
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.orm import Session

from db.models import Alert, ChecklistItem, ReportItem, Store, User

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEMO_PATH = BACKEND_DIR / "mocks" / "demo" / "seoyeon.json"
RULES_PATH = BACKEND_DIR / "rules" / "packs" / "cafe_restaurant.yaml"

DEMO_USER_NAME = "이서연"
# 시작 상태에서 완료된 체크리스트 (명세서 9장: 사업자등록·식품위생교육). 시드 파일의 task 이름으로 찾는다
DEMO_DONE_TASKS = ("사업자등록", "위생교육 신청")
ANSWER_COLUMNS = ("sells_alcohol", "uses_terrace", "has_employees", "funds_krw")


@dataclass
class DemoRows:
    user: dict[str, Any]
    store: dict[str, Any]
    report_items: list[dict[str, Any]]
    checklist_items: list[dict[str, Any]]
    alerts: list[dict[str, Any]]
    # 시드 파일에 있지만 DB에 넣지 않은 것 (보고용)
    skipped: dict[str, Any]


def load_demo(path: Path = DEMO_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_rules(path: Path = RULES_PATH) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _rule_lookup(entries: list[dict[str, Any]] | None, item_key: str, field: str) -> Any:
    """규칙 묶음에서 item_key가 같은 항목의 값을 찾는다. 없으면 None."""
    for entry in entries or []:
        if isinstance(entry, dict) and entry.get("item_key") == item_key:
            return entry.get(field)
    return None


def _to_date(value: str) -> date:
    return date.fromisoformat(value)


def build_demo_rows(demo: dict[str, Any], rules: dict[str, Any] | None = None) -> DemoRows:
    rules = rules or {}
    src_store = demo["store"]
    answers = src_store.get("answers") or {}
    opening = _to_date(src_store["opening_date"])
    is_example = bool(demo.get("is_example", True))

    user = {"provider": "demo", "provider_user_id": None, "name": DEMO_USER_NAME}

    store = {
        "name": src_store["name"],
        "business_type_input": src_store.get("business_type_input") or "카페",
        "business_type": demo.get("business_type"),
        "address": src_store["address"],
        "address_detail": src_store.get("address_detail") or "",
        "address_codes": src_store.get("address_codes"),
        "opening_date": opening,
        "owner_birth_year": src_store.get("owner_birth_year"),
        "is_demo": True,
        **{col: answers[col] for col in ANSWER_COLUMNS if answers.get(col) is not None},
    }

    report_items = []
    for item in demo.get("report_items", []):
        report_items.append(
            {
                "item_key": item["item_id"],
                "check_id": item["check_id"],
                "stage": item["stage"],
                "verdict": item["verdict"],
                "decided_by": item["decided_by"],
                "title": item["title"],
                "reason": item.get("reason"),
                "consequence": item.get("consequence"),
                "options": item.get("options") or [],
                "recommendation": item.get("recommendation"),
                "user_action": item.get("user_action"),
                "contact_key": item.get("contact_key")
                or _rule_lookup(rules.get("checks"), item["item_id"], "contact_key"),
                # from_mock·is_example 표시를 그대로 둔다
                "evidence": item.get("evidence") or [],
                # 시작 상태: 결정 대기·미실행
                "chosen_option": None,
                "action_status": "pending",
            }
        )

    checklist_items = []
    for item in demo.get("checklist", []):
        key = item["item_id"]
        due = _to_date(item["due_date"])
        done = item["task"] in DEMO_DONE_TASKS
        checklist_items.append(
            {
                "item_key": key,
                "source": item["source"],
                "rule_key": item.get("rule_key") or _rule_lookup(rules.get("checklist"), key, "rule_key"),
                "task": item["task"],
                "category": item["category"],
                "group_label": item["group_label"],
                "offset_days": item["offset_days"] if "offset_days" in item else (due - opening).days,
                "due_date": due,
                "agency": item.get("agency"),
                "contact_key": item.get("contact_key") or _rule_lookup(rules.get("checklist"), key, "contact_key"),
                "evidence": item.get("evidence") or [],
                "done": done,
                "auto_checked": False,
                # report_item_id 는 저장하지 않는다 (연결은 규칙 묶음 report_links)
            }
        )

    alerts = []
    for item in report_items:
        if item["options"] and item["chosen_option"] is None:
            alerts.append(
                {
                    "dedupe_key": f"dec-{item['item_key']}",
                    "type": "decision",
                    "title": item["title"],
                    "body": (item["user_action"] or {}).get("text"),
                    "cta": {"label": "카드 열기", "page": "report", "item_id": item["item_key"]},
                    "is_example": is_example,
                }
            )

    skipped = {
        "top_level": [k for k in ("menu_text", "site_compare", "grants", "events") if k in demo or k in src_store],
        "report_item_fields": sorted(
            {f for it in demo.get("report_items", []) for f in ("prepared", "added_to_checklist") if f in it}
        ),
        "checklist_fields": sorted(
            {f for it in demo.get("checklist", []) for f in ("report_item_id", "documents", "prepared", "dday") if f in it}
        ),
    }
    return DemoRows(user, store, report_items, checklist_items, alerts, skipped)


def insert_demo(session: Session, rows: DemoRows) -> dict[str, Any]:
    """한 트랜잭션 안에서 호출한다 (db.session.transaction). 새 user_id·store_id를 만든다."""
    now = datetime.now(timezone.utc)

    user = User(**rows.user)
    session.add(user)
    session.flush()

    store = Store(user_id=user.id, onboarded_at=now, **rows.store)
    session.add(store)
    session.flush()

    for r in rows.report_items:
        session.add(ReportItem(store_id=store.id, **r))
    for c in rows.checklist_items:
        session.add(ChecklistItem(store_id=store.id, done_at=now if c["done"] else None, **c))
    for a in rows.alerts:
        session.add(Alert(store_id=store.id, **a))
    session.flush()

    return {"user": {"user_id": str(user.id), "name": user.name, "provider": user.provider}, "store_id": str(store.id)}


def seed_demo(session: Session) -> dict[str, Any]:
    return insert_demo(session, build_demo_rows(load_demo(), load_rules()))

