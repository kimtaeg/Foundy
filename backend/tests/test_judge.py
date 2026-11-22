from agent.judge import AdJudgment, judge_ad_claims, judge_trademark
from agent.llm import FakeLLM, LLMError
from agent.ports import ToolResult
from rules.engine import check_spec, load_pack

from .fakes import SIMILAR, TM_JUDGMENT, FakeTools, store

PACK = load_pack("cafe_restaurant")
TM = check_spec(PACK, "trademark_similar")
AD = check_spec(PACK, "ad_claims")


def tm_res(similar=SIMILAR):
    return FakeTools(similar=similar).trademark("모노커피")


def test_no_similar_marks_is_ok_without_llm():
    llm = FakeLLM({})
    item, _ = judge_trademark(llm, store(), tm_res([]), TM, "r-01")
    assert item.verdict == "ok" and item.evidence and llm.calls == []


def test_tool_failure_is_unknown_without_llm():
    llm = FakeLLM({})
    item, _ = judge_trademark(llm, store(), ToolResult(ok=False, source="KIPRIS"), TM, "r-01")
    assert item.verdict == "unknown" and llm.calls == []


def test_low_with_valid_citation_builds_evidence_from_data():
    item, extras = judge_trademark(FakeLLM({"judge_trademark": TM_JUDGMENT}), store(), tm_res(), TM, "r-01")
    assert item.verdict == "low" and item.decided_by == "ai"
    assert item.evidence[0].value.startswith("등록 4000000000001 '모노 커피'")
    assert item.evidence[0].from_mock is True  # 도구의 mock 표시가 근거로 이어진다
    assert extras["alternatives"] == ["하루커피", "달빛커피"]  # 최대 2개


def test_invented_citation_becomes_unknown():
    bad = TM_JUDGMENT.model_copy(update={"cited_reg_nos": ["9999999999999"]})
    item, extras = judge_trademark(FakeLLM({"judge_trademark": bad}), store(), tm_res(), TM, "r-01")
    assert item.verdict == "unknown" and not item.evidence and extras["alternatives"] == []


def test_llm_failure_is_unknown_with_list_kept():
    item, _ = judge_trademark(FakeLLM({"judge_trademark": LLMError("x")}), store(), tm_res(), TM, "r-01")
    assert item.verdict == "unknown" and item.evidence


def test_ad_claims_skipped_without_text():
    assert judge_ad_claims(FakeLLM({}), store(), AD, "r-02") is None


def test_ad_quote_must_exist_in_text():
    s = store(menu_text="면역력을 높여주는 허브티, 달콤한 라떼")
    ok = AdJudgment(verdict="low", title="t", reason="r", quotes=["면역력을 높여주는"])
    item = judge_ad_claims(FakeLLM({"judge_ad_claims": ok}), s, AD, "r-02")
    assert item.verdict == "low" and item.evidence[0].value == "면역력을 높여주는"
    fake = AdJudgment(verdict="low", title="t", reason="r", quotes=["암을 예방하는"])
    item = judge_ad_claims(FakeLLM({"judge_ad_claims": fake}), s, AD, "r-02")
    assert item.verdict == "unknown" and not item.evidence


def test_alternatives_overlapping_names_are_dropped():
    bad = TM_JUDGMENT.model_copy(update={"alternatives": ["더모노커피", "모노 커피", "하루커피", "달빛 커피", "또다른"]})
    _, extras = judge_trademark(FakeLLM({"judge_trademark": bad}), store(), tm_res(), TM, "r-01")
    assert extras["alternatives"] == ["하루커피", "달빛 커피"]  # '모노'와 겹치는 이름 제외, 최대 2개


# ---- 영업신고 서류: AI가 조회한 조문을 읽고 판정 (인용한 조문·문장은 원문에 있어야 한다) ----
from agent.judge import PermitJudgment, judge_permit_docs  # noqa: E402

from .fakes import PERMIT_JUDGMENT  # noqa: E402

PERMIT = check_spec(PACK, "permit_docs")


def law_res():
    return FakeTools().law("permit_docs")


