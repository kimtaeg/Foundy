"""외부 연결 없이 조회 도구 → 캐시 경계 → 기존 AI 소비자의 계약을 검증한다.

JSON 캐시는 직렬화 경계를 재현하는 테스트 대역이다. 실제 DB 연결 검증은 아니다.
"""

from datetime import datetime, timedelta, timezone
import json
import socket

import httpx
import pytest

from agent.llm import FakeLLM
from agent.loop import run_analysis
from agent.ports import ToolResult
from tests.fakes import BUILDING_ADVICE, TM_ADVICE, VIOLATION_ADVICE, FakeCalc, store
from tools.address import MOCKS
from tools.cache import CacheEntry, MemoryCache
from tools.runtime import AddressBuildingSettings, make_address_building_tools

NOW = datetime(2026, 11, 20, tzinfo=timezone.utc)
ADDRESS = "서울 성동구 성수이로 113"


class JsonCache:
    """DB 담당이 구현할 get/put의 저장·복원 경계만 재현한다."""

    def __init__(self, records):
        self.records = records

    def get(self, key):
        payload = self.records.get(key)
        if payload is None:
            return None
        record = json.loads(payload)
        return CacheEntry(ToolResult.model_validate(record["result"]),
                          datetime.fromisoformat(record["expires_at"]))

    def put(self, key, result, expires_at):
        self.records[key] = json.dumps({"result": result.model_dump(mode="json"),
                                        "expires_at": expires_at.isoformat()})


@pytest.fixture(params=["memory", "json"])
def cache_backend(request):
    if request.param == "memory":
        cache = MemoryCache()
        return cache, lambda: cache
    records = {}
    return JsonCache(records), lambda: JsonCache(records)


@pytest.fixture(autouse=True)
def no_external_connections(monkeypatch):
    def blocked(*args, **kwargs):
        pytest.fail("독립 계약 테스트에서 실제 네트워크 연결을 시도했습니다")
    monkeypatch.setattr(socket, "getaddrinfo", blocked)
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)
    for key in ("DATABASE_URL", "LLM_API_KEY", "LLM_MODEL_FAST", "LLM_MODEL_MAIN",
                "KAKAO_REST_KEY", "DATA_GO_KR_KEY"):
        monkeypatch.delenv(key, raising=False)


class BuildingOnlyTools:
    """법령·상표가 미연결임을 명시하고 건물 도구만 기존 소비자에 제공한다."""

    def __init__(self, building):
        self.building = building

    def law(self, check_id):
        return ToolResult(ok=False, source="법령 테스트 대역", error="TEST_UNAVAILABLE")

    def trademark(self, name):
        return ToolResult(ok=False, source="상표 테스트 대역", error="TEST_UNAVAILABLE")

    def grants(self, store):
        return ToolResult(ok=False, source="지원사업 테스트 대역", error="TEST_UNAVAILABLE")


def analyze(building, *, address=ADDRESS):
    events = []
    result = run_analysis(
        store(address=address, sites=[]), tools=BuildingOnlyTools(building), calc=FakeCalc(),
        llm=FakeLLM({"advise_building_use": BUILDING_ADVICE,
                     "advise_building_violation": VIOLATION_ADVICE,
                     "advise_trademark_similar": TM_ADVICE}),
        emit=lambda event, data: events.append((event, data)),
    )
    return result, events


def building_status(events):
    return next(data["status"] for event, data in events
                if event == "step" and data["step"] == "building" and data["status"] != "running")


