"""건축HUB 표제부·층별개요 → agent.ports의 building(store) 계약."""

from datetime import datetime
import json
from pathlib import Path
import re
from typing import Callable

import httpx

from agent.ports import StoreInput, ToolResult
from ._common import ToolError, get_json, run_tool, utcnow
from .address import AddressTool, MOCKS, normalize_codes, parse_address
from .cache import ToolCache

BUILDING_BASE = "https://apis.data.go.kr/1613000/BldRgstHubService"
_USE_CLASS_RE = re.compile(r"제\s*([0-9]+)\s*종\s*근린\s*생활\s*시설")


def parse_floor(detail: str | None) -> tuple[str, int]:
    if not isinstance(detail, str):
        raise ToolError("FLOOR_REQUIRED")
    matches = list(re.finditer(r"(?<![0-9A-Za-z])(?:(지하|지상|지|B)\s*)?([0-9]{1,3})\s*층", detail, re.I))
    if not matches:
        match = re.fullmatch(r"\s*[Bb]([0-9]{1,3})\s*", detail)
        if match and int(match[1]) > 0:
            return "10", int(match[1])
        raise ToolError("FLOOR_REQUIRED")
    if len(matches) != 1 or re.search(r"[~～–]|[0-9]\s*[,/·-]\s*[0-9]+\s*층", detail):
        raise ToolError("AMBIGUOUS_FLOOR")
    if re.search(r"[0-9]+\.[0-9]+\s*층", detail):
        raise ToolError("INVALID_FLOOR")
    match = matches[0]
    # '-1층'을 지상 1층으로 오해하지 않는다.
    if match.start() and detail[match.start() - 1] in "-−":
        raise ToolError("INVALID_FLOOR")
    number = int(match[2])
    if number == 0:
        raise ToolError("INVALID_FLOOR")
    return ("10" if (match[1] or "").upper() in ("지하", "지", "B") else "20"), number


def _integer(value) -> int:
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]+", str(value)):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    return int(value)


def parse_page(payload: dict) -> tuple[list[dict], int, int, int]:
    response = payload.get("response")
    if not isinstance(response, dict) or not isinstance(response.get("header"), dict):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    code = str(response["header"].get("resultCode"))
    if code not in ("00", "0"):
        # 공급자의 resultMsg에 키 등이 반사될 수 있어 코드만 기록한다.
        safe = code if re.fullmatch(r"[0-9]{1,3}", code) else "UNKNOWN"
        raise ToolError(f"SERVICE_ERROR_{safe}", fallback=True)
    body = response.get("body")
    if not isinstance(body, dict):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    total, page, size = (_integer(body.get(k)) for k in ("totalCount", "pageNo", "numOfRows"))
    if not page or not size:
        raise ToolError("INVALID_RESPONSE", fallback=True)
    items = body.get("items")
    if items in (None, ""):
        rows = []
    elif isinstance(items, dict):
        rows = items.get("item", [])
        if isinstance(rows, dict):
            rows = [rows]
    else:
        raise ToolError("INVALID_RESPONSE", fallback=True)
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    if total == 0 and rows:
        raise ToolError("INVALID_RESPONSE", fallback=True)
    return rows, total, page, size


def _primary(row: dict) -> bool:
    # 코드와 명칭이 충돌하면 주건축물로 보지 않는다.
    code, name = row.get("mainAtchGbCd"), str(row.get("mainAtchGbCdNm", "")).strip()
    if code not in (None, ""):
        return str(code) == "0" and name in ("", "주건축물")
    return name == "주건축물"


def normalize_building(titles: list[dict], floors: list[dict], floor: tuple[str, int]) -> dict:
    main = [row for row in titles if _primary(row)]
    if not main:
        raise ToolError("BUILDING_NOT_FOUND")
    candidates = []
    for row in floors:
        if not _primary(row):
            continue
        kind = str(row.get("flrGbCd", ""))
        if not kind:
            kind = {"지하": "10", "지상": "20"}.get(row.get("flrGbCdNm"), "")
        if kind != floor[0] or str(row.get("flrNo")) != str(floor[1]):
            continue
        candidates.append({"building_id": str(row.get("mgmBldrgstPk", "")).strip(),
                           "dong": str(row.get("dongNm", "")).strip(),
                           "use": str(row.get("mainPurpsCdNm") or "").strip(),
                           "detail_use": str(row.get("etcPurps") or "").strip(),
                           "area_m2": row.get("area")})
    if not candidates:
        raise ToolError("FLOOR_NOT_FOUND")
    # 두 필드 모두 공급자 원문이다. 상세 용도에만 있는 명시적 분류도 소비자에 전달한다.
    uses = sorted({" / ".join(dict.fromkeys(value for value in (row["use"], row["detail_use"]) if value))
                   for row in candidates})
    # 여러 주건축물 또는 서로 다른 구획이면 가게 용도를 단정하지 않는다.
    ambiguous = (len(main) != 1 or len(uses) != 1 or any(not row["use"] for row in candidates)
                 or any(len(set(_USE_CLASS_RE.findall(use))) > 1 for use in uses))
    ids = {row["building_id"] for row in candidates if row["building_id"]}
    title_id = str(main[0].get("mgmBldrgstPk", "")).strip()
    if len(ids) > 1 or (ids and title_id and ids != {title_id}):
        ambiguous = True
    return {"floor_uses": [] if ambiguous else uses, "violation": None,
            "needs_confirmation": ambiguous, "floor_candidates": candidates,
            "note": "MULTIPLE_BUILDINGS_OR_USES" if ambiguous else "VIOLATION_FIELD_UNAVAILABLE"}


