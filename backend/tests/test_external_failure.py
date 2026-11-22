"""외부 API 실패가 서버 로그 한 줄과 분석 진행 메시지의 짧은 원인으로 남는지 검증한다 (#159).

실제 제공자·DB를 부르지 않는다 (httpx.MockTransport, 캐시 조회는 '없음'으로 고정).
"""

import json
import logging
from types import SimpleNamespace

import httpx
import pytest

from agent.loop import run_analysis
from tools import failure
from tools.analysis import AnalysisTools
from tools.failure import ProviderError, classify, mask, user_reason
from tools.providers import Providers

from .fakes import SIMILAR, FakeCalc, FakeTools, store
from .test_loop import PACK, llm

SECRET = "SECRET-KEY-1234567890"


def settings(**kw):
    values = dict(kakao_rest_key=SECRET, building_api_key=SECRET, data_go_kr_key="", kipris_api_key=SECRET, law_oc=SECRET)
    values.update(kw)
    return SimpleNamespace(**values)


def providers(handler):
    return Providers(client=httpx.Client(transport=httpx.MockTransport(handler)), settings=settings(), references={})


def building_store():
    return store(address_codes={"sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0289", "ji": "0010"},
                 address_detail="1층")


KIPRIS_NOT_REGISTERED = (b"<response><header><resultCode>30</resultCode>"
                         b"<resultMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</resultMsg><successYN>N</successYN></header></response>")
GATEWAY_NOT_REGISTERED = (b"<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>"
                          b"<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>"
                          b"<returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>")


def raised(fn):
    with pytest.raises(Exception) as info:
        fn()
    return classify(info.value)


# ── 분류: 제공자 응답 → 실패 종류 ──

def test_kipris_unregistered_key_is_auth_with_result_code():
    f = raised(lambda: providers(lambda r: httpx.Response(200, content=KIPRIS_NOT_REGISTERED)).trademark("모노커피"))
    assert (f.kind, f.result_code, f.result_msg) == ("auth", "30", "SERVICE_KEY_IS_NOT_REGISTERED_ERROR")
    assert user_reason("trademark", f) == "상표 검색 서비스 인증에 실패했어요"


def test_data_go_kr_gateway_error_is_auth_even_with_http_200():
    f = raised(lambda: providers(lambda r: httpx.Response(200, content=GATEWAY_NOT_REGISTERED)).building(building_store()))
    assert (f.kind, f.result_code) == ("auth", "30")


@pytest.mark.parametrize("status,kind", [(401, "auth"), (403, "auth"), (404, "not_found"), (500, "server_error")])
def test_http_status_is_classified(status, kind):
    f = raised(lambda: providers(lambda r: httpx.Response(status, text="x")).building(building_store()))
    assert (f.kind, f.status) == (kind, status)


def test_timeout_is_classified():
    def boom(request):
        raise httpx.ReadTimeout("slow", request=request)
    f = raised(lambda: providers(boom).building(building_store()))
    assert f.kind == "timeout"
    assert user_reason("building", f) == "건축물대장 서비스 응답이 늦어요"


def test_unparseable_body_is_parse_error():
    f = raised(lambda: providers(lambda r: httpx.Response(200, text="<html>점검 중</html>")).building(building_store()))
    assert f.kind == "parse_error"


def test_building_provider_result_code_is_kept():
    body = {"response": {"header": {"resultCode": "99", "resultMsg": "SERVICE ERROR"}, "body": {}}}
    f = raised(lambda: providers(lambda r: httpx.Response(200, json=body)).building(building_store()))
    assert (f.kind, f.result_code, f.result_msg) == ("provider_error", "99", "SERVICE ERROR")


def test_address_not_resolved_is_no_data_with_address_message():
    f = raised(lambda: providers(lambda r: httpx.Response(200, json={"documents": []})).building(store(address_codes={})))
    assert f.kind == "no_data"
    assert user_reason("building", f) == "주소 검색에서 이 주소를 하나로 찾지 못했어요"


def test_missing_key_is_config():
    p = Providers(client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200))),
                  settings=settings(kipris_api_key=""), references={})
    assert raised(lambda: p.trademark("x")).kind == "config"


# ── 마스킹 ──

