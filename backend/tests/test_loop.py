from datetime import date

from agent.grants import GrantExtraction
from agent.llm import FakeLLM, LLMError
from agent.loop import run_analysis
from agent.ports import ToolResult
from rules.engine import load_pack

from .test_grants import AGE, grant
from .fakes import (
    AI_JUDGES, BUILDING_ADVICE, PERMIT_JUDGMENT, SIMILAR, TM_ADVICE, TM_JUDGMENT, FakeCalc, FakeTools, store,
)

PACK = load_pack("cafe_restaurant")


def llm(**over):
    base = {**AI_JUDGES, "judge_trademark": TM_JUDGMENT, "judge_permit_docs": PERMIT_JUDGMENT, "judge_law_card": PERMIT_JUDGMENT,
            "advise_building_use": BUILDING_ADVICE,
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
    assert bu.verdict == "high" and bu.decided_by == "ai" and bu.title == "이 자리에서는 일반음식점 신고가 어려워요"
    assert bu.evidence[0].type == "data" and bu.evidence[0].value == "제1종근린생활시설"  # 건축물대장 값
    assert any(e.type == "law" and "일반음식점을 할 수 없다" in (e.text or "") for e in bu.evidence)  # 검증된 조문 인용
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
                                                 "permit_docs", "labeling", "labor_contract"]  # 직원이 있으니 근로계약 카드가 붙는다
    # foundy 카드 번호는 규칙 묶음 순서가 정한다. 면적을 모르면 소방 카드(r-06)는 만들지 않고 번호만 건너뛴다.
    assert [i.item_id for i in res.items] == ["r-01", "r-02", "r-03", "r-04", "r-05", "r-07"]


def test_permit_docs_card_is_judged_by_ai_from_law_text_with_verified_evidence():
    pd = by_check(run()[0])["permit_docs"]
    assert pd.verdict == "low" and pd.decided_by == "ai" and pd.title == "영업신고를 개업 전에 해야 해요"
    law = pd.evidence[0]
    assert law.type == "law" and law.article == "제37조" and law.text.startswith("대통령령으로 정하는 영업을")  # 인용 문장만 근거로
    assert "구청 위생과에 필요 서류 확인" in pd.reason  # AI가 조문에서 뽑은 할 일
    assert pd.user_action.type == "sign" and pd.contact.agency == "성동구청 위생과"  # 할 일·연락처는 규칙 묶음


def test_labeling_is_unknown_without_evidence():
    lb = by_check(run()[0])["labeling"]
    assert lb.verdict == "unknown" and not lb.evidence and lb.stage == "운영 중"
    assert lb.consequence and lb.user_action.text == "서류함에서 표시 의무 안내 확인하기"


def test_real_mode_does_not_judge_trademark_with_mock_fallback_list():
    """실제 모드에서 KIPRIS 조회가 실패해 모의 목록으로 대체되면 그 목록으로 판정하지 않고 판단 불가로 둔다 (거짓 안심 방지)."""
    class RealModeTools(FakeTools):
        use_mock = False  # 실제 모드: trademark() 가 실패해 모의 목록(from_mock)을 돌려주는 상황

    res, events = run(tools=RealModeTools(similar=SIMILAR))
    tm = by_check(res)["trademark_similar"]
    assert tm.verdict == "unknown" and tm.title == "상표가 겹치는지 확인할 수 없어요"
    assert "KIPRIS" in tm.reason  # 직접 확인할 곳을 안내한다
    step = next(d for e, d in events if e == "step" and d["step"] == "trademark" and d["status"] != "running")
    assert step["status"] == "failed"
    # 명시한 모의 모드(use_mock=True)는 그대로 모의 목록으로 판정한다 ("예시로 해보기"는 끝까지 돌아가야 한다)
    mock_res, _ = run(tools=type("MockModeTools", (FakeTools,), {"use_mock": True})(similar=SIMILAR))
    assert by_check(mock_res)["trademark_similar"].verdict == "low"


def test_trademark_step_message_says_when_example_data_was_used():
    """진행 화면이 상표 단계가 예시 자료를 썼는지 알 수 있게 단계 메시지에 출처를 적는다."""
    _, events = run()  # FakeTools.trademark 는 모의 자료(from_mock)를 돌려준다
    done = next(d for e, d in events if e == "step" and d["step"] == "trademark" and d["status"] != "running")
    assert done["status"] == "fallback" and "예시 자료" in done["message"]


def test_trademark_ai_item_never_high_and_has_rename_options():
    tm = by_check(run()[0])["trademark_similar"]
    assert tm.verdict == "low" and tm.decided_by == "ai"
    assert [o.label for o in tm.options][:2] == ["'하루커피'(으)로 이름 바꾸기", "'달빛커피'(으)로 이름 바꾸기"]
    assert tm.options[-1].remedy == "proceed"


