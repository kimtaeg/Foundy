"""실제 제공자를 호출하지 않고 공식 응답 변환·출처 보존·실패를 검증한다."""

from types import SimpleNamespace
from datetime import timedelta
import uuid

import httpx
import pytest
from sqlalchemy import delete

from agent.ports import ToolResult
from config import get_settings
from db.models import ApiCache
from db.session import transaction
from services.timeutil import now_utc
from tools.analysis import AnalysisTools
from tools.providers import Providers
from tests.fakes import store


def settings(**kwargs):
    values = dict(kakao_rest_key="test-key", building_api_key="test-key", data_go_kr_key="", kipris_api_key="test-key", law_oc="test-oc")
    values.update(kwargs)
    return SimpleNamespace(**values)


def test_mock_mode_is_explicit_and_keeps_original_time():
    tools = AnalysisTools(use_mock=True)
    result = tools.building(store())
    assert result.ok and result.from_mock and result.fetched_at.year == 2026
    assert tools.law("missing").ok is False


def test_building_uses_selected_floor_and_never_invents_violation_flag():
    def respond(req):
        assert req.url.path.endswith("getBrFlrOulnInfo")
        assert req.url.params["bun"] == "0113"
        items = [{"flrNo": "1", "flrGbCdNm": "지상", "mainAtchGbCdNm": "주건축물", "mainPurpsCd": "03000",
                  "mainPurpsCdNm": "제1종근린생활시설", "mgmBldrgstPk": 1},
                 {"flrNo": "2", "flrGbCdNm": "지상", "mainAtchGbCdNm": "주건축물", "mainPurpsCd": "14000",
                  "mainPurpsCdNm": "업무시설", "mgmBldrgstPk": 1}]
        return httpx.Response(200, json={"response": {"header": {"resultCode": "00"},
            "body": {"totalCount": 2, "items": {"item": items}}}})
    codes = {"sigungu_cd": "11200", "bjdong_cd": "11500", "bun": "0113", "ji": "0000"}
    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = Providers(client, settings())
        result = provider.building(store(address_codes=codes))
        assert result.data["violation"] is None  # 위반 표기는 지어내지 않는다
        assert result.data["address_codes"] == codes
        assert [c["code"] for c in result.data["space"]["candidates"]] == ["03000"]  # 가게 층(1층)만
        assert result.fetched_at and not result.from_mock
        # 층이 없으면 예외(→ 모의 응답 대체)가 아니라 판단할 수 없다는 상태값
        missing = provider.building(store(address_detail=None, address_codes=codes))
        assert missing.ok and missing.data["space"]["status"] == "floor_missing"


def test_new_address_lookup_returns_legal_dong_with_codes():
    # 주소를 바꿔 코드를 비운 가게: 건물 조회가 카카오로 새 주소를 확인하고, 그 법정동을 코드와 함께 돌려준다 (#193)
    doc = {"address_name": "서울 관악구 봉천동 1", "address": {
        "b_code": "1162010100", "main_address_no": "1", "sub_address_no": "", "mountain_yn": "N",
        "region_1depth_name": "서울", "region_2depth_name": "관악구", "region_3depth_name": "봉천동"}}

    def respond(req):
        if "kakao" in req.url.host:
            return httpx.Response(200, json={"documents": [doc]})
        return httpx.Response(200, json={"response": {"header": {"resultCode": "00"}, "body": {"totalCount": 0, "items": ""}}})
    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        result = Providers(client, settings()).building(store(address="서울특별시 관악구 관악로 1", address_codes={}))
    assert result.data["address_codes"]["region"] == "서울 관악구 봉천동"
    assert result.data["address_codes"]["sigungu_cd"] == "11620"


def test_address_ambiguity_is_not_silently_resolved():
    with httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={"documents": [{}, {}]}))) as client:
        with pytest.raises(ValueError, match="ADDRESS_AMBIGUOUS"):
            Providers(client, settings()).building(store(address_codes={}))


def test_registered_trademark_search_is_marked_as_name_scope():
    raw = b'''<response><header><resultCode>00</resultCode><successYN>Y</successYN></header><count><totalCount>0</totalCount><pageNo>1</pageNo><numOfRows>100</numOfRows></count><body><items/></body></response>'''
    def respond(req):
        assert req.url.params["classification"] == "43"
        assert req.url.params["registration"] == "true"
        assert req.url.params["application"] == "false"
        return httpx.Response(200, content=raw)
    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        result = Providers(client, settings()).trademark("테스트 상호")
        assert result.ok and result.data["similar"] == [] and result.data["search_scope"] == "name"


def test_unconfirmed_law_mapping_does_not_call_external_api():
    with httpx.Client(transport=httpx.MockTransport(lambda req: pytest.fail("미확정 조문을 조회함"))) as client:
        result = Providers(client, settings(), references={}).law("permit_docs")
        assert not result.ok and result.error == "LAW_REFERENCE_UNCONFIRMED"


def test_trademark_keeps_registration_number_and_rejects_unknown_status():
    template = '''<response><header><resultCode>00</resultCode><successYN>Y</successYN></header><count><totalCount>1</totalCount><pageNo>1</pageNo><numOfRows>100</numOfRows></count><body><items><item><registrationNumber>4000000000001</registrationNumber><applicationNumber>4100000000001</applicationNumber><title>합성 테스트 상표</title><classificationCode>43</classificationCode><applicationStatus>{status}</applicationStatus></item></items></body></response>'''
    with httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, content=template.format(status="등록").encode()))) as client:
        result = Providers(client, settings()).trademark("테스트")
        assert result.data["similar"][0]["reg_no"] == "4000000000001"
    with httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, content=template.format(status="미상").encode()))) as client:
        with pytest.raises(ValueError, match="UNKNOWN_KIPRIS_STATUS"):
            Providers(client, settings()).trademark("테스트")


