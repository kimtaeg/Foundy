"""AI 상담 에이전트. 출처 정리·화면 이동 규칙은 외부 호출 없이, 상담 흐름은 실제 LLM·실제 법령 DB로 확인한다.

실제 호출 테스트는 LLM_PROVIDER=openai·LLM_API_KEY·DATABASE_URL 이 없으면 건너뛴다. DB 에 쓰지 않는다 (읽기 도구만 쓴다).
"""

import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv

from agent.assistant import UNGROUNDED_LAW_NOTE, ToolBox, finalize, history_messages, run_turn

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def box_with(*sources, used=()):
    box = ToolBox({})
    for source_type, title in sources:
        box.sources.add(source_type, title, source_id=title)
    box.used = list(used)
    return box


def test_finalize_keeps_only_refs_from_tool_results():
    box = box_with(("law", "식품위생법 제41조"), ("checklist", "위생교육"), used=["search_laws", "get_checklist"])
    text, cites, actions = finalize("교육을 받아요 [S1, 식품위생법 제41조]. 일정은 [S2][S7].", box)
    assert text == "교육을 받아요 [S1]. 일정은 [S2]."
    assert [c["source_title"] for c in cites] == ["식품위생법 제41조", "위생교육"]
    assert actions == [{"type": "navigate", "target": "checklist", "label": "체크리스트 보기"}]


def test_finalize_reads_refs_written_after_law_names():
    box = box_with(("law", "식품위생법 시행령 제21조"), ("law", "식품위생법 시행규칙 별표 17"), used=["search_laws"])
    text, cites, _ = finalize("술은 못 팔아요[식품위생법 시행령 제21조, 식품위생법 시행규칙 별표 17 S1, S2]. [참고]", box)
    assert text == "술은 못 팔아요[S1][S2]. [참고]" and len(cites) == 2 and UNGROUNDED_LAW_NOTE not in text


def test_finalize_warns_when_law_searched_but_not_cited():
    box = box_with(("law", "식품위생법 제41조"), used=["search_laws"])
    text, cites, _ = finalize("휴게음식점은 술을 못 팔아요.", box)
    assert cites == [] and text.endswith(UNGROUNDED_LAW_NOTE)


def test_finalize_no_navigation_without_citation():
    box = box_with(("checklist", "위생교육"), used=["get_checklist"])
    assert finalize("안녕하세요!", box)[2] == []


def test_same_source_gets_same_ref():
    box = ToolBox({})
    assert box.sources.add("law", "A", source_id="A") == box.sources.add("law", "A", source_id="A") == "S1"


def test_history_keeps_only_user_and_assistant_recent():
    rows = [("user", f"q{i}") for i in range(20)] + [("tool", "x"), ("assistant", "")]
    out = history_messages(rows)
    assert len(out) == 12 and all(m["role"] == "user" for m in out)


@pytest.fixture(scope="module")
def real():
    if os.getenv("LLM_PROVIDER", "").lower() != "openai" or not os.getenv("LLM_API_KEY") or not os.getenv("DATABASE_URL"):
        pytest.skip("LLM_PROVIDER=openai·LLM_API_KEY·DATABASE_URL 이 없어 실제 호출 테스트를 건너뜀")
    from agent.cost import CostTracker
    from agent.llm import make_llm

    return make_llm(CostTracker())


def test_real_law_question_searches_and_cites_law(real):
    """법령 질문은 저장된 조문을 검색하고, 인용한 출처는 모두 도구 결과에 있는 조문이다."""
    from db.session import transaction
    from law_rag import retriever
    from law_rag.embedder import make_embedder
    from services.pack import get_pack

    def laws(query):
        with transaction() as session:
            hits = retriever.search(session, query=query, keywords=query.split()[:6], names=get_pack()["law_sources"],
                                    embedder=make_embedder(), top_k=5)
            return retriever.merge_by_article(hits)

    box = ToolBox({"search_laws": laws, "get_checklist": lambda: {"groups": []},
                   "get_business_profile": lambda: {"name": "테스트카페"}, "get_documents": lambda: {"requirements": []},
                   "get_report": lambda: {"groups": []}, "search_support_programs": lambda: {"items": []}})
    profile = {"name": "테스트카페", "business_type": "휴게음식점", "address": "서울특별시 성동구", "opening_date": "2027-03-02"}
    events = list(run_turn(real, profile=profile, history=[], question="휴게음식점과 일반음식점은 법적으로 뭐가 달라?",
                           box=box, today=date(2026, 11, 22)))
    tools = [d["name"] for k, d in events if k == "tool"]
    done = next(d for k, d in events if k == "done")
    assert "search_laws" in tools
    assert done["content"]
    for cite in done["citations"]:  # 인용은 모두 실제로 검색된 조문이다
        assert cite["source_type"] == "law" and cite["source_title"] in {s["source_title"] for s in box.sources.items.values()}
