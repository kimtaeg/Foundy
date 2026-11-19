from datetime import date
import json
import os
from pathlib import Path
import subprocess
import sys

import httpx
import pytest

from agent.ports import StoreInput
from tools.address import MOCKS
from tools.cache import MemoryCache
from tools.runtime import AddressBuildingSettings, make_address_building_tools


def store():
    return StoreInput(store_id="runtime-test", name="연결 확인", address="서울 성동구 성수이로 113",
                      address_detail="1층", opening_date=date(2027, 3, 2))


def test_settings_precedence_and_no_global_mutation(tmp_path, monkeypatch):
    first, second = tmp_path / "root.env", tmp_path / "backend.env"
    first.write_text("KAKAO_REST_KEY=file-first\nDATA_GO_KR_KEY=building-first\nUSE_MOCK=true\n")
    second.write_text("KAKAO_REST_KEY=file-second\nDATA_GO_KR_KEY=building-second\n")
    monkeypatch.setenv("KAKAO_REST_KEY", "environment-key")
    monkeypatch.delenv("DATA_GO_KR_KEY", raising=False)
    monkeypatch.delenv("USE_MOCK", raising=False)
    before = dict(os.environ)
    settings = AddressBuildingSettings.load(env_files=[first, second])
    assert settings.kakao_key == "environment-key"
    assert settings.building_key == "building-second"
    assert settings.use_mock
    assert dict(os.environ) == before
    assert "environment-key" not in repr(settings) and "building-second" not in repr(settings)


def test_settings_do_not_expand_ambient_secret_into_file_value(tmp_path, monkeypatch):
    path = tmp_path / "config.env"
    monkeypatch.setenv("UNRELATED_SECRET", "do-not-read")
    path.write_text('KAKAO_REST_KEY="${UNRELATED_SECRET}"\nUSE_MOCK=false\n')
    settings = AddressBuildingSettings.load(env_files=[path], environ={})
    assert settings.kakao_key == "${UNRELATED_SECRET}"
    assert not settings.use_mock


@pytest.mark.parametrize("raw,expected", [("true", True), (" TRUE ", True), ("1", True),
                                         ("false", False), ("0", False), ("", False)])
def test_mock_setting_is_parsed_explicitly(raw, expected):
    assert AddressBuildingSettings.load(environ={"USE_MOCK": raw}).use_mock == expected


def test_typo_in_mock_flag_and_missing_explicit_file_fail(tmp_path):
    with pytest.raises(ValueError, match="INVALID_USE_MOCK") as exc:
        AddressBuildingSettings.load(environ={"USE_MOCK": "secret-typo"})
    assert "secret-typo" not in str(exc.value)
    with pytest.raises(FileNotFoundError):
        AddressBuildingSettings.load(env_files=[tmp_path / "absent.env"], environ={})


def test_service_assembly_resolves_address_then_building_and_uses_shared_cache():
    paths = []
    offline = False
    def handler(request):
        paths.append(request.url.path)
        if offline:
            raise httpx.ConnectError("offline", request=request)
        if request.url.host == "dapi.kakao.com":
            assert request.headers["Authorization"] == "KakaoAK kakao-test"
            name = "kakao_address"
        else:
            assert request.url.params["serviceKey"] == "building-test"
            assert request.url.params["bun"] == "0289"
            name = "building_title" if request.url.path.endswith("getBrTitleInfo") else "building_floor"
        return httpx.Response(200, json=json.loads((MOCKS / f"{name}.json").read_text()))
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        tools = make_address_building_tools(client, AddressBuildingSettings("kakao-test", "building-test"),
                                            cache=MemoryCache())
        first = tools.building.building(store())
        assert len(paths) == 3
        assert first.ok and not first.from_mock and not first.from_cache
        assert first.data["needs_confirmation"] and len(first.data["floor_candidates"]) == 4
        offline = True
        second = tools.building.building(store())
        assert second.ok and second.from_cache and not second.from_mock
        assert first.fetched_at == second.fetched_at
        assert not client.is_closed  # 도구가 호출자의 클라이언트를 닫지 않는다.


def test_mock_and_address_fallback_remain_mock_without_building_http():
    calls = []
    def offline(request):
        calls.append(request.url.host)
        raise httpx.ConnectError("offline", request=request)
    with httpx.Client(transport=httpx.MockTransport(offline)) as client:
        explicit = make_address_building_tools(client, AddressBuildingSettings(use_mock=True))
        result = explicit.building.building(store())
        assert result.ok and result.from_mock and result.fetched_at is None and not calls
        fallback = make_address_building_tools(client, AddressBuildingSettings("test", "test"))
        result = fallback.building.building(store())
        assert result.ok and result.from_mock and result.fetched_at is None
        assert calls == ["dapi.kakao.com"]


def test_live_only_assembly_does_not_hide_missing_key_with_demo():
    with httpx.Client(transport=httpx.MockTransport(lambda _: pytest.fail("no key, no request"))) as client:
        tools = make_address_building_tools(client, AddressBuildingSettings(), allow_fallback=False)
        result = tools.building.building(store())
    assert not result.ok and result.error == "MISSING_KAKAO_KEY"
    assert not result.from_cache and not result.from_mock


@pytest.mark.parametrize("mock", [True, False])
def test_check_command_distinguishes_explicit_mock_from_live_with_mock_env(tmp_path, mock):
    path = tmp_path / "check.env"
    path.write_text("USE_MOCK=true\nKAKAO_REST_KEY=\nDATA_GO_KR_KEY=\n")
    env = dict(os.environ, KAKAO_REST_KEY="", DATA_GO_KR_KEY="", USE_MOCK="true")
    command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/check_address_building.py"),
               "--env-file", str(path)]
    if mock:
        command.append("--mock")
    result = subprocess.run(command, env=env, text=True, capture_output=True, timeout=10)
    payload = json.loads(result.stdout)
    assert result.returncode == (0 if mock else 1)
    assert payload["mode"] == ("mock" if mock else "live")
    assert payload["address"]["from_mock"] == mock
    if mock:
        assert payload["building"]["from_mock"] and payload["building"]["ok"]
    else:
        assert payload["address"]["error"] == "MISSING_KAKAO_KEY"
        assert payload["building"] is None


def test_check_command_rejects_missing_explicit_config_file(tmp_path):
    command = [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts/check_address_building.py"),
               "--env-file", str(tmp_path / "missing.env"), "--mock"]
    result = subprocess.run(command, text=True, capture_output=True, timeout=10)
    assert result.returncode == 2
    assert "설정 파일을 읽을 수 없습니다" in result.stderr
    assert "Traceback" not in result.stderr
