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
