import pytest

from rules.engine import (
    base_checklist, business_type_reason, check_spec, derive_business_type,
    judge_building_use, load_pack, normalize_use, pending_questions,
)

PACK = load_pack("cafe_restaurant")


def test_alcohol_decides_business_type():
    assert derive_business_type(PACK, {"sells_alcohol": True}) == "일반음식점"
    assert derive_business_type(PACK, {"sells_alcohol": False}) == "휴게음식점"
    assert derive_business_type(PACK, {}) is None
    assert "일반음식점" in business_type_reason(PACK, {"sells_alcohol": True})


def test_pending_questions_skip_answered():
    ids = [q.id for q in pending_questions(PACK, {"sells_alcohol": False})]
    assert "sells_alcohol" not in ids and "has_employees" in ids
    # False는 '답했다'로 취급한다 (None만 미답)
    assert pending_questions(PACK, {q["id"]: False for q in PACK["ask"]}) == []


@pytest.mark.parametrize("raw,expected", [
    ("제1종근린생활시설", "제1종근린생활시설"),
    ("제2종 근린생활시설(일반음식점)", "제2종근린생활시설"),
    ("1층 제2종근린생활시설 48.2㎡", "제2종근린생활시설"),
    ("판매시설", None),
    ("", None),
])
def test_normalize_use(raw, expected):
    assert normalize_use(raw) == expected


def test_s1_alcohol_on_type1_floor_is_high():
    r = judge_building_use(PACK, "일반음식점", ["제1종근린생활시설"])
    assert r.verdict == "high"


def test_type2_floor_allows_general_restaurant():
    assert judge_building_use(PACK, "일반음식점", ["제2종근린생활시설(일반음식점)"]).verdict == "ok"


def test_rest_cafe_ok_on_either_type():
    assert judge_building_use(PACK, "휴게음식점", ["제1종근린생활시설"]).verdict == "ok"
    assert judge_building_use(PACK, "휴게음식점", ["제2종근린생활시설"]).verdict == "ok"


def test_no_data_or_unknown_use_is_unknown_not_high():
    assert judge_building_use(PACK, "일반음식점", []).verdict == "unknown"
    assert judge_building_use(PACK, "일반음식점", ["판매시설"]).verdict == "unknown"
    assert judge_building_use(PACK, None, ["제1종근린생활시설"]).verdict == "unknown"


def test_checklist_employee_item_conditional():
    with_staff = [i["task"] for i in base_checklist(PACK, {"has_employees": True})]
    without = [i["task"] for i in base_checklist(PACK, {"has_employees": False})]
    assert "근로계약서·4대보험" in with_staff and "근로계약서·4대보험" not in without
    assert all("when" not in i for i in base_checklist(PACK, {"has_employees": True}))


def test_every_check_has_remedies_and_drafts_keys():
    for c in PACK["checks"]:
        assert "remedies" in c and "drafts" in c
    assert "change_site" in check_spec(PACK, "building_use")["remedies"]
