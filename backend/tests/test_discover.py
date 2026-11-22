"""조문에서 의무 찾기 (agent/discover.py).

검증·카드·작업 변환은 외부 호출 없이, 의무 찾기 자체는 실제 법령 DB(RAG)와 실제 LLM 으로 확인한다 (CLAUDE.md Testing Policy).
LLM_API_KEY·DATABASE_URL 이 없으면 실제 호출 테스트는 건너뛴다.
"""

import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv

from agent.discover import FoundObligation, accept, card_of, covered_keys, is_found, task_of
from agent.ports import StoreInput, ToolResult
from calc.dates import Dates
from rules.engine import check_spec, derive_business_type, load_pack

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
PACK = load_pack("cafe_restaurant")
ART = {"law_name": "근로기준법", "article": "제41조", "url": "https://www.law.go.kr/x",
       "text": "① 사용자는 각 사업장별로 근로자 명부를 작성하고 근로자의 성명, 생년월일, 이력을 적어야 한다."}
BY_KEY = {"근로기준법 제41조": ART}
RES = ToolResult(ok=True, source="국가법령정보센터 (저장된 조문 검색)", data={"articles": [ART]})


def _ob(**kw) -> FoundObligation:
    base = dict(law_key="근로기준법 제41조", quote="사용자는 각 사업장별로 근로자 명부를 작성하고", status="applies",
                title="직원 명부를 작성해야 해요", reason="직원을 고용하면 근로자 명부를 써야 해요.",
                task="근로자 명부 작성하기", category="고용", group="개업 직전", stage="개업 전")
    base.update(kw)
    return FoundObligation(**base)


def test_accept_keeps_verified_quote():
    found = accept([_ob()], BY_KEY, RES, 6)
    assert len(found) == 1 and found[0].evidence.article == "제41조"


def test_accept_drops_quote_not_in_article():
    assert accept([_ob(quote="사용자는 근로자에게 매달 상여금을 지급하여야 한다")], BY_KEY, RES, 6) == []


def test_accept_drops_unknown_article():
    assert accept([_ob(law_key="근로기준법 제99조")], BY_KEY, RES, 6) == []


def test_accept_dedupes_same_sentence_and_limits_count():
    same = [_ob(), _ob(title="다른 제목")]
    assert len(accept(same, BY_KEY, RES, 6)) == 1  # 같은 조문·같은 문장은 한 번만
    many = [_ob(quote="사용자는 각 사업장별로 근로자 명부를 작성하고"), _ob(quote="근로자의 성명, 생년월일, 이력을 적어야 한다")]
    assert len(accept(many, BY_KEY, RES, 1)) == 1  # 전체 개수 제한


def test_id_is_stable_for_same_article_and_quote():
    a = accept([_ob()], BY_KEY, RES, 6)[0]
    b = accept([_ob(title="표현만 다른 제목", task="명부 쓰기")], BY_KEY, RES, 6)[0]
    assert a.key == b.key  # 다시 분석해 AI 표현이 바뀌어도 같은 카드·작업이 된다


def test_card_and_task_are_linked():
    f = accept([_ob(status="needs_check", missing_info="일용직만 쓰는지 확인")], BY_KEY, RES, 6)[0]
    card = card_of(f)
    assert is_found(card.check_id) and card.verdict == "low" and card.decided_by == "ai"
    assert "일용직만 쓰는지 확인" in card.reason
    assert check_spec(PACK, card.check_id)["dynamic"]  # 규칙 묶음에 없는 동적 카드도 공통 값을 찾는다
    task = task_of(f, PACK, Dates(), date(2027, 3, 1), card.item_id)
    assert task.task_type == "conditional" and task.source_type == "legal_analysis"
    assert task.report_item_ids == [card.item_id] and task.rule_key == task.item_id
    assert task.due_date == date(2027, 2, 22)  # 개업 직전 = 개업일 - 7일 (group_offsets)
    assert {"type": "inspection", "check_id": card.check_id, "item_id": card.item_id} in task.sources


def test_covered_keys_include_rule_articles():
    keys = covered_keys(PACK, {})
    assert "식품위생법 제37조" in keys and "근로기준법 제17조" in keys  # 적용 규칙이 이미 다루는 조문은 AI에 넘기지 않는다


@pytest.fixture(scope="module")
def real():
    if not os.getenv("LLM_API_KEY") or not os.getenv("DATABASE_URL"):
        pytest.skip("LLM_API_KEY·DATABASE_URL 이 없어 실제 호출 테스트를 건너뜀")
    from agent.cost import CostTracker
    from agent.llm import make_llm
    from law_rag.embedder import make_embedder
    from law_rag.service import LawRag

    rag = LawRag(embedder=make_embedder(), pack=PACK)
    return rag, make_llm(CostTracker())


def _store(**answers) -> StoreInput:
    return StoreInput(store_id="t", name="테스트", business_type_input="음식점", address="서울특별시 강남구 언주로69길 16",
                      address_detail="1층", address_codes={}, opening_date=date(2027, 3, 1), owner_birth_year=None,
                      answers=answers, area_sqm=None)


@pytest.mark.llm
def test_real_discovery_finds_verified_obligations(real):
    from agent.discover import discover

    rag, llm = real
    store = _store(sells_alcohol=True, has_employees=True, uses_terrace=False)
    res = rag.discover(store)
    assert res is not None and res.ok and res.data["articles"]
    found = discover(llm, PACK, store, derive_business_type(PACK, store.answers), res, {})
    assert found, "주류·직원이 있는 음식점에서 새 의무를 하나도 찾지 못함"
    for f in found:
        assert f.obligation.quote and f.evidence.law_name  # accept 가 원문 인용을 검증했다
        assert f"{f.evidence.law_name} {f.evidence.article}" not in covered_keys(PACK, {})
