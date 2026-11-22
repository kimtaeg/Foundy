"""외부 API 실패를 분류하고 서버 로그에 한 줄로 남긴다.

로그만 보고 원인(키·승인·주소·제공자 오류·통신)을 구분할 수 있게 하는 것이 목적이다.
URL 쿼리 문자열과 키 값은 절대 남기지 않는다.
"""

from __future__ import annotations

import json
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from urllib.parse import unquote

import httpx

logger = logging.getLogger("foundy.external_api")

# 실패 종류
TIMEOUT, AUTH, NOT_FOUND, NO_DATA, PARSE_ERROR = "timeout", "auth", "not_found", "no_data", "parse_error"
SERVER_ERROR, NETWORK, CONFIG, PROVIDER_ERROR = "server_error", "network", "config", "provider_error"

# 도구 이름 → 화면에 쓰는 이름
TOOL_LABELS = {
    "address": "주소 검색", "building": "건축물대장", "law": "법령", "law_rag": "저장된 법령",
    "trademark": "상표 검색", "grants": "지원사업 공고",
}

# 제공자가 HTTP 200 안에 돌려주는 인증·승인 오류 코드 (공공데이터포털·KIPRIS 공통 체계)
_AUTH_CODES = {"20", "22", "30", "31", "32", "33"}
_AUTH_MSG = re.compile(r"(?i)SERVICE_?KEY|NOT_?REGISTERED|UNAUTHORIZED|ACCESS_?DENIED|EXPIRED|인증|미등록|승인")

# 도구가 던지는 값 오류 코드 → 실패 종류
_VALUE_KINDS = {
    "ADDRESS_AMBIGUOUS_OR_MISSING": NO_DATA,
    "LAW_NOT_UNIQUE": NO_DATA,
    "LAW_REFERENCE_UNCONFIRMED": NO_DATA,
}

_SECRET_PARAM = re.compile(r"(?i)\b(service_?key|access_?key|api_?key|crtfc_?key|oc|key|token)=([^&\s\"'<>]+)")
_KAKAO = re.compile(r"(?i)KakaoAK\s+\S+")
_BEARER = re.compile(r"(?i)Bearer\s+\S+")
_URL = re.compile(r"https?://[^\s\"'<>]+")


@dataclass
class ProviderError(Exception):
    """제공자가 정상 형식으로 오류를 돌려줬다 (HTTP 200 + resultCode 오류 등)."""

    code: str
    result_code: str | None = None
    result_msg: str | None = None
    status: int | None = None
    kind: str | None = None

    def __post_init__(self) -> None:
        super().__init__(self.code)

    def __str__(self) -> str:
        return self.code


@dataclass
class Failure:
    kind: str
    status: int | None = None
    result_code: str | None = None
    result_msg: str | None = None
    code: str | None = None


def _secret_values() -> list[str]:
    try:
        from config import get_settings

        s = get_settings()
        values = [s.kakao_rest_key, s.building_api_key, s.data_go_kr_key, s.law_oc, s.kipris_api_key]
    except Exception:  # noqa: BLE001 - 설정을 못 읽어도 패턴 마스킹은 한다
        values = []
    out = []
    for v in values:
        if v and len(v) >= 4:
            out.extend({v, unquote(v)})
    return out


def mask(text: object) -> str:
    """키·토큰을 가리고 URL은 쿼리 문자열을 지운다."""
    out = str(text)
    for secret in _secret_values():
        out = out.replace(secret, "***")
    out = _URL.sub(lambda m: m.group(0).split("?", 1)[0], out)
    out = _SECRET_PARAM.sub(lambda m: f"{m.group(1)}=***", out)
    out = _KAKAO.sub("KakaoAK ***", out)
    out = _BEARER.sub("Bearer ***", out)
    return out


