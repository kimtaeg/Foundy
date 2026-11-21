"""AI 법령 적용 판정. 병합 규칙은 외부 호출 없이, 판정은 실제 법령 DB(RAG)와 실제 LLM 으로 확인한다 (CLAUDE.md Testing Policy).

LLM_API_KEY·DATABASE_URL·저장된 법령이 없으면 실제 호출 테스트는 건너뛴다.
"""

import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv

from agent.ports import StoreInput
from rules.ai_applicability import RuleJudgment, _merge, refine_obligations
from rules.applicability import APPLIES, NEEDS_CHECK, NOT_APPLICABLE, RuleOutcome, evaluate_rules, facts_of
from rules.engine import derive_business_type, load_pack

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
PACK = load_pack("cafe_restaurant")
ARTS = {"법 제1조": {"text": "영업을 하려는 자는 신고해야 한다"}}


def _outcome(**kw) -> RuleOutcome:
    base = dict(rule_id="R", title="t", status=APPLIES, reason="코드 판정")
    base.update(kw)
    return RuleOutcome(**base)


def test_merge_rejects_unverified_quote():
    ai = RuleJudgment(rule_id="R", status="not_applicable", reason="해당 없음", cited=["법 제1조"], quote="원문에 없는 문장")
    assert _merge(_outcome(), ai, ARTS).status == APPLIES  # 근거를 검증하지 못하면 코드 판정을 쓴다


def test_merge_accepts_verified_quote():
    ai = RuleJudgment(rule_id="R", status="not_applicable", reason="해당 없음", cited=["법 제1조"],
                      quote="영업을 하려는 자는  신고해야 한다")
    assert _merge(_outcome(), ai, ARTS).status == NOT_APPLICABLE


def test_merge_article_beats_rule_even_when_input_missing():
    ai = RuleJudgment(rule_id="R", status="applies", reason="적용", cited=["법 제1조"], quote="영업을 하려는 자는 신고해야 한다")
    out = _merge(_outcome(status=NEEDS_CHECK, missing_inputs=["area_sqm"]), ai, ARTS)
    assert out.status == APPLIES and out.missing_inputs == []


def test_merge_needs_check_is_always_accepted():
    ai = RuleJudgment(rule_id="R", status="needs_check", reason="확인 필요")
    assert _merge(_outcome(), ai, ARTS).status == NEEDS_CHECK


@pytest.fixture(scope="module")
def real():
    if not os.getenv("LLM_API_KEY") or not os.getenv("DATABASE_URL"):
        pytest.skip("LLM_API_KEY·DATABASE_URL 이 없어 실제 호출 테스트를 건너뜀")
    from agent.cost import CostTracker
    from agent.llm import make_llm
    from law_rag.embedder import make_embedder
    from law_rag.service import LawRag

    rag = LawRag(embedder=make_embedder(), pack=PACK)
    if not rag.has_data(["식품위생법"]):
        pytest.skip("저장된 법령이 없어 건너뜀")
    return rag, make_llm(CostTracker())


def judge(real, *, area, floor, employees, alcohol=False):
    rag, llm = real
    store = StoreInput(store_id="t", name="테스트가게", address="서울 성동구 성수이로 00", address_detail=floor,
                       opening_date=date(2027, 3, 2), area_sqm=area,
                       answers={"sells_alcohol": alcohol, "has_employees": employees})
    bt = derive_business_type(PACK, store.answers)
    base = evaluate_rules(PACK, store, bt)
    ids = [c["id"] for c in PACK["checks"] if c.get("law_card") or c["id"] == "permit_docs"]
    laws = {cid: res for cid in ids if (res := rag.articles_for(cid, store)) is not None}
    out = refine_obligations(llm, PACK, store, bt, base, laws, facts_of(store, bt))
    return {o.rule_id: o for o in out}


def test_real_labor_rules_follow_employees(real):
    yes = judge(real, area=40, floor="1층", employees=True)
    no = judge(real, area=40, floor="1층", employees=False)
    assert yes["LABOR-CONTRACT-001"].status in (APPLIES, NEEDS_CHECK)
    assert no["LABOR-CONTRACT-001"].status in (NOT_APPLICABLE, NEEDS_CHECK)


def test_real_fire_small_ground_floor_is_not_forced(real):
    out = judge(real, area=40, floor="1층", employees=True)
    assert out["FIRE-DENSE-001"].status != APPLIES
    assert out["FOOD-REPORT-001"].status == APPLIES


def test_merge_drops_invented_missing_inputs():
    ai = RuleJudgment(rule_id="R", status="needs_check", reason="확인", missing_inputs=["kitchen_status", "area_sqm"])
    assert _merge(_outcome(), ai, ARTS).missing_inputs == ["area_sqm"]


def test_merge_accepts_ellipsis_quote_in_order_only():
    arts = {"법 제1조": {"text": "영업장으로 사용하는 바닥면적의 합계가 100제곱미터 이상인 것"}}
    ok = RuleJudgment(rule_id="R", status="applies", reason="r", cited=["법 제1조"], quote="영업장으로 사용하는 바닥면적... 합계가 100제곱미터 이상")
    bad = RuleJudgment(rule_id="R", status="applies", reason="r", cited=["법 제1조"], quote="합계가 100제곱미터 이상... 영업장으로 사용하는 바닥면적")
    assert _merge(_outcome(status=NEEDS_CHECK), ok, arts).status == APPLIES
    assert _merge(_outcome(status=NEEDS_CHECK), bad, arts).status == NEEDS_CHECK