def test_clean_case_has_no_cards():
    res, _ = run(store(answers={"sells_alcohol": True}), FakeTools(uses=("제2종근린생활시설",), violation=False, similar=[]))
    # 문제 카드(선택지)는 없다. 영업신고 서류 안내(규칙 카드)만 남는다
    assert res.summary == {"high": 0, "low": 1, "unknown": 1, "ok": 3}
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
    assert list(items)[:9] == [f"c-0{n}" for n in range(1, 10)]  # 기본 일정 9개 뒤에 법령 규칙이 만든 작업이 붙는다
    # 40㎡ 가게라 다중이용업소(100㎡ 이상)는 만들지 않고, 직원이 있어 최저임금 확인이 붙는다
    assert list(items)[9:] == ["o-facility", "o-minwage", "o-zoning"]
    assert items["c-04"].task_type == "legal_obligation" and items["o-minwage"].source_type == "rule_engine"
    c04 = items["c-04"]
    assert c04.task == "일반음식점 영업신고에 필요한 서류 준비"  # 신고 업종은 규칙이 정한다
    assert c04.dday == -28 and str(c04.due_date) == "2027-02-02" and c04.group_label == "개업 4주 전"
    assert c04.contact.agency == "성동구청 위생과" and c04.report_item_ids == ["r-04"]
    assert items["c-09"].group_label == "개업 후" and items["c-09"].dday == 7
    none = run(store(answers={"sells_alcohol": True, "has_employees": False}))[0]
    assert not {"c-08", "o-minwage"} & {c.item_id for c in none.checklist}


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
    assert all(i.verdict == "unknown" or i.evidence for i in res.items)


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

    down = FakeLLM({k: _E("down") for k in ("judge_building_use", "judge_violation", "judge_trademark",
                                            "judge_permit_docs", "advise_building_use", "advise_trademark_similar")})
    res, events = run(llm_=down)
    assert len(down.calls) == 3  # 세 번 실패한 뒤에는 나머지 AI 호출을 하지 않는다 (규칙표·안내 카드로 대체)
    assert res.items and res.checklist  # 분석은 끝까지 진행
    pd = by_check(res)["permit_docs"]  # AI가 실패하면 규칙 묶음의 안내 카드로 대체된다
    assert pd.verdict == "low" and pd.decided_by == "rule" and pd.ai_fallback and pd.evidence
    bu = by_check(res)["building_use"]  # 건물 용도도 AI가 실패하면 규칙표 카드로 대체된다 (시연이 멈추지 않는다)
    assert bu.verdict == "high" and bu.decided_by == "rule" and bu.ai_fallback and bu.evidence
    status = {d["step"]: d["status"] for e, d in events if e == "step" and d["status"] != "running"}
    assert status["interpret"] == "fallback" and status["advise"] == "fallback"
    assert events[-1][0] == "done"


def test_healthy_llm_keeps_done_status():
    _, events = run()
    status = {d["step"]: d["status"] for e, d in events if e == "step" and d["status"] != "running"}
    assert status["interpret"] == "done" and status["advise"] == "done"


def test_resolved_address_codes_only_from_real_lookup():
    from agent.loop import resolved_address_codes
    from agent.ports import ToolResult

    codes = {"sigungu_cd": "11200", "bjdong_cd": "11400", "bun": "0001", "ji": "0000"}
    real = ToolResult(ok=True, source="건축HUB", data={"floor_uses": [], "address_codes": codes})
    assert resolved_address_codes(real) == codes
    assert resolved_address_codes(real.model_copy(update={"from_cache": True})) == codes
    assert resolved_address_codes(real.model_copy(update={"from_mock": True})) is None
    assert resolved_address_codes(real.model_copy(update={"ok": False})) is None
    assert resolved_address_codes(real.model_copy(update={"data": {"address_codes": {"sigungu_cd": "11200"}}})) is None


def test_fire_safety_card_only_when_area_makes_it_apply():
    """면적을 모르면 소방 카드를 만들지 않고, 100㎡ 이상 2층이면 만든다. 1층은 예외 확인이 필요해 카드가 생긴다."""
    assert "fire_safety" not in by_check(run()[0])
    big_second = by_check(run(store(area_sqm=120, address_detail="2층"))[0])
    assert "fire_safety" in big_second and big_second["fire_safety"].decided_by == "ai"
    big_first = by_check(run(store(area_sqm=120, address_detail="1층"))[0])
    assert "fire_safety" in big_first  # 예외(1층) 가능성은 확인 필요 → 카드로 안내
    assert "fire_safety" not in by_check(run(store(area_sqm=60, address_detail="2층"))[0])


def test_labor_card_is_skipped_without_employees():
    s = store(answers={"sells_alcohol": True, "uses_terrace": False, "has_employees": False})
    assert "labor_contract" not in by_check(run(s)[0])


def test_obligations_are_returned_with_status():
    res, _ = run(store(area_sqm=120, address_detail="2층"))
    status = {o.rule_id: o.status for o in res.obligations}
    assert status["FIRE-DENSE-001"] == "applies"
    assert status["FOOD-REPORT-001"] == "applies"
    assert status["LABOR-CONTRACT-001"] == "applies"


class _MockFallbackTools(FakeTools):
    """실제 모드(use_mock=False) 분석 도구가 건물 조회 실패로 모의 응답(다른 주소의 예시 건물)을 돌려준 상황."""
    use_mock = False

    def building(self, store):
        return ToolResult(ok=True, source="건축물대장 층별개요 (예시)", from_mock=True,
                          data={"floor_uses": ["제1종근린생활시설"], "violation": False})


def test_real_mode_mock_building_is_not_used_for_use_or_violation():
    res, events = run(tools=_MockFallbackTools(similar=SIMILAR))
    found = by_check(res)
    assert found["building_use"].verdict == "unknown" and found["building_violation"].verdict == "unknown"
    assert not any(e.from_mock and e.type == "data" for e in found["building_use"].evidence)
    assert "조회하지 못했어요" in found["building_violation"].reason
    step = next(d for e, d in events if e == "step" and d["step"] == "building" and d["status"] != "running")
    assert step["status"] == "fallback"  # 진행 표시에도 실제 조회가 아님을 남긴다
    assert res.address_codes is None


def test_mock_mode_keeps_demo_judgement():
    class DemoTools(_MockFallbackTools):
        use_mock = True  # 명시한 모의 모드(개발·데모)는 기존대로 예시 자료로 판정한다

    found = by_check(run(tools=DemoTools(similar=SIMILAR))[0])
    assert found["building_use"].verdict == "high" and found["building_use"].evidence[0].from_mock
