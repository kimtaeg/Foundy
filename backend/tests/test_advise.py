from agent.advise import CONTRACT_DISCLAIMER, AdviceDraft, Counters, DraftText, advise_item, build_options
from agent.llm import FakeLLM, LLMError
from agent.schemas import ReportItem
from rules.engine import check_spec, load_pack

from .fakes import BUILDING_ADVICE, MAIN_SITE, FakeCalc, site_b, store

PACK = load_pack("cafe_restaurant")
SPEC = check_spec(PACK, "building_use")


def high_item() -> ReportItem:
    return ReportItem(item_id="r-01", check_id="building_use", stage="계약 전", title="t", verdict="high",
                      decided_by="rule", reason="r", evidence=[])


def options(s, extras=None):
    return build_options(PACK, s, high_item(), SPEC, extras or {"floor_uses": ["제1종근린생활시설"]},
                         "일반음식점", FakeCalc())


def test_options_for_alcohol_on_type1_floor():
    s = store(sites=[MAIN_SITE, site_b()])
    o = options(s)
    assert [x.remedy for x in o] == ["change_business_type", "change_site", "request_use_change"]
    assert o[0].apply.payload == {"answers": {"sells_alcohol": False}} and o[0].apply.needs_reanalyze
    site = o[1]
    assert site.site_id == "st-02" and site.apply.type == "set_main_site"
    assert site.cost.basis == "calc" and site.cost.delta_krw == 4_000_000 and "+300,000원" in site.cost.text
    assert o[2].time.text == "확인 필요" and o[2].cost.delta_krw is None


def test_no_change_site_option_without_suitable_site():
    s = store(sites=[MAIN_SITE, site_b(floor_uses=["제1종근린생활시설"])])
    assert "change_site" not in [x.remedy for x in options(s)]


def test_site_cost_unknown_without_listing():
    s = store(sites=[MAIN_SITE, site_b(listing=None)])
    site = [x for x in options(s) if x.remedy == "change_site"][0]
    assert site.cost.basis is None and site.cost.text == "확인 필요"


def test_no_business_type_option_when_not_selling_alcohol():
    s = store(answers={"sells_alcohol": False})
    assert "change_business_type" not in [x.remedy for x in options(s)]


def test_advise_fills_card():
    s = store(sites=[MAIN_SITE, site_b()])
    out = advise_item(FakeLLM({"advise_building_use": BUILDING_ADVICE}), PACK, s, high_item(), SPEC,
                      {"floor_uses": ["제1종근린생활시설"]}, "일반음식점", FakeCalc(), Counters())
    assert out.consequence.startswith("이대로 계약하면")
    assert out.options[0].summary == "술 없이 카페로 시작해요."  # AI가 쓴 설명으로 교체
    assert out.options[1].summary.startswith("B 자리")  # AI가 안 쓴 것은 기본 설명 유지
    assert out.recommendation.option_id == "o-2"
    kinds = [p.kind for p in out.prepared]
    assert kinds == ["inquiry_message", "contract_clause"]
    assert out.prepared[1].body.endswith(CONTRACT_DISCLAIMER.strip()) and CONTRACT_DISCLAIMER.strip() in out.prepared[1].body
    assert CONTRACT_DISCLAIMER.strip() not in out.prepared[0].body
    assert out.user_action.prepared_id == out.prepared[0].prepared_id
    assert [p.prepared_id for p in out.prepared] == ["p-01", "p-02"]


def test_disallowed_draft_and_bad_recommendation_dropped():
    spec = check_spec(PACK, "building_violation")  # drafts: inquiry_message만
    d = AdviceDraft(consequence="c", recommended_option_id="o-9", recommendation_reason="x",
                    drafts=[DraftText(kind="contract_clause", title="t", body="b"),
                            DraftText(kind="inquiry_message", title="t", body="b")],
                    user_action_text="a", user_action_type="send", user_action_draft_kind="contract_clause")
    item = high_item().model_copy(update={"check_id": "building_violation"})
    out = advise_item(FakeLLM({"advise_building_violation": d}), PACK, store(), item, spec, {}, "일반음식점",
                      None, Counters())
    assert [p.kind for p in out.prepared] == ["inquiry_message"]
    assert out.recommendation is None
    assert out.user_action.prepared_id is None  # 허용되지 않아 버린 초안은 연결하지 않는다


def test_llm_failure_keeps_options():
    s = store(sites=[MAIN_SITE, site_b()])
    out = advise_item(FakeLLM({"advise_building_use": LLMError("x")}), PACK, s, high_item(), SPEC,
                      {"floor_uses": ["제1종근린생활시설"]}, "일반음식점", FakeCalc(), Counters())
    assert len(out.options) == 3 and out.recommendation is None and out.user_action.type == "decide"


def test_prompt_marks_verified_options():
    s = store(sites=[MAIN_SITE, site_b()])
    llm = FakeLLM({"advise_building_use": BUILDING_ADVICE})
    advise_item(llm, PACK, s, high_item(), SPEC, {"floor_uses": ["제1종근린생활시설"]}, "일반음식점",
                FakeCalc(), Counters())
    user = llm.calls[0]["user"]
    assert '"label": "용도변경 신청", "verified": false' in user
    assert '"label": "후보 자리 B로 변경", "verified": true' in user
