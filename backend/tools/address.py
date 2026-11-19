"""카카오 주소 검색. 복수 주소는 선택 없이 확정하지 않는다."""

from datetime import datetime
import json
import math
from pathlib import Path
import re
from typing import Callable

import httpx

from agent.ports import ToolResult
from ._common import ToolError, get_json, run_tool, utcnow
from .cache import ToolCache

ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
MOCKS = Path(__file__).resolve().parents[1] / "mocks"


def normalize_query(query: str) -> str:
    return " ".join(query.strip().split()).replace("서울특별시 ", "서울 ")


def normalize_codes(codes: dict) -> dict[str, str]:
    """서비스 내부 코드만 받는다. 공급자 camelCase는 어댑터에서 변환한다."""
    if not isinstance(codes, dict):
        raise ToolError("INVALID_ADDRESS_CODES")
    out = {}
    for name, size in (("sigungu_cd", 5), ("bjdong_cd", 5), ("bun", 4), ("ji", 4)):
        value = codes.get(name)
        if not isinstance(value, str) or not re.fullmatch(rf"[0-9]{{{size}}}", value):
            raise ToolError("INVALID_ADDRESS_CODES")
        out[name] = value
    if codes.get("plat_gb_cd") not in ("0", "1", "2"):
        raise ToolError("INVALID_ADDRESS_CODES")
    out["plat_gb_cd"] = codes["plat_gb_cd"]
    return out


def parse_address(payload: dict) -> dict:
    documents, meta = payload.get("documents"), payload.get("meta")
    if not isinstance(documents, list) or not isinstance(meta, dict):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    total = meta.get("total_count")
    if type(total) is not int or total < 0:
        raise ToolError("INVALID_RESPONSE", fallback=True)
    if total == 0 and not documents:
        raise ToolError("ADDRESS_NOT_FOUND")
    if total > 1 or len(documents) > 1:
        raise ToolError("AMBIGUOUS_ADDRESS")
    if total != 1 or len(documents) != 1 or not isinstance(documents[0], dict):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    doc = documents[0]
    addr = doc.get("address")
    if not isinstance(addr, dict):
        raise ToolError("ADDRESS_CODES_UNAVAILABLE", fallback=True)
    b_code = addr.get("b_code")
    if not isinstance(b_code, str) or not re.fullmatch(r"[0-9]{10}", b_code):
        raise ToolError("ADDRESS_CODES_UNAVAILABLE", fallback=True)
    numbers = []
    for value in (addr.get("main_address_no"), addr.get("sub_address_no")):
        value = "0" if value == "" else value
        if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,4}", value):
            raise ToolError("ADDRESS_CODES_UNAVAILABLE", fallback=True)
        numbers.append(value.zfill(4))
    if addr.get("mountain_yn") not in ("Y", "N"):
        raise ToolError("ADDRESS_CODES_UNAVAILABLE", fallback=True)
    try:
        lng, lat = float(doc["x"]), float(doc["y"])
        if not math.isfinite(lng) or not math.isfinite(lat) or not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        raise ToolError("COORDINATES_UNAVAILABLE", fallback=True) from None
    road = doc.get("road_address") or {}
    if not isinstance(road, dict):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    return {"road": road.get("address_name"), "jibun": addr.get("address_name"),
            "codes": {"sigungu_cd": b_code[:5], "bjdong_cd": b_code[5:],
                      "bun": numbers[0], "ji": numbers[1],
                      "plat_gb_cd": "1" if addr["mountain_yn"] == "Y" else "0"},
            "coord": {"lat": lat, "lng": lng}}


class AddressTool:
    def __init__(self, client: httpx.Client, *, api_key: str = "", cache: ToolCache | None = None,
                 use_mock: bool = False, allow_fallback: bool = True,
                 clock: Callable[[], datetime] = utcnow, mocks_dir: Path = MOCKS):
        self.client, self.api_key, self.cache = client, api_key, cache
        self.use_mock, self.allow_fallback = use_mock, allow_fallback
        self.clock, self.mocks_dir = clock, mocks_dir

    def _live(self, query: str) -> dict:
        if not self.api_key:
            raise ToolError("MISSING_KAKAO_KEY", fallback=True)
        return parse_address(get_json(self.client, ADDRESS_URL, params={"query": query, "size": 30},
                                      headers={"Authorization": f"KakaoAK {self.api_key}"}))

    def _mock(self, query: str) -> dict:
        try:
            payload = json.loads((self.mocks_dir / "kakao_address.json").read_text())
            result = parse_address(payload)
        except (OSError, ValueError, ToolError):
            raise ToolError("MOCK_NOT_FOUND") from None
        aliases = {normalize_query(v) for v in (result["road"], result["jibun"]) if isinstance(v, str)}
        if normalize_query(query) not in aliases:
            raise ToolError("MOCK_NOT_FOUND")
        return result

    def resolve_address(self, query: str) -> ToolResult:
        if not isinstance(query, str) or not query.strip() or len(query) > 500:
            return ToolResult(ok=False, source="카카오 주소 검색", error="INVALID_ADDRESS")
        query = normalize_query(query)
        return run_tool(source="카카오 주소 검색", key=f"address:{query}",
                        live=lambda: self._live(query), mock=lambda: self._mock(query),
                        cache=self.cache, ttl_days=30, use_mock=self.use_mock,
                        allow_fallback=self.allow_fallback, clock=self.clock)
