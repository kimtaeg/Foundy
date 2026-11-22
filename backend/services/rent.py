"""임대료 비교: 한국부동산원 임대동향조사의 같은 상권 소규모 상가 ㎡당 임대료와 내 ㎡당 환산 월세를 비교한다.

저장하지 않고 요청마다 계산한다. 실제 통계를 못 불러오면(키 오류·결과 없음·호출 실패) 비교하지 않고 안내만 한다.
지어낸 평균값은 쓰지 않는다. 예시 계정·USE_MOCK=true 에서만 mocks/rent.json 예시 값을 쓰고 is_example 로 표시한다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from calc import rent as calc
from config import get_settings
from rules.building_use import parse_detail

MOCK = Path(__file__).resolve().parents[1] / "mocks" / "rent.json"
UNAVAILABLE = "임대료 통계를 아직 불러올 수 없어요"
BASIS_AREA = "임대가능면적(전용+공용) 기준"
BASIS_FLOOR = "1층 기준"


def _address_text(store: Any) -> str:
    """상권 매칭에 쓰는 주소 글자: 도로명 주소 + 지번 지역(동 이름)."""
    return " ".join(p for p in (store.address, getattr(store, "region", None)) if p)


def _average(found: dict) -> dict:
    return {
        "area_name": found["area_name"], "level": found["level"],
        "krw_per_sqm": round(found["rent_thousand_krw_per_sqm"] * 1000),
        "conversion_rate_pct": round(found["conversion_rate_pct"], 2),
        "period": found["period"], "building_type": found["building_type"], "source": found["source"],
    }


def statistics(store: Any, tools) -> tuple[dict | None, bool, str | None]:
    """(통계, 예시 여부, 실패 원인). 예시 계정·USE_MOCK 이면 예시 값, 아니면 실제 조회만 쓴다."""
    if getattr(store, "is_demo", False) or get_settings().use_mock:
        return json.loads(MOCK.read_text(encoding="utf-8"))["data"], True, None
    res = tools.rent(_address_text(store))
    if not res.ok or res.from_mock or getattr(res, "substituted", False) or not res.data:
        return None, False, getattr(res, "reason", None)
    return res.data, False, None


def view(store: Any, tools, *, monthly_rent: int | None, deposit: int | None, area: float | None) -> dict:
    detail = parse_detail(store.address_detail)
    store_area = float(store.area_sqm) if getattr(store, "area_sqm", None) else None
    use_area = area if area else store_area
    inputs = {
        "monthly_rent_krw": monthly_rent, "deposit_krw": deposit or 0, "area_sqm": use_area,
        "area_source": "query" if area else ("store" if store_area else None),
        "floor": detail["floor"], "underground": detail["underground"],
    }
    found, example, reason = statistics(store, tools)
    out: dict = {
        "status": "ready", "is_example": example, "message": None, "reason": None, "missing": [],
        "inputs": inputs, "average": None, "comparison": None, "notes": [],
        "basis": {"rent": "월세 + 보증금 환산(전환율)", "area": BASIS_AREA, "floor": BASIS_FLOOR},
    }
    if found is None:
        out.update(status="unavailable", message=UNAVAILABLE, reason=reason)
        return out
    out["average"] = _average(found)
    out["basis"]["rent"] = f"월세 + 보증금 × 전환율 {round(found['conversion_rate_pct'], 2):g}% ÷ 12"
    if found["level"] != "상권":
        out["notes"].append(f"이 주소의 상권 통계가 없어 {found['area_name'].replace('>', ' ')} {found['level']} 평균과 비교했어요.")
    if monthly_rent is None:
        out["missing"].append("monthly_rent")
    if not use_area:
        out["missing"].append("area")
    if out["missing"]:
        out["status"] = "need_input"
        return out
    out["comparison"] = calc.compare(monthly_rent, deposit or 0, use_area,
                                     found["conversion_rate_pct"], found["rent_thousand_krw_per_sqm"])
    if not area:
        out["notes"].append("마이페이지의 영업장 면적으로 계산했어요. 통계는 전용+공용 면적 기준이라, 전용면적이면 실제보다 높게 나올 수 있어요. 계약서의 임대면적을 넣으면 더 정확해요.")
    if detail["underground"] or (detail["floor"] and detail["floor"] != "1"):
        out["notes"].append("통계는 1층 기준이라 2층·지하는 보통 이보다 낮아요.")
    return out
