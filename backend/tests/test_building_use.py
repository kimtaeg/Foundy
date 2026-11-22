"""건축물대장 용도 코드 처리와 대상 공간 확정 (#121).

픽스처(tests/fixtures/building)는 2026-11-21 실제 건축HUB 응답에서 주소·건물명·동명·관리번호만 가짜 값으로 바꾼 것이다.
- floor_general.json: 일반건축물 층별개요 (1층 혼합: 소매점·휴게음식점·금융업소·부동산중개업소, 3층 의원만)
- floor_aggregate.json: 집합건축물 층별개요 (1층: 기타제2종근린생활시설·기타공장)
- unit_R126.json / unit_R105.json: 같은 집합건축물 전유공용면적의 hoNm 요청 응답 (1층 R126 소매점, R105 일반음식점)
테스트 안에서 행을 고친 경우(코드 누락·충돌, 건물·호실 중복 등)는 '합성'이라고 적었다. 실제로 받은 응답이 아니다.
"""

import copy
import json
from pathlib import Path

import httpx
import pytest

from agent.judge import judge_building_use_ai, judge_violation_ai
from agent.llm import FakeLLM, LLMError
from rules import building_use as bu
from rules.engine import check_spec, judge_building_use as rule_table, load_pack
from tools.providers import Providers

from .fakes import FakeTools, building_ai, store

PACK = load_pack("cafe_restaurant")
BU = check_spec(PACK, "building_use")
VIO = check_spec(PACK, "building_violation")
FIX = Path(__file__).resolve().parent / "fixtures" / "building"
CODES = {"sigungu_cd": "99999", "bjdong_cd": "99999", "bun": "0001", "ji": "0000"}


def rows(name: str) -> list[dict]:
    return json.loads((FIX / name).read_text(encoding="utf-8"))["response"]["body"]["items"]["item"]


def page(items: list[dict]) -> dict:
    return {"response": {"header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE"},
                         "body": {"items": {"item": items} if items else "", "totalCount": len(items),
                                  "numOfRows": 100, "pageNo": 1}}}


def settings():
    from types import SimpleNamespace
    return SimpleNamespace(kakao_rest_key="k", building_api_key="k", data_go_kr_key="", kipris_api_key="", law_oc="")


def fetch(detail, floor=None, units=None, calls=None):
    """Providers.building 을 MockTransport 로 실행한다. units: hoNm → 응답 행 (없으면 빈 응답)."""
    floor = rows("floor_general.json") if floor is None else floor
    calls = [] if calls is None else calls

    def respond(req):
        calls.append((req.url.path.rsplit("/", 1)[-1], dict(req.url.params)))
        if req.url.path.endswith("getBrFlrOulnInfo"):
            return httpx.Response(200, json=page(floor))
        if req.url.path.endswith("getBrExposPubuseAreaInfo"):
            return httpx.Response(200, json=page((units or {}).get(req.url.params["hoNm"], [])))
        raise AssertionError(req.url)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        return Providers(client, settings()).building(store(address_detail=detail, address_codes=CODES))


def judged(result, biz="일반음식점", j=None):
    law = FakeTools().law("building_use")
    llm = FakeLLM({"judge_building_use": j if j is not None else building_ai})
    bi = bu.building_input(PACK, biz, result.data)
    rr = rule_table(PACK, biz, bi.uses or [])
    item, extras = judge_building_use_ai(llm, store(), biz, result, law, rr, BU, "r-01", PACK)
    return item, extras, llm, bi


# ---------- 공식 코드표 ----------

def test_official_code_table_maps_by_parent_chain_not_by_name_or_prefix():
    assert len(bu._table()) == 718
    assert bu.category_of("03002") == ("03000", "제1종근린생활시설")
    assert bu.category_of("04002") == ("04000", "제2종근린생활시설")  # 같은 '휴게음식점'이라도 코드에 따라 대분류가 다르다
    assert bu.category_of("04403") == ("04000", "제2종근린생활시설")  # 04403 → 04400(사무소) → 04000
    assert bu.category_of("14201") == ("14000", "업무시설")
    assert bu.category_of("Z3002") == ("Z3000", "근린생활시설")  # 옛 체계: 1종·2종 구분이 없다
    assert bu.category_of("99999") is None


