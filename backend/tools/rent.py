"""한국부동산원 R-ONE 부동산통계 Open API: 상업용부동산 임대동향조사 소규모 상가 임대료·전환율.

통계 정의 (한국부동산원 통계 설명):
- 임대료 = 환산임대료 = (보증금 × 전환율 / 12) + 월 임대료. 관리비·부가세 제외
- 임대가능면적(전용면적 + 공용면적)으로 나눈 ㎡당 값, 단위 천원/㎡ (월)
- 상가는 1층 기준
응답 row 예: {"CLS_FULLNM": "서울>기타>뚝섬", "ITM_NM": "임대료", "DTA_VAL": 67.38, "UI_NM": "천원/㎡",
              "WRTTIME_IDTFR_ID": "202603", "WRTTIME_DESC": "2026년 3분기"}
"""

from __future__ import annotations

import re
from pathlib import Path

import httpx
import yaml

from tools import retry
from tools.failure import ProviderError

URL = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do"
SOURCE = "한국부동산원 상업용부동산 임대동향조사"
BUILDING_TYPE = "소규모 상가"

# 최신 표부터 찾는다. 분기마다 새 표가 생기므로 앞 표에 값이 없으면 다음 표를 본다.
RENT_TABLES = ("T269273143698159", "T248223134698125")      # 지역별 임대료_소규모 상가 (2026년3분기~, 2024년3분기~)
CONVERSION_TABLES = ("T265023143785924", "T246253134905233")  # 지역별 전환율_소규모 상가

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
        return {
            "level": level, "area_name": rent["CLS_FULLNM"],
            "rent_thousand_krw_per_sqm": float(rent["DTA_VAL"]), "unit": rent.get("UI_NM"),
            "conversion_rate_pct": float(conv["DTA_VAL"]),
            "period": rent.get("WRTTIME_DESC"), "period_id": rent.get("WRTTIME_IDTFR_ID"),
            "building_type": BUILDING_TYPE, "source": SOURCE,
        }
    return None


def _first_rows(client: httpx.Client, key: str, tables: tuple[str, ...], start: str) -> list[dict]:
    """앞 표부터 보고 row가 있는 첫 표를 쓴다 (새 분기 표가 비어 있으면 이전 표)."""
    rows: list[dict] = []
    for table in tables:
        rows = fetch_table(client, key, table, start)
        if rows:
            return rows
    return rows
