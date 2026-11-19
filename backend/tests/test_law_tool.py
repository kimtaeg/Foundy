"""실제 네트워크·DB·LLM 없이 법령 공급자 응답과 기존 소비자 계약을 검증한다."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import sys

import httpx
import pytest

from agent.llm import FakeLLM
from agent.loop import run_analysis
from tests.fakes import BUILDING_ADVICE, VIOLATION_ADVICE, FakeCalc, FakeTools, store
from tools.address import MOCKS
from tools.cache import MemoryCache
from tools.law import LawReference, LawTool

NOW = datetime(2026, 11, 19, 16, tzinfo=timezone.utc)
FOOD = LawReference("식품위생법", 37)
ANNEX = LawReference("건축법 시행령", 1, "annex")
CHECK = "fixture_law"


@pytest.fixture(autouse=True)
def no_external_network(monkeypatch):
    def blocked(*args, **kwargs):
        pytest.fail("법령 단위 테스트에서 실제 네트워크 연결을 시도했습니다")
    monkeypatch.setattr(socket, "getaddrinfo", blocked)
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)


@pytest.fixture
def bodies():
    return {"식품위생법": json.loads((MOCKS / "law_body.json").read_text()),
            "건축법 시행령": json.loads((MOCKS / "law_building_decree_body.json").read_text())}


def law_row(body, seq="285339"):
    basic = body["법령"]["기본정보"]
    return {"법령명한글": basic["법령명_한글"], "법령ID": basic["법령ID"],
            "법령일련번호": seq, "시행일자": basic["시행일자"], "공포일자": basic["공포일자"],
            "공포번호": basic["공포번호"], "현행연혁코드": "현행",
            "법령상세링크": "https://www.law.go.kr/DRF/lawService.do?OC=synthetic-oc"}


def search(rows, page=1, total=None):
    return {"LawSearch": {"resultCode": "00", "target": "eflaw", "page": str(page),
                          "totalCnt": str(len(rows) if total is None else total), "law": rows}}


def unit37(body):
    return next(row for row in body["법령"]["조문"]["조문단위"]
                if row.get("조문여부") == "조문" and str(row.get("조문번호")) == "37")


def tool(client, ref=FOOD, **kwargs):
    return LawTool(client, references={CHECK: [ref]}, oc="synthetic-oc", clock=lambda: NOW, **kwargs)


def client_for(body, rows=None):
    rows = [law_row(body)] if rows is None else rows
    return httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(
        200, json=search(rows) if request.url.path.endswith("lawSearch.do") else body)))


def test_live_article_exact_version_text_and_safe_link(bodies):
    body = bodies["식품위생법"]
    rows = json.loads((MOCKS / "law_search.json").read_text())["LawSearch"]["law"]
    requests = []

    def handler(request):
        requests.append(request)
        assert request.url.scheme == "https" and request.url.host == "www.law.go.kr"
        assert request.extensions["timeout"]["read"] == 5
        assert request.url.params["OC"] == "synthetic-oc"
        assert request.url.params["target"] == "eflaw"
        if request.url.path.endswith("lawSearch.do"):
            assert request.url.params["nw"] == "3"
            return httpx.Response(200, json=search(rows))
        assert request.url.params["MST"] == "285339" and request.url.params["efYd"] == "20261008"
        assert request.url.params["JO"] == "003700"
        return httpx.Response(200, json=body)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = tool(client, allow_fallback=False).law(CHECK)
        assert not client.is_closed
    assert result.ok and not result.from_mock and not result.from_cache and result.fetched_at == NOW
    assert len(requests) == 2
    article = result.data["articles"][0]
    assert article["law_name"] == "식품위생법" and article["article"] == "제37조"
    assert article["law_id"] == "001805" and article["law_seq"] == "285339"
    assert article["effective_date"] == article["law_effective_date"] == "2026-10-08"
    assert all(p["항내용"].strip() in article["text"] for p in unit37(body)["항"])
    assert article["url"] == "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=285339"
    assert "synthetic-oc" not in result.model_dump_json() and "OC=" not in result.model_dump_json()


def test_singleton_paragraph_clause_point_and_branch_number(bodies):
    body = bodies["식품위생법"]
    body["법령"]["조문"]["조문단위"] = {
        "조문여부": "조문", "조문번호": "10", "조문가지번호": "2", "조문내용": "제10조의2(예시)",
        "항": {"항내용": "① 항 원문", "호": {"호내용": "1. 호 원문", "목": [
            {"목내용": "가. 첫 목 원문"}, {"목내용": "나. 둘째 목 원문"}]}}}
    with client_for(body) as client:
        result = tool(client, LawReference("식품위생법", 10, sub_number=2), allow_fallback=False).law(CHECK)
    article = result.data["articles"][0]
    assert article["article"] == "제10조의2" and article["effective_date"] is None
    assert article["text"].splitlines() == ["제10조의2(예시)", "① 항 원문", "1. 호 원문", "가. 첫 목 원문", "나. 둘째 목 원문"]


def test_annex_nested_text_and_missing_unit_effective_date(bodies):
    body = bodies["건축법 시행령"]
    with client_for(body, [law_row(body, "291715")]) as client:
        result = tool(client, ANNEX, allow_fallback=False).law(CHECK)
    article = result.data["articles"][0]
    assert article["article"] == "별표 1"
    annex = next(row for row in body["법령"]["별표"]["별표단위"] if row.get("별표번호") == "0001")
    original = "".join(line for page in annex["별표내용"] for line in page)
    assert "".join(article["text"].split()) == "".join(original.split())
    assert "휴게음식점" in article["text"] and "일반음식점" in article["text"]
    assert article["effective_date"] is None and article["law_effective_date"] == "2026-11-12"
    assert article["url"].endswith("lsiSeq=291715")


@pytest.mark.parametrize("ref", [FOOD, ANNEX])
def test_explicit_mock_does_not_require_keys_or_network(ref):
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        result = LawTool(client, references={CHECK: [ref]}, use_mock=True, clock=lambda: NOW).law(CHECK)
    assert result.ok and result.from_mock and result.fetched_at is None and not result.from_cache
    assert result.data["articles"][0]["law_name"] == ref.law_name


def test_no_implicit_production_mapping_or_unrelated_fixture():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        result = LawTool(client, use_mock=True).law("building_use")
        assert not result.ok and result.error == "LAW_REFERENCE_UNCONFIRMED"
        result = tool(client, LawReference("식품위생법 시행령", 21), use_mock=True).law(CHECK)
        assert not result.ok and result.error == "MOCK_NOT_FOUND"


@pytest.mark.parametrize("value", [None, [], "", "bad-id", "x" * 65])
def test_invalid_check_id_is_a_result_not_exception(value):
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("HTTP must not run"))) as client:
        result = tool(client).law(value)
    assert not result.ok and result.error == "INVALID_CHECK_ID"


@pytest.mark.parametrize("kwargs", [{"law_name": ""}, {"number": 0}, {"number": True}, {"number": 10000},
                                   {"kind": "form"}, {"sub_number": -1}, {"sub_number": 100}])
def test_invalid_reference_configuration_is_rejected(kwargs):
    values = {"law_name": "식품위생법", "number": 37, **kwargs}
    with pytest.raises(ValueError, match="INVALID_LAW_REFERENCE"):
        LawReference(**values)


def test_reference_mapping_is_copied_and_multi_reference_failure_is_atomic(bodies):
    refs = {CHECK: [FOOD]}
    with client_for(bodies["식품위생법"]) as client:
        configured = LawTool(client, references=refs, oc="test", clock=lambda: NOW, allow_fallback=False)
        refs[CHECK].append(LawReference("식품위생법", 999))
        assert configured.law(CHECK).ok
        result = LawTool(client, references=refs, oc="test", clock=lambda: NOW).law(CHECK)
    assert not result.ok and result.data is None and result.error == "REFERENCE_NOT_FOUND"


@pytest.mark.parametrize("mutation,error", [
    (lambda rows, body: rows[0].update(법령명한글="식품위생법 시행령"), "LAW_NOT_FOUND"),
    (lambda rows, body: rows.append(deepcopy(rows[0])), "AMBIGUOUS_LAW"),
    (lambda rows, body: rows[0].update(현행연혁코드="연혁"), "LAW_NOT_FOUND"),
    (lambda rows, body: rows[0].update(시행일자="20990101"), "LAW_NOT_EFFECTIVE"),
    (lambda rows, body: body["법령"]["기본정보"].update(법령명_한글="다른 법령"), "LAW_MISMATCH"),
    (lambda rows, body: body["법령"]["기본정보"].update(법령ID="999999"), "LAW_MISMATCH"),
    (lambda rows, body: body["법령"]["기본정보"].update(시행일자="20261009"), "LAW_VERSION_MISMATCH"),
    (lambda rows, body: body["법령"]["조문"].update(조문단위=[]), "REFERENCE_NOT_FOUND"),
    (lambda rows, body: body["법령"]["조문"]["조문단위"].append(deepcopy(unit37(body))), "AMBIGUOUS_LAW_REFERENCE"),
    (lambda rows, body: unit37(body).update(조문시행일자="20990101"), "LAW_NOT_EFFECTIVE"),
    (lambda rows, body: unit37(body).update(조문내용="제37조 삭제", 항=[]), "REFERENCE_DELETED"),
    (lambda rows, body: unit37(body).update(조문내용="", 항=[]), "LAW_TEXT_UNAVAILABLE"),
    (lambda rows, body: unit37(body).update(조문가지번호="1"), "REFERENCE_NOT_FOUND"),
])
def test_semantic_failure_never_uses_previous_cache_or_mock(bodies, mutation, error):
    body = bodies["식품위생법"]
    rows = [law_row(body)]
    cache = MemoryCache()
    with client_for(body, rows) as client:
        configured = tool(client, cache=cache)
        assert configured.law(CHECK).ok
        mutation(rows, body)
        result = configured.law(CHECK)
    assert not result.ok and result.error == error and result.data is None
    assert not result.from_mock and not result.from_cache


@pytest.mark.parametrize("status,payload,error", [
    (401, {}, "LAW_AUTH_OR_IP_ERROR"), (403, {}, "LAW_AUTH_OR_IP_ERROR"),
    (429, {}, "HTTP_429"), (500, {}, "HTTP_500"),
    (200, "<html>사용자 정보 검증에 실패하였습니다 synthetic-oc</html>", "LAW_AUTH_OR_IP_ERROR"),
    (200, "정확한 서버장비의 IP주소 및 도메인주소를 등록해 주세요.", "LAW_AUTH_OR_IP_ERROR"),
    (200, "<error>other synthetic-oc</error>", "INVALID_LAW_RESPONSE"),
    (200, {"message": "사용자 검증에 실패 synthetic-oc"}, "LAW_AUTH_OR_IP_ERROR"),
    (200, [], "INVALID_LAW_RESPONSE"), (200, {"LawSearch": None}, "INVALID_LAW_RESPONSE"),
])
def test_provider_errors_never_expose_auth_or_body(status, payload, error):
    def handler(request):
        return httpx.Response(status, text=payload) if isinstance(payload, str) else httpx.Response(status, json=payload)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = tool(client, allow_fallback=False).law(CHECK)
    assert not result.ok and result.error == error
    assert "synthetic-oc" not in result.model_dump_json()


@pytest.mark.parametrize("expired", [False, True])
def test_cache_fallback_preserves_time_and_one_day_ttl(bodies, expired):
    class RecordingCache(MemoryCache):
        def put(self, key, result, expires_at):
            self.expiry = expires_at
            super().put(key, result, expires_at)

    body = bodies["식품위생법"]
    offline = False
    current = NOW
    cache = RecordingCache()

    def handler(request):
        if offline:
            raise httpx.ReadTimeout("synthetic-oc", request=request)
        return httpx.Response(200, json=search([law_row(body)]) if request.url.path.endswith("lawSearch.do") else body)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        configured = LawTool(client, references={CHECK: [FOOD]}, oc="test", cache=cache, clock=lambda: current)
        first = configured.law(CHECK)
        assert first.ok and cache.expiry == NOW + timedelta(days=1)
        offline = True
        current = NOW + timedelta(days=2) if expired else NOW
        second = configured.law(CHECK)
    assert second.ok and second.from_cache and not second.from_mock and second.fetched_at == NOW
    assert second.data == first.data
    assert second.error == f"{'STALE_CACHE' if expired else 'CACHE_FALLBACK'}:TIMEOUT"


def test_failed_provider_uses_only_matching_mock_and_changed_mapping_gets_new_cache_key(bodies):
    body = bodies["식품위생법"]
    offline = False
    cache = MemoryCache()

    def handler(request):
        if offline:
            raise httpx.ConnectError("synthetic-oc", request=request)
        return httpx.Response(200, json=search([law_row(body)]) if request.url.path.endswith("lawSearch.do") else body)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert tool(client, cache=cache).law(CHECK).ok
        offline = True
        result = tool(client, LawReference("식품위생법", 38), cache=cache).law(CHECK)
        assert result.ok and result.from_mock and not result.from_cache and result.fetched_at is None
        assert result.data["articles"][0]["article"] == "제38조"
        other = tool(client, LawReference("지원하지 않는 법령", 1), cache=cache).law(CHECK)
        assert not other.ok and other.error == "NETWORK_ERROR"


def test_broken_storage_and_missing_key_fallback_are_safe():
    class BrokenCache:
        def get(self, key):
            raise RuntimeError("synthetic secret")
        def put(self, key, result, expires_at):
            raise RuntimeError("synthetic secret")
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no key, no HTTP"))) as client:
        configured = LawTool(client, references={CHECK: [FOOD]}, cache=BrokenCache(), clock=lambda: NOW)
        result = configured.law(CHECK)
        assert result.ok and result.from_mock and result.error == "MOCK_FALLBACK:MISSING_LAW_OC"
        strict = LawTool(client, references={CHECK: [FOOD]}, allow_fallback=False).law(CHECK)
        assert not strict.ok and strict.error == "MISSING_LAW_OC"


def test_search_pagination_finds_exact_law_after_first_page(bodies):
    body = bodies["식품위생법"]
    requests = []
    def handler(request):
        if request.url.path.endswith("lawSearch.do"):
            page = int(request.url.params["page"])
            requests.append(page)
            row = {**law_row(body), "법령명한글": "다른 법령"} if page == 1 else law_row(body)
            return httpx.Response(200, json=search([row], page=page, total=2))
        return httpx.Response(200, json=body)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = tool(client, allow_fallback=False).law(CHECK)
    assert result.ok and requests == [1, 2]


@pytest.mark.parametrize("mode,error", [("repeat", "REPEATED_LAW_PAGE"), ("empty", "PARTIAL_LAW_RESPONSE"),
                                        ("count_change", "PARTIAL_LAW_RESPONSE"), ("wrong_page", "PARTIAL_LAW_RESPONSE")])
def test_incomplete_search_does_not_choose_first_match(bodies, mode, error):
    body = bodies["식품위생법"]
    def handler(request):
        page = int(request.url.params["page"])
        rows = [law_row(body)] if page == 1 or mode == "repeat" else []
        return httpx.Response(200, json=search(rows, page=1 if mode == "wrong_page" else page,
                                              total=3 if mode == "count_change" and page == 2 else 2))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = tool(client, allow_fallback=False).law(CHECK)
    assert not result.ok and result.error == error


def test_reference_effective_on_korean_day_not_utc_day(bodies):
    body = bodies["식품위생법"]
    body["법령"]["기본정보"]["시행일자"] = "20261120"
    unit37(body)["조문시행일자"] = "20261120"
    with client_for(body) as client:
        result = tool(client, allow_fallback=False).law(CHECK)
    assert result.ok  # NOW는 UTC 11/19이지만 한국에서는 11/20이다.


def test_mock_registry_cannot_read_outside_fixture_directory(tmp_path, bodies):
    outside = tmp_path / "outside.json"
    outside.write_text(json.dumps(bodies["식품위생법"]))
    directory = tmp_path / "mocks"
    directory.mkdir()
    (directory / "law_sources.json").write_text(json.dumps({"식품위생법": {
        "body_file": "../outside.json", "law_seq": "285339"}}))
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no HTTP"))) as client:
        result = tool(client, use_mock=True, mocks_dir=directory).law(CHECK)
    assert not result.ok and result.error == "MOCK_NOT_FOUND"


def test_existing_ai_preserves_mock_law_origin_without_real_llm():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no HTTP"))) as client:
        # 소비자 계약 검사용 주입값이다. 실제 점검별 조문 확정은 #57에서 수행한다.
        law = LawTool(client, references={"building_use": [ANNEX]}, use_mock=True, clock=lambda: NOW)
        bridge = FakeTools()
        bridge.law = law.law
        events = []
        result = run_analysis(store(), tools=bridge, calc=FakeCalc(),
                              llm=FakeLLM({"advise_building_use": BUILDING_ADVICE,
                                           "advise_building_violation": VIOLATION_ADVICE}),
                              emit=lambda event, data: events.append((event, data)))
    evidence = [e for item in result.items for e in item.evidence if e.type == "law"]
    assert evidence and all(e.from_mock and not e.from_cache and e.fetched_at is None for e in evidence)
    assert all("OC=" not in e.url for e in evidence)
    assert events[-1][0] == "done"


@pytest.mark.parametrize("mock", [False, True])
def test_check_command_never_hides_live_mode_with_mock_env(tmp_path, mock):
    path = tmp_path / "check.env"
    path.write_text("LAW_OC=\nUSE_MOCK=true\n")
    command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/check_law.py"),
               "--law-name", "식품위생법", "--article", "37", "--env-file", str(path)]
    if mock:
        command.append("--mock")
    process = subprocess.run(command, env=dict(os.environ, LAW_OC=""), capture_output=True, text=True, timeout=10)
    payload = json.loads(process.stdout)
    assert process.returncode == (0 if mock else 1)
    assert payload["mode"] == ("mock" if mock else "live")
    assert payload["result"]["from_mock"] is mock
    if not mock:
        assert payload["result"]["error"] == "MISSING_LAW_OC"


def test_check_command_rejects_invalid_reference_and_missing_config(tmp_path):
    script = str(Path(__file__).resolve().parents[1] / "scripts/check_law.py")
    for args in (["--article", "0"], ["--article", "37", "--env-file", str(tmp_path / "missing.env")]):
        result = subprocess.run([sys.executable, script, "--law-name", "식품위생법", *args],
                                capture_output=True, text=True, timeout=10)
        assert result.returncode == 2 and "Traceback" not in result.stderr