def test_classify_only_trusts_confirmed_code_and_matching_name():
    assert bu.classify("03002", "휴게음식점")["category"] == "제1종근린생활시설"
    assert bu.classify("03000", "제1종근린생활시설")["status"] == bu.MAPPED
    assert bu.classify(None, "휴게음식점")["status"] == bu.MISSING_CODE  # 이름으로 추정하지 않는다
    assert bu.classify("99999", "휴게음식점")["status"] == bu.UNKNOWN_CODE
    assert bu.classify("03002", "일반음식점")["status"] == bu.NAME_MISMATCH
    assert bu.classify("03002", "휴게음식점")["category_code"] == "03000"


@pytest.mark.parametrize("text,expected", [
    ("1층", {"floor": "1", "underground": False, "ho": None, "dong": None}),
    ("지하1층 B101호", {"floor": "1", "underground": True, "ho": "B101", "dong": None}),
    ("1층 r126호", {"floor": "1", "underground": False, "ho": "R126", "dong": None}),
    ("A동 2층 201호", {"floor": "2", "underground": False, "ho": "201", "dong": "A"}),
    (None, {"floor": None, "underground": False, "ho": None, "dong": None}),
])
def test_parse_detail(text, expected):
    assert bu.parse_detail(text) == expected


# ---------- 일반건축물 층별개요 (실제 응답) ----------

def test_single_use_floor_feeds_rule_and_ai_but_is_not_marked_as_unit():
    result = fetch("3층")  # 실제: 3층은 03005 의원(제1종근린생활시설)뿐
    space = result.data["space"]
    assert space["status"] == bu.FLOOR and space["scope"] == "floor"
    assert result.data["schema"] == bu.SPACE_SCHEMA and result.data["violation"] is None
    assert result.data["floor_rows"][0]["mainPurpsCd"] == "03005"  # 원본 코드·용도명 보존
    item, _, llm, bi = judged(result)
    assert bi.uses == ["제1종근린생활시설 (의원, 03005)"]
    assert item.verdict == "high" and item.decided_by == "ai"  # 대상과 조문 근거가 확보된 경우 기존 high 유지
    assert "호실 미확인" in item.evidence[0].value and "호실 확인" not in item.evidence[0].value.replace("호실 미확인", "")
    assert any(e.type == "law" and "일반음식점을 할 수 없다" in (e.text or "") for e in item.evidence)


def test_mixed_floor_with_different_outcomes_is_unknown_without_ai():
    result = fetch("1층")  # 실제: 소매점·휴게음식점(1종) + 금융업소(업무) + 부동산중개업소(2종)
    item, extras, llm, bi = judged(result)
    assert bi.uses is None and llm.calls == []
    assert item.verdict == "unknown" and item.decided_by == "rule" and not item.ai_fallback
    assert "호실" in item.reason and "전유부" in item.reason
    value = item.evidence[0].value
    assert "1층 전체 후보 4곳 · 호실 미확인" in value
    for code in ("03001", "03002", "14201", "04403"):  # 첫 행·많은 용도를 고르지 않고 후보 전체를 남긴다
        assert code in value
    assert "14299" not in value  # 부속건축물(주차타워)은 후보가 아니다
    assert extras["ok_business_types"] == []


def test_mixed_floor_with_same_outcome_is_judged_as_floor_scope():
    floor = [r for r in rows("floor_general.json") if r["mainPurpsCd"] != "14201"]  # 합성: 금융업소 행 제거 → 1종·2종만
    result = fetch("1층", floor=floor)
    item, _, _, bi = judged(result, biz="휴게음식점")
    assert bi.scope == "floor" and len(bi.uses) == 3  # 휴게음식점은 1종·2종 모두 가능 → 후보와 무관하게 같은 결과
    assert item.verdict == "ok" and "호실 미확인" in item.evidence[0].value


