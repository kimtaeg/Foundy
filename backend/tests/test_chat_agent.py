"""AI 상담 에이전트. 출처 정리·화면 이동 규칙은 외부 호출 없이, 상담 흐름은 실제 LLM·실제 법령 DB로 확인한다.

실제 호출 테스트는 LLM_PROVIDER=openai·LLM_API_KEY·DATABASE_URL 이 없으면 건너뛴다. DB 에 쓰지 않는다 (읽기 도구만 쓴다).
"""

import json
import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import load_dotenv

from agent.assistant import (OUT_OF_SCOPE_REPLY, UNGROUNDED_LAW_NOTE, ToolBox, finalize,
                             history_messages, run_turn)
from agent.llm import LLMError

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


def test_unrelated_question_is_rejected_before_llm_call():
    class ExplodingLLM:
        def stream_tools(self, **kwargs):
            raise AssertionError("범위 밖 질문은 LLM을 호출하면 안 됩니다")

    events = list(run_turn(ExplodingLLM(), profile={}, history=[], question="오늘 주식 뭐가 좋아요?",
                           box=ToolBox({}), today=date(2026, 11, 22)))
    assert events == [("delta", OUT_OF_SCOPE_REPLY),
                      ("done", {"content": OUT_OF_SCOPE_REPLY, "citations": [], "actions": []})]


def test_contextual_follow_up_remains_allowed():
    class ChatLLM:
        def stream_tools(self, *, step, tier, messages, tools, require_tool):
            if tier == "fast":
                yield "final", {"content": "", "tool_calls": [{"id": "law-1", "type": "function",
                    "function": {"name": "search_laws", "arguments": '{"query":"식품위생법"}'}}]}
            else:
                yield "final", {"content": "확인해 볼게요.", "tool_calls": []}

    box = ToolBox({"search_laws": lambda _: [{"law_name": "식품위생법", "article": "제41조"}]})
    events = list(run_turn(ChatLLM(), profile={}, history=[{"role": "user", "content": "영업신고가 필요해요?"}],
                           question="그럼 어떻게 해요?", box=box, today=date(2026, 11, 22)))
    assert events[-1][0] == "done"


def test_history_keeps_only_user_and_assistant_recent():
    rows = [("user", f"q{i}") for i in range(20)] + [("tool", "x"), ("assistant", "")]
    out = history_messages(rows)
    assert len(out) == 12 and all(m["role"] == "user" for m in out)


def test_turn_reuses_law_queries_with_same_terms_and_preserves_evidence():
    reads = []

    def laws(query):
        reads.append(query)
        return [{"law_name": query, "article": "제41조", "text": "정확한 조문 원문.\n공백 유지."}]

    def call(index, query):
        return {"id": f"law-{index}", "type": "function", "function": {
            "name": "search_laws", "arguments": json.dumps({"query": query})}}

    first_query, second_query = "식품위생법", "식품위생법 시행령"
    profile = {"name": "테스트 카페", "answers": {"alcohol": False}}
    history = [{"role": "user", "content": "가게 준비 중이에요."}]

    class ChatLLM:
        def stream_tools(self, *, step, tier, messages, tools, require_tool):
            if tier == "fast":
                assert json.loads(messages[0]["content"].split("[사업장 정보]\n")[-1]) == profile
                assert messages[1:-1] == history
                yield "final", {"content": "", "tool_calls": [call(1, first_query), call(2, f" {first_query} "),
                                                                call(3, second_query)]}
                return
            tools_used = [message for message in messages if message["role"] == "tool"]
            assert [message["tool_call_id"] for message in tools_used] == ["law-1", "law-2", "law-3"]
            assert tools_used[0]["content"] == tools_used[1]["content"]
            payloads = [json.loads(message["content"]) for message in tools_used]
            assert [payload["query"] for payload in payloads] == [first_query, first_query, second_query]
            assert [payload["articles"][0]["text"] for payload in payloads] == ["정확한 조문 원문.\n공백 유지."] * 3
            assert tools_used[0]["content"] == json.dumps(payloads[0], ensure_ascii=False, separators=(",", ":"))
            yield "final", {"content": "조문을 확인하세요 [S1][S2].", "tool_calls": []}

    box = ToolBox({"search_laws": laws})
    events = list(run_turn(ChatLLM(), profile=profile, history=history, question="어떤 규정이 적용되나요?",
                           box=box, today=date(2026, 11, 22)))
    assert reads == [first_query, second_query]
    assert [cite["source_title"] for cite in events[-1][1]["citations"]] == [
        f"{first_query} 제41조", f"{second_query} 제41조"]


def test_turn_retries_failed_read_and_reuses_checklist_with_different_filters():
    calls = []

    def checklist():
        calls.append("read")
        if len(calls) == 1:
            raise RuntimeError("temporary failure")
        return {"groups": [{"items": [{"item_id": "one", "task": "완료", "done": True},
                                      {"item_id": "two", "task": "남은 일", "done": False}]}]}

    box = ToolBox({"get_checklist": checklist})
    with pytest.raises(RuntimeError, match="temporary failure"):
        box.run("get_checklist", {})
    items = box.run("get_checklist", {})["items"]
    assert [item["task"] for item in items] == ["완료", "남은 일"]
    assert box.run("get_checklist", {"only_open": True})["items"] == [items[1]]
    assert calls == ["read", "read"]


@pytest.mark.parametrize("first_plan", ["tool", "error", "empty"])
def test_fast_model_selects_tool_and_main_model_streams_grounded_answer(first_plan):
    class ChatLLM:
        def __init__(self):
            self.calls = []

        def stream_tools(self, *, step, tier, messages, tools, require_tool):
            self.calls.append((step, tier, require_tool))
            if tier == "fast":
                if first_plan == "error":
                    raise LLMError("빠른 모델 사용 불가")
                yield "delta", "화면에는 보내지 않는 중간 텍스트"
                if first_plan == "empty":
                    yield "final", {"content": "", "tool_calls": []}
                    return
            if require_tool:
                yield "final", {"content": "", "tool_calls": [{"id": "law-1", "type": "function", "function": {
                    "name": "search_laws", "arguments": '{"query":"식품위생법"}',
                }}]}
                return
            assert messages[-1]["role"] == "tool" and "식품위생법" in messages[-1]["content"]
            answer = "식품위생법 제41조를 확인해 주세요 [S1]."
            yield "delta", answer
            yield "final", {"content": answer, "tool_calls": []}

    llm = ChatLLM()
    box = ToolBox({"search_laws": lambda _: [{"law_name": "식품위생법", "article": "제41조"}]})
    events = list(run_turn(llm, profile={}, history=[], question="법적으로 위생교육을 받아야 하나요?",
                           box=box, today=date(2026, 11, 22)))
    expected_calls = [("chat_plan", "fast", True)]
    if first_plan != "tool":
        expected_calls.append(("chat", "main", True))
    assert llm.calls == [*expected_calls, ("chat", "main", False)]
    assert [kind for kind, _ in events] == ["assistant_tools", "tool", "delta", "done"]
    assert events[-1][1]["citations"][0]["source_title"] == "식품위생법 제41조"


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
