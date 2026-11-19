from datetime import datetime, timezone
import json

import httpx
import pytest

from agent.ports import ToolResult
from tools.address import AddressTool, MOCKS
from tools.cache import MemoryCache

ADDRESS = "서울 성동구 성수이로 113"
NOW = datetime(2026, 11, 19, tzinfo=timezone.utc)


@pytest.fixture
def address_payload():
    return json.loads((MOCKS / "kakao_address.json").read_text())


def client_for(payload, status=200):
    return httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(status, json=payload)))


def test_live_normalizes_codes_and_preserves_provenance(address_payload):
    def handler(request):
        assert request.headers["Authorization"] == "KakaoAK test-key"
        assert request.url.params["query"] == ADDRESS
        assert request.extensions["timeout"]["read"] == 5
        return httpx.Response(200, json=address_payload)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = AddressTool(client, api_key="test-key", clock=lambda: NOW).resolve_address(ADDRESS)
    assert isinstance(result, ToolResult)
    assert result.ok and not result.from_mock and not result.from_cache
    assert result.fetched_at == NOW
    assert result.data["codes"] == {"sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0289",
                                    "ji": "0010", "plat_gb_cd": "0"}
    assert result.data["coord"]["lat"] == pytest.approx(37.54514647655)


@pytest.mark.parametrize("field,value,expected", [
    ("sub_address_no", "", ("ji", "0000")),
    ("mountain_yn", "Y", ("plat_gb_cd", "1")),
])
def test_number_and_mountain(address_payload, field, value, expected):
    address_payload["documents"][0]["address"][field] = value
    with client_for(address_payload) as client:
        result = AddressTool(client, api_key="test").resolve_address(ADDRESS)
    assert result.data["codes"][expected[0]] == expected[1]


@pytest.mark.parametrize("payload,error", [
    ({"documents": [], "meta": {"total_count": 0}}, "ADDRESS_NOT_FOUND"),
    ({"documents": [{}, {}], "meta": {"total_count": 2}}, "AMBIGUOUS_ADDRESS"),
    ({"documents": [{}], "meta": {"total_count": 1}}, "ADDRESS_CODES_UNAVAILABLE"),
    ({"documents": [], "meta": {}}, "INVALID_RESPONSE"),
])
def test_semantic_failure_does_not_turn_into_unrelated_mock(payload, error):
    with client_for(payload) as client:
        result = AddressTool(client, api_key="test", allow_fallback=False).resolve_address(ADDRESS)
    assert not result.ok and result.error == error


@pytest.mark.parametrize("value", [None, "", "   ", "x" * 501])
def test_invalid_input_makes_no_request(value):
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        assert AddressTool(client).resolve_address(value).error == "INVALID_ADDRESS"


def test_live_ambiguity_does_not_fallback_even_at_demo_address(address_payload):
    address_payload["meta"]["total_count"] = 2
    with client_for(address_payload) as client:
        result = AddressTool(client, api_key="test").resolve_address(ADDRESS)
    assert not result.ok and result.error == "AMBIGUOUS_ADDRESS" and not result.from_mock


@pytest.mark.parametrize("mutation,error", [
    (lambda p: p["documents"][0]["address"].update(b_code="bad"), "ADDRESS_CODES_UNAVAILABLE"),
    (lambda p: p["documents"][0]["address"].pop("mountain_yn"), "ADDRESS_CODES_UNAVAILABLE"),
    (lambda p: p["documents"][0].update(x="nan"), "COORDINATES_UNAVAILABLE"),
    (lambda p: p["documents"][0].update(y="999"), "COORDINATES_UNAVAILABLE"),
])
def test_missing_and_invalid_fields(address_payload, mutation, error):
    mutation(address_payload)
    with client_for(address_payload) as client:
        result = AddressTool(client, api_key="test", allow_fallback=False).resolve_address(ADDRESS)
    assert not result.ok and result.error == error


def test_mock_only_matches_known_address():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no network"))) as client:
        tool = AddressTool(client, use_mock=True)
        result = tool.resolve_address("서울특별시 성동구 성수이로 113")
        assert result.ok and result.from_mock and result.fetched_at is None
        other = tool.resolve_address("부산 다른 주소")
        assert not other.ok and other.error == "MOCK_NOT_FOUND"