def test_unit_requested_on_general_building_falls_back_to_floor_with_note():
    calls = []
    result = fetch("3층 301호", calls=calls)  # 일반건축물: 전유부 응답 0건
    assert [c[0] for c in calls] == ["getBrFlrOulnInfo", "getBrExposPubuseAreaInfo"]
    assert calls[1][1]["hoNm"] == "301"
    assert result.data["space"]["note"] == "unit_not_found" and result.data["unit_rows"] == []
    bi = bu.building_input(PACK, "일반음식점", result.data)
    assert "전유부에 이 호실 정보 없음" in bi.scope_text and bi.uses


def test_floor_missing_or_not_found_is_status_not_exception():
    calls = []
    missing = fetch(None, calls=calls)
    assert missing.ok and missing.data["space"]["status"] == bu.FLOOR_MISSING and calls == []
    nofloor = fetch("15층")
    assert nofloor.ok and nofloor.data["space"]["status"] == bu.FLOOR_NOT_FOUND
    for res in (missing, nofloor):
        item, _, llm, _ = judged(res)
        assert item.verdict == "unknown" and llm.calls == []


def test_two_buildings_on_same_floor_is_unknown_for_use_and_violation():
    floor = copy.deepcopy(rows("floor_general.json"))
    for r in floor:
        if r["flrNo"] == 3:
            twin = {**r, "mgmBldrgstPk": 9999999999}  # 합성: 같은 층에 다른 건물(관리번호) 행
    floor.append(twin)
    result = fetch("3층", floor=floor)
    assert result.data["space"]["status"] == bu.BUILDING_AMBIGUOUS
    item, *_ = judged(result)
    assert item.verdict == "unknown" and "건물이 여러 동" in item.reason
    vio = judge_violation_ai(FakeLLM({}), result, VIO, "r-03")
    assert vio.verdict == "unknown" and "대상 건물을 하나로" in vio.reason


@pytest.mark.parametrize("change,status", [
    ({"mainPurpsCd": ""}, bu.MISSING_CODE),
    ({"mainPurpsCd": "99999"}, bu.UNKNOWN_CODE),
    ({"mainPurpsCdNm": "일반음식점"}, bu.NAME_MISMATCH),
])
def test_unclassifiable_code_on_target_floor_is_unknown(change, status):
    floor = copy.deepcopy(rows("floor_general.json"))
    for r in floor:
        if r["flrNo"] == 3:
            r.update(change)  # 합성: 실제 행의 코드·이름만 바꿈
    result = fetch("3층", floor=floor)
    assert result.data["space"]["candidates"][0]["status"] == status
    item, _, llm, _ = judged(result)
    assert item.verdict == "unknown" and llm.calls == [] and "공식 코드표로 확인할 수 없는" in item.reason


def test_legacy_code_maps_to_category_rule_table_cannot_judge():
    floor = copy.deepcopy(rows("floor_general.json"))
    for r in floor:
        if r["flrNo"] == 3:
            r.update(mainPurpsCd="Z3002", mainPurpsCdNm="휴게음식점")  # 합성: 옛 체계 코드
    bi = bu.building_input(PACK, "일반음식점", fetch("3층", floor=floor).data)
    assert bi.uses == ["근린생활시설 (휴게음식점, Z3002)"]
    assert rule_table(PACK, "일반음식점", bi.uses).verdict == "unknown"  # 1종·2종을 모르므로 규칙표는 판단하지 않는다


def test_violation_is_judged_separately_when_building_is_confirmed():
    result = fetch("1층")  # 용도가 섞여 건물 용도는 판단 불가지만, 후보는 모두 같은 건물
    assert bu.building_identified(result.data)
    item, *_ = judged(result)
    assert item.verdict == "unknown"
    flagged = result.model_copy(update={"data": {**result.data, "violation": False}})  # 표기를 검증할 수 있다면
    assert judge_violation_ai(FakeLLM({"judge_violation": LLMError("x")}), flagged, VIO, "r-03").verdict == "ok"
    none = judge_violation_ai(FakeLLM({}), result, VIO, "r-03")
    assert none.verdict == "unknown" and "표기 정보가 없어요" in none.reason  # 실제 응답에는 표기 필드가 없다


