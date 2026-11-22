"""임대료 비교 (#181, 층별 비교 #187): R-ONE 응답 해석·상권 매칭·계산·실패 안내·예시 계정·API.

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


def frow(full, floor, item, value, period_id="202603", desc="2026년 3분기", table=rent_tool.FLOOR_TABLES[0]):
    """실제 층별 표 row 와 같은 키 (2026-11-22 실제 응답: 지역은 GRP, 층은 CLS, GRP_FULLNM 은 항상 있음)."""
    return {"STATBL_ID": table, "DTACYCLE_CD": "QY", "WRTTIME_IDTFR_ID": period_id, "GRP_ID": 60067,
            "GRP_NM": full.split(">")[-1], "CLS_ID": 50002, "CLS_NM": floor, "ITM_ID": 100001, "ITM_NM": item,
            "DTA_VAL": value, "UI_NM": "천원/㎡" if item == "임대료" else "%", "GRP_FULLNM": full,
            "CLS_FULLNM": floor, "ITM_FULLNM": item, "WRTTIME_DESC": desc}


# 2026년 3분기 실제 값 (천원/㎡)
FLOOR_ROWS = [
    frow("서울>기타>뚝섬", "1층", "임대료", 67.3810040247753), frow("서울>기타>뚝섬", "2층", "임대료", 33.3267594922903),
    frow("서울>기타>뚝섬", "지하1층", "임대료", 37.8065151653991), frow("서울>기타>뚝섬", "2층", "효용비율", 49.5),
    frow("서울>영등포신촌>동교/연남", "1층", "임대료", 56.7722174571259),
    frow("서울>영등포신촌>동교/연남", "2층", "임대료", 32.1944172854513),
    frow("서울>영등포신촌>동교/연남", "지하1층", "임대료", 38.1761079769892),
    frow("서울", "1층", "임대료", 53.0809830247017), frow("서울", "2층", "임대료", 27.2338468240708),
    frow("서울", "지하1층", "임대료", 19.9494174550593),
    frow("전국", "1층", "임대료", 20.6655085298445), frow("전국", "2층", "임대료", 11.1565199854517),
    frow("전국", "지하1층", "임대료", None),
]


def ok_payload(rows):
    return {"SttsApiTblData": [{"head": [{"list_total_count": len(rows)},
                                         {"RESULT": {"CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다."}}]},
                               {"row": rows}]}


def reb_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def tables(rent_rows=RENT_ROWS, conv_rows=CONV_ROWS, floor_rows=FLOOR_ROWS):
    def handler(request):
        table = request.url.params["STATBL_ID"]
        if table in rent_tool.FLOOR_TABLES:
            if isinstance(floor_rows, Exception):
                raise floor_rows
            rows = floor_rows
        else:
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


# 자치구 1차 추가 (#193): 도로명 주소 + 지번 지역(시도 구 법정동). 실제 가게의 _address_text 와 같은 형식
@pytest.mark.parametrize("address,area", [
    ("서울특별시 강동구 천호대로 1005 서울 강동구 천호동", "서울>기타>천호"),
    ("서울특별시 동작구 노량진로 100 서울 동작구 노량진동", "서울>기타>노량진"),
    ("서울특별시 동작구 동작대로 1 서울 동작구 사당동", "서울>기타>사당"),
    ("서울특별시 관악구 신림로 1 서울 관악구 신림동", "서울>기타>신림역"),
    ("서울특별시 관악구 관악로 1 서울 관악구 봉천동", "서울>기타>서울대입구역"),
    ("서울특별시 노원구 동일로 1 서울 노원구 상계동", "서울>기타>상계역"),
    ("서울특별시 중랑구 망우로 1 서울 중랑구 상봉동", "서울>기타>상봉역"),
    ("서울특별시 양천구 목동동로 1 서울 양천구 목동", "서울>기타>목동"),
    ("서울특별시 금천구 시흥대로 1 서울 금천구 독산동", "서울>기타>독산/시흥"),
    ("서울특별시 금천구 시흥대로 2 서울 금천구 시흥동", "서울>기타>독산/시흥"),
    ("서울특별시 강북구 도봉로 1 서울 강북구 수유동", "서울>기타>수유"),
    ("서울특별시 동대문구 장한로 1 서울 동대문구 장안동", "서울>기타>장안동"),
    ("서울특별시 구로구 경인로 1 서울 구로구 오류동", "서울>기타>오류동역"),
    ("서울특별시 강남구 도산대로 1 서울 강남구 청담동", "서울>강남>청담"),
    ("서울특별시 강남구 압구정로 1 서울 강남구 압구정동", "서울>강남>압구정"),
])
def test_first_batch_district_rules_match_by_legal_dong(address, area):
    assert rent_tool.candidates(address)[0] == ("상권", area, "full")


@pytest.mark.parametrize("address,first", [
    # 한 동이 여러 상권에 걸치는 곳은 연결하지 않고 권역·서울 평균으로 비교한다
    ("서울특별시 서초구 서초대로 1 서울 서초구 서초동", ("권역", "서울>강남", "full")),
    ("서울특별시 강남구 테헤란로 1 서울 강남구 역삼동", ("권역", "서울>강남", "full")),
    ("서울특별시 송파구 올림픽로 1 서울 송파구 잠실동", ("시도", "서울", "name")),
    ("서울특별시 강서구 화곡로 1 서울 강서구 화곡동", ("시도", "서울", "name")),
    # 동 이름은 낱말이 정확히 같아야 한다: 목동로(신정동)는 목동 상권이 아니다
    ("서울특별시 양천구 목동로 1 서울 양천구 신정동", ("시도", "서울", "name")),
    # 같은 동 이름이라도 자치구가 다르면 맞추지 않는다 (경기 시흥시는 금천구 시흥동이 아니다)
    ("경기도 시흥시 시흥대로 1 경기 시흥시 시흥동", ("시도", "경기", "name")),
])
def test_ambiguous_or_other_district_addresses_are_not_linked(address, first):
    assert rent_tool.candidates(address)[0] == first


def test_rent_cache_key_changes_when_area_rules_change(monkeypatch, tmp_path):
    from tools.analysis import AnalysisTools

    seen = []
    tools = AnalysisTools.__new__(AnalysisTools)
    tools._query = lambda source, params, fetch, check_id=None: seen.append(params)
    tools.rent("서울 강동구 천호동")
    rules = tmp_path / "rent_areas.yaml"
    rules.write_text(rent_tool.AREAS_FILE.read_text(encoding="utf-8") + "\n# 바뀐 규칙\n", encoding="utf-8")
    monkeypatch.setattr(rent_tool, "AREAS_FILE", rules)
    tools.rent("서울 강동구 천호동")
    assert seen[0]["address"] == seen[1]["address"] and seen[0]["schema"] == 2
    assert seen[0]["rules"] != seen[1]["rules"]  # 규칙이 바뀌면 저장된 결과를 다시 쓰지 않는다


@pytest.mark.skipif(not os.getenv("REB_API_KEY"), reason="REB_API_KEY 없음")
def test_every_rule_area_has_real_rent_and_conversion():
    """규칙에 넣은 상권이 실제 최신 통계표에 있고 임대료·전환율이 있는지 (상권 이름이 바뀌면 여기서 알 수 있다)."""
    key = os.environ["REB_API_KEY"]
    with httpx.Client(timeout=30) as client:
        rents = rent_tool._first_rows(client, key, rent_tool.RENT_TABLES, "2025")
        period = max(str(r["WRTTIME_IDTFR_ID"]) for r in rents)
        rent_areas = {r["CLS_FULLNM"] for r in rents if str(r["WRTTIME_IDTFR_ID"]) == period and r.get("DTA_VAL") is not None}
        convs = rent_tool._period_rows(client, key, rent_tool.CONVERSION_TABLES, period)
        conv_areas = {r["CLS_FULLNM"] for r in convs if r.get("DTA_VAL") is not None}
        floors = rent_tool._period_rows(client, key, rent_tool.FLOOR_TABLES, period)
        floor_areas = {r["GRP_FULLNM"] for r in floors if r["ITM_NM"] == "임대료" and r.get("DTA_VAL") is not None}
    areas = [rule["area"] for rule in rent_tool.load_areas()["areas"]]
    assert [a for a in areas if a not in rent_areas] == []
    assert [a for a in areas if a not in conv_areas] == []
    assert [a for a in areas if a not in floor_areas] == []


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
    v = service.view(store(), Tools(REAL), monthly_rent=2_500_000, deposit=30_000_000, area=None)
    assert v["status"] == "ready" and v["is_example"] is False
    assert v["average"]["area_name"] == "서울>기타>뚝섬" and v["average"]["krw_per_sqm"] == 67_381
    assert v["average"]["period"] == "2026년 3분기" and v["average"]["source"] == rent_tool.SOURCE
    assert v["basis"] == {"rent": "월세 + 보증금 × 전환율 6.47% ÷ 12", "area": "임대가능면적(전용+공용) 기준", "floor": "1층 기준"}
    assert v["comparison"]["mine_krw_per_sqm"] == 66_544
    assert any("영업장 면적" in n for n in v["notes"]) and not any("1층 기준이라" in n for n in v["notes"])


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


# ── 층별 비교 (#187) ──

def test_floor_rents_reads_area_floors_and_top_1f_only_rent_item():
    f = rent_tool.floor_rents(reb_client(tables()), "k", "서울>기타>뚝섬", "202603")
    assert f["area"] == {"1층": 67.3810040247753, "2층": 33.3267594922903, "지하1층": 37.8065151653991}  # 효용비율 제외
    assert f["top"] == {"name": "서울", "1층": 53.0809830247017}


def test_floor_rents_for_sido_uses_nation_and_drops_missing_floor():
    f = rent_tool.floor_rents(reb_client(tables()), "k", "서울", "202603")
    assert f["top"] == {"name": "전국", "1층": 20.6655085298445}
    nation = rent_tool.floor_rents(reb_client(tables()), "k", "전국", "202603")
    assert "지하1층" not in nation["area"]  # 값이 없는(null) 층은 넣지 않는다


def test_zero_floor_value_is_treated_as_missing():
    # R-ONE은 표본이 없는 층을 0으로 준다 (실제: 서울>기타>천호 지하1층 임대료 0). 0원 평균과 비교하지 않는다
    rows = FLOOR_ROWS + [frow("서울>기타>천호", "1층", "임대료", 57.851016605076),
                         frow("서울>기타>천호", "2층", "임대료", 26.0278586054532),
                         frow("서울>기타>천호", "지하1층", "임대료", 0)]
    f = rent_tool.floor_rents(reb_client(tables(floor_rows=rows)), "k", "서울>기타>천호", "202603")
    assert f["area"] == {"1층": 57.851016605076, "2층": 26.0278586054532}


def test_floor_rows_without_full_path_match_sido_by_name_only():
    rows = [{**r, "GRP_FULLNM": None} for r in FLOOR_ROWS]
    assert rent_tool.floor_rents(reb_client(tables(floor_rows=rows)), "k", "서울", "202603")["area"]["2층"] == 27.2338468240708
    assert rent_tool.floor_rents(reb_client(tables(floor_rows=rows)), "k", "서울>기타>뚝섬", "202603")["area"] == {}


def test_lookup_reads_floor_table_from_same_period_and_falls_back_to_previous_table():
    seen = []
    old = [frow(r["GRP_FULLNM"], r["CLS_NM"], r["ITM_NM"], r["DTA_VAL"], table=rent_tool.FLOOR_TABLES[1]) for r in FLOOR_ROWS]

    def handler(request):
        table = request.url.params["STATBL_ID"]
        if table in rent_tool.FLOOR_TABLES:
            seen.append((table, request.url.params["START_WRTTIME"]))
            if table == rent_tool.FLOOR_TABLES[0]:  # 새 표에 그 분기가 없으면 이전 표를 본다
                return httpx.Response(200, json=ok_payload([frow("서울>기타>뚝섬", "2층", "임대료", 1.0, period_id="202606")]))
            return httpx.Response(200, json=ok_payload(old))
        return tables()(request)
    found = rent_tool.lookup(reb_client(handler), "k", "서울 성동구 성수동1가", 2025)
    assert seen == [(rent_tool.FLOOR_TABLES[0], "202603"), (rent_tool.FLOOR_TABLES[1], "202603")]
    assert found["floors"]["area"]["2층"] == 33.3267594922903


@pytest.mark.parametrize("failure", [httpx.ConnectError("down"), None])
def test_floor_table_failure_keeps_regional_lookup(failure):
    if failure is None:  # 제공자 오류 응답
        def handler(request):
            if request.url.params["STATBL_ID"] in rent_tool.FLOOR_TABLES:
                return httpx.Response(200, json={"RESULT": {"CODE": "ERROR-500", "MESSAGE": "서버 오류"}})
            return tables()(request)
        client = reb_client(handler)
    else:
        client = reb_client(tables(floor_rows=failure))
    found = rent_tool.lookup(client, "k", "서울 성동구 성수동1가", 2025)
    assert found["rent_thousand_krw_per_sqm"] == 67.3810040247753 and found["floors"] is None


@pytest.mark.parametrize("detail,underground,wanted", [
    ("1", False, "1층"), ("2", False, "2층"), ("1", True, "지하1층"), ("2", True, "지하1층"),
    ("3", False, None), (None, False, None)])
def test_wanted_floor(detail, underground, wanted):
    assert calc.wanted_floor(detail, underground) == wanted


def test_monthly_for_area_and_readings():
    assert calc.monthly_for_area(67_381, 40) == 2_695_240 and calc.monthly_for_area(67_381, None) is None
    note = " 통계는 실제 계약가가 아니라 조사된 시장임대료 추정치예요."
    assert calc.readings("상권", "1층", -1.2, "similar")[0] == "상권 1층 평균과 비슷해요 (-1.2%)." + note
    assert calc.readings("권역", "2층", 3.0, "similar")[0] == "권역 2층 평균과 비슷해요 (+3.0%)." + note
    assert calc.readings("시도", "지하1층", 17.94, "high")[0] == "시도 지하1층 평균보다 17.9% 높아요." + note
    assert calc.readings("상권", "1층", -25.0, "low")[0] == "상권 1층 평균보다 25.0% 낮아요." + note
    assert calc.readings("상권", "1층", None, None) == [calc.CONTRACT_CHECK]
    assert calc.readings("상권", "1층", 1.0, "similar")[1] == calc.CONTRACT_CHECK


def floor_real(address="서울 성동구 성수동1가", **kw):
    return ToolResult(ok=True, source=rent_tool.SOURCE, data=rent_tool.lookup(reb_client(tables(**kw)), "k", address, 2025))


def test_first_floor_store_matches_contract_example(real_mode):
    v = service.view(store(), Tools(floor_real()), monthly_rent=2_500_000, deposit=30_000_000, area=40)
    assert v["headline"] == {"area_name": "서울>기타>뚝섬", "area_level": "상권", "building_type": "소규모 상가",
                             "floor_label": "1층", "krw_per_sqm": 67_381, "monthly_for_my_area_krw": 2_695_240,
                             "statistic": "평균(면적 가중)"}
    assert v["comparison"] == {"converted_monthly_krw": 2_661_750, "deposit_monthly_krw": 161_750,
                               "mine_krw_per_sqm": 66_544, "average_krw_per_sqm": 67_381, "diff_pct": -1.2,
                               "level": "similar", "compared_floor": "1층"}
    assert v["rows"] == [
        {"label": "뚝섬 1층", "krw_per_sqm": 67_381, "monthly_for_my_area_krw": 2_695_240, "is_my_floor": True},
        {"label": "뚝섬 2층", "krw_per_sqm": 33_327, "monthly_for_my_area_krw": 1_333_080, "is_my_floor": False},
        {"label": "뚝섬 지하1층", "krw_per_sqm": 37_807, "monthly_for_my_area_krw": 1_512_280, "is_my_floor": False},
        {"label": "서울 1층 평균", "krw_per_sqm": 53_081, "monthly_for_my_area_krw": 2_123_240, "is_my_floor": False}]
    assert v["readings"] == [
        "상권 1층 평균과 비슷해요 (-1.2%). 통계는 실제 계약가가 아니라 조사된 시장임대료 추정치예요.", calc.CONTRACT_CHECK]
    assert v["notes"] == [] and v["basis"]["floor"] == "1층 기준"
    assert v["source"] == {"name": rent_tool.SOURCE, "period": "2026년 3분기", "conversion_rate_pct": 6.47}
    assert v["average"]["krw_per_sqm"] == 67_381  # 기존 필드는 그대로 (1층 지역 평균)


def test_second_floor_store_compares_with_second_floor(real_mode):
    v = service.view(store(address_detail="2층 201호"), Tools(floor_real()), monthly_rent=2_500_000,
                     deposit=30_000_000, area=40)
    assert v["comparison"]["compared_floor"] == "2층" and v["comparison"]["average_krw_per_sqm"] == 33_327
    assert v["comparison"]["level"] == "high" and v["comparison"]["diff_pct"] == 99.7
    assert v["headline"]["floor_label"] == "2층" and v["headline"]["monthly_for_my_area_krw"] == 1_333_080
    assert [r["is_my_floor"] for r in v["rows"]] == [False, True, False, False]
    assert v["readings"][0].startswith("상권 2층 평균보다 99.7% 높아요.")
    assert v["basis"]["floor"] == "2층 기준" and v["notes"] == []


def test_basement_store_compares_with_basement_first_floor(real_mode):
    v = service.view(store(address_detail="지하2층"), Tools(floor_real()), monthly_rent=1_000_000, deposit=0, area=40)
    assert v["comparison"]["compared_floor"] == "지하1층" and v["rows"][2]["is_my_floor"] is True


def test_basement_store_with_zero_basement_value_falls_back_to_first_floor(real_mode):
    rows = [r for r in FLOOR_ROWS if not (r["GRP_NM"] == "뚝섬" and r["CLS_NM"] == "지하1층")]
    rows.append(frow("서울>기타>뚝섬", "지하1층", "임대료", 0))
    v = service.view(store(address_detail="지하1층"), Tools(floor_real(floor_rows=rows)), monthly_rent=1_000_000,
                     deposit=0, area=40)
    assert v["comparison"]["compared_floor"] == "1층" and v["comparison"]["average_krw_per_sqm"] == 67_381
    assert [r["label"] for r in v["rows"]] == ["뚝섬 1층", "뚝섬 2층", "서울 1층 평균"]
    assert v["notes"] == ["지하1층 통계가 없어 1층 평균과 비교했어요. 1층이 아니면 보통 이보다 낮아요."]


def test_zero_floor_value_in_saved_result_is_ignored(real_mode):
    # 0 거르기 이전에 저장된 조회 결과(캐시)에 0이 남아 있어도 0원 평균과 비교하지 않는다
    data = {**floor_real().data, "floors": {"area": {"1층": 67.38, "2층": 33.33, "지하1층": 0}, "top": {"name": "서울", "1층": 0}}}
    v = service.view(store(address_detail="지하1층"), Tools(ToolResult(ok=True, source=rent_tool.SOURCE, data=data)),
                     monthly_rent=1_000_000, deposit=0, area=40)
    assert v["comparison"]["compared_floor"] == "1층" and v["comparison"]["average_krw_per_sqm"] == 67_381
    assert [r["label"] for r in v["rows"]] == ["뚝섬 1층", "뚝섬 2층"]


def test_third_floor_store_falls_back_to_first_floor_with_note(real_mode):
    v = service.view(store(address_detail="3층"), Tools(floor_real()), monthly_rent=2_500_000, deposit=0, area=40)
    assert v["comparison"]["compared_floor"] == "1층" and v["basis"]["floor"] == "1층 기준"
    assert not any(r["is_my_floor"] for r in v["rows"])
    assert v["notes"] == ["3층 통계가 없어 1층 평균과 비교했어요. 1층이 아니면 보통 이보다 낮아요."]


def test_missing_floor_value_falls_back_and_drops_row(real_mode):
    rows = [r for r in FLOOR_ROWS if not (r["GRP_NM"] == "뚝섬" and r["CLS_NM"] in ("2층", "지하1층"))]
    v = service.view(store(address_detail="2층"), Tools(floor_real(floor_rows=rows)), monthly_rent=2_500_000,
                     deposit=0, area=40)
    assert [r["label"] for r in v["rows"]] == ["뚝섬 1층", "서울 1층 평균"]
    assert v["comparison"]["compared_floor"] == "1층"
    assert v["notes"] == ["2층 통계가 없어 1층 평균과 비교했어요. 1층이 아니면 보통 이보다 낮아요."]


def test_sido_level_area_ends_with_nation_row(real_mode):
    v = service.view(store(address="서울특별시 강동구 천호대로 1005", region="서울 강동구 천호동"), Tools(
        floor_real("서울특별시 강동구 천호대로 1005")), monthly_rent=2_500_000, deposit=0, area=40)
    assert [(r["label"], r["krw_per_sqm"]) for r in v["rows"]] == [
        ("서울 1층", 53_081), ("서울 2층", 27_234), ("서울 지하1층", 19_949), ("전국 1층 평균", 20_666)]
    assert v["headline"]["area_level"] == "시도" and v["readings"][0].startswith("시도 1층 평균")


def test_floor_table_failure_compares_first_floor_with_single_row(real_mode):
    v = service.view(store(address_detail="2층"), Tools(floor_real(floor_rows=httpx.ConnectError("down"))),
                     monthly_rent=2_500_000, deposit=30_000_000, area=40)
    assert v["status"] == "ready" and v["comparison"]["compared_floor"] == "1층"
    assert [r["label"] for r in v["rows"]] == ["뚝섬 1층"] and v["rows"][0]["is_my_floor"] is False
    assert v["notes"] == ["층별 통계를 불러오지 못했어요", "통계는 1층 기준이라 2층·지하는 보통 이보다 낮아요."]


def test_need_input_shape(real_mode):
    v = service.view(store(area_sqm=None), Tools(floor_real()), monthly_rent=2_500_000, deposit=None, area=None)
    assert v["status"] == "need_input" and v["missing"] == ["area"] and v["comparison"] is None
    assert v["headline"]["monthly_for_my_area_krw"] is None and v["headline"]["krw_per_sqm"] == 67_381
    assert all(r["monthly_for_my_area_krw"] is None for r in v["rows"]) and len(v["rows"]) == 4
    assert v["readings"] == [calc.CONTRACT_CHECK] and v["notes"] == []
    assert v["source"]["period"] == "2026년 3분기"


def test_unavailable_shape(real_mode):
    v = service.view(store(), Tools(ToolResult(ok=False, source="x", error="외부 조회 실패", reason="임대료 통계 서비스 인증에 실패했어요")),
                     monthly_rent=2_500_000, deposit=30_000_000, area=40)
    assert v["status"] == "unavailable" and v["reason"] == "임대료 통계 서비스 인증에 실패했어요"
    assert (v["headline"], v["comparison"], v["rows"], v["readings"], v["source"], v["average"]) == (None, None, None, [], None, None)
    assert v["basis"] == {"rent": "월세 + 보증금 환산(전환율)", "area": "임대가능면적(전용+공용) 기준", "floor": "1층 기준"}


def test_example_account_includes_example_floor_rows(real_mode):
    v = service.view(store(is_demo=True, address_detail="2층"), Tools(None), monthly_rent=2_000_000, deposit=0, area=40)
    assert v["is_example"] is True and v["comparison"]["compared_floor"] == "2층"
    assert [r["label"] for r in v["rows"]] == ["뚝섬 1층", "뚝섬 2층", "뚝섬 지하1층", "서울 1층 평균"]


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
    floors = res.data["floors"]
    assert floors and floors["top"]["name"] == "서울" and floors["top"]["1층"] > 0
    assert set(floors["area"]) >= {"1층", "2층"}
    assert abs(floors["area"]["1층"] - res.data["rent_thousand_krw_per_sqm"]) < 0.01  # 층별 1층 = 지역별 임대료
