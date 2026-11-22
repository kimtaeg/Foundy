"""임대료 비교 계산. 한국부동산원 임대동향조사와 같은 기준으로 내 ㎡당 환산 월세를 만든다.

환산 월세 = 월세 + 보증금 × 전환율 / 12  (관리비·부가세 제외)
㎡당 환산 월세 = 환산 월세 / 면적(임대가능면적 = 전용 + 공용)
"""

from __future__ import annotations

SIMILAR_BAND_PCT = 10.0  # 평균과 ±10% 이내면 '비슷'
FIRST_FLOOR = "1층"
STAT_FLOORS = ("1층", "2층", "지하1층")  # 층별 통계가 있는 층
ESTIMATE_NOTE = "통계는 실제 계약가가 아니라 조사된 시장임대료 추정치예요."
CONTRACT_CHECK = "계약 전 확인: 관리비 별도 여부, 권리금(통계에 포함되지 않음), 계약서 임대면적이 전용+공용 기준인지"


def krw_per_sqm(thousand_krw_per_sqm: float) -> int:
    """통계 단위(천원/㎡) → 원/㎡."""
    return round(thousand_krw_per_sqm * 1000)


def monthly_for_area(krw_per_sqm_value: int, area_sqm: float | None) -> int | None:
    """그 ㎡당 임대료로 내 면적을 빌리면 한 달 얼마인지. 면적이 없으면 None."""
    return round(krw_per_sqm_value * area_sqm) if area_sqm else None


def store_floor_label(floor: str | None, underground: bool) -> str | None:
    """가게 층의 표시 이름 ('1층', '3층', '지하2층'). 층을 모르면 None."""
    if not floor:
        return None
    return f"지하{floor}층" if underground else f"{floor}층"


def wanted_floor(floor: str | None, underground: bool) -> str | None:
    """가게 층에 맞는 통계 층. 지하는 모두 지하1층, 지상 1·2층은 그대로, 3층 이상·모름은 None (1층과 비교)."""
    if not floor:
        return None
    if underground:
        return "지하1층"
    label = f"{floor}층"
    return label if label in STAT_FLOORS else None


def _pct(value: float) -> str:
    return f"{value:.1f}"


def readings(scope: str, floor_label: str, diff_pct: float | None, level: str | None) -> list[str]:
    """읽는 법: 비교 결과 구간 문장 + 계약 전 확인. 이유(입지·노출 등)는 지어내지 않는다."""
    if diff_pct is None or level is None:
        return [CONTRACT_CHECK]
    if level == "similar":
        first = f"{scope} {floor_label} 평균과 비슷해요 ({diff_pct:+.1f}%)."
    else:
        first = f"{scope} {floor_label} 평균보다 {_pct(abs(diff_pct))}% {'높아요' if level == 'high' else '낮아요'}."
    return [f"{first} {ESTIMATE_NOTE}", CONTRACT_CHECK]


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
