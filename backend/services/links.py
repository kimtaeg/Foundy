"""점검 카드 완료 → 체크리스트 자동 체크 (DB 명세서 5-4)."""

from datetime import datetime
from typing import Any

from services.pack import linked_check_ids


def link_map(pack: dict, cards: list[Any], items: list[Any]) -> dict[str, list[str]]:
    """체크리스트 item_key → 연결된 카드 item_key 목록. 연결 카드가 없는 항목은 빠진다."""
    by_check = {c.check_id: c.item_key for c in cards}
    links = {}
    for item in items:
        keys = [by_check[cid] for cid in linked_check_ids(pack, item) if cid in by_check]
        if keys:
            links[item.item_key] = keys
    return links


def sync_links(pack: dict, cards: list[Any], items: list[Any], now: datetime) -> list[str]:
    """연결된 카드가 모두 done 이면 자동 체크, 아니면 자동 체크만 푼다. 새로 자동 체크한 item_key 목록을 돌려준다."""
    status = {c.item_key: c.action_status for c in cards}
    links = link_map(pack, cards, items)
    checked = []
    for item in items:
        keys = links.get(item.item_key)
        if not keys:
            continue
        all_done = all(status.get(k) == "done" for k in keys)
        if all_done and not item.done:
            item.done, item.done_at, item.auto_checked = True, now, True
            checked.append(item.item_key)
        elif not all_done and item.done and item.auto_checked:
            item.done, item.done_at, item.auto_checked = False, None, False
    return checked
