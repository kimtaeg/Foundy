"""국가법령정보 현행 조문·별표 조회. 확정된 check_id 매핑은 호출자가 주입한다.

시행일 기준 API: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdListGuide
본문: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdInfoGuide
HTTP나 원문 링크의 OC를 외부에 전달하지 않는다. 법적 적용 판단은 하지 않는다.
"""

from dataclasses import asdict, dataclass
from datetime import date, datetime
from hashlib import sha256
import json
from pathlib import Path
import re
from types import MappingProxyType
from typing import Callable, Mapping, Sequence
from zoneinfo import ZoneInfo

import httpx

from agent.ports import ToolResult
from ._common import ToolError, get_response, run_tool, utcnow
from .address import MOCKS
from .cache import ToolCache

LAW_BASE = "https://www.law.go.kr/DRF"
_AUTH_HINTS = ("사용자 정보 검증에 실패", "미신청된 목록", "사용자 검증에 실패", "등록되지 않은 IP", "IP가 등록", "정확한 서버장비의 IP주소")
_KOREA = ZoneInfo("Asia/Seoul")


def _number(value, *, default=None) -> int:
    if value in (None, "") and default is not None:
        return default
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]+", str(value)):
        raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
    return int(value)


def _digits(value) -> str:
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not re.fullmatch(r"[0-9]+", str(value)):
        raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
    return str(value)


def _date(value) -> date:
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
    try:
        return datetime.strptime(str(value), "%Y%m%d").date() if len(str(value)) == 8 else date.fromisoformat(str(value))
    except ValueError:
        raise ToolError("INVALID_LAW_RESPONSE", fallback=True) from None


def _rows(value) -> list[dict]:
    if value is None or value == "":
        return []
    rows = [value] if isinstance(value, dict) else value
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
    return rows


@dataclass(frozen=True)
class LawReference:
    law_name: str
    number: int
    kind: str = "article"  # article | annex
    sub_number: int = 0

    def __post_init__(self):
        if (not isinstance(self.law_name, str) or not self.law_name.strip() or len(self.law_name) > 200
                or self.kind not in ("article", "annex") or type(self.number) is not int
                or not 1 <= self.number <= 9999 or type(self.sub_number) is not int
                or not 0 <= self.sub_number <= 99):
            raise ValueError("INVALID_LAW_REFERENCE")
        object.__setattr__(self, "law_name", " ".join(self.law_name.split()))

    @property
    def label(self) -> str:
        base = f"제{self.number}조" if self.kind == "article" else f"별표 {self.number}"
        return f"{base}의{self.sub_number}" if self.sub_number else base


@dataclass(frozen=True)
class _Version:
    law_name: str
    law_id: str
    law_seq: str
    effective_date: date
    promulgation_date: date
    promulgation_number: str


def _version(row: dict, law_name: str, today: date) -> _Version:
    # 공급자 링크는 OC를 포함할 수 있으므로 읽거나 반환하지 않는다.
    name = row.get("법령명한글")
    if not isinstance(name, str) or " ".join(name.split()) != law_name:
        raise ToolError("LAW_MISMATCH")
    law_id, seq, number = (_digits(row.get(k)) for k in ("법령ID", "법령일련번호", "공포번호"))
    effective, promulgated = _date(row.get("시행일자")), _date(row.get("공포일자"))
    if effective > today or promulgated > today:
        raise ToolError("LAW_NOT_EFFECTIVE")
    return _Version(law_name, law_id.zfill(6), seq, effective, promulgated, number)


def _text(value, depth=0) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list) and depth < 8:
        return "\n".join(part for item in value if (part := _text(item, depth + 1)))
    raise ToolError("INVALID_LAW_RESPONSE", fallback=True)


def _article_text(unit: dict) -> str:
    parts = [_text(unit.get("조문내용"))]
    for paragraph in _rows(unit.get("항")):
        parts.append(_text(paragraph.get("항내용")))
        for clause in _rows(paragraph.get("호")):
            parts.append(_text(clause.get("호내용")))
            for point in _rows(clause.get("목")):
                parts.append(_text(point.get("목내용")))
    return "\n".join(part for part in parts if part)


