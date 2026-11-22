"""2. 국가법령정보 OPEN API (법제처).

출처 (open.law.go.kr 활용가이드)
- 법령 목록:   guideResult.do?htmlName=lsNwListGuide   lawSearch.do  target=law
- 법령 본문:   guideResult.do?htmlName=lsNwInfoGuide   lawService.do target=law,      ID|MST, JO(6자리)
- 조항호목:    guideResult.do?htmlName=lsNwJoListGuide lawService.do target=lawjosub, ID|MST, JO 필수
- 별표서식 목록: guideResult.do?htmlName=lsBylListGuide lawSearch.do  target=licbyl, search=2(해당법령검색), knd=1(별표)

가이드 예시 주소는 http://www.law.go.kr/DRF/ 이다. OC가 평문으로 가지 않도록 https를 먼저 시도하고,
안 되면 http로 한 번 더 시도한 뒤 어느 쪽이 됐는지 기록한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import ProbeReport, Step, call, get_key, parse_json, require_keys, save  # noqa: E402

HOSTS = ["https://www.law.go.kr/DRF", "http://www.law.go.kr/DRF"]
LAW_NAME = "식품위생법"
ARTICLE_JO = "003700"          # 제37조
BYL_LAW_NAME = "건축법 시행령"

# 미등록 IP·OC 오류는 200 + 안내 문구로 오는 경우가 있어 본문으로도 판별한다
AUTH_HINTS = ("사용자 정보 검증에 실패", "미신청된 목록", "OPEN API 호출 시 사용자 검증", "IP", "등록되지 않은")


def _law_call(name: str, path: str, params: dict) -> tuple[Step, object | None, str]:
    """https → http 순서로 호출. (step, json 또는 None, 사용한 host)"""
    last: tuple[Step, object | None, str] | None = None
    for host in HOSTS:
        step, resp = call(f"{name} ({host.split(':')[0]})", f"{host}/{path}", params=params)
        if resp is None or not step.ok:
            last = (step, None, host)
            continue
        data = parse_json(resp)
        if data is None:
            text = resp.text
            if any(h in text for h in AUTH_HINTS):
                step.ok, step.failure = False, "키·승인·IP"
                step.note = "JSON 대신 안내문: " + " ".join(text.split())[:120]
            else:
                step.ok, step.failure = False, "코드·파라미터"
                step.note = "JSON 아님: " + " ".join(text.split())[:120]
            last = (step, None, host)
            continue
        step.resp = resp  # type: ignore[attr-defined]
        return step, data, host
    assert last is not None
    return last


def _as_list(v) -> list:
    return v if isinstance(v, list) else [v] if v else []


def run() -> ProbeReport:
    rep = ProbeReport(api="국가법령정보 (법제처)")
    if require_keys("LAW_OC"):
        rep.steps.append(Step(name="키 확인", failure="키·승인·IP", note=".env에 LAW_OC 없음"))
        return rep
    oc = get_key("LAW_OC")

    # ── 1) 목록 조회: 식품위생법 → 법령ID, MST ──
    step, data, host = _law_call("법령 목록 lawSearch target=law", "lawSearch.do",
                                 {"OC": oc, "target": "law", "type": "JSON", "query": LAW_NAME})
    rep.steps.append(step)
    if data is None:
        return rep
    rep.saved.append(save("law_search.json", step.resp))  # type: ignore[attr-defined]
    rep.checks["사용한 주소"] = host
    laws = _as_list((data.get("LawSearch") or {}).get("law"))
    rep.checks["목록 응답 최상위 키"] = list(data.keys())
    exact = [l for l in laws if l.get("법령명한글") == LAW_NAME]
    step.note = f"결과 {len(laws)}건, 이름 일치 {len(exact)}건"
    if not exact:
        step.failure = "데이터 없음"
        return rep
    law = exact[0]
    law_id, mst = law.get("법령ID"), law.get("법령일련번호")
    rep.checks["식품위생법 법령ID / MST(법령일련번호)"] = f"{law_id} / {mst}"
    rep.checks["시행일자 / 법령상세링크"] = f"{law.get('시행일자')} / {law.get('법령상세링크')}"
    rep.checks["목록 항목 필드"] = ", ".join(law.keys())

    # ── 2) 본문 조회 ──
    step, data, _ = _law_call("법령 본문 lawService target=law", "lawService.do",
                              {"OC": oc, "target": "law", "type": "JSON", "ID": law_id})
    rep.steps.append(step)
    if data is not None:
        rep.saved.append(save("law_body.json", step.resp))  # type: ignore[attr-defined]
        root = data.get("법령") or {}
        units = _as_list((root.get("조문") or {}).get("조문단위"))
        art = [u for u in units if str(u.get("조문번호")) == "37" and u.get("조문여부") == "조문"]
        step.note = f"조문단위 {len(units)}개"
        rep.checks["본문 최상위 키"] = list(data.keys()) + [f"법령.{k}" for k in root.keys()]
        rep.checks["본문에서 제37조"] = (
            f"{art[0].get('조문제목')} / 항 {len(_as_list(art[0].get('항')))}개" if art else "못 찾음")
        if units:
            rep.checks["조문단위 필드"] = ", ".join(units[0].keys())

    # ── 3) 제37조만 조회 ──
    step, data, _ = _law_call("조문 단위 lawService target=lawjosub JO=003700", "lawService.do",
                              {"OC": oc, "target": "lawjosub", "type": "JSON", "ID": law_id, "JO": ARTICLE_JO})
    rep.steps.append(step)
    if data is not None:
        rep.saved.append(save("law_article37.json", step.resp))  # type: ignore[attr-defined]
        text = str(data)
        step.note = f"응답 {len(text)}자, '제37조' 포함={'제37조' in text}, '영업허가' 포함={'영업허가' in text}"
        rep.checks["조문 단위 최상위 키"] = list(data.keys())

    # ── 4) 건축법 시행령 별표 1 ──
    step, data, _ = _law_call("별표서식 목록 lawSearch target=licbyl", "lawSearch.do",
                              {"OC": oc, "target": "licbyl", "type": "JSON", "search": "2",
                               "query": BYL_LAW_NAME, "knd": "1", "display": "100"})
    rep.steps.append(step)
    if data is not None:
        rep.saved.append(save("law_byl_search.json", step.resp))  # type: ignore[attr-defined]
        root = next(iter(data.values()), {}) if isinstance(data, dict) else {}
        byls = _as_list(root.get("licbyl")) if isinstance(root, dict) else []
        # 관련법령명에 검색어 강조 태그(<strong class="tbl_tx_type">)가 섞여 온다
        target = [b for b in byls if _strip_tags(b.get("관련법령명", "")) == BYL_LAW_NAME
                  and str(b.get("별표번호", "")) == "000100"]
        step.note = f"결과 {len(byls)}건, 별표 1 후보 {len(target)}건"
        rep.checks["별표 응답 최상위 키"] = list(data.keys())
        if byls:
            rep.checks["별표 항목 필드"] = ", ".join(byls[0].keys())
        for b in target[:2]:
            rep.checks[f"별표 {b.get('별표번호')}"] = (
                f"{b.get('별표명')} | 파일 {b.get('별표서식파일링크')} | PDF {b.get('별표서식PDF파일링크')}")
        if not target:
            step.failure = "데이터 없음"
            return rep

        # ── 5) 별표 1 본문 텍스트: 건축법 시행령 본문 조회 응답의 별표 단위 ──
        byl_law_id = target[0].get("관련법령ID")
        step, data, _ = _law_call("건축법 시행령 본문 (별표내용 확인)", "lawService.do",
                                  {"OC": oc, "target": "law", "type": "JSON", "ID": byl_law_id})
        rep.steps.append(step)
        if data is not None:
            rep.saved.append(save("law_building_decree_body.json", step.resp))  # type: ignore[attr-defined]
            root = data.get("법령") or {}
            units = _as_list((root.get("별표") or {}).get("별표단위"))
            b1 = [u for u in units if str(u.get("별표번호")) == "0001" and u.get("별표구분") == "별표"]
            step.note = f"별표단위 {len(units)}개, 별표 1 {len(b1)}건"
            if units:
                rep.checks["별표단위 필드"] = ", ".join(units[0].keys())
            if b1:
                body = b1[0].get("별표내용")
                text = "".join(map(str, body)) if isinstance(body, list) else str(body or "")
                rep.checks["별표 1 본문"] = (
                    f"{len(text)}자, '휴게음식점' 포함={'휴게음식점' in text}, '일반음식점' 포함={'일반음식점' in text}")
            else:
                step.failure = "데이터 없음"
    return rep


def _strip_tags(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", s).strip()


if __name__ == "__main__":
    run().print()
