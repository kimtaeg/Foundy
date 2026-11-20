"""규칙 묶음에서 API가 읽는 값. 규칙 묶음에 없는 값은 지어내지 않고 빈 값으로 둔다."""

from typing import Any

from rules.engine import contact_of, derive_business_type, load_pack

# 지금 규칙 묶음은 하나다. 업종이 늘면 stores.business_type_input → 묶음 이름 대응을 규칙 쪽에 둔다.
DEFAULT_PACK = "cafe_restaurant"


def get_pack(_store: Any = None) -> dict:
    return load_pack(DEFAULT_PACK)


def business_type(pack: dict, sells_alcohol: bool | None) -> str | None:
    return derive_business_type(pack, {"sells_alcohol": sells_alcohol})


def extra_task(pack: dict, item_key: str) -> dict | None:
    return next((t for t in pack.get("extra_tasks") or [] if t.get("item_key") == item_key), None)


def extra_tasks_for_remedy(pack: dict, remedy: str | None) -> list[str]:
    if not remedy:
        return []
    return [t["item_key"] for t in pack.get("extra_tasks") or [] if t.get("remedy") == remedy]


def checklist_entry(pack: dict, task: str) -> dict | None:
    return next((c for c in pack.get("checklist") or [] if c.get("task") == task), None)


def linked_check_ids(pack: dict, item: Any) -> list[str]:
    """체크리스트 항목과 연결된 점검 항목 check_id (DB 명세서 5-4 report_links).

    기본 항목: checks[].checklist_task 가 이 항목의 task 와 같은 점검.
    선택지 항목(source=report): extra_tasks[].checks.
    """
    if item.source == "report":
        extra = extra_task(pack, item.item_key)
        return list(extra.get("checks") or []) if extra else []
    if item.source == "rule":
        return [c["id"] for c in pack.get("checks") or [] if c.get("checklist_task") == item.task]
    return []


def task_title(pack: dict, task: str, effective: dict) -> str:
    template = (pack.get("checklist_titles") or {}).get(task)
    if not template or not effective.get("business_type"):
        return task
    return template.format(business_type=effective["business_type"])


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


def documents_for(pack: dict, rule_key: str | None) -> list[dict]:
    if not rule_key:
        return []
    return list((pack.get("documents") or {}).get(rule_key) or [])


def contact_for(pack: dict, contact_key: str | None, sigungu: str | None = None) -> dict | None:
    """기관 연락처. 관할 구청은 주소의 시군구 코드로 고르고, 표에 없는 지역은 정부민원안내콜센터(110)로 대체한다."""
    c = contact_of(pack, contact_key, sigungu)
    if c is None:
        return None
    return {"agency": c["agency"], "phone": c["phone"], "tip": c.get("tip"), "verified": not c["is_example"]}
