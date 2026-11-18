"""mocks/demo/seoyeon.json (예시로 해보기 저장 결과)이 계약을 지키는지 검증한다.

이 파일은 LLM이 쓴 문장을 담고 있어서, 다시 만든 뒤에도 같은 불변 규칙을 지켜야 한다.
"""

import json
from pathlib import Path

import pytest

from agent.guardrails import enforce
from agent.ports import StoreInput
from agent.schemas import ChecklistItem, Question, ReportItem
from rules.engine import check_spec, derive_business_type, load_pack

DEMO = Path(__file__).resolve().parent.parent / "mocks" / "demo"
PACK = load_pack("cafe_restaurant")

pytestmark = pytest.mark.skipif(not (DEMO / "seoyeon.json").exists(), reason="저장 결과가 아직 없어요")


@pytest.fixture(scope="module")
def demo() -> dict:
    return json.loads((DEMO / "seoyeon.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def items(demo) -> list[ReportItem]:
    return [ReportItem(**i) for i in demo["report_items"]]


def test_marked_as_example(demo):
    assert demo["is_demo"] is True and demo["is_example"] is True and demo["example_notice"]


def test_matches_inputs_and_rules(demo):
    inputs = json.loads((DEMO / "seoyeon_inputs.json").read_text(encoding="utf-8"))
    assert StoreInput(**demo["store"]) == StoreInput(**inputs["store"])
    assert demo["business_type"] == derive_business_type(PACK, demo["store"]["answers"]) == "일반음식점"


def test_models_parse(demo):
    [Question(**q) for q in demo["questions"]]
    [ChecklistItem(**c) for c in demo["checklist"]]
    assert "sells_alcohol" in [q["id"] for q in demo["questions"]]  # 필수 질문


def test_guardrails_find_nothing_to_fix(items, demo):
    assert demo["guardrail_changes"] == []
    for item in items:
        _, changes = enforce(item, allowed_remedies=check_spec(PACK, item.check_id)["remedies"])
        assert changes == [], item.check_id


def test_ids_unique(items, demo):
    assert len({i.item_id for i in items}) == len(items)
    assert len({c["item_id"] for c in demo["checklist"]}) == len(demo["checklist"])
    prepared = [p.prepared_id for i in items for p in i.prepared]
    assert len(prepared) == len(set(prepared))
    for i in items:
        assert len({o.option_id for o in i.options}) == len(i.options)


def test_every_problem_has_a_card(items):
    for i in items:
        if i.verdict == "ok":
            assert not i.options and i.user_action is None
            continue
        assert i.reason and i.consequence, i.check_id
        assert i.user_action and i.user_action.text, i.check_id
        if i.options:
            assert i.recommendation and i.recommendation.reason, i.check_id
        for o in i.options:  # 근거 없는 숫자 금지
            for est in (o.time, o.cost):
                assert est.basis is not None or (est.text == "확인 필요" and est.delta_krw is None)


def test_evidence_present_and_marked_mock(items):
    for i in items:
        assert i.evidence or i.verdict == "unknown", i.check_id
        for e in i.evidence:
            if e.type == "data" and e.source and "예시" in e.source:
                assert e.from_mock is True


def test_story_includes_site_change_card(items):
    bu = next(i for i in items if i.check_id == "building_use")
    assert bu.verdict == "high" and bu.decided_by == "rule"
    site = next(o for o in bu.options if o.remedy == "change_site")
    assert site.site_id == "st-02" and site.cost.basis == "calc" and site.cost.delta_krw == 4_000_000
    assert bu.added_to_checklist


def test_events_replayable(demo, items):
    ev = demo["events"]
    assert ev[0]["event"] == "step" and ev[0]["data"]["step"] == "building"
    assert ev[-1]["event"] == "done" and ev[-1]["data"]["summary"] == demo["summary"]
    assert [e["data"]["check_id"] for e in ev if e["event"] == "item"] == [i.check_id for i in items]
    assert demo["summary"] == {k: sum(1 for i in items if i.verdict == k) for k in ("high", "low", "unknown", "ok")}
    assert any(e["data"].get("status") == "fallback" for e in ev if e["event"] == "step")  # 예시 응답은 fallback 표시
