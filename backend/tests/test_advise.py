from agent.advise import AdviceDraft, advise_item, build_options, contact_for
from agent.llm import FakeLLM, LLMError
from agent.schemas import ReportItem
from rules.engine import check_spec, load_pack

from .fakes import BUILDING_ADVICE, store

PACK = load_pack("cafe_restaurant")
SPEC = check_spec(PACK, "building_use")


def high_item() -> ReportItem:
    return ReportItem(item_id="r-01", check_id="building_use", stage="계약 전", title="t", verdict="high",
                      decided_by="rule", reason="r", evidence=[])


def options(s, extras=None):
    return build_options(PACK, s, high_item(), SPEC, extras or {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}, "일반음식점")


def test_options_for_alcohol_on_type1_floor():
    o = options(store())
    assert [x.remedy for x in o] == ["change_business_type", "request_use_change", "find_other_site"]
    assert o[0].apply.payload == {"answers": {"sells_alcohol": False}} and o[0].apply.needs_reanalyze
    assert o[1].time.text == "확인 필요" and o[1].cost.delta_krw is None
    assert o[1].apply.adds_checklist == ["x-1"]  # 용도변경 신청 → 구청 문의 할 일이 생긴다
    assert o[2].apply.type == "none" and o[2].apply.adds_checklist == ["x-0"]


def test_no_business_type_option_when_not_selling_alcohol():
    s = store(answers={"sells_alcohol": False})
    assert "change_business_type" not in [x.remedy for x in options(s)]


def test_contact_comes_from_rules_not_ai():
    c = contact_for(PACK, SPEC, "11200")
    assert c.agency == "성동구청 건축과" and c.phone == "02-2286-5114" and c.is_example  # 확인 못 한 번호는 예시
    assert contact_for(PACK, {"contact_key": "tax"}).is_example is False
    assert contact_for(PACK, {}) is None


def test_unknown_region_falls_back_to_verified_national_number():
    for sigungu in (None, "26110"):  # 표에 없는 지역
        c = contact_for(PACK, SPEC, sigungu)
        assert c.agency == "정부민원안내콜센터" and c.phone == "110" and not c.is_example
        assert "건축과" in c.tip  # 구청 건축과로 연결해 달라는 안내


def test_card_contact_follows_store_region():
    other = store(address_codes={"sigungu_cd": "26110"})
    out = advise_item(FakeLLM({"advise_building_use": BUILDING_ADVICE}), PACK, other, high_item(), SPEC,
                      {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}, "일반음식점")
    assert out.contact.phone == "110"


def test_advise_fills_card():
    out = advise_item(FakeLLM({"advise_building_use": BUILDING_ADVICE}), PACK, store(), high_item(), SPEC,
                      {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}, "일반음식점")
    assert out.consequence.startswith("이대로 계약하면")
    assert out.options[0].summary == "술 없이 카페로 시작해요."  # AI가 쓴 설명으로 교체
    assert out.options[1].summary.startswith("구청 승인")  # AI가 안 쓴 것은 기본 설명 유지
    assert out.recommendation.option_id == "o-2"
    assert out.contact.agency == "성동구청 건축과"
    assert out.user_action.text == "구청 건축과에 전화로 문의하기"


def test_bad_recommendation_dropped():
    d = AdviceDraft(consequence="c", recommended_option_id="o-9", recommendation_reason="x",
                    user_action_text="a", user_action_type="send")
    out = advise_item(FakeLLM({"advise_building_use": d}), PACK, store(), high_item(), SPEC,
                      {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}, "일반음식점")
    assert out.recommendation is None


def test_card_without_options_uses_rule_text_and_no_llm():
    spec = check_spec(PACK, "building_violation")
    item = high_item().model_copy(update={"check_id": "building_violation", "verdict": "unknown"})
    llm = FakeLLM({})
    out = advise_item(llm, PACK, store(), item, spec, {}, "일반음식점")
    assert llm.calls == []  # 선택지가 없으면 AI를 부르지 않는다
    assert out.consequence == "위반건축물이면 영업신고가 반려될 수 있어요."
    assert out.user_action.text == "구청 건축과에 전화로 문의하기" and out.contact.phone


def test_llm_failure_keeps_options_and_contact():
    out = advise_item(FakeLLM({"advise_building_use": LLMError("x")}), PACK, store(), high_item(), SPEC,
                      {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}, "일반음식점")
    assert len(out.options) == 3 and out.recommendation is None and out.user_action.type == "decide"
    assert out.contact is not None


def test_prompt_marks_verified_options():
    llm = FakeLLM({"advise_building_use": BUILDING_ADVICE})
    advise_item(llm, PACK, store(), high_item(), SPEC, {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}, "일반음식점")
    user = llm.calls[0]["user"]
    assert '"label": "용도변경 신청", "verified": false' in user
    assert '"label": "술 빼고 휴게음식점으로 시작", "verified": true' in user
