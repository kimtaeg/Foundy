from agent.llm import FakeLLM, LLMError
from agent.location import CompareLLM, SiteQuestions, compare_sites, numbers_supported
from agent.ports import Site

from .fakes import MAIN_SITE, site_b, store

A = MAIN_SITE.model_copy(update={"listing": {"deposit_krw": 30_000_000, "monthly_rent_krw": 2_500_000,
                                              "maintenance_krw": 200_000, "premium_krw": 10_000_000, "area_m2": 33},
                                 "area_metrics": {"same_type_count": 14, "open_close_trend": {"available": False},
                                                  "foot_traffic": {"available": False}},
                                 "area_avg_rent_per_m2": 70_000})
B = site_b(listing={"deposit_krw": 34_000_000, "monthly_rent_krw": 2_800_000, "maintenance_krw": 200_000,
                    "premium_krw": 10_000_000, "area_m2": 33}, area_metrics={"same_type_count": 6})
S = store(answers={"sells_alcohol": True, "funds_krw": 80_000_000})


def ai(summary="A는 경쟁이 심하지만 건물 용도가 맞지 않아요. B는 월 고정비가 300,000원 더 들어요.", qs=None):
    qs = qs if qs is not None else [SiteQuestions(site_id="st-01", questions=["관리비에 뭐가 포함되나요?"]),
                                    SiteQuestions(site_id="st-02", questions=["권리금 시설 목록 주세요", "권리금 시설 목록 주세요"])]
    return FakeLLM({"compare_sites": CompareLLM(summary=summary, site_questions=qs)})


def test_costs_come_from_calc_not_ai():
    r = compare_sites(ai(), S, [A, B])
    a, b = r.sites
    assert a.listing_result.initial_cost_krw == 40_000_000 and a.listing_result.monthly_fixed_krw == 2_700_000
    assert a.listing_result.rent_per_m2_krw == 75_758 and a.listing_result.vs_area_average["diff_pct"] == 8
    assert a.listing_result.runway_months["value"] == 14.8 and b.listing_result.vs_area_average == {"available": False}
    assert r.summary_by == "ai" and "300,000원" in r.summary


def test_building_check_uses_rules():
    a, b = compare_sites(ai(), S, [A, B]).sites
    assert a.building_check["verdict"] == "high" and b.building_check["verdict"] == "ok"


def test_prompt_includes_precomputed_baseline_diff_and_marks_missing_data():
    fake = ai()
    compare_sites(fake, S, [A, B.model_copy(update={"area_metrics": None})])
    user = fake.calls[0]["user"]
    assert '"baseline_diff": {"baseline": "A", "initial_delta_krw": 4000000, "monthly_delta_krw": 300000}' in user
    assert '"area_metrics": "데이터 없음"' in user


def test_invented_number_replaces_summary_with_rule_summary():
    r = compare_sites(ai(summary="B는 월 187,000원이나 저렴해요"), S, [A, B])
    assert r.summary_by == "rule" and "187,000" not in r.summary
    assert "월 고정비 2,700,000원" in r.summary and "반경 내 같은 업종 14곳" in r.summary


def test_numbers_supported_rules():
    facts = [{"costs": {"monthly_fixed_krw": 2_700_000, "x": 40_000_000}, "n": 14, "txt": "제2종근린생활시설"}]
    assert numbers_supported("월 고정비는 2,700,000원, 270만 원이에요. 경쟁 14곳, 1층", facts)
    assert numbers_supported("초기 비용 4,000만 원", facts)
    assert not numbers_supported("월 280만 원", facts)
    assert not numbers_supported("경쟁 20곳", facts)
    assert numbers_supported("숫자 없는 요약이에요", facts)


def test_questions_are_cleaned_and_filled_with_defaults():
    qs = [SiteQuestions(site_id="st-01", questions=["  관리비에   뭐가 포함되나요? ", "관리비에 뭐가 포함되나요?", "x" * 200]),
          SiteQuestions(site_id="st-99", questions=["없는 자리"])]
    a, b = compare_sites(ai(qs=qs), S, [A, B]).sites
    assert a.listing_result.site_questions == ["관리비에 뭐가 포함되나요?"]
    assert any("권리금" in q for q in b.listing_result.site_questions)  # AI가 안 준 자리는 기본 질문
    assert len(b.listing_result.site_questions) <= 4


def test_llm_failure_gives_rule_summary_and_default_questions():
    a, b = (r := compare_sites(FakeLLM({"compare_sites": LLMError("x")}), S, [A, B])).sites
    assert r.summary_by == "rule" and r.summary
    assert a.listing_result.site_questions[0].startswith("이 건물에서 일반음식점")  # 건물 점검에서 걸린 자리
    assert "관리비" in " ".join(a.listing_result.site_questions)


def test_site_without_listing_still_listed_with_nothing_invented():
    bare = Site(site_id="st-03", label="C", floor_uses=["제2종근린생활시설"])
    r = compare_sites(ai(summary="C는 입력된 비용 정보가 없어요."), S, [A, bare])
    c = r.sites[1].listing_result
    assert c.initial_cost_krw is None and c.monthly_fixed_krw is None and c.runway_months == {"available": False}
    assert r.sites[1].area_metrics is None


def test_runway_unavailable_without_funds():
    r = compare_sites(ai(), store(answers={"sells_alcohol": True}), [A, B])
    assert r.sites[0].listing_result.runway_months == {"available": False}
