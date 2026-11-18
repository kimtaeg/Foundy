from agent.llm import FakeLLM, LLMError
from agent.questions import QuestionPick, select_questions
from rules.engine import load_pack

from .fakes import store

PACK = load_pack("cafe_restaurant")


def ids(qs):
    return [q.id for q in qs]


def test_required_question_always_included():
    llm = FakeLLM({"ask": QuestionPick(ids=["has_employees"])})  # AI가 sells_alcohol을 빼먹어도
    out = select_questions(llm, PACK, store(answers={}))
    assert ids(out) == ["sells_alcohol", "has_employees"]
    assert llm.calls[0]["tier"] == "fast"


def test_unknown_ids_ignored():
    llm = FakeLLM({"ask": QuestionPick(ids=["invented", "funds_krw"])})
    assert ids(select_questions(llm, PACK, store(answers={}))) == ["sells_alcohol", "funds_krw"]


def test_llm_failure_asks_all_pending():
    llm = FakeLLM({"ask": LLMError("down")})
    assert ids(select_questions(llm, PACK, store(answers={"uses_terrace": False}))) == [
        "sells_alcohol", "has_employees", "funds_krw"]


def test_nothing_pending_skips_llm():
    llm = FakeLLM({})
    full = {q["id"]: False for q in PACK["ask"]}
    assert select_questions(llm, PACK, store(answers=full)) == [] and llm.calls == []
