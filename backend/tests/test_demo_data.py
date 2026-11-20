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
        spec = check_spec(PACK, item.check_id)
        _, changes = enforce(item, allowed_remedies=spec["remedies"],
                             allow_empty_evidence=bool(spec.get("allow_empty_evidence")))
        assert changes == [], item.check_id


def test_ids_unique(items, demo):
    assert len({i.item_id for i in items}) == len(items)
    assert len({c["item_id"] for c in demo["checklist"]}) == len(demo["checklist"])
    for i in items:
        assert len({o.option_id for o in i.options}) == len(i.options)


def test_every_problem_has_a_card(items):
    for i in items:
        if i.verdict == "ok":
            assert not i.options and i.user_action is None
            continue
        assert i.contact is None or i.contact.agency
        assert i.reason and i.consequence, i.check_id
        assert i.user_action and i.user_action.text, i.check_id
        if i.options:
            assert i.recommendation and i.recommendation.reason, i.check_id
        for o in i.options:  # 근거 없는 숫자 금지
            for est in (o.time, o.cost):
                assert est.basis is not None or (est.text == "확인 필요" and est.delta_krw is None)


def test_evidence_present_and_marked_mock(items):
    for i in items:
        assert i.evidence or i.verdict == "unknown" or i.check_id == "labeling", i.check_id  # labeling은 안내 항목
        for e in i.evidence:
            if e.type == "data" and e.source and "예시" in e.source:
                assert e.from_mock is True


def test_story_building_card_has_find_other_site_and_contact(items):
    bu = next(i for i in items if i.check_id == "building_use")
    assert bu.verdict == "high" and bu.decided_by == "rule"
    assert [o.remedy for o in bu.options] == ["change_business_type", "request_use_change", "find_other_site"]
    other = next(o for o in bu.options if o.remedy == "find_other_site")
    assert other.apply.type == "none" and other.apply.adds_checklist == ["x-0"]
    assert bu.recommendation.option_id == "o-3"
    assert bu.contact.agency == "성동구청 건축과" and bu.contact.phone and bu.contact.is_example
    assert bu.added_to_checklist == ["c-01"]


def test_foundy_card_set_and_numbers(items):
    assert [(i.item_id, i.check_id) for i in items] == [
        ("r-01", "building_use"), ("r-02", "trademark_similar"), ("r-03", "building_violation"),
        ("r-04", "permit_docs"), ("r-05", "labeling")]


def test_checklist_is_foundy_set_with_documents_and_links(demo):
    cl = {c["item_id"]: ChecklistItem(**c) for c in demo["checklist"]}
    assert [k for k in cl if k.startswith("c-")] == [f"c-0{n}" for n in range(1, 10)]
    assert cl["c-04"].report_item_ids == ["r-04"] and cl["c-01"].report_item_ids == ["r-01", "r-03"]
    assert cl["c-04"].documents[0].links[0]["url"] == "https://www.gov.kr/"
    assert cl["c-04"].contact.agency == "성동구청 위생과"


def test_events_replayable(demo, items):
    ev = demo["events"]
    assert ev[0]["event"] == "step" and ev[0]["data"]["step"] == "building"
    assert ev[-1]["event"] == "done" and ev[-1]["data"]["summary"] == demo["summary"]
    assert [e["data"]["check_id"] for e in ev if e["event"] == "item"] == [i.check_id for i in items]
    assert demo["summary"] == {k: sum(1 for i in items if i.verdict == k) for k in ("high", "low", "unknown", "ok")}
    assert any(e["data"].get("status") == "fallback" for e in ev if e["event"] == "step")  # 예시 응답은 fallback 표시


def test_grants_result(demo):
    g = demo["grants"]
    assert g["ok"] and g["excluded_count"] == 1 and g["closed_count"] == 1  # 제조업 공고 제외, 마감 공고 제외
    by = {m["grant_id"]: m for m in g["items"]}
    assert set(by) == {"example-001", "example-003"}
    assert by["example-001"]["eligibility"]["result"] == "eligible"
    assert by["example-003"]["eligibility"]["result"] == "partial"
    for m in g["items"]:
        assert m["eligibility"]["decided_by"] == "ai" and m["summary"]["by"] == "ai"
        assert all(c["evidence"] and c["evidence"]["type"] == "notice" or c["result"] == "unknown"
                   for c in m["eligibility"]["checks"])
        assert all(c["result"] in ("pass", "unknown") for c in m["eligibility"]["checks"])


def test_grant_deadlines_in_checklist(demo):
    grant_items = [c for c in demo["checklist"] if c["source"] == "grant"]
    assert {c["category"] for c in grant_items} == {"정책"} and len(grant_items) == 2
    assert all(m["added_to_checklist"] for m in demo["grants"]["items"])
    assert any(e["data"].get("step") == "grants" for e in demo["events"] if e["event"] == "step")
