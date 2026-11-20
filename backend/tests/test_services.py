"""DB 없이 도는 서비스 단위 테스트 (유효 값·자동 체크·다음 할 일)."""

from datetime import date, datetime, timezone
from types import SimpleNamespace as NS

import pytest

from services.effective import effective_store, effects_from_apply
from services.links import link_map, sync_links
from services.next_steps import next_steps
from services.pack import get_pack, hidden_categories, task_title

NOW = datetime(2026, 11, 21, tzinfo=timezone.utc)


@pytest.fixture
def pack():
    return get_pack()


def card(key, check_id, verdict="low", options=(), chosen=None, status="pending", effects=None, action=None, rec=None):
    return NS(item_key=key, check_id=check_id, verdict=verdict, options=list(options), chosen_option=chosen,
              action_status=status, applied_effects=effects or {}, user_action=action, recommendation=rec,
              title=f"{check_id} 카드")


def item(key, task, source="rule", done=False, auto=False, due=date(2027, 1, 5), category="건물·시설", origin=None, rule_key="auto"):
    return NS(item_key=key, task=task, source=source, done=done, done_at=None, auto_checked=auto, due_date=due,
              category=category, origin_item_key=origin, agency=None, rule_key=key if rule_key == "auto" else rule_key)


STORE = NS(name="모노커피", sells_alcohol=True, uses_terrace=False, has_employees=False, funds_krw=None)


def test_effective_applies_chosen_effects_only(pack):
    cards = [card("r-01", "building_use", chosen="o-1", effects={"sells_alcohol": False}),
             card("r-04", "trademark_similar", effects={"name": "다른이름"})]  # 선택 안 함 → 무시
    eff = effective_store(pack, STORE, cards)
    assert eff["sells_alcohol"] is False and eff["business_type"] == "휴게음식점"
    assert eff["name"] == "모노커피"
    assert effective_store(pack, STORE, [])["business_type"] == "일반음식점"


def test_effects_from_apply_accepts_both_shapes():
    assert effects_from_apply({"type": "update_store", "payload": {"answers": {"sells_alcohol": False}}}) == {"sells_alcohol": False}
    assert effects_from_apply({"type": "update_store", "payload": {"name": "푸른달"}}) == {"name": "푸른달"}
    assert effects_from_apply({"type": "update_store", "effects": {"sells_alcohol": False, "address": "x"}}) == {"sells_alcohol": False}
    assert effects_from_apply({"type": "none", "payload": {"name": "x"}}) == {}


def test_task_title_and_hidden_categories(pack):
    assert task_title(pack, "일반음식점 영업신고에 필요한 서류 준비",
                      {"business_type": "휴게음식점"}, "c-04") == "휴게음식점 영업신고에 필요한 서류 준비"
    assert task_title(pack, "사업자등록", {"business_type": "휴게음식점"}) == "사업자등록"
    hidden = hidden_categories(pack, {"has_employees": False})
    assert [h["category"] for h in hidden] == ["고용"]
    assert hidden_categories(pack, {"has_employees": True}) == []


def test_link_map_uses_check_ids(pack):
    cards = [card("r-01", "building_use"), card("r-03", "building_violation"), card("r-02", "trademark_similar")]
    items = [item("c-01", "건물 확인·임대차 계약"), item("x-1", "용도변경 문의", source="report"),
             item("x-2", "상표 확인", source="report"), item("c-05", "사업자등록")]
    assert link_map(pack, cards, items) == {"c-01": ["r-01", "r-03"], "x-1": ["r-01"], "x-2": ["r-02"]}


def test_sync_links_needs_all_cards_and_keeps_manual_checks(pack):
    r01, r02 = card("r-01", "building_use"), card("r-03", "building_violation")
    c01 = item("c-01", "건물 확인·임대차 계약")
    r01.action_status = "done"
    assert sync_links(pack, [r01, r02], [c01], NOW) == [] and not c01.done
    r02.action_status = "done"
    assert sync_links(pack, [r01, r02], [c01], NOW) == ["c-01"] and c01.done and c01.auto_checked
    r02.action_status = "pending"
    sync_links(pack, [r01, r02], [c01], NOW)
    assert not c01.done and not c01.auto_checked
    # 사용자가 직접 체크한 항목은 풀지 않는다
    c01.done, c01.auto_checked = True, False
    sync_links(pack, [r01, r02], [c01], NOW)
    assert c01.done


def test_next_steps_order_and_limit():
    opts = [{"option_id": "o-1", "label": "추천안"}]
    cards = [
        card("r-01", "building_use", verdict="high", options=opts, chosen="o-1", status="done",
             action={"type": "decide", "text": "결정"}),
        card("r-04", "trademark_similar", verdict="low", options=opts, rec={"option_id": "o-1", "reason": "x"}),
        card("r-02", "building_violation", verdict="unknown", action={"type": "send", "text": "구청에 문의", "est_minutes": 5}),
        card("r-05", "z", verdict="high", options=opts),
    ]
    items = [item("x-1", "새 할 일", source="report", origin="r-01", due=date(2027, 1, 1)),
             item("c-02", "위생교육", due=date(2027, 1, 19)), item("c-03", "건강진단", due=date(2027, 1, 26)),
             item("c-07", "근로계약", due=date(2027, 1, 2), category="고용")]
    steps = next_steps(cards, items, excl="r-01", hidden={"고용"})
    assert [s["kind"] for s in steps] == ["new", "decide", "decide", "do", "task"]
    assert steps[1]["go"]["item_id"] == "r-05"  # high 먼저
    assert steps[2]["sub"] == "추천: 추천안"
    assert steps[4]["title"] == "위생교육"  # 숨긴 고용 항목과 새 항목은 빠진다
    assert len(next_steps(cards, items, hidden={"고용"})) <= 5


def test_missing_linked_card_does_not_auto_complete(pack):
    cards = [card("r-01", "building_use", status="done")]
    c01 = item("c-01", "건축물대장 확인 및 임대차 계약 검토")
    assert sync_links(pack, cards, [c01], NOW) == []
    assert not c01.done


def test_old_reused_checklist_id_is_not_assigned_new_meaning(pack):
    cards = [card("r-02", "trademark_similar", status="done")]
    old_hygiene = item("c-02", "위생교육 신청", rule_key=None)
    assert link_map(pack, cards, [old_hygiene]) == {}
    assert sync_links(pack, cards, [old_hygiene], NOW) == []
    assert not old_hygiene.done