def test_timeout_fallback_and_live_only():
    def handler(request):
        raise httpx.ReadTimeout("secret-in-url", request=request)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = AddressTool(client, api_key="secret").resolve_address(ADDRESS)
        assert result.ok and result.from_mock and result.error == "MOCK_FALLBACK:TIMEOUT"
        result = AddressTool(client, api_key="secret", allow_fallback=False).resolve_address(ADDRESS)
        assert not result.ok and result.error == "TIMEOUT"
        assert "secret" not in result.model_dump_json()


def test_http_failure_does_not_leak_response_or_credentials():
    with client_for({"message": "sensitive provider response"}, 403) as client:
        result = AddressTool(client, api_key="secret", allow_fallback=False).resolve_address(ADDRESS)
    assert result.error == "HTTP_403"
    assert "secret" not in result.model_dump_json() and "sensitive" not in result.model_dump_json()


def test_cache_is_used_only_after_failure_and_keeps_original_time(address_payload):
    calls = []
    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(200, json=address_payload)
        raise httpx.ConnectError("offline", request=request)
    cache = MemoryCache()
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        tool = AddressTool(client, api_key="test", cache=cache, clock=lambda: NOW)
        first = tool.resolve_address(ADDRESS)
        second = tool.resolve_address(ADDRESS)
    assert len(calls) == 2
    assert second.ok and second.from_cache and not second.from_mock
    assert first.fetched_at == second.fetched_at == NOW
    assert second.error == "CACHE_FALLBACK:NETWORK_ERROR"


@pytest.mark.parametrize("field,value,error", [
    ("b_code", "invalid", "ADDRESS_CODES_UNAVAILABLE"),
    ("main_address_no", "invalid", "ADDRESS_CODES_UNAVAILABLE"),
    ("sub_address_no", "invalid", "ADDRESS_CODES_UNAVAILABLE"),
    ("mountain_yn", "invalid", "ADDRESS_CODES_UNAVAILABLE"),
    ("x", "invalid", "COORDINATES_UNAVAILABLE"),
    ("y", "999", "COORDINATES_UNAVAILABLE"),
])
@pytest.mark.parametrize("cached", [False, True])
def test_invalid_provider_fields_use_cache_or_matching_mock(address_payload, field, value, error, cached):
    cache = MemoryCache()
    with client_for(address_payload) as client:
        tool = AddressTool(client, api_key="test", cache=cache, clock=lambda: NOW)
        if cached:
            assert tool.resolve_address(ADDRESS).ok
        target = address_payload["documents"][0]
        (target if field in ("x", "y") else target["address"])[field] = value
        result = tool.resolve_address(ADDRESS)
    assert result.ok and result.from_cache is cached and result.from_mock is not cached
    assert result.fetched_at == (NOW if cached else None)
    assert result.error == f"{'CACHE_FALLBACK' if cached else 'MOCK_FALLBACK'}:{error}"


@pytest.mark.parametrize("total,error", [(0, "ADDRESS_NOT_FOUND"), (2, "AMBIGUOUS_ADDRESS")])
def test_semantic_failure_never_uses_previous_cache(address_payload, total, error):
    cache = MemoryCache()
    with client_for(address_payload) as client:
        tool = AddressTool(client, api_key="test", cache=cache)
        assert tool.resolve_address(ADDRESS).ok
        address_payload["meta"]["total_count"] = total
        if total == 0:
            address_payload["documents"] = []
        result = tool.resolve_address(ADDRESS)
    assert not result.ok and result.error == error
    assert not result.from_cache and not result.from_mock


def test_malformed_response_does_not_use_another_address_mock(address_payload):
    address_payload["documents"][0]["x"] = "invalid"
    with client_for(address_payload) as client:
        result = AddressTool(client, api_key="test").resolve_address("fixture에 없는 주소")
    assert not result.ok and result.error == "COORDINATES_UNAVAILABLE"
    assert not result.from_mock and not result.from_cache