# ---------- 집합건축물 전유부 (실제 응답) ----------

UNITS = {"R126": rows("unit_R126.json"), "R105": rows("unit_R105.json")}


def test_unit_confirmed_by_dong_floor_and_ho_in_response():
    result = fetch("1층 R126호", floor=rows("floor_aggregate.json"), units=UNITS)
    space = result.data["space"]
    assert space["status"] == bu.UNIT_MATCHED and space["scope"] == "unit"
    assert [c["code"] for c in space["candidates"]] == ["03001"]  # 공용(각층) 행은 대상이 아니다
    assert result.source == "건축HUB 전유부·층별개요"
    item, _, _, bi = judged(result)
    assert bi.uses == ["제1종근린생활시설 (소매점, 03001)"] and "1층 R126호 · 전유부에서 호실 확인" in bi.scope_text
    assert item.verdict == "high" and item.decided_by == "ai"
    ok, *_ = judged(fetch("1층 R105호", floor=rows("floor_aggregate.json"), units=UNITS))
    assert ok.verdict == "ok"  # 같은 층이라도 호실이 2종(일반음식점)이면 가능


def test_aggregate_floor_without_unit_is_unknown_when_candidates_differ():
    item, _, llm, bi = judged(fetch("1층", floor=rows("floor_aggregate.json"), units=UNITS))
    assert bi.uses is None and llm.calls == [] and item.verdict == "unknown"  # 2종 근생 + 공장


def test_hoNm_in_request_is_not_trusted_without_matching_response():
    # 합성: 서버가 요청과 다른 호실 행을 돌려준 경우 → 일치로 보지 않고 층 후보로 판단
    result = fetch("1층 R126호", floor=rows("floor_aggregate.json"), units={"R126": UNITS["R105"]})
    assert result.data["space"]["status"] == bu.FLOOR and result.data["space"]["note"] == "unit_not_found"


def test_unit_on_other_floor_is_mismatch():
    result = fetch("2층 R126호", floor=rows("floor_aggregate.json"), units=UNITS)
    assert result.data["space"]["status"] == bu.UNIT_MISMATCH
    item, *_ = judged(result)
    assert item.verdict == "unknown" and "맞지 않아요" in item.reason


def test_same_ho_in_two_dongs_is_ambiguous_unless_dong_given():
    twin = [{**r, "dongNm": "다른동", "mgmBldrgstPk": 9999999998} for r in UNITS["R126"]]  # 합성: 다른 동의 같은 호
    units = {"R126": UNITS["R126"] + twin}
    result = fetch("1층 R126호", floor=rows("floor_aggregate.json"), units=units)
    assert result.data["space"]["status"] == bu.UNIT_AMBIGUOUS
    assert judged(result)[0].verdict == "unknown"
    picked = fetch("다른동 1층 R126호", floor=rows("floor_aggregate.json"), units=units)
    assert picked.data["space"]["status"] == bu.UNIT_MATCHED
    assert {c["dong"] for c in picked.data["space"]["candidates"]} == {"다른동"}


# ---------- 조회 실패 ----------

@pytest.mark.parametrize("response", [
    httpx.Response(200, json={"response": {"header": {"resultCode": "30", "resultMsg": "SERVICE KEY IS NOT REGISTERED"}, "body": {}}}),
    httpx.Response(200, text="<OpenAPI_ServiceResponse>SERVICE ERROR</OpenAPI_ServiceResponse>"),
    httpx.Response(503, text="unavailable"),
])
def test_provider_errors_raise_so_they_are_not_treated_as_data(response):
    with httpx.Client(transport=httpx.MockTransport(lambda req: response)) as client:
        with pytest.raises(Exception):
            Providers(client, settings()).building(store(address_detail="1층", address_codes=CODES))
