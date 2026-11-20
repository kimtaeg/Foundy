"""점검 카드 ↔ 체크리스트 자동 체크 (코드가 한다. AI 아님).

규칙 묶음 report_links의 카드가 모두 완료(done)되면 그 항목을 자동 체크한다.
카드를 되돌리면 자동 체크된 항목만 풀리고, 사용자가 직접 한 체크는 유지한다.
"""

from __future__ import annotations

from agent.schemas import ChecklistItem, ReportItem
from rules.engine import report_links


def sync_links(
    pack: dict, items: list[ReportItem], checklist: list[ChecklistItem],
) -> tuple[list[ChecklistItem], list[str]]:
    """(갱신된 체크리스트, 이번에 자동 체크된 항목 id)."""
    done_checks = {i.check_id for i in items if i.action_status == "done"}
    present = {i.check_id for i in items}
    out: list[ChecklistItem] = []
    auto: list[str] = []
    for c in checklist:
        cards = report_links(pack).get(c.item_id)
        if cards and all(card in present for card in cards):
            all_done = all(card in done_checks for card in cards)
            if all_done and not c.done:
                c = c.model_copy(update={"done": True, "auto_checked": True})
                auto.append(c.item_id)
            elif not all_done and c.done and c.auto_checked:
                c = c.model_copy(update={"done": False, "auto_checked": False})
        out.append(c)
    return out, auto


def mark_done(checklist: list[ChecklistItem], item_id: str, done: bool) -> list[ChecklistItem]:
    """사용자가 직접 체크: 자동 체크 표시는 지운다 (이후 카드를 되돌려도 풀리지 않는다)."""
    return [c.model_copy(update={"done": done, "auto_checked": False}) if c.item_id == item_id else c
            for c in checklist]
