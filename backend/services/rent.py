"""임대료 비교: 한국부동산원 임대동향조사의 같은 상권 소규모 상가 ㎡당 임대료와 내 ㎡당 환산 월세를 비교한다.

저장하지 않고 요청마다 계산한다. 실제 통계를 못 불러오면(키 오류·결과 없음·호출 실패) 비교하지 않고 안내만 한다.
지어낸 평균값은 쓰지 않는다. 예시 계정·USE_MOCK=true 에서만 mocks/rent.json 예시 값을 쓰고 is_example 로 표시한다.

지도 중심 (#201): lat·lng 가 오면 좌표의 법정동(카카오 coord2regioncode, B 문서)만으로 상권 → 권역 → 시도를 찾는다.
층은 가게 층을 쓴다. 동을 확인하지 못하면 unavailable 로 두고 가게 주소로 대신하지 않는다. 저장하지 않는다.

층별 비교 (#187): 같은 지역의 1층·2층·지하1층과 상위(시도, 시도 자체면 전국) 1층 평균을 rows 로 보여 주고,
가게 층에 맞는 통계 층과 비교한다. 층별 표만 실패하면 지역별(1층) 값 1행으로 비교한다. 문장(readings)은 규칙으로 만든다.
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
STATISTIC = "평균(면적 가중)"
FLOORS_UNAVAILABLE = "층별 통계를 불러오지 못했어요"
MAP_UNRESOLVED = "지도 위치의 동을 확인하지 못했어요"


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


def _is_example(store: Any) -> bool:
    return bool(getattr(store, "is_demo", False)) or get_settings().use_mock


def statistics(store: Any, tools, text: str | None = None) -> tuple[dict | None, bool, str | None]:
    """(통계, 예시 여부, 실패 원인). 예시 계정·USE_MOCK 이면 예시 값, 아니면 실제 조회만 쓴다.

    text: 상권 매칭 글자. 없으면 가게 주소(도로명 + 지번 지역)를 쓴다.
    """
    if _is_example(store):
        return json.loads(MOCK.read_text(encoding="utf-8"))["data"], True, None
    res = tools.rent(text if text is not None else _address_text(store))
    if not res.ok or res.from_mock or getattr(res, "substituted", False) or not res.data:
        return None, False, getattr(res, "reason", None)
    return res.data, False, None


def _floor_values(found: dict) -> tuple[dict[str, float], dict | None, bool]:
    """(이 지역 층별 값(천원/㎡), 상위 1층 평균, 층별 표를 읽었는지). 1층은 지역별 임대료 값을 쓴다 (통계상 같은 값)."""
    floors = found.get("floors")
    values = {calc.FIRST_FLOOR: found["rent_thousand_krw_per_sqm"]}
    if not floors:
        return values, None, False
    # 0 이하는 표본 없음 (R-ONE이 0으로 준다). 저장된 이전 조회 결과에 0이 남아 있어도 비교에 쓰지 않는다
    values.update({k: v for k, v in (floors.get("area") or {}).items() if k != calc.FIRST_FLOOR and v is not None and v > 0})
    top = floors.get("top") or {}
    top_value = top.get(calc.FIRST_FLOOR)
    return values, (top if top_value is not None and top_value > 0 else None), True


def _rows(found: dict, values: dict[str, float], top: dict | None, compared: str, matched: bool,
          area: float | None) -> list[dict]:
    """같은 지역 1층·2층·지하1층(값이 있는 층만) + 상위(시도, 시도 자체면 전국) 1층 평균."""
    name = found["area_name"].split(">")[-1]
    rows = []
    for floor in calc.STAT_FLOORS:
        if floor not in values:
            continue
        won = calc.krw_per_sqm(values[floor])
        rows.append({"label": f"{name} {floor}", "krw_per_sqm": won,
                     "monthly_for_my_area_krw": calc.monthly_for_area(won, area),
                     "is_my_floor": matched and floor == compared})
    if top:
        won = calc.krw_per_sqm(top[calc.FIRST_FLOOR])
        rows.append({"label": f"{top['name']} 1층 평균", "krw_per_sqm": won,
                     "monthly_for_my_area_krw": calc.monthly_for_area(won, area), "is_my_floor": False})
    return rows


def _location(store: Any, tools, lat: float | None, lng: float | None) -> tuple[dict, str | None]:
    """(location 필드, 상권 매칭 글자). 지도 기준이면 좌표의 법정동 글자만 쓴다 (가게 주소를 섞지 않는다)."""
    if lat is None or lng is None:
        if _is_example(store):
            return {"source": "store", "region": None, "resolved": False}, None
        region = getattr(store, "region", None) or None
        return {"source": "store", "region": region, "resolved": region is not None}, None
    if _is_example(store):
        return {"source": "map", "region": None, "resolved": False}, None
    region = tools.coord_region(lat, lng)
    return {"source": "map", "region": region, "resolved": region is not None}, region


def view(store: Any, tools, *, monthly_rent: int | None, deposit: int | None, area: float | None,
         lat: float | None = None, lng: float | None = None) -> dict:
    detail = parse_detail(store.address_detail)
    store_area = float(store.area_sqm) if getattr(store, "area_sqm", None) else None
    use_area = area if area else store_area
    inputs = {
        "monthly_rent_krw": monthly_rent, "deposit_krw": deposit or 0, "area_sqm": use_area,
        "area_source": "query" if area else ("store" if store_area else None),
        "floor": detail["floor"], "underground": detail["underground"],
    }
    location, text = _location(store, tools, lat, lng)
    unresolved_map = location["source"] == "map" and not location["resolved"] and not _is_example(store)
    if unresolved_map:
        found, example, reason = None, False, MAP_UNRESOLVED
    else:
        found, example, reason = statistics(store, tools, text)
    out: dict = {
        "status": "ready", "is_example": example, "message": None, "reason": None, "missing": [],
        "inputs": inputs, "headline": None, "comparison": None, "rows": None, "readings": [], "notes": [],
        "basis": {"rent": "월세 + 보증금 환산(전환율)", "area": BASIS_AREA, "floor": BASIS_FLOOR},
        "source": None, "average": None, "location": location,
    }
    if found is None:
        out.update(status="unavailable", message=UNAVAILABLE, reason=reason)
        return out

    # 비교할 층: 가게 층의 통계가 있으면 그 층, 없으면(3층 이상·값 없음·층별 표 실패·층 모름) 1층
    values, top, floors_ok = _floor_values(found)
    wanted = calc.wanted_floor(detail["floor"], detail["underground"])
    matched = wanted is not None and wanted in values
    compared = wanted if matched else calc.FIRST_FLOOR
    compared_won = calc.krw_per_sqm(values[compared])

    out["average"] = _average(found)
    out["source"] = {"name": found["source"], "period": found["period"],
                     "conversion_rate_pct": round(found["conversion_rate_pct"], 2)}
    out["basis"]["rent"] = f"월세 + 보증금 × 전환율 {round(found['conversion_rate_pct'], 2):g}% ÷ 12"
    out["basis"]["floor"] = f"{compared} 기준"
    out["headline"] = {
        "area_name": found["area_name"], "area_level": found["level"], "building_type": found["building_type"],
        "floor_label": compared, "krw_per_sqm": compared_won,
        "monthly_for_my_area_krw": calc.monthly_for_area(compared_won, use_area), "statistic": STATISTIC,
    }
    out["rows"] = _rows(found, values, top, compared, matched, use_area)

    if found["level"] != "상권":
        out["notes"].append(f"이 주소의 상권 통계가 없어 {found['area_name'].replace('>', ' ')} {found['level']} 평균과 비교했어요.")
    store_floor = calc.store_floor_label(detail["floor"], detail["underground"])
    if not floors_ok:
        out["notes"].append(FLOORS_UNAVAILABLE)
    elif store_floor and not matched and store_floor != calc.FIRST_FLOOR:
        out["notes"].append(f"{store_floor} 통계가 없어 1층 평균과 비교했어요. 1층이 아니면 보통 이보다 낮아요.")

    if monthly_rent is None:
        out["missing"].append("monthly_rent")
    if not use_area:
        out["missing"].append("area")
    if out["missing"]:
        out["status"] = "need_input"
        out["readings"] = calc.readings(found["level"], compared, None, None)
        return out
    comparison = calc.compare(monthly_rent, deposit or 0, use_area, found["conversion_rate_pct"], values[compared])
    out["comparison"] = {**comparison, "compared_floor": compared}
    out["readings"] = calc.readings(found["level"], compared, comparison["diff_pct"], comparison["level"])
    if not area:
        out["notes"].append("마이페이지의 영업장 면적으로 계산했어요. 통계는 전용+공용 면적 기준이라, 전용면적이면 실제보다 높게 나올 수 있어요. 계약서의 임대면적을 넣으면 더 정확해요.")
    # 층별로 비교하지 못했을 때만 (층별 표 실패) 예전 1층 기준 안내를 남긴다
    if not floors_ok and (detail["underground"] or (detail["floor"] and detail["floor"] != "1")):
        out["notes"].append("통계는 1층 기준이라 2층·지하는 보통 이보다 낮아요.")
    return out
