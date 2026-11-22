"""4. 카카오 카테고리로 장소 검색 — 시연 주소 반경 300m 카페(CE7).

출처: https://developers.kakao.com/docs/latest/ko/local/dev-guide
  GET https://dapi.kakao.com/v2/local/search/category.json
  category_group_code(필수), x, y, radius(0~20000m), page(1~45), size(1~15, 기본 15), sort(distance|accuracy)
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import ProbeReport, Step, call, get_key, parse_json, require_keys, save  # noqa: E402

DEMO_ADDRESS = "서울 성동구 성수이로 113"
ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
NEED = ("place_name", "distance", "x", "y", "place_url")


def run() -> ProbeReport:
    rep = ProbeReport(api="카카오 카테고리 검색 (CE7 카페, 반경 300m)")
    if require_keys("KAKAO_REST_KEY"):
        rep.steps.append(Step(name="키 확인", failure="키·승인·IP", note=".env에 KAKAO_REST_KEY 없음"))
        return rep
    headers = {"Authorization": f"KakaoAK {get_key('KAKAO_REST_KEY')}"}

    step, resp = call("카카오 주소 검색 (좌표)", ADDRESS_URL, params={"query": DEMO_ADDRESS}, headers=headers)
    rep.steps.append(step)
    docs = (parse_json(resp) or {}).get("documents", []) if resp is not None and step.ok else []
    if not docs:
        return rep
    x, y = docs[0]["x"], docs[0]["y"]

    places: list[dict] = []
    meta: dict = {}
    for page in (1, 2, 3, 4):
        step, resp = call(f"카테고리 검색 page={page}", CATEGORY_URL, headers=headers, params={
            "category_group_code": "CE7", "x": x, "y": y, "radius": "300",
            "sort": "distance", "size": "15", "page": str(page)})
        rep.steps.append(step)
        if resp is None or not step.ok:
            break
        data = parse_json(resp) or {}
        if page == 1:
            rep.saved.append(save("kakao_category_ce7.json", resp))  # phone 은 [가림] 처리
        docs = data.get("documents", [])
        meta = data.get("meta", {})
        places += docs
        step.note = f"documents={len(docs)}, is_end={meta.get('is_end')}"
        if meta.get("is_end"):
            break

    rep.checks["meta (마지막 페이지)"] = meta
    rep.checks["받은 카페 수 (전체 페이지)"] = len(places)
    if places:
        rep.checks["필요 필드 유무"] = {k: all(p.get(k) for p in places) for k in NEED}
        rep.checks["응답 필드"] = ", ".join(places[0].keys())
        rep.checks["가까운 3곳"] = [f"{p['place_name']} {p.get('distance')}m" for p in places[:3]]
    return rep


if __name__ == "__main__":
    run().print()
