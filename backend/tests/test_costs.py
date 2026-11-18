from calc import costs

L = {"deposit_krw": 30_000_000, "monthly_rent_krw": 2_500_000, "maintenance_krw": 200_000,
     "premium_krw": 10_000_000, "area_m2": 33}


def test_basic_sums():
    assert costs.initial_cost(L) == 40_000_000
    assert costs.monthly_fixed(L) == 2_700_000
    assert costs.rent_per_m2(L) == 75_758


def test_optional_fields_default_to_zero_but_required_missing_is_none():
    assert costs.initial_cost({"deposit_krw": 1_000}) == 1_000
    assert costs.monthly_fixed({"monthly_rent_krw": 500}) == 500
    assert costs.initial_cost({"premium_krw": 5}) is None  # 보증금이 없으면 계산하지 않는다
    assert costs.monthly_fixed({}) is None and costs.monthly_fixed(None) is None
    assert costs.rent_per_m2({"monthly_rent_krw": 500}) is None and costs.rent_per_m2({"monthly_rent_krw": 5, "area_m2": 0}) is None
    assert costs.initial_cost({"deposit_krw": -1}) is None and costs.initial_cost({"deposit_krw": True}) is None


def test_vs_area_average():
    assert costs.vs_area_average(90_000, 75_000) == {"available": True, "area_average_per_m2_krw": 75_000, "diff_pct": 20}
    assert costs.vs_area_average(60_000, 75_000)["diff_pct"] == -20
    assert costs.vs_area_average(90_000, None) == {"available": False}
    assert costs.vs_area_average(None, 75_000) == {"available": False}


def test_runway():
    r = costs.runway_months(100_000_000, 40_000_000, 2_700_000)
    assert r["available"] and r["value"] == 22.2 and not r["short_of_initial"]
    assert "인테리어" in r["basis"]  # 낙관적인 값이라는 점을 밝힌다
    short = costs.runway_months(30_000_000, 40_000_000, 2_700_000)
    assert short["value"] == 0 and short["short_of_initial"] is True
    assert costs.runway_months(None, 1, 1) == {"available": False}
    assert costs.runway_months(1, 1, 0) == {"available": False}


def test_listing_result_and_cost_delta():
    r = costs.listing_result(L, 80_000_000, 70_000)
    assert r["initial_cost_krw"] == 40_000_000 and r["vs_area_average"]["diff_pct"] == 8
    assert costs.listing_result(None, None, None)["initial_cost_krw"] is None
    other = {"deposit_krw": 34_000_000, "monthly_rent_krw": 2_800_000, "premium_krw": 10_000_000, "maintenance_krw": 200_000}
    assert costs.site_cost_delta(L, other) == {"initial_delta_krw": 4_000_000, "monthly_delta_krw": 300_000}
    assert costs.site_cost_delta(L, {"deposit_krw": 1}) is None
