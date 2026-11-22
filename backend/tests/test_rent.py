"""임대료 비교 (#181): R-ONE 응답 해석·상권 매칭·계산·실패 안내·예시 계정·API.

가짜 응답은 실제로 받은 R-ONE row 형식이다. 실제 호출 테스트는 REB_API_KEY 가 있을 때만 돈다.
"""

import os
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

from agent.ports import ToolResult
from calc import rent as calc
from services import rent as service
from tools import rent as rent_tool
from tools import retry
from tools.failure import classify
from tools.providers import Providers

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@pytest.fixture(autouse=True)
def no_retry_wait(monkeypatch):
    monkeypatch.setattr(retry.time, "sleep", lambda s: None)


def row(table, cls_id, full, item, value, unit, period_id="202603", desc="2026년 3분기"):
    """실제 R-ONE SttsApiTblData row 와 같은 키."""
    return {"STATBL_ID": table, "DTACYCLE_CD": "QY", "WRTTIME_IDTFR_ID": period_id, "GRP_ID": None, "GRP_NM": None,
            "CLS_ID": cls_id, "CLS_NM": full.split(">")[-1], "ITM_ID": 100001, "ITM_NM": item, "DTA_VAL": value,
            "UI_NM": unit, "GRP_FULLNM": None, "CLS_FULLNM": full, "ITM_FULLNM": item, "WRTTIME_DESC": desc}


RENT, CONV = rent_tool.RENT_TABLES[0], rent_tool.CONVERSION_TABLES[0]
RENT_ROWS = [row(RENT, 500002, "서울", "임대료", 53.0809830247017, "천원/㎡"),
             row(RENT, 520037, "서울>기타>뚝섬", "임대료", 67.3810040247753, "천원/㎡"),
             row(RENT, 510005, "서울>영등포신촌", "임대료", 48.8675074097928, "천원/㎡"),
             row(RENT, 520025, "서울>영등포신촌>동교/연남", "임대료", 56.7722174571259, "천원/㎡"),
             row(RENT, 500003, "부산", "임대료", 26.33, "천원/㎡")]
CONV_ROWS = [row(CONV, 500002, "서울", "전환율", 7.04270096463023, "%"),
             row(CONV, 520037, "서울>기타>뚝섬", "전환율", 6.47, "%"),
             row(CONV, 510005, "서울>영등포신촌", "전환율", 6.99178082191781, "%"),
             row(CONV, 520025, "서울>영등포신촌>동교/연남", "전환율", 7.08888888888889, "%"),
             row(CONV, 500003, "부산", "전환율", 6.93, "%")]


def ok_payload(rows):
    return {"SttsApiTblData": [{"head": [{"list_total_count": len(rows)},
                                         {"RESULT": {"CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다."}}]},
                               {"row": rows}]}


