from datetime import date

from calc import match

TODAY = date(2026, 11, 20)


def test_age_max_boundaries():
    # 1998년생: 2026년 연 나이 28 → 만 27~28세
    assert match.age_max(1998, 39, TODAY)[0] == "pass"
    assert match.age_max(1998, 28, TODAY)[0] == "pass"
    assert match.age_max(1998, 27, TODAY)[0] == "unknown"  # 생일에 따라 달라지는 경계
    assert match.age_max(1998, 26, TODAY)[0] == "fail"
    assert match.age_max(None, 39, TODAY)[0] == "unknown"


def test_age_min_boundaries():
    assert match.age_min(1998, 19, TODAY)[0] == "pass"
    assert match.age_min(1998, 27, TODAY)[0] == "pass"
    assert match.age_min(1998, 28, TODAY)[0] == "unknown"
    assert match.age_min(1998, 29, TODAY)[0] == "fail"


def test_business_years():
    assert match.business_years_max(date(2027, 3, 2), 3, TODAY)[0] == "pass"  # 개업 전 = 업력 0
    assert match.business_years_max(date(2027, 3, 2), 0, TODAY)[0] == "pass"  # 예비창업자
    assert match.business_years_max(date(2024, 1, 1), 3, TODAY)[0] == "pass"
    assert match.business_years_max(date(2021, 1, 1), 3, TODAY)[0] == "fail"
    assert match.business_years_max(date(2021, 1, 1), 0, TODAY)[0] == "fail"  # 이미 연 가게는 예비창업자가 아님


def test_region():
    addr = "서울특별시 성동구 성수이로 00"
    assert match.region(addr, ["서울"])[0] == "pass"
    assert match.region(addr, ["부산", "성동구"])[0] == "pass"
    assert match.region(addr, ["부산"])[0] == "fail"
    assert match.region(addr, [])[0] == "unknown"
    assert match.region("", ["서울"])[0] == "unknown"
