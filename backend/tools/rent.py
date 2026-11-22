"""한국부동산원 R-ONE 부동산통계 Open API: 상업용부동산 임대동향조사 소규모 상가 임대료·전환율.

통계 정의 (한국부동산원 통계 설명):
- 임대료 = 환산임대료 = (보증금 × 전환율 / 12) + 월 임대료. 관리비·부가세 제외
- 임대가능면적(전용면적 + 공용면적)으로 나눈 ㎡당 값, 단위 천원/㎡ (월)
- 상가는 1층 기준, 면적 가중 평균(Σ임대료 / Σ면적)
응답 row 예: {"CLS_FULLNM": "서울>기타>뚝섬", "ITM_NM": "임대료", "DTA_VAL": 67.38, "UI_NM": "천원/㎡",
              "WRTTIME_IDTFR_ID": "202603", "WRTTIME_DESC": "2026년 3분기"}
층별 표는 지역이 그룹(GRP), 층이 분류(CLS)다 (2026-11-22 실제 응답으로 확인, GRP_FULLNM 은 모든 row 에 있다):
  {"GRP_NM": "뚝섬", "GRP_FULLNM": "서울>기타>뚝섬", "CLS_NM": "2층", "ITM_NM": "임대료", "DTA_VAL": 33.33, "UI_NM": "천원/㎡"}
  층별 표의 1층 값은 지역별 임대료 값과 같다.
"""

from __future__ import annotations

import re
import time
from pathlib import Path

import httpx
import yaml

from tools import retry
from tools.failure import ProviderError, classify, log_failure

URL = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do"
SOURCE = "한국부동산원 상업용부동산 임대동향조사"
BUILDING_TYPE = "소규모 상가"

# 최신 표부터 찾는다. 분기마다 새 표가 생기므로 앞 표에 값이 없으면 다음 표를 본다.
RENT_TABLES = ("T269273143698159", "T248223134698125")      # 지역별 임대료_소규모 상가 (2026년3분기~, 2024년3분기~)
CONVERSION_TABLES = ("T265023143785924", "T246253134905233")  # 지역별 전환율_소규모 상가
FLOOR_TABLES = ("T265443143777773", "T246233134891629")       # 층별임대료 및 층별효용비율_소규모 상가
FLOORS = ("1층", "2층", "지하1층")
NATION = "전국"

AREAS_FILE = Path(__file__).resolve().parents[1] / "rules" / "rent_areas.yaml"


def load_areas() -> dict:
    return yaml.safe_load(AREAS_FILE.read_text(encoding="utf-8"))


def candidates(address: str, areas: dict | None = None) -> list[tuple[str, str, str]]:
    """주소에 맞는 통계 지역 후보 (상권 → 권역 → 시도 순). 값: (단계, 찾을 이름, 맞추는 방식 full|name)."""
    areas = areas or load_areas()
    text = re.sub(r"\s+", " ", address or "").strip()
    out: list[tuple[str, str, str]] = []
    for rule in areas.get("areas", []):
        district = rule.get("district")
        if district and district not in text:
            continue
        if any(word in text for word in rule["match"]):
            out.append(("상권", rule["area"], "full"))
            break
    for district, region in (areas.get("regions") or {}).items():
        if district in text:
            out.append(("권역", region, "full"))
            break
    first = text.split(" ")[0] if text else ""
    sido = (areas.get("sido") or {}).get(first)
    if sido:
        out.append(("시도", sido, "name"))
    return out


AUTH_CODES = {"ERROR-290"}  # 인증키가 유효하지 않습니다 (실제 응답으로 확인)
NO_DATA = "INFO-200"        # 해당하는 데이터가 없습니다
PAGE_SIZE = 1000


def fetch_table(client: httpx.Client, key: str, table: str, start: str) -> list[dict]:
    """통계표 한 개의 row 전체 (1,000건씩 끝까지). 인증·제공자 오류는 ProviderError, 결과 없음은 빈 목록."""
    rows: list[dict] = []
    for page in range(1, 6):
        response = retry.get(client, URL, params={
            "KEY": key, "STATBL_ID": table, "DTACYCLE_CD": "QY", "START_WRTTIME": start,
            "Type": "json", "pIndex": page, "pSize": PAGE_SIZE})
        response.raise_for_status()
        payload = response.json()
        if "SttsApiTblData" not in payload:
            result = payload.get("RESULT") or {}
            code = str(result.get("CODE") or "")
            if code == NO_DATA:
                return rows
            raise ProviderError("REB_PROVIDER_ERROR", code or None, result.get("MESSAGE"),
                                kind="auth" if code in AUTH_CODES else None)
        head, body = payload["SttsApiTblData"]
        meta = {k: v for h in head["head"] for k, v in h.items()}
        code = (meta.get("RESULT") or {}).get("CODE")
        if code not in (None, "INFO-000"):
            raise ProviderError("REB_PROVIDER_ERROR", code, (meta.get("RESULT") or {}).get("MESSAGE"))
        batch = body.get("row") or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE or len(rows) >= int(meta.get("list_total_count") or 0):
            return rows
    return rows


