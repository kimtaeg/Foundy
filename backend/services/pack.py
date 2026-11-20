"""규칙 묶음에서 API가 읽는 값. 규칙 묶음에 없는 값은 지어내지 않고 빈 값으로 둔다."""

from typing import Any

from rules.engine import contact_of, derive_business_type, documents_of, load_pack

# 지금 규칙 묶음은 하나다. 업종이 늘면 stores.business_type_input → 묶음 이름 대응을 규칙 쪽에 둔다.
DEFAULT_PACK = "cafe_restaurant"


def get_pack(_store: Any = None) -> dict:
    return load_pack(DEFAULT_PACK)


def business_type(pack: dict, sells_alcohol: bool | None) -> str | None:
    return derive_business_type(pack, {"sells_alcohol": sells_alcohol})


def extra_task(pack: dict, item_key: str) -> dict | None:
    return next((t for t in pack.get("extra_tasks") or [] if t.get("id") == item_key), None)


def extra_tasks_for_remedy(pack: dict, check_id: str, remedy: str | None) -> list[str]:
    if not remedy:
        return []
    return [t["id"] for t in pack.get("extra_tasks") or [] if t.get("from") == [check_id, remedy]]


def checklist_entry(pack: dict, task: str) -> dict | None:
    return next((c for c in pack.get("checklist") or [] if c.get("task") == task), None)


def linked_check_ids(pack: dict, item: Any) -> list[str]:
    """규칙 묶음 report_links의 check_id. 옛 항목 ID를 새 규칙에 임의로 연결하지 않는다."""
    if item.source == "report":
        key = item.rule_key or item.item_key
    elif item.source == "rule":
        spec = checklist_entry(pack, item.task)
        key = item.rule_key or (spec["id"] if spec else None)
    else:
        return []
    return list((pack.get("report_links") or {}).get(key) or [])


def task_title(pack: dict, task: str, effective: dict, rule_key: str | None = None) -> str:
    spec = next((c for c in pack.get("checklist") or [] if c["id"] == rule_key), None)
    spec = spec or checklist_entry(pack, task)
    if not spec or not spec.get("title_prefix_business_type") or not effective.get("business_type"):
        return task
    return f"{effective['business_type']} 영업신고에 필요한 서류 준비"


def hidden_categories(pack: dict, effective: dict) -> list[dict]:
    """when 조건이 거짓인 기본 항목의 카테고리를 숨긴다. 이유는 되묻기 질문으로 만든다."""
    asks = {a["id"]: a for a in pack.get("ask") or []}
    hidden: dict[str, str] = {}
    for entry in pack.get("checklist") or []:
        cond = entry.get("when")
        if cond and not effective.get(cond):
            question = asks.get(cond, {}).get("text", cond)
            hidden.setdefault(entry["category"], f"{question} → 아니요")
    return [{"category": c, "hidden_reason": r} for c, r in hidden.items()]


def documents_for(pack: dict, rule_key: str | None, sigungu: str | None = None) -> list[dict]:
    if not rule_key:
        return []
    return documents_of(pack, rule_key, sigungu)


def contact_for(pack: dict, contact_key: str | None, sigungu: str | None = None) -> dict | None:
    if not contact_key:
        return None
    return contact_of(pack, contact_key, sigungu)
