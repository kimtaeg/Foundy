"""마이페이지 수정의 영향 범위와 초기화할 카드 (코드가 한다. AI 아님)."""

from __future__ import annotations

from agent.schemas import ChecklistItem, ReportItem
from rules.engine import impact_of


def plan_change(pack: dict, changed_fields: list[str], items: list[ReportItem]) -> dict:
    """{"run": 다시 할 단계, "reset_items": 선택을 초기화할 카드 id (이미 고른 것만)}.

    저장 전 미리보기(dry_run)와 실제 반영이 같은 함수를 쓴다.
    """
    plan = impact_of(pack, changed_fields)
    resettable = [i.item_id for i in items
                  if i.check_id in plan["reset"] and (i.chosen_option or i.action_status != "pending")]
    return {"run": plan["run"], "reset_items": resettable}


def reset_card(item: ReportItem) -> ReportItem:
    """결정·실행·메모·효과를 비워 다시 결정 대기로 돌린다."""
    return item.model_copy(update={
        "chosen_option": None, "action_status": "pending", "action_reply": None,
        "applied_effects": {}, "applied_changes": [],
    })


def drop_derived(checklist: list[ChecklistItem], item_ids: set[str]) -> list[ChecklistItem]:
    """초기화한 카드로 생긴 체크리스트 항목(선택지로 생긴 x-*)을 없앤다. 다른 항목의 직접 체크는 유지된다."""
    return [c for c in checklist if c.origin_item_id not in item_ids]
