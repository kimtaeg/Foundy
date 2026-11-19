"""KIPRIS 전체검색 → 기존 trademark(name) 계약. 제43류 등록 상표 후보만 조회한다.

공식 명세: https://plus.kipris.or.kr/portal/data/clasList/DBII_000000000000012/view.do?kppSCode=KPP010103&menuNo=210002
항목별 전체검색 getAdvancedSearch의 ServiceKey·trademarkName·classification을 사용한다.
후보의 유사성·상표권 침해 여부는 이 조회 도구에서 판단하지 않는다.
"""

from datetime import datetime
from hashlib import sha256
from pathlib import Path
import re
from typing import Callable
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

import httpx

from agent.ports import ToolResult
from ._common import ToolError, get_response, run_tool, utcnow
from .address import MOCKS
from .cache import ToolCache

TRADEMARK_URL = "https://plus.kipris.or.kr/kipo-api/kipi/trademarkInfoSearchService/getAdvancedSearch"
_STATUS_FLAGS = ("application", "registration", "refused", "expiration", "withdrawal", "publication", "cancel", "abandonment")
_MARK_FLAGS = ("trademark", "serviceMark", "trademarkServiceMark", "businessEmblem", "collectiveMark",
               "geoOrgMark", "internationalMark", "certMark", "geoCertMark")
_FORM_FLAGS = ("character", "figure", "compositionCharacter", "figureComposition", "fragrance", "sound",
               "color", "colorMixed", "dimension", "hologram", "invisible", "motion", "visual")
_KNOWN_STATUSES = {"출원", "등록", "거절", "소멸", "취하", "공고", "무효", "포기"}


def normalize_name(name: str) -> str:
    return " ".join(name.split())


def validate_endpoint(value: str) -> str:
    try:
        parsed = urlsplit(value)
        expected = urlsplit(TRADEMARK_URL)
        valid = (parsed.scheme == "https" and parsed.hostname == expected.hostname
                 and parsed.port in (None, 443) and parsed.path == expected.path
                 and not parsed.query and not parsed.fragment and not parsed.username and not parsed.password)
    except (TypeError, ValueError):
        valid = False
    if not valid:
        raise ValueError("UNSUPPORTED_KIPRIS_ENDPOINT")
    return value


def _child(node: ET.Element, name: str, *, required: bool = True) -> ET.Element | None:
    nodes = [child for child in node if child.tag == name]
    if not nodes and not required:
        return None
    if len(nodes) != 1:
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    return nodes[0]


def _value(node: ET.Element, name: str, *, required: bool = True) -> str:
    child = _child(node, name, required=required)
    if child is None:
        return ""
    if len(child):
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    return (child.text or "").strip()


def _number(value: str) -> int:
    if not re.fullmatch(r"[0-9]+", value):
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    return int(value)


def parse_page(content: bytes) -> tuple[ET.Element, list[ET.Element], int, int, int]:
    if (len(content) > 2 * 1024 * 1024 or b"\x00" in content
            or b"<!DOCTYPE" in content.upper() or b"<!ENTITY" in content.upper()):
        raise ToolError("UNSAFE_TRADEMARK_XML", fallback=True)
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True) from None
    for node in root.iter():
        node.tag = node.tag.rsplit("}", 1)[-1]
    if root.tag != "response":
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    header = _child(root, "header")
    code = _value(header, "resultCode")
    if code != "00":
        safe_code = code if re.fullmatch(r"[0-9]{1,3}", code) else "UNKNOWN"
        raise ToolError(f"KIPRIS_ERROR_{safe_code}", fallback=True)
    if _value(header, "successYN") != "Y":
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    count = _child(root, "count")
    total, page, size = (_number(_value(count, key)) for key in ("totalCount", "pageNo", "numOfRows"))
    if page < 1 or (total > 0 and size < 1) or size > 500:
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    items = _child(_child(root, "body"), "items")
    rows = list(items)
    if any(row.tag != "item" for row in rows) or len(rows) > size or len(rows) > total:
        raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
    return root, rows, total, page, size


