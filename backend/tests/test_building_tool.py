import json

import httpx
import pytest

from agent.llm import FakeLLM
from agent.loop import run_analysis
from tests.fakes import BUILDING_ADVICE, VIOLATION_ADVICE, FakeCalc, FakeTools, store
from tools.address import AddressTool, MOCKS
from tools.building import BuildingTool, parse_floor
from tools._common import ToolError

ADDRESS = "서울 성동구 성수이로 113"
CODES = {"sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0289", "ji": "0010", "plat_gb_cd": "0"}


@pytest.fixture
def payloads():
    return {k: json.loads((MOCKS / f"{k}.json").read_text())
            for k in ("building_title", "building_floor", "kakao_address")}


def page(rows, *, number=1, size=100, total=None):
    return {"response": {"header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE."},
                         "body": {"items": {"item": rows}, "pageNo": number,
                                  "numOfRows": size, "totalCount": len(rows) if total is None else total}}}


def floor_row(*, number=1, kind="20", use="제2종근린생활시설", primary="0", pk=1):
    return {"mainAtchGbCd": primary, "mgmBldrgstPk": pk, "flrGbCd": kind,
            "flrNo": number, "mainPurpsCdNm": use, "area": 20}


def title_row(pk=1):
    return {"mainAtchGbCd": "0", "mgmBldrgstPk": pk}


def building_client(titles, floors):
    return httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(
        200, json=titles if request.url.path.endswith("getBrTitleInfo") else floors)))


@pytest.mark.parametrize("detail,expected", [("1층 101호", ("20", 1)), ("지상 2층", ("20", 2)),
                                               ("지하1층", ("10", 1)), ("B2", ("10", 2))])
def test_floor_parser(detail, expected):
    assert parse_floor(detail) == expected


@pytest.mark.parametrize("detail", [None, "101호", "옥탑", "0층", "-1층", "1~2층", "1층 2층",
                                     "1,2층", "1/2층", "1·2층", "1.5층"])
def test_floor_does_not_guess(detail):
    with pytest.raises(ToolError):
        parse_floor(detail)


def test_selected_floor_and_primary_only():
    floors = [floor_row(), floor_row(number=2, use="다른 층"),
              floor_row(kind="10", use="지하"), floor_row(primary="1", use="주차장")]
    with building_client(page([title_row()]), page(floors)) as client:
        result = BuildingTool(client, api_key="test", allow_fallback=False).building(store(address_codes=CODES))
    assert result.ok and result.data["floor_uses"] == ["제2종근린생활시설"]
    assert result.data["violation"] is None
    assert not result.data["needs_confirmation"]
    assert result.fetched_at is not None


def test_real_recorded_first_floor_does_not_choose_one_compartment(payloads):
    with building_client(payloads["building_title"], payloads["building_floor"]) as client:
        result = BuildingTool(client, api_key="test").building(store(address=ADDRESS, address_codes=CODES))
    assert result.ok and not result.from_mock
    assert result.data["floor_uses"] == [] and result.data["violation"] is None
    assert result.data["needs_confirmation"]
    assert len(result.data["floor_candidates"]) == 4
    assert {r["use"] for r in result.data["floor_candidates"]} == {"소매점", "휴게음식점", "금융업소", "부동산중개업소"}


def test_multiple_main_buildings_are_ambiguous():
    with building_client(page([title_row(1), title_row(2)]), page([floor_row(pk=1), floor_row(pk=2)])) as client:
        result = BuildingTool(client, api_key="test").building(store(address_codes=CODES))
    assert result.ok and result.data["floor_uses"] == [] and result.data["needs_confirmation"]


def test_missing_floor_is_not_replaced_with_whole_building_or_demo():
    with building_client(page([title_row()]), page([floor_row(number=2)])) as client:
        result = BuildingTool(client, api_key="test").building(store(address_codes=CODES))
    assert not result.ok and result.error == "FLOOR_NOT_FOUND" and not result.from_mock


