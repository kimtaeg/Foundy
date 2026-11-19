"""공식 getAdvancedSearch XML 계약을 HTTP 대역과 합성 예시로 검증한다."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import socket
import subprocess
import sys
import json
import xml.etree.ElementTree as ET

import httpx
import pytest

from agent.judge import judge_trademark
from agent.llm import FakeLLM
from rules.engine import check_spec, load_pack
from tests.fakes import TM_JUDGMENT, store
from tools.address import MOCKS
from tools.cache import MemoryCache
from tools.trademark import TRADEMARK_URL, TrademarkTool

NOW = datetime(2026, 11, 20, tzinfo=timezone.utc)
NAME = "모노커피"


@pytest.fixture(autouse=True)
def no_external_network(monkeypatch):
    def blocked(*args, **kwargs):
        pytest.fail("상표 단위 테스트에서 실제 네트워크 연결을 시도했습니다")
    monkeypatch.setattr(socket, "getaddrinfo", blocked)
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)


@pytest.fixture
def response():
    root = ET.fromstring((MOCKS / "trademark.xml").read_bytes())
    root.attrib.clear()  # HTTP 대역은 공급자 XML 구조를 사용한다. 실제 호출 성공을 의미하지 않는다.
    return root


def xml(root):
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def client_for(root):
    return httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=xml(root))))


def make_tool(client, **kwargs):
    return TrademarkTool(client, api_key="synthetic-key", clock=lambda: NOW, **kwargs)


def set_field(node, name, value):
    child = node.find(name)
    if child is None:
        child = ET.SubElement(node, name)
    child.text = value


def page(rows, number=1, total=None):
    root = ET.Element("response")
    header = ET.SubElement(root, "header")
    for key, value in (("successYN", "Y"), ("resultCode", "00")):
        ET.SubElement(header, key).text = value
    items = ET.SubElement(ET.SubElement(root, "body"), "items")
    items.extend(deepcopy(rows))
    count = ET.SubElement(root, "count")
    for key, value in (("totalCount", len(rows) if total is None else total), ("pageNo", number), ("numOfRows", 100)):
        ET.SubElement(count, key).text = str(value)
    return root


def test_live_request_and_normalized_registered_candidates(response):
    requests = []
    def handler(request):
        requests.append(request)
        assert str(request.url).startswith(TRADEMARK_URL)
        assert request.extensions["timeout"]["read"] == 5
        params = request.url.params
        assert params["ServiceKey"] == "synthetic-key" and "accessKey" not in params
        assert params["trademarkName"] == NAME and params["classification"] == "43"
        assert params["registration"] == "true" and params["application"] == params["expiration"] == "false"
        assert params["serviceMark"] == params["trademark"] == params["character"] == "true"
        assert params["pageNo"] == "1" and params["numOfRows"] == "100"
        return httpx.Response(200, content=xml(response))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
        assert not client.is_closed
    assert result.ok and result.fetched_at == NOW and not result.from_cache and not result.from_mock
    assert len(requests) == 1 and len(result.data["similar"]) == 2
    assert all(set(item) == {"reg_no", "name", "class_code", "status", "url"} for item in result.data["similar"])
    assert result.data["similar"][0]["reg_no"] == "4000000000001"
    assert result.data["status_scope"] == "등록" and result.data["provider_count"] == 2
    assert "synthetic-key" not in result.model_dump_json() and "ServiceKey" not in result.model_dump_json()


def test_verified_empty_response_is_success_but_missing_key_is_not():
    empty = page([])
    with client_for(empty) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
        assert result.ok and result.data["similar"] == [] and result.data["provider_count"] == 0
        missing = TrademarkTool(client, allow_fallback=False).trademark(NAME)
        assert not missing.ok and missing.error == "MISSING_KIPRIS_API_KEY"


@pytest.mark.parametrize("value", [None, [], False, "", "   ", "x" * 201])
def test_invalid_name_makes_no_request(value):
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        result = make_tool(client).trademark(value)
    assert not result.ok and result.error == "INVALID_TRADEMARK_NAME"


@pytest.mark.parametrize("endpoint", ["http://plus.kipris.or.kr/kipo-api/kipi/trademarkInfoSearchService/getAdvancedSearch",
                                     "https://example.com/", TRADEMARK_URL + "?ServiceKey=synthetic-key",
                                     TRADEMARK_URL + "#fragment", "https://synthetic-key@plus.kipris.or.kr/",
                                     "https://plus.kipris.or.kr/openapi/rest/trademarkInfoSearchService/trademarkNameSearchInfo"])
def test_endpoint_does_not_send_key_to_other_service_or_plain_http(endpoint):
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        with pytest.raises(ValueError, match="UNSUPPORTED_KIPRIS_ENDPOINT") as error:
            make_tool(client, endpoint=endpoint)
    assert "synthetic-key" not in str(error.value)


def test_only_registered_class43_records_are_returned_and_multiclass_is_supported(response):
    items = response.find("body/items")
    registered = items[0]
    set_field(registered, "classificationCode", "09|43")
    pending = items[1]
    set_field(pending, "applicationStatus", "출원")
    set_field(pending, "registrationNumber", "")
    other_class = deepcopy(registered)
    set_field(other_class, "classificationCode", "42")
    items.append(other_class)
    set_field(response.find("count"), "totalCount", "3")
    with client_for(response) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert result.ok and len(result.data["similar"]) == 1 and result.data["excluded_count"] == 2
    assert result.data["similar"][0]["class_code"] == "43"


@pytest.mark.parametrize("field,value,error", [
    ("applicationStatus", "알 수 없음", "UNKNOWN_TRADEMARK_STATUS"),
    ("registrationNumber", "", "INVALID_TRADEMARK_RESPONSE"),
    ("registrationNumber", "4020260000001?synthetic-key", "INVALID_TRADEMARK_RESPONSE"),
    ("title", "", "INVALID_TRADEMARK_RESPONSE"),
    ("classificationCode", "143", "INVALID_TRADEMARK_RESPONSE"),
])
def test_invalid_record_never_becomes_no_matches(response, field, value, error):
    set_field(response.find("body/items/item"), field, value)
    with client_for(response) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert not result.ok and result.data is None and result.error == error
    assert "synthetic-key" not in result.model_dump_json()


def test_conflicting_registration_records_are_not_silently_overwritten(response):
    first, second = list(response.find("body/items"))
    set_field(second, "registrationNumber", first.findtext("registrationNumber"))
    with client_for(response) as client:
        result = make_tool(client).trademark(NAME)
    assert not result.ok and result.error == "CONFLICTING_TRADEMARK_RECORDS"


@pytest.mark.parametrize("code,success,error", [("11", "N", "KIPRIS_ERROR_11"), ("30", "N", "KIPRIS_ERROR_30"),
                                              ("synthetic-key", "N", "KIPRIS_ERROR_UNKNOWN"),
                                              ("00", "N", "INVALID_TRADEMARK_RESPONSE")])
def test_provider_failure_never_means_empty_search(response, code, success, error):
    set_field(response.find("header"), "resultCode", code)
    set_field(response.find("header"), "successYN", success)
    set_field(response.find("header"), "resultMsg", "synthetic-key raw error")
    with client_for(response) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert not result.ok and result.error == error and result.data is None
    assert "synthetic-key" not in result.model_dump_json() and "raw error" not in result.model_dump_json()


@pytest.mark.parametrize("content,error", [
    (b"<html>synthetic-key</html>", "INVALID_TRADEMARK_RESPONSE"),
    (b"<response>", "INVALID_TRADEMARK_RESPONSE"),
    (b'<!DOCTYPE response [<!ENTITY x "test">]><response>&x;</response>', "UNSAFE_TRADEMARK_XML"),
    (b'<?xml version="1.0"?><response>\x00</response>', "UNSAFE_TRADEMARK_XML"),
])
def test_bad_or_unsafe_xml_is_rejected(content, error):
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=content))) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert not result.ok and result.error == error


@pytest.mark.parametrize("status", [401, 403, 429, 500, 302])
def test_http_failure_is_safe_and_not_followed(status):
    calls = []
    def handler(request):
        calls.append(request.url.host)
        return httpx.Response(status, headers={"location": "https://example.com/?ServiceKey=synthetic-key"},
                              text="synthetic-key")
    with httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert calls == ["plus.kipris.or.kr"]
    assert not result.ok and result.error == f"HTTP_{status}" and "synthetic-key" not in result.model_dump_json()


def test_namespaced_xml_and_zero_rows_are_supported(response):
    for node in response.iter():
        node.tag = "{urn:kipris}" + node.tag
    with client_for(response) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert result.ok and len(result.data["similar"]) == 2


def test_pagination_uses_all_records_before_filtering(response):
    first, second = list(response.find("body/items"))
    set_field(first, "classificationCode", "42")
    calls = []
    def handler(request):
        number = int(request.url.params["pageNo"])
        calls.append(number)
        return httpx.Response(200, content=xml(page([first if number == 1 else second], number, 2)))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert result.ok and calls == [1, 2] and len(result.data["similar"]) == 1
    assert result.data["provider_count"] == 2


@pytest.mark.parametrize("mode,error", [("repeat", "REPEATED_TRADEMARK_PAGE"), ("empty", "PARTIAL_TRADEMARK_RESPONSE"),
                                        ("count_change", "PARTIAL_TRADEMARK_RESPONSE"),
                                        ("wrong_page", "PARTIAL_TRADEMARK_RESPONSE")])
def test_incomplete_pages_are_not_successful(response, mode, error):
    first = response.find("body/items/item")
    def handler(request):
        number = int(request.url.params["pageNo"])
        rows = [first] if number == 1 or mode == "repeat" else []
        return httpx.Response(200, content=xml(page(rows, 1 if mode == "wrong_page" else number,
                                                  3 if mode == "count_change" and number == 2 else 2)))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert not result.ok and result.error == error


def test_overlapping_partial_pages_are_rejected(response):
    first, second = list(response.find("body/items"))
    def handler(request):
        number = int(request.url.params["pageNo"])
        return httpx.Response(200, content=xml(page([first, second] if number == 1 else [second], number, 3)))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = make_tool(client, allow_fallback=False).trademark(NAME)
    assert not result.ok and result.error == "PARTIAL_TRADEMARK_RESPONSE"


@pytest.mark.parametrize("expired", [False, True])
def test_seven_day_cache_fallback_preserves_origin_and_timestamp(response, expired):
    class RecordingCache(MemoryCache):
        def put(self, key, result, expires_at):
            self.expiry = expires_at
            super().put(key, result, expires_at)
    offline = False
    current = NOW
    cache = RecordingCache()
    def handler(request):
        if offline:
            raise httpx.ReadTimeout("synthetic-key", request=request)
        return httpx.Response(200, content=xml(response))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        configured = TrademarkTool(client, api_key="test", clock=lambda: current, cache=cache)
        first = configured.trademark(NAME)
        assert first.ok and cache.expiry == NOW + timedelta(days=7)
        offline = True
        current = NOW + timedelta(days=8) if expired else NOW
        result = configured.trademark(NAME)
    assert result.ok and result.from_cache and not result.from_mock and result.fetched_at == NOW
    assert result.data == first.data and result.error == f"{'STALE_CACHE' if expired else 'CACHE_FALLBACK'}:TIMEOUT"


def test_mock_only_matches_its_input_and_has_no_fake_timestamp():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no HTTP"))) as client:
        configured = TrademarkTool(client, use_mock=True)
        result = configured.trademark(NAME)
        assert result.ok and result.from_mock and result.fetched_at is None and not result.from_cache
        other = configured.trademark("다른 상표")
        assert not other.ok and other.error == "MOCK_NOT_FOUND"
        fallback = TrademarkTool(client).trademark(NAME)
        assert fallback.ok and fallback.from_mock and fallback.error == "MOCK_FALLBACK:MISSING_KIPRIS_API_KEY"


def test_provider_failure_can_use_matching_mock_but_not_another_name():
    def timeout(request):
        raise httpx.ReadTimeout("synthetic-key", request=request)
    with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
        result = make_tool(client).trademark(NAME)
        assert result.ok and result.from_mock and result.error == "MOCK_FALLBACK:TIMEOUT"
        other = make_tool(client).trademark("다른 상표")
    assert not other.ok and other.error == "TIMEOUT"


def test_existing_ai_consumer_keeps_mock_provenance():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no HTTP"))) as client:
        result = TrademarkTool(client, use_mock=True).trademark(NAME)
    item, _ = judge_trademark(FakeLLM({"judge_trademark": TM_JUDGMENT}), store(), result,
                              check_spec(load_pack("cafe_restaurant"), "trademark_similar"), "test-item")
    assert item.verdict == "low" and item.evidence
    assert all(e.from_mock and e.fetched_at is None for e in item.evidence)


@pytest.mark.parametrize("mock", [False, True])
def test_check_command_does_not_hide_live_mode_with_use_mock_env(tmp_path, mock):
    env_file = tmp_path / "config.env"
    env_file.write_text("KIPRIS_API_KEY=\nUSE_MOCK=true\n")
    command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/check_trademark.py"),
               "--env-file", str(env_file)]
    if mock:
        command.append("--mock")
    process = subprocess.run(command, env=dict(os.environ, KIPRIS_API_KEY="", KIPRIS_TRADEMARK_URL=""),
                             capture_output=True, text=True, timeout=10)
    payload = json.loads(process.stdout)
    assert process.returncode == (0 if mock else 1)
    assert payload["mode"] == ("mock" if mock else "live") and payload["result"]["from_mock"] is mock
    if not mock:
        assert payload["result"]["error"] == "MISSING_KIPRIS_API_KEY"


def test_root_and_backend_use_the_same_key_name():
    from dotenv import dotenv_values
    backend = Path(__file__).resolve().parents[1]
    for path in (backend.parent / ".env.example", backend / ".env.example"):
        example = dotenv_values(path)
        assert "KIPRIS_API_KEY" in example and "KIPRIS_KEY" not in example