def normalize_records(rows: list[ET.Element], query: str) -> dict:
    similar, excluded = {}, 0
    for row in rows:
        status = _value(row, "applicationStatus")
        if status not in _KNOWN_STATUSES:
            raise ToolError("UNKNOWN_TRADEMARK_STATUS")
        raw_classes = _value(row, "classificationCode")
        classes = [part.strip() for part in raw_classes.split("|")]
        if any(not re.fullmatch(r"[0-9]{2}", part) or not 1 <= int(part) <= 45 for part in classes):
            raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
        if status != "등록" or "43" not in classes:
            excluded += 1
            continue
        registration, name = _value(row, "registrationNumber"), _value(row, "title")
        if not re.fullmatch(r"[0-9]{13}", registration) or not name:
            raise ToolError("INVALID_TRADEMARK_RESPONSE", fallback=True)
        item = {"reg_no": registration, "name": name, "class_code": "43", "status": status,
                "url": "https://www.kipris.or.kr/"}
        # 검증된 개별 상세 URL 형식이 없어 공개 검색 포털을 사용한다. 원문 이미지 URL은 반환하지 않는다.
        if registration in similar and similar[registration] != item:
            raise ToolError("CONFLICTING_TRADEMARK_RECORDS")
        similar[registration] = item
    return {"similar": list(similar.values()), "query": query, "class_code": "43",
            "status_scope": "등록", "provider_count": len(rows), "excluded_count": excluded}


class TrademarkTool:
    def __init__(self, client: httpx.Client, *, api_key: str = "", endpoint: str = TRADEMARK_URL,
                 cache: ToolCache | None = None, use_mock: bool = False, allow_fallback: bool = True,
                 clock: Callable[[], datetime] = utcnow, mocks_dir: Path = MOCKS):
        if not isinstance(api_key, str):
            raise ValueError("INVALID_KIPRIS_SETTINGS")
        self.client, self.api_key, self.endpoint = client, api_key.strip(), validate_endpoint(endpoint)
        self.cache, self.use_mock, self.allow_fallback = cache, use_mock, allow_fallback
        self.clock, self.mocks_dir = clock, mocks_dir

    def _live(self, query: str) -> dict:
        if not self.api_key:
            raise ToolError("MISSING_KIPRIS_API_KEY", fallback=True)
        params = {key: "true" if key == "registration" else "false" for key in _STATUS_FLAGS}
        params.update({key: "true" for key in (*_MARK_FLAGS, *_FORM_FLAGS)})
        params.update(ServiceKey=self.api_key, trademarkName=query, classification="43", numOfRows="100")
        rows, expected, previous, seen = [], None, set(), set()
        for page in range(1, 11):
            params["pageNo"] = str(page)
            response = get_response(self.client, self.endpoint, params=params, follow_redirects=False)
            _, batch, total, actual_page, _ = parse_page(response.content)
            if expected is None:
                expected = total
            if total != expected or actual_page != page:
                raise ToolError("PARTIAL_TRADEMARK_RESPONSE", fallback=True)
            signature = tuple(ET.tostring(row, encoding="unicode") for row in batch)
            if batch and signature in previous:
                raise ToolError("REPEATED_TRADEMARK_PAGE", fallback=True)
            previous.add(signature)
            identities = [tuple(_value(row, field, required=False) for field in (
                "applicationNumber", "registrationNumber", "classificationCode", "applicationStatus", "title"))
                for row in batch]
            if len(set(identities)) != len(identities) or any(identity in seen for identity in identities):
                raise ToolError("PARTIAL_TRADEMARK_RESPONSE", fallback=True)
            seen.update(identities)
            rows.extend(batch)
            if len(rows) == total:
                return normalize_records(rows, query)
            if not batch or len(rows) > total:
                raise ToolError("PARTIAL_TRADEMARK_RESPONSE", fallback=True)
        raise ToolError("TOO_MANY_TRADEMARK_PAGES", fallback=True)

    def _mock(self, query: str) -> dict:
        try:
            root, rows, total, page, _ = parse_page((self.mocks_dir / "trademark.xml").read_bytes())
            if root.get("mock_is_example") != "true" or normalize_name(root.get("mock_query", "")) != query:
                raise ToolError("MOCK_NOT_FOUND")
            if len(rows) != total or page != 1:
                raise ToolError("MOCK_INCOMPLETE")
            return normalize_records(rows, query)
        except (OSError, ToolError):
            raise ToolError("MOCK_NOT_FOUND") from None

    def trademark(self, name: str) -> ToolResult:
        source = "KIPRIS Plus 상표 출원 속보"
        if not isinstance(name, str) or not name.strip() or len(name) > 200:
            return ToolResult(ok=False, source=source, error="INVALID_TRADEMARK_NAME")
        query = normalize_name(name)
        digest = sha256((self.endpoint + "\n43:registered:trademarkName\n" + query).encode()).hexdigest()
        return run_tool(source=source, key=f"trademark:{digest}",
                        live=lambda: self._live(query), mock=lambda: self._mock(query), cache=self.cache,
                        ttl_days=7, use_mock=self.use_mock, allow_fallback=self.allow_fallback, clock=self.clock)
