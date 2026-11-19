from datetime import datetime, timedelta, timezone

import pytest

from agent.ports import ToolResult
from tools._common import ToolError, run_tool
from tools.cache import MemoryCache

NOW = datetime(2026, 11, 19, tzinfo=timezone.utc)


def test_cache_isolation():
    cache = MemoryCache()
    result = ToolResult(ok=True, source="test", data={"items": [1]}, fetched_at=NOW)
    cache.put("one", result, NOW + timedelta(days=1))
    result.data["items"].append(2)
    read = cache.get("one")
    read.result.data["items"].append(3)
    assert cache.get("one").result.data == {"items": [1]}
    assert cache.get("other") is None


@pytest.mark.parametrize("mock,expired", [(False, False), (False, True), (True, True)])
def test_cache_fallback_preserves_mock_origin_and_time(mock, expired):
    cache = MemoryCache()
    original = NOW - timedelta(days=50)
    cache.put("key", ToolResult(ok=True, source="provider", data={"x": 1}, from_mock=mock,
                                fetched_at=None if mock else original),
              NOW - timedelta(seconds=1) if expired else NOW + timedelta(days=1))
    def fail():
        raise ToolError("TIMEOUT", fallback=True)
    result = run_tool(source="provider", key="key", live=fail,
                      mock=lambda: pytest.fail("must use cache first"), cache=cache, ttl_days=7,
                      use_mock=False, allow_fallback=True, clock=lambda: NOW)
    assert result.ok and result.from_cache and result.from_mock == mock
    assert result.fetched_at == (None if mock else original)
    assert result.error.startswith("STALE_CACHE:" if expired else "CACHE_FALLBACK:")


def test_cache_failure_does_not_hide_live_success_or_mock():
    class BrokenCache:
        def get(self, key):
            raise RuntimeError("secret")
        def put(self, *args):
            raise RuntimeError("secret")
    args = dict(source="p", key="k", cache=BrokenCache(), ttl_days=7, use_mock=False,
                allow_fallback=True, clock=lambda: NOW, mock=lambda: {"mock": True})
    assert run_tool(live=lambda: {"live": True}, **args).ok
    def fail():
        raise ToolError("TIMEOUT", fallback=True)
    result = run_tool(live=fail, **args)
    assert result.from_mock and result.data == {"mock": True}