def _normalize(payload: dict, ref: LawReference, version: _Version, today: date) -> dict:
    root = payload.get("법령")
    if not isinstance(root, dict) or not isinstance(root.get("기본정보"), dict):
        raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
    basic = root["기본정보"]
    if (basic.get("법령명_한글") != ref.law_name
            or _digits(basic.get("법령ID")).zfill(6) != version.law_id):
        raise ToolError("LAW_MISMATCH")
    if (_date(basic.get("시행일자")) != version.effective_date
            or _date(basic.get("공포일자")) != version.promulgation_date
            or _digits(basic.get("공포번호")) != version.promulgation_number):
        raise ToolError("LAW_VERSION_MISMATCH")
    group = "조문" if ref.kind == "article" else "별표"
    container = root.get(group)
    if not isinstance(container, dict):
        raise ToolError("REFERENCE_NOT_FOUND")
    candidates = []
    for unit in _rows(container.get(group + "단위")):
        if ref.kind == "article" and unit.get("조문여부") != "조문":
            continue
        if ref.kind == "annex" and unit.get("별표구분") != "별표":
            continue
        if (_number(unit.get(group + "번호")) == ref.number
                and _number(unit.get(group + "가지번호"), default=0) == ref.sub_number):
            candidates.append(unit)
    if not candidates:
        raise ToolError("REFERENCE_NOT_FOUND")
    if len(candidates) != 1:
        raise ToolError("AMBIGUOUS_LAW_REFERENCE")
    unit = candidates[0]
    if unit.get("조문제개정유형") == "삭제":
        raise ToolError("REFERENCE_DELETED")
    text = _article_text(unit) if ref.kind == "article" else _text(unit.get("별표내용"))
    if not text:
        raise ToolError("LAW_TEXT_UNAVAILABLE")
    if re.match(r"^제\s*[0-9]+\s*조(?:\s*의\s*[0-9]+)?\s*(?:\([^)]*\))?\s*삭제", text):
        raise ToolError("REFERENCE_DELETED")
    effective = _date(unit[group + "시행일자"]) if unit.get(group + "시행일자") else None
    if effective and effective > today:
        raise ToolError("LAW_NOT_EFFECTIVE")
    return {"law_name": ref.law_name, "article": ref.label, "text": text,
            "url": f"https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq={version.law_seq}",
            "law_id": version.law_id, "law_seq": version.law_seq,
            "effective_date": effective.isoformat() if effective else None,
            "law_effective_date": version.effective_date.isoformat(),
            "promulgation_date": version.promulgation_date.isoformat(),
            "promulgation_number": version.promulgation_number}