def latest(rows: list[dict], target: str, how: str) -> dict | None:
    """대상 지역의 가장 최근 분기 row (값이 있는 것만)."""
    found = [r for r in rows if r.get("DTA_VAL") is not None
             and (r.get("CLS_FULLNM") if how == "full" else r.get("CLS_NM")) == target]
    if how == "name":  # 시도 이름은 하위 상권 이름과 겹칠 수 있어 가장 짧은 경로(시도 행)만 쓴다
        found = [r for r in found if ">" not in (r.get("CLS_FULLNM") or "")] or found
    return max(found, key=lambda r: str(r.get("WRTTIME_IDTFR_ID"))) if found else None


def lookup(client: httpx.Client, key: str, address: str, start_year: int, areas: dict | None = None) -> dict | None:
    """주소에 맞는 소규모 상가 임대료(천원/㎡)와 같은 지역·분기 전환율(%). 어느 단계에서도 못 찾으면 None."""
    rent_rows = _first_rows(client, key, RENT_TABLES, str(start_year))
    conv_rows = _first_rows(client, key, CONVERSION_TABLES, str(start_year))
    for level, target, how in candidates(address, areas):
        rent = latest(rent_rows, target, how)
        if rent is None:
            continue
        conv = next((r for r in conv_rows if r.get("WRTTIME_IDTFR_ID") == rent.get("WRTTIME_IDTFR_ID")
                     and r.get("DTA_VAL") is not None
                     and (r.get("CLS_FULLNM") if how == "full" else r.get("CLS_NM")) == target
                     and (how == "full" or ">" not in (r.get("CLS_FULLNM") or ""))), None)
        if conv is None:  # 전환율이 없으면 보증금을 환산할 수 없어 같은 기준으로 비교하지 못한다
            continue
        found = {
            "level": level, "area_name": rent["CLS_FULLNM"],
            "rent_thousand_krw_per_sqm": float(rent["DTA_VAL"]), "unit": rent.get("UI_NM"),
            "conversion_rate_pct": float(conv["DTA_VAL"]),
            "period": rent.get("WRTTIME_DESC"), "period_id": rent.get("WRTTIME_IDTFR_ID"),
            "building_type": BUILDING_TYPE, "source": SOURCE,
        }
        started = time.monotonic()
        try:
            found["floors"] = floor_rents(client, key, found["area_name"], str(found["period_id"]))
        except Exception as exc:  # noqa: BLE001 - 층별 표만 실패하면 지역별(1층) 비교는 그대로 한다
            log_failure("rent_floor", classify(exc), (time.monotonic() - started) * 1000, "skipped")
            found["floors"] = None
        return found
    return None


def _same_area(row: dict, area_name: str) -> bool:
    """층별 row 가 이 지역인지. 경로(GRP_FULLNM)가 있으면 경로로, 없으면 시도 단위 이름만 이름으로 맞춘다."""
    full = row.get("GRP_FULLNM")
    if full:
        return full == area_name
    return ">" not in area_name and row.get("GRP_NM") == area_name


def floor_rents(client: httpx.Client, key: str, area_name: str, period_id: str) -> dict:
    """같은 분기의 층별 임대료(천원/㎡). {"area": {층: 값}, "top": {"name": 상위 이름, "1층": 값 | None}}.

    상위는 찾은 지역의 시도(예: 서울>기타>뚝섬 → 서울). 찾은 지역이 시도 자체면 전국이다.
    값이 없는 층은 넣지 않는다. 호출 실패는 예외로 올린다.
    """
    rows = _period_rows(client, key, FLOOR_TABLES, period_id)
    rents = [r for r in rows if r.get("ITM_NM") == "임대료" and r.get("DTA_VAL") is not None and r.get("CLS_NM") in FLOORS]
    top = area_name.split(">")[0] if ">" in area_name else NATION
    top_row = next((r for r in rents if r.get("CLS_NM") == "1층" and _same_area(r, top)), None)
    return {"area": {r["CLS_NM"]: float(r["DTA_VAL"]) for r in rents if _same_area(r, area_name)},
            "top": {"name": top, "1층": float(top_row["DTA_VAL"]) if top_row else None}}


def _period_rows(client: httpx.Client, key: str, tables: tuple[str, ...], period_id: str) -> list[dict]:
    """그 분기 row 가 있는 첫 표의 그 분기 row. 같은 분기부터만 받아 이전 분기 표도 몇 페이지로 끝난다."""
    for table in tables:
        rows = [r for r in fetch_table(client, key, table, period_id) if str(r.get("WRTTIME_IDTFR_ID")) == period_id]
        if rows:
            return rows
    return []


def _first_rows(client: httpx.Client, key: str, tables: tuple[str, ...], start: str) -> list[dict]:
    """앞 표부터 보고 row가 있는 첫 표를 쓴다 (새 분기 표가 비어 있으면 이전 표)."""
    rows: list[dict] = []
    for table in tables:
        rows = fetch_table(client, key, table, start)
        if rows:
            return rows
    return rows