def reb_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def tables(rent_rows=RENT_ROWS, conv_rows=CONV_ROWS):
    def handler(request):
        table = request.url.params["STATBL_ID"]
        rows = rent_rows if table in rent_tool.RENT_TABLES else conv_rows
        if not rows:
            return httpx.Response(200, json={"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}})
        return httpx.Response(200, json=ok_payload(rows))
    return handler


# ── 계산 ──

def test_compare_uses_deposit_conversion_and_area():
    # 월세 250만 + 보증금 3천만 × 6.47% / 12 = 2,661,750원 → 40㎡ → 66,544원/㎡, 평균 67,381원/㎡
    c = calc.compare(2_500_000, 30_000_000, 40, 6.47, 67.3810040247753)
    assert c["converted_monthly_krw"] == 2_661_750 and c["deposit_monthly_krw"] == 161_750
    assert c["mine_krw_per_sqm"] == 66_544 and c["average_krw_per_sqm"] == 67_381
    assert c["diff_pct"] == -1.2 and c["level"] == "similar"


@pytest.mark.parametrize("rent_krw,level", [(3_200_000, "high"), (2_000_000, "low"), (2_700_000, "similar")])
def test_compare_levels(rent_krw, level):
    assert calc.compare(rent_krw, 0, 40, 6.47, 67.381)["level"] == level


def test_compare_rejects_zero_area():
    with pytest.raises(ValueError):
        calc.compare(1, 0, 0, 7, 50)


# ── 상권 매칭 ──

def test_candidates_area_then_region_then_sido():
    assert rent_tool.candidates("서울특별시 성동구 아차산로 17 서울 성동구 성수동1가")[0] == ("상권", "서울>기타>뚝섬", "full")
    assert [c[0] for c in rent_tool.candidates("서울특별시 마포구 독막로 10 서울 마포구 상수동")] == ["권역", "시도"]
    assert rent_tool.candidates("서울특별시 강동구 천호대로 1005") == [("시도", "서울", "name")]
    assert rent_tool.candidates("없는 주소") == []


def test_candidates_requires_district_for_shared_road_names():
    # 아차산로는 광진구에도 있다. 성동구가 아닌 주소는 뚝섬 상권으로 잡지 않는다
    assert rent_tool.candidates("서울특별시 광진구 아차산로 200")[0][1] != "서울>기타>뚝섬"


# ── R-ONE 응답 해석 ──

def test_lookup_reads_area_rent_and_same_area_conversion():
    found = rent_tool.lookup(reb_client(tables()), "k", "서울특별시 성동구 성수동1가", 2025)
    assert found["area_name"] == "서울>기타>뚝섬" and found["level"] == "상권"
    assert found["rent_thousand_krw_per_sqm"] == 67.3810040247753 and found["conversion_rate_pct"] == 6.47
    assert found["period"] == "2026년 3분기" and found["unit"] == "천원/㎡"


def test_lookup_falls_back_to_sido_row_not_sub_area():
    found = rent_tool.lookup(reb_client(tables()), "k", "서울특별시 강동구 천호대로 1005", 2025)
    assert (found["level"], found["area_name"], found["conversion_rate_pct"]) == ("시도", "서울", 7.04270096463023)


def test_lookup_skips_area_without_conversion_rate():
    found = rent_tool.lookup(reb_client(tables(conv_rows=[r for r in CONV_ROWS if r["CLS_NM"] != "뚝섬"])),
                             "k", "서울특별시 성동구 성수동1가", 2025)
    assert found["level"] == "시도"  # 뚝섬 전환율이 없으면 같은 기준으로 비교할 수 없어 다음 단계로


def test_lookup_uses_previous_table_when_newest_is_empty():
    seen = []

    def handler(request):
        table = request.url.params["STATBL_ID"]
        seen.append(table)
        if table in (rent_tool.RENT_TABLES[0], rent_tool.CONVERSION_TABLES[0]):
            return httpx.Response(200, json={"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}})
        rows = RENT_ROWS if table in rent_tool.RENT_TABLES else CONV_ROWS
        return httpx.Response(200, json=ok_payload(rows))
    assert rent_tool.lookup(reb_client(handler), "k", "서울 성동구 성수동", 2025)["area_name"] == "서울>기타>뚝섬"
    assert rent_tool.RENT_TABLES[1] in seen


def test_fetch_table_pages_until_total():
    pages = []

    def handler(request):
        page = int(request.url.params["pIndex"])
        pages.append(page)
        rows = [row(RENT, i, f"지역{i}", "임대료", 1.0, "천원/㎡") for i in range(rent_tool.PAGE_SIZE if page == 1 else 3)]
        payload = ok_payload(rows)
        payload["SttsApiTblData"][0]["head"][0]["list_total_count"] = rent_tool.PAGE_SIZE + 3
        return httpx.Response(200, json=payload)
    assert len(rent_tool.fetch_table(reb_client(handler), "k", RENT, "2025")) == rent_tool.PAGE_SIZE + 3
    assert pages == [1, 2]


def test_invalid_key_is_auth_failure():
    def handler(request):
        return httpx.Response(200, json={"RESULT": {"CODE": "ERROR-290", "MESSAGE": "인증키가 유효하지 않습니다."}})
    with pytest.raises(Exception) as info:
        rent_tool.fetch_table(reb_client(handler), "bad", RENT, "2025")
    f = classify(info.value)
    assert (f.kind, f.result_code) == ("auth", "ERROR-290")


def test_no_data_returns_none():
    assert rent_tool.lookup(reb_client(tables(rent_rows=[], conv_rows=[])), "k", "서울 성동구 성수동", 2025) is None


def test_provider_requires_key_and_reports_not_found():
    no_key = Providers(client=reb_client(tables()), settings=SimpleNamespace(reb_api_key=""), references={})
    with pytest.raises(ValueError, match="MISSING_REB_API_KEY"):
        no_key.rent("서울 성동구 성수동")
    p = Providers(client=reb_client(tables()), settings=SimpleNamespace(reb_api_key="k"), references={})
    assert p.rent("제주특별자치도 제주시 어딘가").ok is False
    assert p.rent("서울 성동구 성수동1가").data["area_name"] == "서울>기타>뚝섬"


# ── 서비스: 실패 안내·예시·입력 ──

def store(**kw):
    base = dict(address="서울특별시 성동구 아차산로 17", region="서울 성동구 성수동1가", address_detail="1층",
                area_sqm=40, is_demo=False)
    base.update(kw)
    return SimpleNamespace(**base)


class Tools:
    def __init__(self, result):
        self.result = result

    def rent(self, address):
        return self.result


REAL = ToolResult(ok=True, source=rent_tool.SOURCE, data=rent_tool.lookup(reb_client(tables()), "k", "서울 성동구 성수동", 2025))


@pytest.fixture
def real_mode(monkeypatch):
    monkeypatch.setattr(service, "get_settings", lambda: SimpleNamespace(use_mock=False))


@pytest.mark.parametrize("result", [
    ToolResult(ok=False, source="x", error="외부 조회 실패", reason="임대료 통계 서비스 인증에 실패했어요"),
    ToolResult(ok=True, source="x", data=REAL.data, from_mock=True, substituted=True),
    ToolResult(ok=True, source="x", data=REAL.data, from_cache=True, substituted=True),
])
def test_failure_shows_notice_only_without_made_up_average(real_mode, result):
    v = service.view(store(), Tools(result), monthly_rent=2_500_000, deposit=0, area=None)
    assert v["status"] == "unavailable" and v["message"] == "임대료 통계를 아직 불러올 수 없어요"
    assert v["average"] is None and v["comparison"] is None and v["is_example"] is False


def test_real_statistics_compare_with_basis_and_notes(real_mode):
    v = service.view(store(address_detail="2층"), Tools(REAL), monthly_rent=2_500_000, deposit=30_000_000, area=None)
    assert v["status"] == "ready" and v["is_example"] is False
    assert v["average"]["area_name"] == "서울>기타>뚝섬" and v["average"]["krw_per_sqm"] == 67_381
    assert v["average"]["period"] == "2026년 3분기" and v["average"]["source"] == rent_tool.SOURCE
    assert v["basis"] == {"rent": "월세 + 보증금 × 전환율 6.47% ÷ 12", "area": "임대가능면적(전용+공용) 기준", "floor": "1층 기준"}
    assert v["comparison"]["mine_krw_per_sqm"] == 66_544
    assert any("영업장 면적" in n for n in v["notes"]) and any("1층 기준" in n for n in v["notes"])


def test_query_area_overrides_store_area_and_drops_area_note(real_mode):
    v = service.view(store(), Tools(REAL), monthly_rent=2_500_000, deposit=30_000_000, area=50)
    assert v["inputs"]["area_source"] == "query" and v["inputs"]["area_sqm"] == 50
    assert not any("영업장 면적" in n for n in v["notes"])


def test_missing_inputs_return_average_without_comparison(real_mode):
    v = service.view(store(area_sqm=None), Tools(REAL), monthly_rent=None, deposit=None, area=None)
    assert v["status"] == "need_input" and v["missing"] == ["monthly_rent", "area"]
    assert v["average"]["krw_per_sqm"] == 67_381 and v["comparison"] is None


def test_demo_store_uses_example_values_with_flag(real_mode):
    class Boom:
        def rent(self, address):
            raise AssertionError("예시 계정은 실제 통계를 부르지 않는다")
    v = service.view(store(is_demo=True), Boom(), monthly_rent=2_500_000, deposit=30_000_000, area=None)
    assert v["status"] == "ready" and v["is_example"] is True and v["average"]["period"] == "예시 분기"


def test_use_mock_uses_example_values(monkeypatch):
    monkeypatch.setattr(service, "get_settings", lambda: SimpleNamespace(use_mock=True))
    v = service.view(store(), Tools(None), monthly_rent=2_500_000, deposit=0, area=None)
    assert v["is_example"] is True


# ── API ──

def test_api_validates_and_returns_view(monkeypatch):
    import main
    from api.deps import owned_store

    main.app.dependency_overrides[owned_store] = lambda: store(is_demo=True)
    try:
        client = TestClient(main.app)
        r = client.get("/api/stores/x/rent", params={"monthly_rent": 2_500_000, "deposit": 30_000_000})
        assert r.status_code == 200 and r.json()["is_example"] is True and r.json()["comparison"]
        assert client.get("/api/stores/x/rent", params={"monthly_rent": -1}).status_code in (400, 422)
        assert client.get("/api/stores/x/rent", params={"area": 0}).status_code in (400, 422)
    finally:
        main.app.dependency_overrides.pop(owned_store, None)


# ── 실제 호출 (키가 있을 때만) ──

@pytest.mark.skipif(not os.getenv("REB_API_KEY"), reason="REB_API_KEY 없음")
def test_real_reb_lookup_for_seongsu():
    p = Providers(client=httpx.Client(timeout=30), settings=SimpleNamespace(reb_api_key=os.environ["REB_API_KEY"]),
                  references={})
    res = p.rent("서울특별시 성동구 아차산로 17 서울 성동구 성수동1가")
    assert res.ok and res.data["area_name"] == "서울>기타>뚝섬" and res.data["unit"] == "천원/㎡"
    assert 10 < res.data["rent_thousand_krw_per_sqm"] < 300 and 3 < res.data["conversion_rate_pct"] < 15