def test_pagination_includes_all_rows():
    calls = []
    def handler(request):
        assert request.extensions["timeout"]["read"] == 5
        assert request.url.params["bun"] == "0289"
        if request.url.path.endswith("getBrTitleInfo"):
            return httpx.Response(200, json=page([title_row()]))
        n = int(request.url.params["pageNo"])
        calls.append(n)
        return httpx.Response(200, json=page([floor_row(number=n)], number=n, size=1, total=2))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = BuildingTool(client, api_key="test").building(store(address_codes=CODES, address_detail="2층"))
    assert calls == [1, 2] and result.ok and result.data["floor_uses"] == ["제2종근린생활시설"]


@pytest.mark.parametrize("mode,error", [("repeat", "REPEATED_PAGE"), ("empty", "PARTIAL_RESPONSE"),
                                        ("total_change", "PARTIAL_RESPONSE"), ("wrong_page", "PARTIAL_RESPONSE")])
def test_incomplete_pages_never_report_live_success(mode, error):
    def handler(request):
        if request.url.path.endswith("getBrTitleInfo"):
            return httpx.Response(200, json=page([title_row()]))
        n = int(request.url.params["pageNo"])
        rows = [floor_row()] if mode == "repeat" or n == 1 else []
        return httpx.Response(200, json=page(rows, number=1 if mode == "wrong_page" and n == 2 else n,
                                             size=1, total=3 if mode == "total_change" and n == 2 else 2))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = BuildingTool(client, api_key="test", allow_fallback=False).building(store(address_codes=CODES))
    assert not result.ok and result.error == error and not result.from_mock


@pytest.mark.parametrize("body,error", [
    ({"response": {"header": {"resultCode": "30", "resultMsg": "secret"}}}, "SERVICE_ERROR_30"),
    ({"response": {"body": {}}}, "INVALID_RESPONSE"),
])
def test_service_errors_are_sanitized(body, error):
    with building_client(body, body) as client:
        result = BuildingTool(client, api_key="secret", allow_fallback=False).building(store(address_codes=CODES))
    assert not result.ok and result.error == error and "secret" not in result.model_dump_json()


def test_xml_key_error_and_failed_live_verification():
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(
            200, text="<error>SERVICE_KEY_IS_NOT_REGISTERED_ERROR secret</error>"))) as client:
        result = BuildingTool(client, api_key="secret", allow_fallback=False).building(store(address_codes=CODES))
    assert not result.ok and result.error == "INVALID_RESPONSE" and "secret" not in result.model_dump_json()


def test_mock_has_no_fake_timestamp_and_never_reuses_another_address():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no network"))) as client:
        tool = BuildingTool(client, use_mock=True)
        result = tool.building(store(address_codes=CODES))
        assert result.ok and result.from_mock and result.fetched_at is None
        wrong = tool.building(store(address_codes={**CODES, "bun": "9999"}))
        assert not wrong.ok and wrong.error == "MOCK_NOT_FOUND"


def test_mock_address_cannot_turn_into_real_building_provenance():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no network"))) as client:
        tool = BuildingTool(client, address_tool=AddressTool(client, use_mock=True))
        result = tool.building(store(address=ADDRESS))
    assert result.ok and result.from_mock


def test_address_to_building_with_no_server_or_db(payloads):
    paths = []
    def handler(request):
        paths.append(request.url.path)
        name = "kakao_address" if "kakao" in request.url.host else (
            "building_title" if request.url.path.endswith("getBrTitleInfo") else "building_floor")
        return httpx.Response(200, json=payloads[name])
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        address = AddressTool(client, api_key="kakao", allow_fallback=False)
        result = BuildingTool(client, api_key="building", address_tool=address,
                              allow_fallback=False).building(store(address=ADDRESS))
    assert result.ok and not result.from_mock and len(paths) == 3


def test_existing_ai_consumes_building_contract_without_modification():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no network"))) as client:
        tool = BuildingTool(client, use_mock=True)
        bridge = FakeTools()
        bridge.building = tool.building
        result = run_analysis(store(address=ADDRESS, address_codes=CODES), tools=bridge,
                              calc=FakeCalc(), llm=FakeLLM({"advise_building_use": BUILDING_ADVICE,
                                                           "advise_building_violation": VIOLATION_ADVICE}))
    building = next(item for item in result.items if item.check_id == "building_use")
    violation = next(item for item in result.items if item.check_id == "building_violation")
    assert building.verdict == violation.verdict == "unknown"
    assert any(e.from_mock for e in violation.evidence)
