from datetime import date

from agent.loop import run_analysis
from calc.choices import apply_choice, clear_choice, effective_store
from calc.dates import Dates, date_info, group_for_dday
from calc.impacts import plan_change, reset_card
from calc.links import mark_done, sync_links
from calc.next_steps import next_steps
from rules.engine import load_pack

from .test_loop import llm
from .fakes import SIMILAR, FakeTools, store

PACK = load_pack("cafe_restaurant")
OPEN = date(2027, 3, 2)


def analyzed():
    res = run_analysis(store(), tools=FakeTools(similar=SIMILAR), calc=Dates(), llm=llm(), pack=PACK)
    return res.items, res.checklist


def card(items, check_id):
    return next(i for i in items if i.check_id == check_id)


def test_dates_offset_and_group_by_dday():
    d = Dates().checklist_dates(OPEN, -28)
    assert d == {"due_date": date(2027, 2, 2), "dday": -28}
    assert [group_for_dday(x) for x in (-49, -29, -28, -15, -14, -1, 0, 7)] == [
        "계약 전", "계약 전", "개업 4주 전", "개업 4주 전", "개업 직전", "개업 직전", "개업 후", "개업 후"]
    assert date_info(OPEN, date(2027, 1, 31))["group_label"] == "계약 전"


def done(items, *ids):
    return [i.model_copy(update={"action_status": "done"}) if i.item_id in ids else i for i in items]


def test_auto_check_needs_every_linked_card_and_releases_only_auto():
    items, checklist = analyzed()
    r01, r03 = card(items, "building_use").item_id, card(items, "building_violation").item_id
    cl, auto = sync_links(PACK, done(items, r01), checklist)
    assert auto == [] and not next(c for c in cl if c.item_id == "c-01").done  # 카드 하나만 끝나면 체크되지 않는다
    cl, auto = sync_links(PACK, done(items, r01, r03), checklist)
    c01 = next(c for c in cl if c.item_id == "c-01")
    assert auto == ["c-01"] and c01.done and c01.auto_checked
    cl2, _ = sync_links(PACK, items, cl)  # 카드를 되돌리면 자동 체크만 풀린다
    assert not next(c for c in cl2 if c.item_id == "c-01").done


def test_manual_check_survives_card_undo():
    items, checklist = analyzed()
    r01, r03 = card(items, "building_use").item_id, card(items, "building_violation").item_id
    cl, _ = sync_links(PACK, done(items, r01, r03), checklist)
    cl = mark_done(cl, "c-01", True)  # 사용자가 직접 체크 → 자동 체크 표시를 지운다
    cl2, _ = sync_links(PACK, items, cl)
    assert next(c for c in cl2 if c.item_id == "c-01").done


def test_apply_choice_adds_extra_tasks_and_clear_removes_them():
    items, checklist = analyzed()
    bu = card(items, "building_use")
    other = next(o for o in bu.options if o.remedy == "find_other_site")
    items2, cl2, summary = apply_choice(PACK, items, checklist, bu.item_id, other.option_id, OPEN, Dates())
    x0 = next(c for c in cl2 if c.item_id == "x-0")
    assert x0.source == "report" and x0.origin_item_id == bu.item_id and str(x0.due_date) == "2026-12-22"
    assert summary["added_checklist"] == ["x-0"] and "x-0" in card(items2, "building_use").added_to_checklist
    assert x0.documents[0].name == "후보 자리 건축물대장"
    items3, cl3 = clear_choice(items2, cl2, bu.item_id)
    assert not any(c.item_id == "x-0" for c in cl3)
    b3 = card(items3, "building_use")
    assert b3.chosen_option is None and "c-01" in b3.added_to_checklist and "x-0" not in b3.added_to_checklist


def test_effects_overlay_original_store_and_reset_restores():
    items, checklist = analyzed()
    s = store()
    bu = card(items, "building_use")
    o1 = next(o for o in bu.options if o.remedy == "change_business_type")
    items2, _, _ = apply_choice(PACK, items, checklist, bu.item_id, o1.option_id, OPEN, Dates())
    assert effective_store(s, items2).answers["sells_alcohol"] is False
    assert s.answers["sells_alcohol"] is True  # 원본은 그대로
    items3 = [reset_card(i) for i in items2]
    assert effective_store(s, items3).answers["sells_alcohol"] is True


def test_choosing_again_replaces_previous_choice():
    items, checklist = analyzed()
    bu = card(items, "building_use")
    by = {o.remedy: o.option_id for o in bu.options}
    items, cl, _ = apply_choice(PACK, items, checklist, bu.item_id, by["find_other_site"], OPEN, Dates())
    items, cl, _ = apply_choice(PACK, items, cl, bu.item_id, by["request_use_change"], OPEN, Dates())
    assert [c.item_id for c in cl if c.source == "report"] == ["x-1"]


def test_next_steps_order_and_limit():
    items, checklist = analyzed()
    bu = card(items, "building_use")
    by = {o.remedy: o.option_id for o in bu.options}
    items, cl, _ = apply_choice(PACK, items, checklist, bu.item_id, by["find_other_site"], OPEN, Dates())
    steps = next_steps(PACK, items, cl, excl=bu.item_id)
    kinds = [s.kind for s in steps]
    assert kinds[0] == "new" and steps[0].go == {"page": "checklist", "item_id": "x-0"}
    assert kinds == ["new", "decide", "do", "do", "do"]  # 표시 의무 확인까지 직접 할 일 3개가 먼저 온다.
    assert steps[kinds.index("decide")].sub.startswith("추천:")
    items = [i.model_copy(update={"action_status": "done"}) if i.check_id == "labeling" else i for i in items]
    steps = next_steps(PACK, items, cl, excl=bu.item_id)
    assert [s.kind for s in steps] == ["new", "decide", "do", "do", "task"]  # 직접 할 일이 줄면 체크리스트가 뒤에 온다.
    assert len(steps) == 5


def test_next_steps_empty_when_everything_done():
    items, checklist = analyzed()
    items = [i.model_copy(update={"action_status": "done", "chosen_option": i.chosen_option or (i.options[0].option_id if i.options else None)})
             for i in items]
    checklist = [c.model_copy(update={"done": True}) for c in checklist]
    assert next_steps(PACK, items, checklist) == []


def test_plan_change_resets_only_chosen_affected_cards():
    items, checklist = analyzed()
    assert plan_change(PACK, ["address"], items)["reset_items"] == []  # 고른 것이 없으면 초기화할 것도 없다
    tm = card(items, "trademark_similar")
    bu = card(items, "building_use")
    items, _, _ = apply_choice(PACK, items, checklist, bu.item_id, bu.options[2].option_id, OPEN, Dates())
    items, _, _ = apply_choice(PACK, items, checklist, tm.item_id, tm.options[0].option_id, OPEN, Dates())
    p = plan_change(PACK, ["address"], items)
    assert p["reset_items"] == [bu.item_id] and "building" in p["run"]  # 상표 카드는 주소와 무관
    assert plan_change(PACK, ["opening_date"], items) == {"run": ["dates"], "reset_items": []}