def classify(exc: BaseException) -> Failure:
    if isinstance(exc, ProviderError):
        kind = exc.kind
        if kind is None:
            auth = (exc.result_code or "") in _AUTH_CODES or bool(_AUTH_MSG.search(exc.result_msg or ""))
            kind = AUTH if auth else PROVIDER_ERROR
        return Failure(kind, exc.status, exc.result_code, exc.result_msg, exc.code)
    if isinstance(exc, httpx.TimeoutException):
        return Failure(TIMEOUT, code=type(exc).__name__)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        kind = {401: AUTH, 403: AUTH, 404: NOT_FOUND}.get(status, SERVER_ERROR if status >= 500 else PROVIDER_ERROR)
        return Failure(kind, status, code=f"HTTP_{status}")
    if isinstance(exc, httpx.HTTPError):
        return Failure(NETWORK, code=type(exc).__name__)
    if isinstance(exc, (json.JSONDecodeError, ET.ParseError, KeyError, TypeError)):
        return Failure(PARSE_ERROR, code=type(exc).__name__)
    if isinstance(exc, ValueError):
        code = str(exc).split(":", 1)[0].strip()
        if code.startswith("MISSING_"):
            return Failure(CONFIG, code=code)
        if re.fullmatch(r"[A-Z0-9_]+", code or ""):
            return Failure(_VALUE_KINDS.get(code, PARSE_ERROR if "INVALID" in code else PROVIDER_ERROR), code=code)
        return Failure(PARSE_ERROR, code="ValueError")
    return Failure(PROVIDER_ERROR, code=type(exc).__name__)


def user_reason(tool: str, failure: Failure) -> str:
    """분석 진행 화면에 붙이는 짧은 원인."""
    label = TOOL_LABELS.get(tool, tool)
    if failure.kind == AUTH:
        return f"{label} 서비스 인증에 실패했어요"
    if failure.kind == CONFIG:
        return f"{label} 서비스 키가 설정되지 않았어요"
    if failure.kind == TIMEOUT:
        return f"{label} 서비스 응답이 늦어요"
    if failure.kind == NO_DATA:
        if (failure.code or "").startswith("ADDRESS_"):
            tool = "address"
        return {"address": "주소 검색에서 이 주소를 하나로 찾지 못했어요",
                "building": "건축물대장에서 이 주소의 건물을 찾지 못했어요"}.get(tool, f"{label}에서 결과를 찾지 못했어요")
    if failure.kind == NOT_FOUND:
        return f"{label} 서비스 주소를 찾지 못했어요"
    if failure.kind == PARSE_ERROR:
        return f"{label} 응답을 읽지 못했어요"
    if failure.kind in (SERVER_ERROR, NETWORK):
        return f"{label} 서비스에 일시적인 문제가 있어요"
    return f"{label} 서비스가 오류를 돌려줬어요"


def log_failure(tool: str, failure: Failure, elapsed_ms: float, outcome: str) -> None:
    """outcome: 실패 뒤 무엇을 했는지 (cache=저장된 결과, mock=예시 자료, failed=대체 없음)."""
    logger.warning(
        "external_api_failure tool=%s kind=%s http=%s result_code=%s result_msg=%s code=%s elapsed_ms=%d outcome=%s",
        tool, failure.kind, failure.status if failure.status is not None else "-",
        mask(failure.result_code or "-"), mask(failure.result_msg or "-")[:200], mask(failure.code or "-"),
        round(elapsed_ms), outcome,
    )


def check_gateway(response: httpx.Response, code: str) -> None:
    """공공데이터포털 게이트웨이 오류(XML cmmMsgHeader)면 resultCode·메시지를 담아 던진다.

    키 미등록·트래픽 초과 같은 오류는 JSON을 요청해도 XML로, HTTP 200 또는 4xx로 온다.
    """
    head = response.content[:2000]
    if b"cmmMsgHeader" not in head:
        return
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError:
        return
    raise ProviderError(code, root.findtext(".//returnReasonCode"),
                        root.findtext(".//returnAuthMsg") or root.findtext(".//errMsg"), status=response.status_code)