def judge_permit(j=PERMIT_JUDGMENT, res=None):
    llm = FakeLLM({"judge_permit_docs": j})
    return judge_permit_docs(llm, store(), "일반음식점", res or law_res(), PERMIT, "r-04"), llm


def test_permit_ai_reads_article_and_cites_only_verified_quote():
    item, llm = judge_permit()
    assert item.verdict == "low" and item.decided_by == "ai"
    assert item.evidence[0].text == PERMIT_JUDGMENT.quotes[0] and item.evidence[0].article == "제37조"
    assert "식품위생법" in llm.calls[0]["user"] and "신고하여야 한다" in llm.calls[0]["user"]  # 조문 원문이 AI에 전달된다
    assert "일반음식점" in llm.calls[0]["user"]


def test_permit_invented_quote_becomes_unknown():
    bad = PERMIT_JUDGMENT.model_copy(update={"quotes": ["식당은 무조건 허가를 받아야 한다"]})
    item, _ = judge_permit(bad)
    assert item.verdict == "unknown" and "확인하지 못했어요" in item.reason


def test_permit_invented_article_is_dropped():
    bad = PERMIT_JUDGMENT.model_copy(update={"cited": ["식품위생법 제99조"]})
    item, _ = judge_permit(bad)
    assert item.verdict == "unknown"


def test_permit_ok_needs_a_real_citation():
    ok = PermitJudgment(verdict="ok", title="해당 없음", reason="적용 대상이 아니에요", cited=[], quotes=[])
    assert judge_permit(ok)[0].verdict == "unknown"  # 근거 조문 없이 해당 없음으로 단정하지 않는다


def test_permit_high_is_impossible_for_ai():
    # 스키마가 high를 받지 않는다 (AI 판정의 상한은 low)
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PermitJudgment(verdict="high", title="t", reason="r")


def test_permit_whitespace_and_line_breaks_in_quote_are_tolerated():
    spaced = PERMIT_JUDGMENT.model_copy(update={"quotes": ["대통령령으로 정하는 영업을  하려는 자는\n대통령령으로 정하는 바에 따라"]})
    assert judge_permit(spaced)[0].verdict == "low"


def test_permit_without_article_text_does_not_call_ai_and_is_unknown():
    llm = FakeLLM({})
    empty = ToolResult(ok=True, source="국가법령정보", data={"articles": []})
    item = judge_permit_docs(llm, store(), "일반음식점", empty, PERMIT, "r-04")
    assert llm.calls == [] and item.verdict == "unknown" and not item.evidence
    failed = judge_permit_docs(llm, store(), "일반음식점", ToolResult(ok=False, source="국가법령정보"), PERMIT, "r-04")
    assert failed.verdict == "unknown" and llm.calls == []


def test_permit_ai_failure_falls_back_to_rule_card_with_law_evidence():
    item, _ = judge_permit(LLMError("x"))
    assert item.decided_by == "rule" and item.verdict == "low" and item.evidence[0].type == "law"


# ---- 건물 용도·위반건축물: AI가 건축물대장과 조문을 읽고 판정 (규칙표는 대조용 안전장치) ----
from agent.judge import BuildingJudgment, ViolationJudgment, judge_building_use_ai, judge_violation_ai  # noqa: E402
from rules.engine import judge_building_use as rule_table  # noqa: E402

from .fakes import building_ai  # noqa: E402

BU = check_spec(PACK, "building_use")
VIO = check_spec(PACK, "building_violation")


def bu(j=None, uses=("제1종근린생활시설",), law_ok=True, biz="일반음식점"):
    tools = FakeTools(uses=uses, law_ok=law_ok)
    b, law = tools.building(store()), tools.law("building_use")
    rr = rule_table(PACK, biz, list(uses))
    llm = FakeLLM({"judge_building_use": j if j is not None else building_ai})
    return judge_building_use_ai(llm, store(), biz, b, law, rr, BU, "r-01", PACK), llm


