"""매물 비용 계산 (계산 도구). 입력은 사용자가 넣은 값 그대로이고, 서비스가 추정해서 채우지 않는다.

listing 키: deposit_krw(보증금), monthly_rent_krw(월세), maintenance_krw(관리비), premium_krw(권리금), area_m2(면적)
필수 값이 없으면 None을 돌려준다 (0으로 간주하지 않는다). 선택 값(관리비·권리금)이 없으면 0으로 본다.
"""

from __future__ import annotations


def _num(listing: dict, key: str) -> int | float | None:
    v = (listing or {}).get(key)
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0 else None


def initial_cost(listing: dict) -> int | None:
    """초기 비용 = 보증금 + 권리금"""
    deposit = _num(listing, "deposit_krw")
    if deposit is None:
        return None
    return int(deposit + (_num(listing, "premium_krw") or 0))


def monthly_fixed(listing: dict) -> int | None:
    """월 고정비 = 월세 + 관리비"""
    rent = _num(listing, "monthly_rent_krw")
    if rent is None:
        return None
    return int(rent + (_num(listing, "maintenance_krw") or 0))


def rent_per_m2(listing: dict) -> int | None:
    rent, area = _num(listing, "monthly_rent_krw"), _num(listing, "area_m2")
    if rent is None or not area:
        return None
    return round(rent / area)


def vs_area_average(own_per_m2: int | None, area_avg_per_m2: int | None) -> dict:
    """지역 평균 ㎡당 임대료와 비교. 평균을 모르면 available=False (숫자를 만들지 않는다)."""
    if own_per_m2 is None or not area_avg_per_m2:
        return {"available": False}
    return {"available": True, "area_average_per_m2_krw": area_avg_per_m2,
            "diff_pct": round((own_per_m2 - area_avg_per_m2) / area_avg_per_m2 * 100)}


def runway_months(funds_krw: int | None, initial: int | None, monthly: int | None) -> dict:
    """준비 자금에서 보증금·권리금을 뺀 돈으로 월 고정비를 몇 개월 감당하는지.

    인테리어·장비·재료비·인건비는 들어 있지 않아 실제보다 낙관적인 값이다 (basis에 그대로 적는다).
    """
    if funds_krw is None or initial is None or not monthly:
        return {"available": False}
    left = funds_krw - initial
    return {"available": True, "value": round(max(left, 0) / monthly, 1), "short_of_initial": left < 0,
            "basis": f"준비 자금 {funds_krw:,}원에서 보증금·권리금 {initial:,}원을 뺀 돈을 월 고정비로 나눈 값 (인테리어·운영비 제외)"}


def listing_result(listing: dict | None, funds_krw: int | None, area_avg_per_m2: int | None) -> dict:
    listing = listing or {}
    initial, monthly, per_m2 = initial_cost(listing), monthly_fixed(listing), rent_per_m2(listing)
    return {"initial_cost_krw": initial, "monthly_fixed_krw": monthly, "rent_per_m2_krw": per_m2,
            "vs_area_average": vs_area_average(per_m2, area_avg_per_m2),
            "runway_months": runway_months(funds_krw, initial, monthly)}


def site_cost_delta(base_listing: dict, other_listing: dict) -> dict | None:
    """다른 자리로 옮길 때 초기 비용·월 고정비 차이 (other - base). 계산할 수 없으면 None."""
    bi, oi = initial_cost(base_listing), initial_cost(other_listing)
    bm, om = monthly_fixed(base_listing), monthly_fixed(other_listing)
    if None in (bi, oi, bm, om):
        return None
    return {"initial_delta_krw": oi - bi, "monthly_delta_krw": om - bm}
