"""1. 카카오 주소 검색 → 건축HUB 건축물대장 (표제부, 층별개요, 지역지구구역).

출처
- 카카오 로컬 주소 검색: https://developers.kakao.com/docs/latest/ko/local/dev-guide
- 건축HUB 건축물대장정보 서비스: https://www.data.go.kr/data/15134735/openapi.do
  오퍼레이션 이름은 getBrTitleInfo(상세 페이지 확인), getBrFlrOulnInfo·getBrJijiguInfo(사용자 확인)
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import (ProbeReport, Step, all_keys, call, find_fields, get_key,  # noqa: E402
                     parse_json, require_keys, save)

DEMO_ADDRESS = "서울 성동구 성수이로 113"
KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
BLD_BASE = "https://apis.data.go.kr/1613000/BldRgstHubService"
VIOLATION_NEEDLES = ("위반", "viol")


def _datagokr_items(step: Step, resp) -> list[dict]:
    """data.go.kr 응답에서 item 목록을 꺼내고, 결과 코드로 실패 원인을 구분한다."""
    data = parse_json(resp)
    if data is None:
        text = resp.text
        # 키 오류는 JSON 요청이어도 XML(OpenAPI_ServiceResponse)로 오는 경우가 있다
        for msg in ("SERVICE_KEY_IS_NOT_REGISTERED_ERROR", "SERVICE_ACCESS_DENIED_ERROR",
                    "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR", "UNREGISTERED_IP_ERROR"):
            if msg in text:
                step.ok, step.failure, step.note = False, "키·승인·IP", msg
                return []
        step.ok, step.failure, step.note = False, "코드·파라미터", f"JSON 아님: {text[:120]!r}"
        return []
    header = data.get("response", {}).get("header", {})
    code, msg = header.get("resultCode"), header.get("resultMsg")
    if code not in ("00", "0", 0, None):
        step.ok = False
        step.failure = "키·승인·IP" if code in ("20", "22", "30", "31", "32", "33") else "코드·파라미터"
        step.note = f"resultCode={code} {msg}"
        return []
    body = data.get("response", {}).get("body", {})
    items = (body.get("items") or {}) if isinstance(body.get("items"), dict) else {}
    item = items.get("item", [])
    items_list = item if isinstance(item, list) else [item] if item else []
    step.note = f"totalCount={body.get('totalCount')}, items={len(items_list)}"
    if not items_list:
        step.failure = "데이터 없음"
    return items_list


def run() -> ProbeReport:
    rep = ProbeReport(api="카카오 주소 → 건축HUB 건축물대장")
    missing = require_keys("KAKAO_REST_KEY", "DATA_GO_KR_KEY")
    if missing:
        rep.steps.append(Step(name="키 확인", failure="키·승인·IP", note=f".env에 없음: {missing}"))
        return rep

    # ── 1) 카카오 주소 검색 ──
    step, resp = call("카카오 주소 검색", KAKAO_ADDRESS_URL,
                      params={"query": DEMO_ADDRESS},
                      headers={"Authorization": f"KakaoAK {get_key('KAKAO_REST_KEY')}"})
    rep.steps.append(step)
    if resp is None or not step.ok:
        return rep
    rep.saved.append(save("kakao_address.json", resp))
    docs = (parse_json(resp) or {}).get("documents", [])
    if not docs or not docs[0].get("address"):
        step.ok, step.failure, step.note = False, "데이터 없음", "documents[0].address 없음"
        return rep
    doc = docs[0]
    addr = doc["address"]
    b_code = addr.get("b_code", "")
    bun = (addr.get("main_address_no") or "0").zfill(4)
    ji = (addr.get("sub_address_no") or "0").zfill(4)
    plat_gb = "1" if addr.get("mountain_yn") == "Y" else "0"
    rep.checks["지번 주소"] = addr.get("address_name")
    rep.checks["건물명"] = (doc.get("road_address") or {}).get("building_name")
    rep.checks["b_code / 산 / 본번 / 부번"] = f"{b_code} / {addr.get('mountain_yn')} / {bun} / {ji}"
    rep.checks["좌표(x,y)"] = f"{doc.get('x')}, {doc.get('y')}"
    step.note = f"documents={len(docs)}"
    if len(b_code) != 10:
        step.ok, step.failure = False, "데이터 없음"
        step.note += f", b_code 길이 {len(b_code)}"
        return rep

    bld_params = {
        "serviceKey": get_key("DATA_GO_KR_KEY"),
        "sigunguCd": b_code[:5],
        "bjdongCd": b_code[5:],
        "platGbCd": plat_gb,
        "bun": bun,
        "ji": ji,
        "_type": "json",
        "numOfRows": "100",
        "pageNo": "1",
    }

    # ── 2) 표제부 ──
    step, resp = call("건축HUB 표제부 getBrTitleInfo", f"{BLD_BASE}/getBrTitleInfo", params=bld_params)
    rep.steps.append(step)
    title_items: list[dict] = []
    if resp is not None:
        rep.saved.append(save("building_title.json", resp))
        if step.ok:
            title_items = _datagokr_items(step, resp)
    if title_items:
        rep.checks["표제부 주용도"] = [
            f"{t.get('bldNm') or '(건물명 없음)'} {t.get('dongNm') or ''}: "
            f"{t.get('mainPurpsCdNm')} / 기타 {t.get('etcPurps')}" for t in title_items]
        rep.checks["표제부 필드"] = ", ".join(all_keys(title_items))

    # ── 3) 층별개요 ──
    step, resp = call("건축HUB 층별개요 getBrFlrOulnInfo", f"{BLD_BASE}/getBrFlrOulnInfo", params=bld_params)
    rep.steps.append(step)
    floor_items: list[dict] = []
    if resp is not None:
        rep.saved.append(save("building_floor.json", resp))
        if step.ok:
            floor_items = _datagokr_items(step, resp)
    if floor_items:
        # 부속건축물(주차타워 등)도 flrGbCdNm=지상, flrNo=1 로 올 수 있어 주건축물만 거른다
        first = [f for f in floor_items
                 if str(f.get("flrNo")) == "1" and f.get("flrGbCdNm") == "지상"
                 and f.get("mainAtchGbCdNm") == "주건축물"]
        rep.checks["1층 행 수"] = len(first)
        rep.checks["1층 용도·면적"] = [
            f"{f.get('flrNoNm')}: {f.get('mainPurpsCdNm')} / 기타 {f.get('etcPurps')} / {f.get('area')}㎡"
            for f in first] or "1층 행 없음 (flrNo·flrGbCdNm 값 확인 필요)"
        rep.checks["층별개요 필드"] = ", ".join(all_keys(floor_items))

    # ── 4) 지역지구구역 ──
    step, resp = call("건축HUB 지역지구구역 getBrJijiguInfo", f"{BLD_BASE}/getBrJijiguInfo", params=bld_params)
    rep.steps.append(step)
    jijigu_items: list[dict] = []
    if resp is not None:
        rep.saved.append(save("building_jijigu.json", resp))
        if step.ok:
            jijigu_items = _datagokr_items(step, resp)
    if jijigu_items:
        rep.checks["지역지구구역"] = [
            f"{j.get('jijiguGbCdNm')}: {j.get('jijiguCdNm')} {j.get('etcJijigu') or ''}".strip()
            for j in jijigu_items]
        rep.checks["지역지구구역 필드"] = ", ".join(all_keys(jijigu_items))

    # ── 5) "위반" 필드 탐색 ──
    hits = find_fields({"title": title_items, "floor": floor_items, "jijigu": jijigu_items},
                       VIOLATION_NEEDLES)
    rep.checks["'위반'·'viol' 포함 필드/값"] = hits or "없음"
    return rep


if __name__ == "__main__":
    run().print()