@pytest.mark.parametrize("age_days", [0, 8, 31])
def test_replaced_cache_preserves_origin_and_time_through_ai(cache_backend, age_days):
    cache, reopen_cache = cache_backend
    paths = []
    offline = False
    current = NOW

    def transport(request):
        paths.append(request.url.path)
        if offline:
            raise httpx.ConnectError("test offline", request=request)
        fixture = "kakao_address" if request.url.host == "dapi.kakao.com" else (
            "building_title" if request.url.path.endswith("getBrTitleInfo") else "building_floor")
        return httpx.Response(200, json=json.loads((MOCKS / f"{fixture}.json").read_text()))

    settings = AddressBuildingSettings("kakao-test", "building-test")
    with httpx.Client(transport=httpx.MockTransport(transport)) as client:
        first_tools = make_address_building_tools(client, settings, cache=cache, clock=lambda: current)
        first = first_tools.building.building(store(address=ADDRESS))
        assert first.ok and first.fetched_at == NOW and len(paths) == 3
        assert not first.from_mock and not first.from_cache

        # 새로운 조립 객체가 JSON으로 저장·복원한 캐시를 받아도 동일한 계약이다.
        offline = True
        current = NOW + timedelta(days=age_days)
        second_tools = make_address_building_tools(client, settings, cache=reopen_cache(),
                                                   clock=lambda: current)
        observed = []

        def building(s):
            result = second_tools.building.building(s)
            observed.append(result)
            return result

        result, events = analyze(building)
        cached = observed[0]
        assert cached.ok and cached.from_cache and not cached.from_mock
        assert cached.fetched_at == first.fetched_at == NOW
        marker = "STALE_CACHE" if age_days >= 8 else "CACHE_FALLBACK"
        assert cached.error == f"{marker}:NETWORK_ERROR"
        assert len(paths) == 5  # 주소와 건물 각각 실제 경로 실패 후 캐시 사용
        assert not client.is_closed

    violation = next(item for item in result.items if item.check_id == "building_violation")
    assert violation.verdict == "unknown"  # 미제공 위반 필드는 정상으로 단정하지 않는다.
    evidence = [e for e in violation.evidence if e.type == "data"]
    assert evidence and all(e.from_cache and not e.from_mock and e.fetched_at == NOW for e in evidence)
    payload = json.loads(violation.model_dump_json())
    assert payload["evidence"][0]["fetched_at"] == first.model_dump(mode="json")["fetched_at"]
    assert "kakao-test" not in violation.model_dump_json() and "building-test" not in violation.model_dump_json()
    assert building_status(events) == "fallback"
    assert events[-1][0] == "done" and events[-1][1]["summary"] == result.summary


@pytest.mark.parametrize("mock", [True, False])
def test_keyless_analysis_uses_only_matching_mock_and_keeps_flags(cache_backend, mock):
    cache, _ = cache_backend
    # 명시 mock과 키 누락 fallback 모두 HTTP를 한 번도 실행하지 않는다.
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        settings = AddressBuildingSettings.load(environ={"USE_MOCK": str(mock).lower()})
        tools = make_address_building_tools(client, settings, cache=cache, clock=lambda: NOW)
        result, events = analyze(tools.building.building)
        violation = next(item for item in result.items if item.check_id == "building_violation")
        assert violation.verdict == "unknown" and violation.evidence
        assert all(e.from_mock and not e.from_cache and e.fetched_at is None for e in violation.evidence)
        assert building_status(events) == "fallback" and events[-1][0] == "done"

        other, other_events = analyze(tools.building.building, address="부산의 fixture에 없는 주소")
        assert all(item.verdict == "unknown" and not item.evidence for item in other.items)
        assert building_status(other_events) == "failed" and other_events[-1][0] == "done"


def test_unavailable_cache_does_not_prevent_matching_mock_or_completion():
    class BrokenCache:
        def get(self, key):
            raise RuntimeError("test storage unavailable")

        def put(self, key, result, expires_at):
            raise RuntimeError("test storage unavailable")

    def offline(request):
        raise httpx.ReadTimeout("test offline", request=request)

    with httpx.Client(transport=httpx.MockTransport(offline)) as client:
        tools = make_address_building_tools(client, AddressBuildingSettings("kakao-test", "building-test"),
                                            cache=BrokenCache(), clock=lambda: NOW)
        result, events = analyze(tools.building.building)
    evidence = [e for item in result.items for e in item.evidence]
    assert evidence and all(e.from_mock and e.fetched_at is None for e in evidence)
    assert building_status(events) == "fallback" and events[-1][0] == "done"


@pytest.mark.parametrize("from_mock", [False, True])
def test_cache_storage_preserves_nullable_time_and_original_mock_flag(cache_backend, from_mock):
    cache, reopen_cache = cache_backend
    original = ToolResult(ok=True, source="출처 계약 테스트", data={"codes": {"bun": "0001"}},
                          fetched_at=None if from_mock else NOW, from_mock=from_mock)
    cache.put("contract-origin", original, NOW + timedelta(days=7))
    # 호출자가 원본을 변경해도 저장 데이터는 오염되지 않는다.
    original.data["codes"]["bun"] = "9999"
    restored = reopen_cache().get("contract-origin")
    assert restored.result.data == {"codes": {"bun": "0001"}}
    assert restored.result.from_mock is from_mock
    assert restored.result.fetched_at == (None if from_mock else NOW)
    assert restored.expires_at == NOW + timedelta(days=7)