def test_ai_building_use_reads_register_and_article_and_cites_verified_evidence():
    (item, extras), llm = bu()
    assert item.verdict == "high" and item.decided_by == "ai"
    assert item.evidence[0].value == "제1종근린생활시설" and item.evidence[1].article == "별표 1"
    assert "일반음식점을 할 수 없다" in item.evidence[1].text  # 원문에서 검증된 문장만 근거로
    assert "제1종근린생활시설" in llm.calls[0]["user"] and "별표 1" in llm.calls[0]["user"]  # AI가 읽을 데이터를 받는다
    assert extras["ok_business_types"] == ["휴게음식점"]  # 선택지(술 빼고 시작) 가능 여부도 AI 판단 + 규칙표 대조


def test_ai_building_use_invented_use_becomes_unknown():
    bad = building_ai('(business_type): 일반음식점\n(floor_uses): ["제1종근린생활시설"]\n').model_copy(update={"cited_uses": ["판매시설"]})
    (item, _), _ = bu(bad)
    assert item.verdict == "unknown" and "확인하지 못했어요" in item.reason


def test_ai_high_without_verified_article_quote_drops_to_low():
    base = building_ai('(business_type): 일반음식점\n(floor_uses): ["제1종근린생활시설"]\n')
    (item, _), _ = bu(base.model_copy(update={"quotes": ["식당은 무조건 안 된다"]}))
    assert item.verdict == "low"


def test_ai_and_rule_table_disagreement_is_lowered_to_low():
    base = building_ai('(business_type): 일반음식점\n(floor_uses): ["제1종근린생활시설"]\n')
    (item, _), _ = bu(base.model_copy(update={"verdict": "ok"}))  # 규칙표는 high인데 AI가 ok
    assert item.verdict == "low" and "달라서" in item.reason


def test_ai_high_when_rule_table_cannot_judge_is_lowered():
    (item, _), _ = bu(uses=("판매시설",))  # 규칙표 밖 용도 → 표는 unknown, AI 대역은 unknown
    assert item.verdict in ("unknown", "low")
    forced = BuildingJudgment(verdict="high", title="t", reason="r", cited_uses=["판매시설"], cited=["건축법 시행령 별표 1"],
                              quotes=["제2종 근린생활시설: 일반음식점"])
    (item2, _), _ = bu(forced, uses=("판매시설",))
    assert item2.verdict == "low"


def test_ai_failure_falls_back_to_rule_table_card():
    (item, extras), _ = bu(LLMError("x"))
    assert item.decided_by == "rule" and item.ai_fallback and item.verdict == "high"
    assert extras["ok_business_types"] == ["휴게음식점"]


def test_no_register_data_skips_ai():
    tools = FakeTools(building_ok=False)
    llm = FakeLLM({})
    rr = rule_table(PACK, "일반음식점", [])
    item, _ = judge_building_use_ai(llm, store(), "일반음식점", tools.building(store()), tools.law("building_use"), rr, BU, "r-01", PACK)
    assert llm.calls == [] and item.verdict == "unknown" and not item.ai_fallback


def test_violation_ai_reads_flag_and_never_contradicts_it():
    b = FakeTools(violation=True).building(store())
    ok = judge_violation_ai(FakeLLM({"judge_violation": ViolationJudgment(verdict="ok", title="없어요", reason="r")}), b, VIO, "r-03")
    assert ok.verdict == "high" and ok.decided_by == "ai"  # AI가 표기와 다르게 판정해도 표기 값이 이긴다
    clean = FakeTools(violation=False).building(store())
    assert judge_violation_ai(FakeLLM({"judge_violation": violation_ai_fn()}), clean, VIO, "r-03").verdict == "ok"


def violation_ai_fn():
    from .fakes import violation_ai

    return violation_ai


def test_violation_without_flag_does_not_call_ai():
    llm = FakeLLM({})
    item = judge_violation_ai(llm, FakeTools(violation=None).building(store()), VIO, "r-03")
    assert llm.calls == [] and item.verdict == "unknown" and item.evidence


def test_missing_ai_ok_types_fall_back_to_the_rule_table():
    """AI가 가능한 업종을 하나도 적지 않아도(판단을 빼먹음) 규칙표가 확인한 업종은 선택지 후보로 남는다."""
    omit = lambda user: building_ai(user).model_copy(update={"ok_business_types": []})  # noqa: E731
    (item, extras), _ = bu(j=omit)
    assert item.verdict == "high" and extras["ok_business_types"] == ["휴게음식점"]