def test_confirmed_law_reference_checks_version_and_returns_actual_text():
    def respond(req):
        if req.url.path.endswith("lawSearch.do"):
            return httpx.Response(200, json={"LawSearch": {"totalCnt": 1, "law": {"법령명한글": "합성 법령", "현행연혁코드": "현행", "시행일자": "20200101", "법령일련번호": "123"}}})
        assert req.url.params["JO"] == "003700"
        return httpx.Response(200, json={"법령": {"기본정보": {"법령명_한글": "합성 법령", "시행일자": "20200101"},
            "조문": {"조문단위": {"조문번호": "37", "조문여부": "조문", "조문내용": "합성 테스트 원문", "항": {"항내용": "합성 항 원문"}}}}})
    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        result = Providers(client, settings(), references={"permit_docs": [{"law_name": "합성 법령", "number": 37}]}).law("permit_docs")
        assert result.ok and result.data["articles"][0]["text"] == "합성 테스트 원문\n합성 항 원문"
        assert "OC=" not in result.data["articles"][0]["url"]


def test_name_search_zero_is_not_a_similarity_clearance():
    from agent.judge import judge_trademark
    from agent.llm import FakeLLM
    from rules.engine import check_spec, load_pack
    result = ToolResult(ok=True, source="합성 명칭 검색", data={"similar": [], "search_scope": "name"})
    item, _ = judge_trademark(FakeLLM({}), store(), result, check_spec(load_pack("cafe_restaurant"), "trademark_similar"), "r-02")
    assert item.verdict == "unknown" and item.evidence


@pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")
def test_cache_preserves_provenance_and_failure_uses_expired_cache_then_mock():
    name = "cache-test-" + uuid.uuid4().hex
    stamp = now_utc() - timedelta(days=2)
    class Provider:
        calls = 0
        fail = False
        def trademark(self, name):
            self.calls += 1
            if self.fail:
                raise httpx.TimeoutException("의도한 테스트 장애")
            return ToolResult(ok=True, source="합성 공급자", fetched_at=stamp, data={"similar": []})
    provider = Provider()
    tools = AnalysisTools(providers=provider, use_mock=False)
    key = tools._key("trademark", {"name": name})
    try:
        first = tools.trademark(name)
        second = tools.trademark(name)
        assert first.ok and not first.from_cache and not first.from_mock
        assert second.from_cache and second.fetched_at == stamp and provider.calls == 1
        with transaction() as session:
            session.get(ApiCache, key).expires_at = now_utc() - timedelta(seconds=1)
        provider.fail = True
        expired = tools.trademark(name)
        assert expired.from_cache and not expired.from_mock and expired.fetched_at == stamp
        fallback = tools.trademark(name + "-missing")
        assert fallback.from_mock and provider.calls == 3
    finally:
        with transaction() as session:
            session.execute(delete(ApiCache).where(ApiCache.key.in_([key, tools._key("trademark", {"name": name + "-missing"})])))


@pytest.mark.skipif(not get_settings().database_url, reason="테스트 PostgreSQL 필요")
def test_old_building_cache_without_space_is_not_reused():
    """원본 용도 코드·대상 공간이 없는 옛 건물 캐시는 새 매핑을 우회하므로 쓰지 않는다 (#121)."""
    from rules.building_use import SPACE_SCHEMA

    s = store(address="캐시 테스트 " + uuid.uuid4().hex)
    stamp = now_utc() - timedelta(days=1)

    class Provider:
        calls = 0
        def building(self, store):
            self.calls += 1
            raise httpx.TimeoutException("의도한 테스트 장애")

    provider = Provider()
    tools = AnalysisTools(providers=provider, use_mock=False)
    key = tools._key("building", tools._building_params(s))
    old = ToolResult(ok=True, source="건축HUB 층별개요", fetched_at=stamp,
                     data={"floor_uses": ["휴게음식점"], "violation": None}).model_dump(mode="json")
    new = ToolResult(ok=True, source="건축HUB 층별개요", fetched_at=stamp,
                     data={"schema": SPACE_SCHEMA, "space": {"status": "floor", "candidates": []}, "violation": None}).model_dump(mode="json")
    try:
        for expires in (now_utc() + timedelta(days=1), now_utc() - timedelta(days=1)):  # 유효한 캐시·만료된 캐시 모두
            with transaction() as session:
                session.merge(ApiCache(key=key, source="building", payload=old, fetched_at=stamp, expires_at=expires))
            result = tools.building(s)
            assert result.from_mock and not result.from_cache  # 옛 캐시 대신 조회 → 실패 → 모의 응답 (실제 모드에서는 판정 안 함)
            assert tools.cached_building(s).ok is False
        with transaction() as session:
            session.merge(ApiCache(key=key, source="building", payload=new, fetched_at=stamp,
                                   expires_at=now_utc() + timedelta(days=1)))
        cached = tools.building(s)
        assert cached.from_cache and cached.data["schema"] == SPACE_SCHEMA
        assert provider.calls == 2
    finally:
        with transaction() as session:
            session.execute(delete(ApiCache).where(ApiCache.key == key))
