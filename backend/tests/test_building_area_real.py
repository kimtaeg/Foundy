"""건물 용도 판정의 면적 기준(제1종 근린생활시설 휴게음식점 300㎡ 미만)과 제목 보정.

실제 법령 DB(RAG)와 실제 LLM 을 호출한다 (CLAUDE.md Testing Policy: 목 데이터로 검증하지 않는다).
LLM_API_KEY·DATABASE_URL·저장된 법령이 없으면 건너뛴다.
"""

import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv

from agent.ports import StoreInput, ToolResult
from rules.engine import area_limit_reason, derive_business_type, judge_building_use, load_pack

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PACK = load_pack("cafe_restaurant")
J1, J2 = "제1종근린생활시설", "제2종근린생활시설"


# ---- 규칙 함수 (외부 호출 없음) ----
@pytest.mark.parametrize("bt,uses,area,expect", [
    ("휴게음식점", [J1], 350, True), ("휴게음식점", [J1], 300, True), ("휴게음식점", [J1], None, True),
    ("휴게음식점", [J1], 299.9, False), ("휴게음식점", [J2], 350, False), ("휴게음식점", [J1, J2], 350, False),
    ("일반음식점", [J2], 350, False), ("휴게음식점", [], 350, False), ("휴게음식점", ["업무시설"], 350, False),
])
def test_area_limit_reason(bt, uses, area, expect):
    assert (area_limit_reason(PACK, bt, uses, area) is not None) is expect


# ---- 실제 호출 ----
@pytest.fixture(scope="module")
def real():
    if not os.getenv("LLM_API_KEY") or not os.getenv("DATABASE_URL"):
        pytest.skip("LLM_API_KEY·DATABASE_URL 이 없어 실제 호출 테스트를 건너뜀")
    from agent.cost import CostTracker
    from agent.llm import make_llm
    from law_rag.embedder import make_embedder
    from law_rag.service import LawRag

    rag = LawRag(embedder=make_embedder(), pack=PACK)
    if not rag.has_data(["건축법 시행령"]):
        pytest.skip("저장된 법령이 없어 건너뜀")
    return rag, make_llm(CostTracker())


def run(real, *, alcohol, area, floor, uses):
    from agent.judge import judge_building_use_ai

    rag, llm = real
    store = StoreInput(store_id="t", name="테스트가게", address="서울 성동구 성수이로 00", address_detail=floor,
                       opening_date=date(2027, 3, 2), area_sqm=area, answers={"sells_alcohol": alcohol, "does_delivery": True})
    bt = derive_business_type(PACK, store.answers)
    law = rag.articles_for("building_use", store)
    b = ToolResult(ok=True, source="건축물대장(입력값)", data={"floor_uses": uses, "violation": None})
    spec = next(c for c in PACK["checks"] if c["id"] == "building_use")
    item, _ = judge_building_use_ai(llm, store, bt, b, law, judge_building_use(PACK, bt, uses), spec, "x", PACK)
    return item


def test_real_cafe_300_or_more_in_type1_is_not_ok(real):
    for area in (350, 300):
        item = run(real, alcohol=False, area=area, floor="1층", uses=[J1])
        assert item.verdict == "low" and "300㎡ 미만" in item.reason and "구청 건축과" in item.reason


def test_real_cafe_without_area_in_type1_is_not_ok(real):
    assert run(real, alcohol=False, area=None, floor="1층", uses=[J1]).verdict == "low"


def test_real_small_cafe_in_type1_is_ok(real):
    assert run(real, alcohol=False, area=40, floor="1층", uses=[J1]).verdict == "ok"


def test_real_lowered_card_uses_template_title_not_ai_claim(real):
    item = run(real, alcohol=True, area=120, floor="5층", uses=["업무시설"])
    assert item.verdict == "low" and "확인이 필요해요" in item.title and "없어요" not in item.title


def test_real_original_input_type1_floor_stays_high(real):
    item = run(real, alcohol=True, area=120, floor="2층", uses=[J1])
    assert item.verdict == "high" and "제2종" in item.reason
