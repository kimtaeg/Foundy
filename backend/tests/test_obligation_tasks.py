"""법령 분석 결과 → 체크리스트 작업. 실제 규칙 묶음·규칙 엔진·날짜 계산을 그대로 쓴다 (가짜 도구 없음).

조문 근거는 실제 법령 DB(RAG)에서 검색한 조문으로 만든다. DATABASE_URL·저장된 법령이 없으면 그 테스트만 건너뛴다.
"""

from datetime import date, timedelta

import pytest

from agent.schemas import ChecklistItem, Evidence, ReportItem
from calc.dates import Dates
from calc.obligation_tasks import apply_obligations, counts_by_type
from config import get_settings
from rules.applicability import evaluate_rules, facts_of
from rules.engine import base_checklist, derive_business_type, load_pack
from agent.ports import StoreInput

PACK = load_pack("cafe_restaurant")
OPEN = date(2027, 3, 2)
CARD_OF = {c["id"]: f"r-{n:02d}" for n, c in enumerate(PACK["checks"], start=1)}


def make_store(**kw) -> StoreInput:
    answers = {"sells_alcohol": True, "has_employees": True, "does_delivery": True, "uses_terrace": False}
    answers.update(kw.pop("answers", {}))
    base = dict(store_id="t", name="테스트식당", address="서울 성동구 성수이로 00", address_detail="2층",
                opening_date=OPEN, area_sqm=120.0, answers=answers)
    base.update(kw)
    return StoreInput(**base)


def base_list(store: StoreInput) -> list[ChecklistItem]:
    out = []
    for b in base_checklist(PACK, store.answers):
        d = Dates().checklist_dates(OPEN, b["offset_days"])
        out.append(ChecklistItem(item_id=b["id"], rule_key=b["id"], task=b["task"], category=b["category"],
                                 due_date=d["due_date"], dday=d["dday"], group_label=b["group"], source="rule"))
    return out


def build(store: StoreInput, cards=()) -> dict[str, ChecklistItem]:
    bt = derive_business_type(PACK, store.answers)
    tasks = apply_obligations(PACK, evaluate_rules(PACK, store, bt), base_list(store), list(cards), CARD_OF, Dates(), OPEN,
                              facts=facts_of(store, bt))
    return {t.item_id: t for t in tasks}


def test_applicable_rules_become_typed_tasks():
    t = build(make_store())
    assert t["c-04"].task_type == "legal_obligation" and t["c-04"].obligation_rule_id == "FOOD-REPORT-001"
    assert t["c-05"].task_type == "legal_obligation" and t["c-06"].task_type == "legal_obligation"
    assert t["c-08"].task_type == "legal_obligation"  # 직원이 있으면 근로계약은 필수 (규칙 묶음이 정함)
    assert t["o-fire"].task_type == "conditional" and "영업장 면적 120㎡" in t["o-fire"].reason  # 면적 조건 때문이라는 이유가 붙는다
    assert "기준 100㎡ 이상" in t["o-fire"].reason and "일반음식점" in t["c-04"].reason
    assert t["c-08"].reason.endswith("조건에 해당해 적용돼요.") and "직원 고용 여부: 예" in t["c-08"].reason
    assert t["o-minwage"].task_type == "conditional" and t["o-facility"].task_type == "legal_obligation"
    assert t["o-zoning"].task_type == "conditional"  # 용도지역 제한은 구청에 확인해야 아는 조건부 작업이다 (필수로 단정하지 않는다)
    # 법령 규칙이 없는 기본 항목은 권장으로 남는다
    assert all(t[k].task_type == "preparation" for k in ("c-01", "c-02", "c-03", "c-07"))


def test_not_applicable_rules_create_nothing():
    t = build(make_store(area_sqm=50.0, answers={"has_employees": False}))
    assert "o-fire" not in t and "o-minwage" not in t and "c-08" not in t
    assert t["c-04"].task_type == "legal_obligation"


def test_missing_input_becomes_conditional_with_reason():
    t = build(make_store(area_sqm=None))
    fire = t["o-fire"]
    assert fire.task_type == "conditional" and "영업장 면적" in fire.reason


def test_statutory_deadline_is_separate_from_recommended_date():
    t = build(make_store())
    edu, health = t["c-05"], t["c-06"]
    assert edu.statutory_deadline == OPEN - timedelta(days=1) and "영업 시작 전" in edu.statutory_basis
    assert edu.due_date == OPEN + timedelta(days=-22)  # 권장 준비일은 그대로다
    assert health.statutory_deadline == OPEN - timedelta(days=1) and "제49조" in health.statutory_basis  # 시행규칙 제49조 제2항: 영업 시작 전
    assert t["c-08"].statutory_deadline is None  # 조문에 개업 전 기한이 없으면 만들지 않는다
    assert all(x.statutory_deadline is None for x in (t["o-fire"], t["o-minwage"], t["o-zoning"], t["c-09"]))


def test_priority_and_law_basis_and_sources():
    t = build(make_store())
    assert t["c-04"].priority == "high" and t["o-fire"].priority == "normal"
    basis = t["o-facility"].law_basis
    assert basis["law_name"] == "식품위생법" and basis["article"] == "제36조"
    kinds = {s["type"] for s in t["o-facility"].sources}
    assert {"rule", "law", "inspection"} <= kinds
    assert t["c-04"].sources[0] == {"type": "template", "id": "c-04"}


def test_counts_by_type_covers_all_tasks():
    tasks = list(build(make_store()).values())
    counts = counts_by_type(tasks)
    assert sum(counts.values()) == len(tasks) and counts["legal_obligation"] >= 5 and counts["conditional"] >= 2


def test_new_task_is_linked_to_its_report_card():
    t = build(make_store())
    assert t["o-facility"].report_item_ids == [CARD_OF["permit_docs"]]
    assert t["o-fire"].report_item_ids == [CARD_OF["fire_safety"]]


@pytest.mark.skipif(not get_settings().database_url, reason="DATABASE_URL 이 없어 건너뜁니다")
def test_verified_law_evidence_makes_task_legal_analysis():
    """점검 카드가 실제 법령 DB에서 검색해 인용한 조문이 있으면 legal_analysis, 없으면 rule_engine 이다."""
    from law_rag.service import LawRag

    store = make_store()
    res = LawRag(pack=PACK).articles_for("permit_docs", store)  # 키워드·고정 조문 검색 (임베딩 없이도 동작)
    if res is None or not res.ok:
        pytest.skip("저장된 법령이 없어 건너뜁니다")
    art = next(a for a in res.data["articles"] if a["law_name"] == "식품위생법")
    card = ReportItem(item_id="r-04", check_id="permit_docs", stage="계약 전", title="x", verdict="low", decided_by="ai",
                      evidence=[Evidence(type="law", source=res.source, law_name=art["law_name"], article=art["article"],
                                         text=art["text"][:200], url=art.get("url"))])
    with_ev, without = build(store, [card]), build(store)
    assert with_ev["o-facility"].source_type == "legal_analysis" and with_ev["o-facility"].evidence
    assert without["o-facility"].source_type == "rule_engine"
    assert with_ev["c-04"].evidence and with_ev["c-04"].source_type == "template"