class BuildingTool:
    def __init__(self, client: httpx.Client, *, api_key: str = "", address_tool: AddressTool | None = None,
                 cache: ToolCache | None = None, use_mock: bool = False, allow_fallback: bool = True,
                 clock: Callable[[], datetime] = utcnow, mocks_dir: Path = MOCKS):
        self.client, self.api_key, self.address_tool = client, api_key, address_tool
        self.cache, self.use_mock, self.allow_fallback = cache, use_mock, allow_fallback
        self.clock, self.mocks_dir = clock, mocks_dir

    def _pages(self, operation: str, codes: dict) -> list[dict]:
        if not self.api_key:
            raise ToolError("MISSING_BUILDING_KEY", fallback=True)
        mapping = {"sigungu_cd": "sigunguCd", "bjdong_cd": "bjdongCd",
                   "plat_gb_cd": "platGbCd", "bun": "bun", "ji": "ji"}
        params = {mapping[k]: v for k, v in codes.items()}
        params.update(serviceKey=self.api_key, _type="json", numOfRows="100")
        rows, expected, previous = [], None, set()
        for requested in range(1, 101):
            params["pageNo"] = str(requested)
            data = get_json(self.client, f"{BUILDING_BASE}/{operation}", params=params)
            batch, total, page, size = parse_page(data)
            if expected is None:
                expected = total
            if total != expected or page != requested or len(batch) > size:
                raise ToolError("PARTIAL_RESPONSE", fallback=True)
            signature = json.dumps(batch, sort_keys=True, ensure_ascii=False)
            if batch and signature in previous:
                raise ToolError("REPEATED_PAGE", fallback=True)
            previous.add(signature)
            rows.extend(batch)
            if len(rows) == total:
                return rows
            if len(rows) > total or not batch:
                raise ToolError("PARTIAL_RESPONSE", fallback=True)
        raise ToolError("TOO_MANY_PAGES", fallback=True)

    def _mock(self, codes: dict, floor: tuple[str, int]) -> dict:
        try:
            address = parse_address(json.loads((self.mocks_dir / "kakao_address.json").read_text()))
            if address["codes"] != codes:
                raise ToolError("MOCK_NOT_FOUND")
            all_rows = []
            for name in ("building_title", "building_floor"):
                batch, total, _, _ = parse_page(json.loads((self.mocks_dir / f"{name}.json").read_text()))
                if len(batch) != total:
                    raise ToolError("MOCK_INCOMPLETE")
                all_rows.append(batch)
            return normalize_building(*all_rows, floor)
        except (OSError, ValueError):
            raise ToolError("MOCK_NOT_FOUND") from None

    def building(self, store: StoreInput) -> ToolResult:
        source = "건축HUB 건축물대장 층별개요"
        try:
            floor = parse_floor(store.address_detail)
            mock_address = False
            if store.address_codes:
                codes = normalize_codes(store.address_codes)
            else:
                if self.address_tool is None:
                    raise ToolError("ADDRESS_CODES_REQUIRED")
                address = self.address_tool.resolve_address(store.address)
                if not address.ok or not address.data:
                    raise ToolError(address.error or "ADDRESS_NOT_RESOLVED")
                codes = normalize_codes(address.data.get("codes"))
                mock_address = address.from_mock
            key = "building:" + ":".join(codes.values()) + f":{floor[0]}:{floor[1]}"
            # 주소를 mock으로 해석했다면 그 주소로 실제 데이터를 조회해 출처를 지우지 않는다.
            return run_tool(source=source, key=key,
                            live=lambda: normalize_building(self._pages("getBrTitleInfo", codes),
                                                            self._pages("getBrFlrOulnInfo", codes), floor),
                            mock=lambda: self._mock(codes, floor), cache=self.cache, ttl_days=7,
                            use_mock=self.use_mock or mock_address, allow_fallback=self.allow_fallback,
                            clock=self.clock)
        except ToolError as exc:
            return ToolResult(ok=False, source=source, error=exc.code)
