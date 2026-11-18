from agent.llm import FakeLLM, LLMError
from agent.loop import run_analysis
from rules.engine import load_pack

from .fakes import (
    BUILDING_ADVICE, MAIN_SITE, SIMILAR, TM_ADVICE, TM_JUDGMENT, VIOLATION_ADVICE, FakeCalc, FakeTools,
    site_b, store,
)

PACK = load_pack("cafe_restaurant")


def llm(**over):
    base = {"judge_trademark": TM_JUDGMENT, "advise_building_use": BUILDING_ADVICE,
            "advise_building_violation": VIOLATION_ADVICE, "advise_trademark_similar": TM_ADVICE}
    base.update(over)
    return FakeLLM(base)


def run(s=None, tools=None, llm_=None):
    events = []
    res = run_analysis(s or store(sites=[MAIN_SITE, site_b()]), tools=tools or FakeTools(similar=SIMILAR),
                       calc=FakeCalc(), llm=llm_ or llm(), pack=PACK, emit=lambda e, d: events.append((e, d)))
    return res, events


def by_check(res):
    return {i.check_id: i for i in res.items}


def test_s1_alcohol_on_type1_floor():
    res, events = run()
    assert res.business_type == "일반음식점"
    bu = by_check(res)["building_use"]
    assert bu.verdict == "high" and bu.decided_by == "rule" and bu.title == "이 자리에서는 일반음식점 신고가 어려워요"
    assert bu.evidence[0].type == "data" and bu.evidence[0].value == "제1종근린생활시설"
    assert any(e.type == "law" for e in bu.evidence)
    assert [o.remedy for o in bu.options] == ["change_business_type", "change_site", "request_use_change"]
    assert bu.recommendation.option_id == "o-2" and bu.user_action.type == "send"
    assert bu.added_to_checklist == ["c-01"]
    assert res.checklist[0].report_item_id == bu.item_id


def test_ids_unique_and_ordered_by_pack():
    res, _ = run()
    assert [i.check_id for i in res.items] == ["building_use", "building_violation", "alcohol_vs_type",
                                                 "trademark_similar"]
    assert [i.item_id for i in res.items] == ["r-01", "r-02", "r-03", "r-04"]
    pids = [p.prepared_id for i in res.items for p in i.prepared]
    assert len(pids) == len(set(pids))


def test_violation_unknown_when_not_provided():
    bv = by_check(run()[0])["building_violation"]
    assert bv.verdict == "unknown" and bv.evidence and bv.user_action.type == "send"


def test_trademark_ai_item_never_high_and_has_rename_options():
    tm = by_check(run()[0])["trademark_similar"]
    assert tm.verdict == "low" and tm.decided_by == "ai"
    assert [o.label for o in tm.options][:2] == ["'하루커피'(으)로 이름 바꾸기", "'달빛커피'(으)로 이름 바꾸기"]
    assert tm.options[-1].remedy == "proceed"


def test_clean_case_has_no_cards():
    res, _ = run(store(sites=[]), FakeTools(uses=("제2종근린생활시설",), violation=False, similar=[]))
    assert res.summary == {"high": 0, "low": 0, "unknown": 0, "ok": 4}
    assert all(not i.options and not i.prepared and i.user_action is None for i in res.items)


def test_no_alcohol_item_when_not_selling_alcohol():
    res, _ = run(store(answers={"sells_alcohol": False, "has_employees": False}),
                 FakeTools(uses=("제1종근린생활시설",), violation=False, similar=[]))
    assert "alcohol_vs_type" not in by_check(res) and by_check(res)["building_use"].verdict == "ok"


def test_ad_claims_checked_only_with_menu_text():
    assert "ad_claims" not in by_check(run()[0])


def test_checklist_dates_from_calc_and_employee_item():
    res, _ = run()
    tasks = {c.task: c for c in res.checklist}
    assert tasks["영업신고"].dday == -28 and str(tasks["영업신고"].due_date) == "2027-02-02"
    assert tasks["영업신고"].group_label == "개업 4주 전"
    assert "근로계약서·4대보험" in tasks
    none = run(store(answers={"sells_alcohol": True, "has_employees": False}))[0]
    assert "근로계약서·4대보험" not in {c.task for c in none.checklist}


def test_events_and_done_summary():
    res, events = run()
    steps = [d["step"] for e, d in events if e == "step"]
    assert steps[0] == "building" and steps.index("rules") < steps.index("interpret") < steps.index("advise") \
        < steps.index("checklist")
    trademark_done = [d for e, d in events if e == "step" and d["step"] == "trademark" and d["status"] != "running"][0]
    assert trademark_done["status"] == "fallback"  # mock 응답은 fallback으로 표시
    assert events[-1][0] == "done" and events[-1][1]["summary"] == res.summary
    assert sum(1 for e, _ in events if e == "item") == len(res.items)


def test_building_failure_degrades_to_unknown_and_continues():
    res, events = run(tools=FakeTools(building_ok=False, similar=SIMILAR))
    by = by_check(res)
    assert by["building_use"].verdict == "unknown" and by["building_violation"].verdict == "unknown"
    assert [d["status"] for e, d in events if e == "step" and d["step"] == "building"][-1] == "failed"
    assert events[-1][0] == "done"


def test_tool_exception_does_not_crash():
    res, _ = run(tools=FakeTools(raises=True, similar=SIMILAR))
    assert by_check(res)["building_use"].verdict == "unknown"


def test_law_failure_drops_alcohol_item_and_law_evidence():
    res, events = run(tools=FakeTools(law_ok=False, similar=SIMILAR))
    assert "alcohol_vs_type" not in by_check(res)
    assert not any(e.type == "law" for e in by_check(res)["building_use"].evidence)
    assert [d["status"] for e, d in events if e == "step" and d["step"] == "law"] == ["failed"]


def test_advise_llm_failure_still_completes():
    res, _ = run(llm_=llm(advise_building_use=LLMError("x")))
    bu = by_check(res)["building_use"]
    assert len(bu.options) == 3 and bu.recommendation is None and bu.verdict == "high"


def test_guardrail_forces_unknown_without_evidence():
    # 근거 없는 AI 판정이 새어 나가지 않는다: 건물 조회가 실패한 상태에서도 모든 항목이 유효한 값이다
    res, _ = run(tools=FakeTools(building_ok=False, trademark_ok=False))
    assert all(i.verdict == "unknown" or i.evidence for i in res.items)
