"""숫자·지역 조건 대조 (계산 도구). 답이 하나로 정해지는 비교는 AI가 하지 않고 여기서 한다.

모든 함수는 (결과, 설명)을 돌려준다. 결과는 "pass" | "fail" | "unknown".
- 정보가 모자라거나 경계에서 확정할 수 없으면 "unknown"이다 (추측으로 pass/fail을 내지 않는다).
"""

from __future__ import annotations

from datetime import date

Result = tuple[str, str]


def _age_range(birth_year: int | None, today: date) -> tuple[int, int] | None:
    """생일을 모르면 만 나이는 (연 나이 - 1) 또는 연 나이다."""
    if birth_year is None:
        return None
    year_age = today.year - birth_year
    return year_age - 1, year_age


def age_max(birth_year: int | None, limit: int, today: date) -> Result:
    """'만 {limit}세 이하'"""
    r = _age_range(birth_year, today)
    if r is None:
        return "unknown", "생년이 입력되지 않아 나이를 확인할 수 없어요"
    low, high = r
    if high <= limit:
        return "pass", f"만 나이가 {low}~{high}세라 해당돼요"
    if low > limit:
        return "fail", f"만 나이가 {low}~{high}세라 {limit}세를 넘어요"
    return "unknown", f"생일에 따라 만 {limit}세 이하일 수도, 아닐 수도 있어요"


def age_min(birth_year: int | None, limit: int, today: date) -> Result:
    """'만 {limit}세 이상'"""
    r = _age_range(birth_year, today)
    if r is None:
        return "unknown", "생년이 입력되지 않아 나이를 확인할 수 없어요"
    low, high = r
    if low >= limit:
        return "pass", f"만 나이가 {low}~{high}세라 해당돼요"
    if high < limit:
        return "fail", f"만 나이가 {low}~{high}세라 {limit}세에 못 미쳐요"
    return "unknown", f"생일에 따라 만 {limit}세 이상일 수도, 아닐 수도 있어요"


def business_years_max(opening_date: date, limit_years: int, today: date) -> Result:
    """'창업 후 {limit_years}년 이내' — 아직 문을 열기 전(예비 창업)이면 업력 0년이다."""
    if opening_date >= today:
        return "pass", "아직 개업 전이라 업력이 0년이에요"
    years = (today - opening_date).days / 365.25
    if years <= limit_years:
        return "pass", f"업력이 약 {years:.1f}년이에요"
    return "fail", f"업력이 약 {years:.1f}년이라 {limit_years}년을 넘어요"


def region(address: str, regions: list[str]) -> Result:
    """공고가 정한 지역 중 하나가 가게 주소에 들어 있으면 pass, 하나도 없으면 fail."""
    names = [r.strip() for r in regions if r.strip()]
    if not names:
        return "unknown", "공고에서 지역을 특정하지 못했어요"
    if not address.strip():
        return "unknown", "가게 주소가 없어 지역을 확인할 수 없어요"
    hit = next((n for n in names if n in address), None)
    if hit:
        return "pass", f"가게 주소에 '{hit}'이(가) 포함돼요"
    return "fail", f"가게 주소가 {', '.join(names)}에 해당하지 않아요"
