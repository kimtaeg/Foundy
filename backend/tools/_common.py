"""공급자 오류의 비밀값 없는 분류와 실제→캐시→mock 실행."""

from datetime import datetime, timedelta, timezone
from typing import Callable

import httpx

from agent.ports import ToolResult
from .cache import ToolCache


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ToolError(Exception):
    def __init__(self, code: str, *, fallback: bool = False):
        self.code, self.fallback = code, fallback
        super().__init__(code)


def get_response(client: httpx.Client, url: str, **kwargs) -> httpx.Response:
    try:
        response = client.get(url, timeout=5.0, **kwargs)
        response.raise_for_status()
    except httpx.TimeoutException:
        raise ToolError("TIMEOUT", fallback=True) from None
    except httpx.HTTPStatusError as exc:
        # str(exc)에는 URL·serviceKey가 포함될 수 있어 반환하지 않는다.
        raise ToolError(f"HTTP_{exc.response.status_code}", fallback=True) from None
    except httpx.RequestError:
        raise ToolError("NETWORK_ERROR", fallback=True) from None
    return response


def get_json(client: httpx.Client, url: str, **kwargs) -> dict:
    response = get_response(client, url, **kwargs)
    try:
        data = response.json()
    except ValueError:
        # XML 인증 오류나 원문 본문은 내보내지 않는다.
        raise ToolError("INVALID_RESPONSE", fallback=True) from None
    if not isinstance(data, dict):
        raise ToolError("INVALID_RESPONSE", fallback=True)
    return data


def run_tool(*, source: str, key: str, live: Callable[[], dict],
             mock: Callable[[], dict], cache: ToolCache | None, ttl_days: int,
             use_mock: bool, allow_fallback: bool, clock: Callable[[], datetime]) -> ToolResult:
    if use_mock:
        try:
            return ToolResult(ok=True, source=source, data=mock(), from_mock=True)
        except ToolError as exc:
            return ToolResult(ok=False, source=source, error=exc.code, from_mock=True)
    try:
        fetched_at = clock()
        result = ToolResult(ok=True, source=source, data=live(), fetched_at=fetched_at)
    except ToolError as exc:
        if not allow_fallback or not exc.fallback:
            return ToolResult(ok=False, source=source, error=exc.code)
        if cache is not None:
            try:
                entry = cache.get(key)
            except Exception:
                entry = None  # 캐시 장애도 mock 경로를 막지 않는다.
            if entry and entry.result.ok:
                marker = "STALE_CACHE" if entry.expires_at <= clock() else "CACHE_FALLBACK"
                return entry.result.model_copy(deep=True, update={
                    "from_cache": True, "error": f"{marker}:{exc.code}",
                })
        try:
            return ToolResult(ok=True, source=source, data=mock(), from_mock=True,
                              error=f"MOCK_FALLBACK:{exc.code}")
        except ToolError:
            return ToolResult(ok=False, source=source, error=exc.code)
    if cache is not None:
        try:
            cache.put(key, result, fetched_at + timedelta(days=ttl_days))
        except Exception:
            pass  # 실제 조회 성공을 캐시 저장 실패로 바꾸지 않는다.
    return result
