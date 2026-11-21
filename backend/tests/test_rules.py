import pytest

from rules.engine import (
    active_checks, base_checklist, business_type_reason, call_questions, check_spec, derive_business_type,
    documents_of, impact_of, judge_building_use, load_pack, normalize_use, pending_questions,
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
    assert "근로계약서 및 고용 관련 사항 확인" in with_staff and "근로계약서 및 고용 관련 사항 확인" not in without
    assert all("when" not in i for i in base_checklist(PACK, {"has_employees": True}))


def test_every_check_has_remedies_key():
    for c in PACK["checks"]:
        assert "remedies" in c and "drafts" not in c
    assert "find_other_site" in check_spec(PACK, "building_use")["remedies"]
    assert [c["id"] for c in active_checks(PACK)] == [
        "building_use", "trademark_similar", "building_violation", "permit_docs", "labeling",
            "fire_safety", "labor_contract"]  # ad_claims는 deferred


def test_checklist_is_foundy_set_with_fixed_groups_and_offsets():
    items = base_checklist(PACK, {"has_employees": True})
    assert [i["id"] for i in items] == [f"c-0{n}" for n in range(1, 10)]
    assert {i["id"]: (i["group"], i["offset_days"]) for i in items}["c-04"] == ("개업 4주 전", -28)
    assert "c-08" not in [i["id"] for i in base_checklist(PACK, {"has_employees": False})]


def test_documents_links_come_only_from_verified_sites():
    docs = documents_of(PACK, "c-04", "11200")
    assert docs[0]["name"] == "영업신고 접수" and docs[0]["links"] == [{"label": "정부24", "url": "https://www.gov.kr/"}]
    assert docs[0]["contact"] == {"agency": "성동구청 위생과", "phone": "02-2286-5114", "is_example": True, "tip": None}
    assert documents_of(PACK, "c-04", "26110")[0]["contact"]["phone"] == "110"  # 표에 없는 지역은 110으로 대체
    assert documents_of(PACK, "c-05") == []  # 발급처를 확정하지 못한 서류는 목록에 없다
    for task_docs in PACK["documents"].values():
        for d in task_docs:
            assert all(k in PACK["sites"] for k in d["sites"])


def test_call_questions_fill_business_type_or_mark_unknown():
    q = call_questions(PACK, "permit_docs", "일반음식점")
    assert q[0] == "일반음식점 영업신고에 필요한 서류 목록을 알려 주세요."
    assert "[확인 필요]" in call_questions(PACK, "permit_docs", None)[0]


def test_impacts_decide_run_and_reset_by_rule():
    assert impact_of(PACK, ["opening_date"]) == {"run": ["dates"], "reset": []}
    r = impact_of(PACK, ["address", "name"])
    assert r["reset"] == ["building_use", "building_violation", "permit_docs", "trademark_similar"]
    assert "building" in r["run"] and "trademark" in r["run"]


def test_report_links_reference_existing_checks_and_tasks():
    ids = {c["id"] for c in PACK["checks"]}
    tasks = {c["id"] for c in PACK["checklist"]} | {t["id"] for t in PACK["extra_tasks"]}
    for task, cards in PACK["report_links"].items():
        assert task in tasks and set(cards) <= ids