class LawTool:
    def __init__(self, client: httpx.Client, *, references: Mapping[str, Sequence[LawReference]] | None = None,
                 oc: str = "", cache: ToolCache | None = None, use_mock: bool = False,
                 allow_fallback: bool = True, clock: Callable[[], datetime] = utcnow, mocks_dir: Path = MOCKS):
        if not isinstance(oc, str):
            raise ValueError("INVALID_LAW_SETTINGS")
        self.client, self.oc, self.cache = client, oc.strip(), cache
        self.use_mock, self.allow_fallback, self.clock, self.mocks_dir = use_mock, allow_fallback, clock, mocks_dir
        self._references = MappingProxyType({cid: tuple(refs) for cid, refs in (references or {}).items()})
        if any(not isinstance(cid, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", cid)
               or not refs or len(refs) > 20 or any(not isinstance(r, LawReference) for r in refs)
               for cid, refs in self._references.items()):
            raise ValueError("INVALID_LAW_REFERENCES")

    def _json(self, path: str, **params) -> dict:
        try:
            response = get_response(self.client, f"{LAW_BASE}/{path}",
                                    params={"OC": self.oc, "type": "JSON", **params}, follow_redirects=False)
        except ToolError as exc:
            if exc.code in ("HTTP_401", "HTTP_403"):
                raise ToolError("LAW_AUTH_OR_IP_ERROR", fallback=True) from None
            raise
        try:
            payload = response.json()
        except ValueError:
            code = "LAW_AUTH_OR_IP_ERROR" if any(h in response.text[:8192] for h in _AUTH_HINTS) else "INVALID_LAW_RESPONSE"
            raise ToolError(code, fallback=True) from None
        if not isinstance(payload, dict):
            raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
        if not ({"LawSearch", "법령"} & payload.keys()) and any(h in response.text[:8192] for h in _AUTH_HINTS):
            raise ToolError("LAW_AUTH_OR_IP_ERROR", fallback=True)
        return payload

    def _search(self, name: str, today: date) -> _Version:
        rows, expected, previous = [], None, set()
        for page in range(1, 11):
            payload = self._json("lawSearch.do", target="eflaw", query=name, nw="3", display="100", page=str(page))
            root = payload.get("LawSearch")
            if not isinstance(root, dict) or str(root.get("resultCode", "00")) not in ("00", "0"):
                raise ToolError("INVALID_LAW_RESPONSE", fallback=True)
            total = _number(root.get("totalCnt"))
            batch = _rows(root.get("law"))
            if expected is None:
                expected = total
            if total != expected or _number(root.get("page")) != page or len(batch) > 100:
                raise ToolError("PARTIAL_LAW_RESPONSE", fallback=True)
            signature = json.dumps(batch, ensure_ascii=False, sort_keys=True)
            if batch and signature in previous:
                raise ToolError("REPEATED_LAW_PAGE", fallback=True)
            previous.add(signature)
            rows.extend(batch)
            if len(rows) == total:
                break
            if not batch or len(rows) > total:
                raise ToolError("PARTIAL_LAW_RESPONSE", fallback=True)
        else:
            raise ToolError("TOO_MANY_LAW_PAGES", fallback=True)
        matches = [r for r in rows if r.get("법령명한글") == name and r.get("현행연혁코드") == "현행"]
        if not matches:
            raise ToolError("LAW_NOT_FOUND")
        if len(matches) != 1:
            raise ToolError("AMBIGUOUS_LAW")
        return _version(matches[0], name, today)

    def _live(self, refs: tuple[LawReference, ...], today: date) -> dict:
        if not self.oc:
            raise ToolError("MISSING_LAW_OC", fallback=True)
        versions, articles = {}, []
        for ref in refs:
            if ref.law_name not in versions:
                versions[ref.law_name] = self._search(ref.law_name, today)
            version = versions[ref.law_name]
            params = {"target": "eflaw", "MST": version.law_seq,
                      "efYd": version.effective_date.strftime("%Y%m%d")}
            if ref.kind == "article":
                params["JO"] = f"{ref.number:04d}{ref.sub_number:02d}"
            payload = self._json("lawService.do", **params)
            articles.append(_normalize(payload, ref, version, today))
        return {"articles": articles}

    def _mock(self, refs: tuple[LawReference, ...], today: date) -> dict:
        try:
            sources = json.loads((self.mocks_dir / "law_sources.json").read_text())
            if not isinstance(sources, dict):
                raise ToolError("MOCK_NOT_FOUND")
            articles = []
            for ref in refs:
                source = sources.get(ref.law_name)
                if not isinstance(source, dict) or not isinstance(source.get("body_file"), str):
                    raise ToolError("MOCK_NOT_FOUND")
                path = (self.mocks_dir / source["body_file"]).resolve()
                if not path.is_relative_to(self.mocks_dir.resolve()):
                    raise ToolError("MOCK_NOT_FOUND")
                payload = json.loads(path.read_text())
                basic = payload["법령"]["기본정보"]
                row = {"법령명한글": basic["법령명_한글"], "법령ID": basic["법령ID"],
                       "법령일련번호": source.get("law_seq"), "시행일자": basic["시행일자"],
                       "공포일자": basic["공포일자"], "공포번호": basic["공포번호"]}
                articles.append(_normalize(payload, ref, _version(row, ref.law_name, today), today))
            return {"articles": articles}
        except (OSError, ValueError, TypeError, KeyError, ToolError):
            raise ToolError("MOCK_NOT_FOUND") from None

    def law(self, check_id: str) -> ToolResult:
        source = "국가법령정보센터"
        if not isinstance(check_id, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", check_id):
            return ToolResult(ok=False, source=source, error="INVALID_CHECK_ID")
        refs = self._references.get(check_id)
        if not refs:
            return ToolResult(ok=False, source=source, error="LAW_REFERENCE_UNCONFIRMED")
        today = self.clock().astimezone(_KOREA).date()
        digest = sha256(json.dumps([asdict(ref) for ref in refs], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        return run_tool(source=source, key=f"law:{check_id}:{digest}",
                        live=lambda: self._live(refs, today), mock=lambda: self._mock(refs, today),
                        cache=self.cache, ttl_days=1, use_mock=self.use_mock,
                        allow_fallback=self.allow_fallback, clock=self.clock)
