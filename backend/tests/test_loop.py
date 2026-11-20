from datetime import date

from agent.grants import GrantExtraction
from agent.llm import FakeLLM, LLMError
from agent.loop import run_analysis
from agent.ports import ToolResult
from rules.engine import load_pack

from .test_grants import AGE, grant
from .fakes import BUILDING_ADVICE, SIMILAR, TM_ADVICE, TM_JUDGMENT, FakeCalc, FakeTools, store

PACK = load_pack("cafe_restaurant")


def llm(**over):
    base = {"judge_trademark": TM_JUDGMENT, "advise_building_use": BUILDING_ADVICE,
            "advise_trademark_similar": TM_ADVICE}
    base.update(over)
    return FakeLLM(base)


def run(s=None, tools=None, llm_=None):
    events = []
    res = run_analysis(s or store(), tools=tools or FakeTools(similar=SIMILAR),
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
    assert [o.remedy for o in bu.options] == ["change_business_type", "request_use_change", "find_other_site"]
    assert bu.recommendation.option_id == "o-2" and bu.user_action.type == "send"
    assert bu.contact.agency == "성동구청 건축과" and bu.contact.is_example  # 기관 전화번호(예시)
    assert bu.added_to_checklist == ["c-01"]
    c01 = next(c for c in res.checklist if c.item_id == "c-01")
    assert c01.report_item_ids == [bu.item_id, by_check(res)["building_violation"].item_id]  # 두 카드가 모두 끝나야 자동 체크
    assert [d.doc_id for d in c01.documents] == ["bldg"] and c01.documents[0].links[0]["url"].startswith("https://")


def test_ids_unique_and_ordered_by_pack():
    res, _ = run()
    assert [i.check_id for i in res.items] == ["building_use", "trademark_similar", "building_violation",
                                                 "permit_docs", "labeling"]
    assert [i.item_id for i in res.items] == ["r-01", "r-02", "r-03", "r-04", "r-05"]  # foundy 카드 번호와 같다


def test_permit_docs_card_is_rule_card_with_law_evidence_and_contact():
    pd = by_check(run()[0])["permit_docs"]
    assert pd.verdict == "low" and pd.decided_by == "rule" and any(e.type == "law" for e in pd.evidence)
    assert pd.user_action.type == "sign" and pd.contact.agency == "성동구청 위생과"


def test_labeling_is_guidance_ok_without_evidence():
    lb = by_check(run()[0])["labeling"]
    assert lb.verdict == "ok" and not lb.evidence and lb.stage == "운영 중"


def test_trademark_ai_item_never_high_and_has_rename_options():
    tm = by_check(run()[0])["trademark_similar"]
    assert tm.verdict == "low" and tm.decided_by == "ai"
    assert [o.label for o in tm.options][:2] == ["'하루커피'(으)로 이름 바꾸기", "'달빛커피'(으)로 이름 바꾸기"]
    assert tm.options[-1].remedy == "proceed"


def test_clean_case_has_no_cards():
    res, _ = run(store(answers={"sells_alcohol": True}), FakeTools(uses=("제2종근린생활시설",), violation=False, similar=[]))
    # 문제 카드(선택지)는 없다. 영업신고 서류 안내(규칙 카드)만 남는다
    assert res.summary == {"high": 0, "low": 1, "unknown": 0, "ok": 4}
    assert all(not i.options for i in res.items)


def test_no_options_when_not_selling_alcohol():
    res, _ = run(store(answers={"sells_alcohol": False, "has_employees": False}),
                 FakeTools(uses=("제1종근린생활시설",), violation=False, similar=[]))
    bu = by_check(res)["building_use"]
    assert bu.verdict == "ok" and not bu.options and bu.user_action is None


def test_ad_claims_is_deferred_and_never_built():
    assert "ad_claims" not in by_check(run(store(menu_text="디톡스에 좋은 주스"))[0])


def test_checklist_is_foundy_set_dates_from_calc_and_employee_item():
    res, _ = run()
    items = {c.item_id: c for c in res.checklist}
    assert list(items) == [f"c-0{n}" for n in range(1, 10)]
    c04 = items["c-04"]
    assert c04.task == "일반음식점 영업신고에 필요한 서류 준비"  # 신고 업종은 규칙이 정한다
    assert c04.dday == -28 and str(c04.due_date) == "2027-02-02" and c04.group_label == "개업 4주 전"
    assert c04.contact.agency == "성동구청 위생과" and c04.report_item_ids == ["r-04"]
    assert items["c-09"].group_label == "개업 후" and items["c-09"].dday == 7
    none = run(store(answers={"sells_alcohol": True, "has_employees": False}))[0]
    assert "c-08" not in {c.item_id for c in none.checklist}


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


def test_law_failure_drops_law_evidence_and_permit_docs_becomes_unknown():
    res, events = run(tools=FakeTools(law_ok=False, similar=SIMILAR))
    assert by_check(res)["permit_docs"].verdict == "unknown"  # 근거(조문)가 없으면 판단하지 않는다
    assert not any(e.type == "law" for e in by_check(res)["building_use"].evidence)
    assert [d["status"] for e, d in events if e == "step" and d["step"] == "law"] == ["failed"]


def test_advise_llm_failure_still_completes():
    res, _ = run(llm_=llm(advise_building_use=LLMError("x")))
    bu = by_check(res)["building_use"]
    assert len(bu.options) == 3 and bu.recommendation is None and bu.verdict == "high"


def test_guardrail_forces_unknown_without_evidence():
    # 근거 없는 AI 판정이 새어 나가지 않는다: 건물 조회가 실패한 상태에서도 모든 항목이 유효한 값이다
    res, _ = run(tools=FakeTools(building_ok=False, trademark_ok=False))
    assert all(i.verdict == "unknown" or i.evidence for i in res.items if i.check_id != "labeling")  # labeling은 안내 항목


def test_grants_step_adds_checklist_items_and_result():
    tools = FakeTools(similar=SIMILAR)
    tools.grants = lambda s: ToolResult(ok=True, source="K-Startup", data={"grants": [grant()]})
    fake = llm()
    fake.responses["grants_extract"] = GrantExtraction(conditions=[AGE], who="w", how_much="h")
    events = []
    res = run_analysis(store(owner_birth_year=1998), tools=tools, calc=FakeCalc(), llm=fake, pack=PACK,
                       emit=lambda e, d: events.append((e, d)), include_grants=True, today=date(2026, 11, 20))
    assert res.grants.items[0].eligibility.result == "eligible"
    assert res.checklist[-1].category == "정책" and res.checklist[-1].source == "grant"
    assert [d["status"] for e, d in events if e == "step" and d["step"] == "grants"][-1] == "done"


def test_grants_skipped_without_tool_and_off_by_default():
    res, events = run()
    assert res.grants is None and not any(d["step"] == "grants" for e, d in events if e == "step")
    events2 = []
    r2 = run_analysis(store(), tools=FakeTools(), calc=FakeCalc(), llm=llm(), pack=PACK,
                      emit=lambda e, d: events2.append((e, d)), include_grants=True)
    assert [d["status"] for e, d in events2 if e == "step" and d["step"] == "grants"] == ["skipped"]
    assert r2.grants is None


def test_llm_outage_stops_calling_after_three_failures_and_marks_fallback():
    from agent.llm import LLMError as _E

    down = FakeLLM({k: _E("down") for k in ("judge_trademark", "advise_building_use", "advise_trademark_similar")})
    res, events = run(llm_=down)
    assert len(down.calls) == 3  # 세 번 실패한 뒤에는 나머지 AI 호출을 하지 않는다
    assert res.items and res.checklist  # 분석은 끝까지 진행
    status = {d["step"]: d["status"] for e, d in events if e == "step" and d["status"] != "running"}
    assert status["interpret"] == "fallback" and status["advise"] == "fallback"
    assert events[-1][0] == "done"


def test_healthy_llm_keeps_done_status():
    _, events = run()
    status = {d["step"]: d["status"] for e, d in events if e == "step" and d["status"] != "running"}
    assert status["interpret"] == "done" and status["advise"] == "done"
