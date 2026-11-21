"""실제 모드(USE_MOCK=false)에서 모의 조문이 법령 판정의 근거가 되지 않게 한다 (#68).

- 실제 조문(저장된 법령 검색·법령 API·그 캐시)을 확보하고 인용을 검증했을 때만 기존 high 허용 조건을 통과한다.
- 모의 조문만 있거나 찾지 못했으면 법령에 기대는 판정(건물 용도·법령 카드)은 unknown 과 이유를 남긴다.
- 위반건축물은 건축물대장 표기만으로 판정하므로 법령과 별개다. 명시한 모의 모드(USE_MOCK=true)는 그대로다.
"""

from agent.judge import BuildingJudgment, REAL_LAW_REASON
from agent.llm import FakeLLM
from agent.loop import run_analysis
from agent.ports import ToolResult
from rules.engine import load_pack

from .fakes import (
    AI_JUDGES, ARTICLE_37, BUILDING_ADVICE, BYUL_1, PERMIT_JUDGMENT, SIMILAR, TM_ADVICE, TM_JUDGMENT, FakeCalc,
    FakeTools, store,
)

PACK = load_pack("cafe_restaurant")
REAL_BUILDING = ToolResult(ok=True, source="건축HUB 층별개요", data={"floor_uses": ["제1종근린생활시설"], "violation": False})


class Tools(FakeTools):
    """use_mock 값이 실제/모의 모드를 정한다. law 는 check_id → ToolResult 로 바꿔 끼운다."""

    def __init__(self, use_mock: bool, laws: dict, building: ToolResult = REAL_BUILDING):
        super().__init__(similar=SIMILAR)
        self.use_mock, self.laws, self.b, self.law_calls = use_mock, laws, building, []

    def building(self, s):
        return self.b

    def law(self, check_id, store=None):
        self.law_calls.append(check_id)
        return self.laws.get(check_id) or ToolResult(ok=False, source="국가법령정보 (저장된 조문 검색)", error="LAW_NOT_FOUND")


def article(law_name, number, text, mock=False):
    return ToolResult(ok=True, source="국가법령정보 (예시)" if mock else "국가법령정보센터 (저장된 조문 검색)",
                      from_mock=mock, data={"articles": [{"law_name": law_name, "article": number, "text": text,
                                                          "url": "https://www.law.go.kr/x"}]})


def mock_laws():
    return {"building_use": article("건축법 시행령", "별표 1", BYUL_1, mock=True),
            "permit_docs": article("식품위생법", "제37조", ARTICLE_37, mock=True)}


def real_laws():
    return {"building_use": article("건축법 시행령", "별표 1", BYUL_1),
            "permit_docs": article("식품위생법", "제37조", ARTICLE_37)}


def llm(**over):
    base = {**AI_JUDGES, "judge_trademark": TM_JUDGMENT, "judge_permit_docs": PERMIT_JUDGMENT,
            "judge_law_card": PERMIT_JUDGMENT, "advise_building_use": BUILDING_ADVICE, "advise_trademark_similar": TM_ADVICE}
    base.update(over)
    return FakeLLM(base)


def run(tools, llm_=None, scope=None):
    fake = llm_ or llm()
    res = run_analysis(store(), tools=tools, calc=FakeCalc(), llm=fake, pack=PACK, scope=scope)
    return {i.check_id: i for i in res.items}, fake


def steps(fake):
    return [c["step"] for c in fake.calls]


def test_real_register_with_mock_article_never_becomes_high():
    found, fake = run(Tools(use_mock=False, laws=mock_laws()))
    bu, permit = found["building_use"], found["permit_docs"]
    assert bu.verdict == "unknown" and bu.decided_by == "rule" and REAL_LAW_REASON in bu.reason
    assert [e.type for e in bu.evidence] == ["data"] and not any(e.from_mock for e in bu.evidence)  # 모의 조문은 근거로 안 남긴다
    assert "judge_building_use" not in steps(fake)  # 실제 조문이 없으면 AI 에게 판단을 맡기지 않는다
    assert permit.verdict == "unknown" and permit.reason == REAL_LAW_REASON and permit.evidence == []
    assert "judge_permit_docs" not in steps(fake)
    assert found["building_violation"].verdict == "ok"  # 위반 표기는 법령과 별개로 판정


def test_mock_article_quoted_by_ai_is_still_blocked():
    """재현 사례: AI 가 모의 조문 문장을 그대로 인용해도 실제 근거로 인정하지 않는다."""
    quoted = BuildingJudgment(verdict="high", title="t", reason="r", cited_uses=["제1종근린생활시설"],
                              cited=["건축법 시행령 별표 1"], quotes=["제1종 근린생활시설에서는 일반음식점을 할 수 없다"])
    found, _ = run(Tools(use_mock=False, laws=mock_laws()), llm(judge_building_use=quoted))
    assert found["building_use"].verdict == "unknown"


def test_no_article_found_or_search_failure_is_unknown_with_reason():
    for laws in ({}, {"building_use": ToolResult(ok=False, source="국가법령정보센터 (저장된 조문 검색)", error="조문 검색 실패"),
                      "permit_docs": ToolResult(ok=False, source="국가법령정보", error="LAW_REFERENCE_UNCONFIRMED")}):
        found, _ = run(Tools(use_mock=False, laws=laws))
        assert found["building_use"].verdict == "unknown" and REAL_LAW_REASON in found["building_use"].reason
        assert found["permit_docs"].verdict == "unknown" and found["permit_docs"].reason == REAL_LAW_REASON


def test_verified_real_article_keeps_existing_high_rule():
    found, fake = run(Tools(use_mock=False, laws=real_laws()))
    bu = found["building_use"]
    assert bu.verdict == "high" and bu.decided_by == "ai"
    law_ev = [e for e in bu.evidence if e.type == "law"]
    assert law_ev and not any(e.from_mock for e in law_ev) and "일반음식점을 할 수 없다" in law_ev[0].text
    assert found["permit_docs"].verdict == "low" and not found["permit_docs"].evidence[0].from_mock


def test_real_article_with_unverified_quote_still_drops_to_low():
    bad = BuildingJudgment(verdict="high", title="t", reason="r", cited_uses=["제1종근린생활시설"],
                           cited=["건축법 시행령 별표 1"], quotes=["식당은 무조건 안 된다"])
    found, _ = run(Tools(use_mock=False, laws=real_laws()), llm(judge_building_use=bad))
    assert found["building_use"].verdict == "low"  # 기존 인용 검증 조건 그대로


def test_cached_real_article_counts_as_real():
    cached = article("건축법 시행령", "별표 1", BYUL_1).model_copy(update={"from_cache": True})
    found, _ = run(Tools(use_mock=False, laws={**real_laws(), "building_use": cached}))
    assert found["building_use"].verdict == "high"


def test_explicit_mock_mode_demo_is_unchanged():
    found, _ = run(Tools(use_mock=True, laws=mock_laws()))
    assert found["building_use"].verdict == "high" and found["building_use"].evidence[1].from_mock
    assert found["permit_docs"].verdict == "low"


def test_building_only_rerun_in_real_mode_looks_up_building_article_only():
    tools = Tools(use_mock=False, laws=real_laws())
    found, _ = run(tools, scope=["building"])
    assert tools.law_calls == ["building_use"]  # 층·호만 다시 반영해도 건물 용도 조문 하나만 찾는다
    assert found["building_use"].verdict == "high"
