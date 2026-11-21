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
    assert contact_for(PACK, {"contact": "tax"}).is_example is False
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


# ---------------------------------------------------------------- AI가 제안하는 추가 선택지

from agent.advise import AI_REMEDY, ExtraOption, add_ai_options  # noqa: E402
from agent.guardrails import enforce  # noqa: E402

EXTRAS = {"floor_uses": ["제1종근린생활시설"], "ok_business_types": ["휴게음식점"]}


def advice(**kw):
    base = dict(BUILDING_ADVICE.model_dump())
    base.update(kw)
    return AdviceDraft.model_validate(base)


def run_advice(draft):
    return advise_item(FakeLLM({"advise_building_use": draft}), PACK, store(), high_item(), SPEC, EXTRAS, "일반음식점")


def test_ai_can_add_options_that_do_not_change_the_store():
    out = run_advice(advice(extra_options=[
        {"label": "건물주에게 용도 확인 요청", "summary": "계약 전에 건물주에게 해당 층 용도를 서면으로 확인받아요."}]))
    added = out.options[-1]
    assert added.remedy == AI_REMEDY and added.option_id == "o-4"
    assert added.apply.type == "none" and not added.apply.adds_checklist and not added.apply.needs_reanalyze
    assert added.time.text == "확인 필요" and added.cost.text == "확인 필요"  # AI가 기간·금액을 정하지 않는다
    assert [o.remedy for o in out.options[:3]] == ["change_business_type", "request_use_change", "find_other_site"]


def test_ai_can_recommend_its_own_option_by_extra_id():
    out = run_advice(advice(
        extra_options=[{"label": "임대인과 계약 조건 협의", "summary": "용도가 맞을 때까지 계약을 미룰 수 있는지 협의해요."}],
        recommended_option_id="extra-1", recommendation_reason="계약 전이라 협의가 가장 안전해요."))
    assert out.recommendation.option_id == out.options[-1].option_id == "o-4"


def test_extra_options_with_invented_numbers_are_dropped():
    out = run_advice(advice(extra_options=[
        {"label": "용도변경 대행 맡기기", "summary": "비용은 약 50만원이고 2주 안에 끝나요."},
        {"label": "3일 안에 계약 취소", "summary": "계약을 취소해요."},
        {"label": "구청에 서면 문의", "summary": "용도가 맞는지 구청에 서면으로 물어봐요."}]))
    assert [o.label for o in out.options if o.remedy == AI_REMEDY] == ["구청에 서면 문의"]


def test_extra_options_are_deduplicated_and_capped():
    existing = options(store())
    extras = [ExtraOption(label="다른 자리를 알아보기", summary="이미 있는 선택지와 같아요."),
              ExtraOption(label="A 방법", summary="첫째 제안이에요."), ExtraOption(label="B 방법", summary="둘째 제안이에요."),
              ExtraOption(label="C 방법", summary="셋째 제안이에요."), ExtraOption(label="", summary="라벨이 없어요.")]
    result, ids = add_ai_options(existing, extras)
    assert [o.label for o in result[len(existing):]] == ["A 방법", "B 방법"]  # 중복·빈 라벨·초과는 버림
    assert ids == {"extra-2": "o-4", "extra-3": "o-5"} and len(result) <= 5


def test_bad_extra_recommendation_id_is_ignored():
    out = run_advice(advice(extra_options=[], recommended_option_id="extra-1"))
    assert out.recommendation is None  # 제안한 추가 선택지가 없는데 extra-1 을 추천하면 버린다


def test_guardrail_keeps_ai_suggested_options_but_still_removes_unknown_remedies():
    item = run_advice(advice(extra_options=[{"label": "구청에 서면 문의", "summary": "서면으로 물어봐요."}]))
    stray = item.options[0].model_copy(update={"option_id": "o-9", "remedy": "made_up"})
    guarded, changes = enforce(item.model_copy(update={"options": [*item.options, stray]}),
                               allowed_remedies=SPEC["remedies"], ai_high_allowed=True)
    assert AI_REMEDY in [o.remedy for o in guarded.options] and "made_up" not in [o.remedy for o in guarded.options]
    assert any("허용되지 않은 선택지 1개 제거" in c for c in changes)


def test_ai_options_flag_lets_cards_without_code_options_get_ai_options():
    spec = {**check_spec(PACK, "permit_docs"), "ai_options": True}
    item = ReportItem(item_id="r-04", check_id="permit_docs", stage="개업 전", title="t", verdict="low",
                      decided_by="ai", reason="r", evidence=[])
    draft = AdviceDraft(consequence="c", user_action_text="구청에 문의하기", user_action_type="send",
                        extra_options=[ExtraOption(label="위생교육 먼저 신청", summary="영업신고 전에 위생교육을 신청해요.")])
    out = advise_item(FakeLLM({"advise_permit_docs": draft}), PACK, store(), item, spec, {}, "일반음식점")
    assert [o.remedy for o in out.options] == [AI_REMEDY]
    # 플래그가 없으면 예전처럼 AI를 부르지 않는다
    plain = advise_item(FakeLLM({}), PACK, store(), item, check_spec(PACK, "permit_docs"), {}, "일반음식점")
    assert plain.options == []