def test_mask_hides_keys_and_query_strings(monkeypatch):
    monkeypatch.setattr(failure, "_secret_values", lambda: [SECRET])
    text = (f"Server error for url 'https://apis.data.go.kr/x?serviceKey={SECRET}&bun=0289' "
            f"OC=abc ServiceKey=zzz accessKey=yyy KakaoAK {SECRET} Bearer t0k3n {SECRET}")
    out = mask(text)
    assert SECRET not in out and "zzz" not in out and "yyy" not in out and "t0k3n" not in out and "abc" not in out
    assert "bun=0289" not in out  # 쿼리 문자열 전체를 지운다
    assert "https://apis.data.go.kr/x" in out


# ── 분석 도구(_query): 로그 한 줄 + 화면용 원인 ──

def real_tools(handler):
    t = AnalysisTools(providers=providers(handler), use_mock=False)
    t._cached = lambda key, fresh=False: None  # DB 캐시 없음
    return t


def failure_lines(caplog):
    return [r.getMessage() for r in caplog.records if r.getMessage().startswith("external_api_failure")]


@pytest.mark.parametrize("handler,tool,kind,reason", [
    (lambda r: httpx.Response(200, content=KIPRIS_NOT_REGISTERED), "trademark", "auth", "상표 검색 서비스 인증에 실패했어요"),
    (lambda r: httpx.Response(403, text="no"), "building", "auth", "건축물대장 서비스 인증에 실패했어요"),
    (lambda r: httpx.Response(200, text="not json"), "building", "parse_error", "건축물대장 응답을 읽지 못했어요"),
    (lambda r: httpx.Response(200, json={"documents": []}), "building", "no_data", "주소 검색에서 이 주소를 하나로 찾지 못했어요"),
])
def test_query_failure_logs_one_line_and_keeps_reason(caplog, monkeypatch, handler, tool, kind, reason):
    monkeypatch.setattr(failure, "_secret_values", lambda: [SECRET])
    tools = real_tools(handler)
    s = building_store() if kind != "no_data" else store(address_codes={})
    caplog.set_level(logging.WARNING, logger="foundy.external_api")
    res = tools.trademark(s.name) if tool == "trademark" else tools.building(s)
    lines = failure_lines(caplog)
    assert len(lines) == 1, lines
    assert f"tool={tool}" in lines[0] and f"kind={kind}" in lines[0] and "elapsed_ms=" in lines[0]
    assert "outcome=mock" in lines[0]  # 저장된 결과가 없어 예시 자료로 대체
    assert SECRET not in caplog.text and "serviceKey=" not in caplog.text and "ServiceKey=" not in caplog.text
    assert res.from_mock and res.reason == reason


def test_query_timeout_logs_timeout(caplog):
    def boom(request):
        raise httpx.ConnectTimeout("slow", request=request)
    caplog.set_level(logging.WARNING, logger="foundy.external_api")
    res = real_tools(boom).trademark("모노커피")
    [line] = failure_lines(caplog)
    assert "tool=trademark kind=timeout" in line
    assert res.reason == "상표 검색 서비스 응답이 늦어요"


def test_kipris_log_line_has_result_code_and_message(caplog):
    caplog.set_level(logging.WARNING, logger="foundy.external_api")
    real_tools(lambda r: httpx.Response(200, content=KIPRIS_NOT_REGISTERED)).trademark("모노커피")
    [line] = failure_lines(caplog)
    assert "http=- result_code=30 result_msg=SERVICE_KEY_IS_NOT_REGISTERED_ERROR" in line


# ── 분석 진행(SSE) 메시지 ──

def test_sse_step_messages_carry_short_reason(caplog):
    caplog.set_level(logging.WARNING, logger="foundy.external_api")
    kipris = real_tools(lambda r: httpx.Response(200, content=KIPRIS_NOT_REGISTERED))
    building = real_tools(lambda r: httpx.Response(500, text="err"))

    class Tools(FakeTools):
        use_mock = False

        def building(self, s):
            return building.building(building_store())

        def trademark(self, name):
            return kipris.trademark(name)

    events = []
    run_analysis(store(), tools=Tools(similar=SIMILAR), calc=FakeCalc(), llm=llm(), pack=PACK,
                 emit=lambda e, d: events.append((e, d)))
    steps = {d["step"]: d for e, d in events if e == "step" and d["status"] != "running"}
    assert steps["trademark"]["status"] == "failed"
    assert steps["trademark"]["message"] == "상표 조회 실패 · 상표 검색 서비스 인증에 실패했어요"
    assert steps["building"]["message"].endswith(" · 건축물대장 서비스에 일시적인 문제가 있어요")
    assert len(failure_lines(caplog)) == 2
    assert SECRET not in json.dumps([d for _, d in events], ensure_ascii=False, default=str)
