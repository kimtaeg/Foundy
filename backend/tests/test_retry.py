"""외부 API 일시 오류(500·502·503·504, 시간 초과, 연결 오류)만 다시 시도한다 (#163). 실제 호출 없음."""

import httpx
import pytest

from tools import retry


def client(responses):
    """responses: 차례로 돌려줄 응답 또는 던질 예외 클래스. 호출 수는 calls 로 센다."""
    calls = []

    def handler(request):
        calls.append(request)
        item = responses[min(len(calls), len(responses)) - 1]
        if isinstance(item, type) and issubclass(item, Exception):
            raise item("x", request=request)
        return httpx.Response(item, text="ok" if item == 200 else "err")

    return httpx.Client(transport=httpx.MockTransport(handler)), calls


@pytest.fixture
def waits():
    out = []
    return out


def get(c, waits):
    return retry.get(c, "https://apis.data.go.kr/x", sleep=waits.append)


@pytest.mark.parametrize("status", [500, 502, 503, 504])
def test_retries_transient_status_then_succeeds(status, waits):
    c, calls = client([status, 200])
    assert get(c, waits).status_code == 200
    assert len(calls) == 2 and waits == [0.5]


def test_retries_timeout_and_connect_error(waits):
    c, calls = client([httpx.ReadTimeout, httpx.ConnectError, 200])
    assert get(c, waits).status_code == 200
    assert len(calls) == 3 and waits == [0.5, 1.0]


def test_gives_up_after_three_calls_with_last_response(waits):
    c, calls = client([503, 503, 503])
    assert get(c, waits).status_code == 503
    assert len(calls) == 3 and waits == [0.5, 1.0]


def test_gives_up_after_three_timeouts_with_exception(waits):
    c, calls = client([httpx.ReadTimeout])
    with pytest.raises(httpx.ReadTimeout):
        get(c, waits)
    assert len(calls) == 3


@pytest.mark.parametrize("status", [200, 400, 401, 403, 404, 429])
def test_does_not_retry_other_statuses(status, waits):
    c, calls = client([status, 200])
    assert get(c, waits).status_code == status
    assert len(calls) == 1 and waits == []


def test_provider_uses_retry_for_building(monkeypatch):
    """건축물대장 조회가 503 한 번 뒤 성공하면 대체 없이 정상 결과다."""
    from types import SimpleNamespace

    from tools.providers import Providers

    from .fakes import store

    monkeypatch.setattr(retry.time, "sleep", lambda s: None)
    body = {"response": {"header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE"},
                         "body": {"totalCount": 1, "items": {"item": [
                             {"flrNo": "1", "flrGbCdNm": "지상", "flrNoNm": "1층", "mainPurpsCdNm": "제1종근린생활시설",
                              "etcPurps": "휴게음식점", "area": "50"}]}}}}
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(503) if len(seen) == 1 else httpx.Response(200, json=body)

    settings = SimpleNamespace(kakao_rest_key="k", building_api_key="k", data_go_kr_key="", kipris_api_key="", law_oc="")
    p = Providers(client=httpx.Client(transport=httpx.MockTransport(handler)), settings=settings, references={})
    s = store(address_codes={"sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0289", "ji": "0010"})
    assert p.building(s).ok and len(seen) == 2
