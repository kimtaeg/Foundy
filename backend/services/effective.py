"""유효 값 (DB 명세서 5-2). stores 원본에 선택된 카드의 applied_effects 를 덧씌운다."""

from typing import Any

from services.pack import business_type

# 카드 효과로 바꿀 수 있는 가게 값 (DB 명세서 2-4 applied_effects 허용 키)
EFFECT_KEYS = ("sells_alcohol", "name")
STORE_KEYS = ("name", "sells_alcohol", "uses_terrace", "has_employees", "funds_krw")


def effective_store(pack: dict, store: Any, cards: list[Any]) -> dict:
    eff = {k: getattr(store, k) for k in STORE_KEYS}
    for card in sorted(cards, key=lambda c: c.item_key):
        if card.chosen_option is None:
            continue
        for key in EFFECT_KEYS:
            if key in (card.applied_effects or {}):
                eff[key] = card.applied_effects[key]
    eff["business_type"] = business_type(pack, eff["sells_alcohol"])
    eff["sigungu_cd"] = (getattr(store, "address_codes", None) or {}).get("sigungu_cd")  # 관할 구청 번호를 고르는 키
    return eff


def effects_from_apply(apply: dict | None) -> dict:
    """선택지 apply → applied_effects. 허용 키만 남긴다.

    두 형태를 받는다: 명세서 {effects:{...}} 와 시드·AI 형식 {payload:{answers:{...}, name}}.
    """
    if not apply or apply.get("type") != "update_store":
        return {}
    payload = apply.get("payload") or {}
    merged = {**(payload.get("answers") or {}), **{k: v for k, v in payload.items() if k != "answers"}}
    merged.update(apply.get("effects") or {})
    return {k: merged[k] for k in EFFECT_KEYS if k in merged}
