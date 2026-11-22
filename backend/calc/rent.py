"""임대료 비교 계산. 한국부동산원 임대동향조사와 같은 기준으로 내 ㎡당 환산 월세를 만든다.

환산 월세 = 월세 + 보증금 × 전환율 / 12  (관리비·부가세 제외)
㎡당 환산 월세 = 환산 월세 / 면적(임대가능면적 = 전용 + 공용)
"""

from __future__ import annotations

SIMILAR_BAND_PCT = 10.0  # 평균과 ±10% 이내면 '비슷'


def converted_monthly_rent(monthly_rent_krw: int, deposit_krw: int, conversion_rate_pct: float) -> float:
    return monthly_rent_krw + deposit_krw * (conversion_rate_pct / 100) / 12


def compare(monthly_rent_krw: int, deposit_krw: int, area_sqm: float,
            conversion_rate_pct: float, average_thousand_krw_per_sqm: float) -> dict:
    if area_sqm <= 0:
        raise ValueError("area_sqm must be positive")
    converted = converted_monthly_rent(monthly_rent_krw, deposit_krw, conversion_rate_pct)
    mine = converted / area_sqm
    average = average_thousand_krw_per_sqm * 1000
    diff_pct = (mine - average) / average * 100 if average > 0 else None
    if diff_pct is None:
        level = None
    elif diff_pct > SIMILAR_BAND_PCT:
        level = "high"
    elif diff_pct < -SIMILAR_BAND_PCT:
        level = "low"
    else:
        level = "similar"
    return {
        "converted_monthly_krw": round(converted),
        "deposit_monthly_krw": round(converted - monthly_rent_krw),
        "mine_krw_per_sqm": round(mine),
        "average_krw_per_sqm": round(average),
        "diff_pct": round(diff_pct, 1) if diff_pct is not None else None,
        "level": level,
    }
