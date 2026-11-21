"""건축물대장 용도 코드 처리와 대상 공간 확정 (기존 건물 용도 판정 규칙의 입력을 만든다).

- 용도 코드는 공식 주용도코드표(rules/data/building_use_codes.json)로만 대분류에 매핑한다.
  대분류는 상위코드를 따라 '00000' 바로 아래까지 올라가 정한다. 같은 이름이 여러 대분류에 있어(예: 휴게음식점 03002·04002)
  이름이나 코드 앞자리로 대분류를 추정하지 않는다. 코드 없음·미등록·이름 충돌이면 분류하지 않는다.
- 대상 공간: 호실이 입력되고 전유부(전유공용면적) 응답의 동·층·호가 하나의 전유 공간으로 맞으면 그 호실로 확정한다.
  호실을 특정하지 못하면 같은 층의 주건축물 행 전체를 후보로 두고, 후보마다 규칙표를 돌려 결과가 모두 같을 때만 판정 입력으로 쓴다.
  층 전체의 첫 행이나 가장 흔한 용도를 대상 호실의 용도로 보지 않는다.
- 판정(규칙표·AI 검증·high 허용 조건)은 바꾸지 않는다. 여기서는 그 판정에 넘길 용도 목록(floor_uses)만 정한다.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

CODES_PATH = Path(__file__).resolve().parent / "data" / "building_use_codes.json"
ROOT = "00000"
SPACE_SCHEMA = 2  # 건물 조회 결과(캐시 포함)의 형식 버전. 이 값이 없는 옛 결과는 새 매핑을 우회하지 못하게 쓰지 않는다

# 대상 공간 상태
UNIT_MATCHED = "unit_matched"          # 전유부의 동·층·호가 하나의 전유 공간으로 확인됨
UNIT_AMBIGUOUS = "unit_ambiguous"      # 같은 호 이름의 전유 공간이 여러 개 (동·건물이 다름)
UNIT_MISMATCH = "unit_mismatch"        # 그 호실이 있지만 입력한 층·동과 맞지 않음
FLOOR = "floor"                        # 호실을 특정하지 못해 같은 층의 후보 전체로 판단
FLOOR_MISSING = "floor_missing"        # 층·호 입력에 층이 없음
FLOOR_NOT_FOUND = "floor_not_found"    # 대장에 그 층의 주건축물 행이 없음
BUILDING_AMBIGUOUS = "building_ambiguous"  # 같은 층에 건물(관리번호)이 여러 개

BUILDING_IDENTIFIED = {UNIT_MATCHED, UNIT_MISMATCH, FLOOR}  # 후보가 한 건물로 모이면 대상 건물은 확인됨

# 코드 분류 상태
MAPPED, MISSING_CODE, UNKNOWN_CODE, NAME_MISMATCH = "mapped", "missing_code", "unknown_code", "name_mismatch"


@lru_cache(maxsize=1)
def _table() -> dict[str, dict]:
    return json.loads(CODES_PATH.read_text(encoding="utf-8"))["codes"]


def _strip_group(label: str) -> str:
    """'휴게음식점(03)' → '휴게음식점' (코드표 이름 끝의 대분류 표기만 뗀다)."""
    return re.sub(r"\([0-9A-Z]{2}\)$", "", label or "").strip()


def _squash(text: str | None) -> str:
    return re.sub(r"\s+", "", text or "")


def category_of(code: str) -> tuple[str, str] | None:
    """코드 → (대분류 코드, 대분류 이름). 표에 없거나 상위 연결이 끊기면 None."""
    table, seen = _table(), set()
    current = code
    while current in table and current not in seen:
        seen.add(current)
        parent = table[current]["parent"]
        if parent == ROOT:
            return current, _strip_group(table[current]["label"])
        current = parent
    return None


def classify(code: str | None, name: str | None) -> dict:
    """원본 용도 코드·이름을 공식 코드표로 분류한다. 확인된 매핑만 category 를 채운다."""
    code = (code or "").strip()
    out = {"code": code or None, "name": (name or "").strip() or None, "status": MAPPED,
           "category_code": None, "category": None}
    if not code:
        out["status"] = MISSING_CODE
        return out
    entry = _table().get(code)
    if entry is None:
        out["status"] = UNKNOWN_CODE
        return out
    if name and _squash(_strip_group(entry["label"])) != _squash(name):
        out["status"] = NAME_MISMATCH  # 코드와 용도명이 서로 다르면 둘 다 믿지 않는다
        return out
    top = category_of(code)
    if top is None:
        out["status"] = UNKNOWN_CODE
        return out
    out["category_code"], out["category"] = top
    return out


def use_label(c: dict) -> str:
    """규칙표·AI 에 넘기는 용도 문자열. 대분류가 앞에 와서 기존 normalize_use 가 그대로 읽는다."""
    return f"{c['category']} ({c['name'] or '-'}, {c['code']})"


# ---------- 층·호 입력 ----------

_FLOOR_RE = re.compile(r"(지하\s*|B\s*)?(\d+)\s*층", re.I)
_HO_RE = re.compile(r"([A-Za-z]*\d+[A-Za-z0-9-]*)\s*호")
_DONG_RE = re.compile(r"([A-Za-z0-9가-힣]+?)\s*동(?![가-힣])")


def parse_detail(detail: str | None) -> dict:
    """'1층 R126호', '지하1층', '2층 A동 201호' → {floor, underground, ho, dong}. 없는 값은 None."""
    text = detail or ""
    floor = _FLOOR_RE.search(text)
    ho = _HO_RE.search(text)
    dong = _DONG_RE.search(_FLOOR_RE.sub(" ", _HO_RE.sub(" ", text)))
    return {"floor": floor.group(2) if floor else None, "underground": bool(floor and floor.group(1)),
            "ho": ho.group(1).upper() if ho else None, "dong": dong.group(1) if dong else None}


def _norm_dong(value: str | None) -> str:
    return re.sub(r"동$", "", _squash(value)).upper()


def _floor_match(row: dict, detail: dict) -> bool:
    return (str(row.get("flrNo")) == detail["floor"]
            and row.get("flrGbCdNm") == ("지하" if detail["underground"] else "지상"))


def _main(row: dict) -> bool:
    return str(row.get("mainAtchGbCd", "")) == "0" or row.get("mainAtchGbCdNm") == "주건축물"


def _building_id(row: dict):
    return row.get("mgmBldrgstPk") or row.get("bldrgstSeqno") or _squash(row.get("dongNm")) or None


ROW_KEYS = ("dongNm", "hoNm", "flrGbCd", "flrGbCdNm", "flrNo", "flrNoNm", "mainAtchGbCd", "mainAtchGbCdNm",
            "exposPubuseGbCd", "exposPubuseGbCdNm", "mainPurpsCd", "mainPurpsCdNm", "etcPurps", "area",
            "mgmBldrgstPk", "regstrGbCdNm")


def keep_row(row: dict) -> dict:
    """원본 행에서 판정·근거에 쓰는 필드만 그대로 보존한다 (주소 문자열 등은 남기지 않는다)."""
    return {k: row.get(k) for k in ROW_KEYS if k in row}


def _candidate(row: dict, source: str) -> dict:
    c = classify(row.get("mainPurpsCd"), row.get("mainPurpsCdNm"))
    return {**c, "source": source, "dong": (row.get("dongNm") or "").strip() or None,
            "ho": (row.get("hoNm") or "").strip() or None, "floor": row.get("flrNoNm") or row.get("flrNo"),
            "area": row.get("area"), "etc": row.get("etcPurps"), "building_id": _building_id(row)}


def resolve_space(floor_rows: list[dict], unit_rows: list[dict] | None, detail: dict) -> dict:
    """대상 공간을 정한다. unit_rows 는 호실을 넣어 조회한 전유공용면적 응답(조회 안 했으면 None)."""
    space = {"status": None, "scope": None, "detail": detail, "candidates": [], "note": None}
    if not detail.get("floor"):
        space["status"] = FLOOR_MISSING
        return space

    if detail.get("ho") and unit_rows is not None:
        named = [r for r in unit_rows if str(r.get("exposPubuseGbCd")) == "1"
                 and _squash(r.get("hoNm")).upper() == detail["ho"] and _main(r)]
        if detail.get("dong"):
            named = [r for r in named if _norm_dong(r.get("dongNm")) == _norm_dong(detail["dong"])]
        on_floor = [r for r in named if _floor_match(r, detail)]
        units = {(_building_id(r), _squash(r.get("dongNm")), _squash(r.get("hoNm")).upper()) for r in on_floor}
        if len(units) == 1:
            space.update(status=UNIT_MATCHED, scope="unit", candidates=[_candidate(r, "전유부") for r in on_floor])
            return space
        if len(units) > 1:
            space.update(status=UNIT_AMBIGUOUS, scope="unit", candidates=[_candidate(r, "전유부") for r in on_floor])
            return space
        if named:  # 그 호실은 있지만 입력한 층(또는 동)과 다르다
            space.update(status=UNIT_MISMATCH, scope="unit", candidates=[_candidate(r, "전유부") for r in named])
            return space
        space["note"] = "unit_not_found"  # 전유부에 그 호실이 없다 (일반건축물이거나 호 이름이 다름) → 층 후보로 판단

    rows = [r for r in floor_rows if _floor_match(r, detail) and _main(r)]
    if not rows:
        space["status"] = FLOOR_NOT_FOUND
        return space
    if len({_building_id(r) for r in rows}) > 1:
        space.update(status=BUILDING_AMBIGUOUS, scope="floor", candidates=[_candidate(r, "층별개요") for r in rows])
        return space
    space.update(status=FLOOR, scope="floor", candidates=[_candidate(r, "층별개요") for r in rows])
    return space


# ---------- 판정 입력 ----------

@dataclass
class BuildingInput:
    uses: list[str] | None          # 규칙표·AI 에 넘길 용도. None 이면 판정하지 않는다 (unknown)
    scope: str                      # unit | floor | legacy
    status: str
    reason: str | None = None       # uses 가 None 일 때 화면에 보일 이유와 안내
    scope_text: str = ""            # 근거에 남길 판단 범위
    candidates: list[str] = field(default_factory=list)  # 근거에 남길 후보 전체


def _cand_text(c: dict) -> str:
    where = " ".join(x for x in (c.get("dong"), f"{c['ho']}호" if c.get("ho") else None) if x)
    use = use_label(c) if c["status"] == MAPPED else f"{c.get('name') or '용도명 없음'} (코드 {c.get('code') or '없음'}, {_STATUS_TEXT[c['status']]})"
    return f"{where + ' ' if where else ''}{use}"


_STATUS_TEXT = {MISSING_CODE: "코드 없음", UNKNOWN_CODE: "코드표에 없는 코드", NAME_MISMATCH: "코드와 용도명 불일치", MAPPED: "확인됨"}


def _floor_text(detail: dict) -> str:
    return f"{'지하' if detail.get('underground') else ''}{detail.get('floor')}층"


def building_input(pack: dict, business_type: str | None, data: dict | None) -> BuildingInput:
    """건물 조회 결과 → 기존 규칙표·AI 판정에 넘길 입력. 대상 공간이 정해지지 않으면 uses=None."""
    from rules.engine import judge_building_use

    data = data or {}
    space = data.get("space")
    if space is None:  # 모의 응답·테스트 대역의 옛 형식 (실제 조회 결과는 항상 space 가 있다)
        return BuildingInput(uses=list(data.get("floor_uses") or []), scope="legacy", status="legacy")

    detail = space.get("detail") or {}
    cands = space.get("candidates") or []
    texts = [_cand_text(c) for c in cands]
    status = space.get("status")
    floor = _floor_text(detail) if detail.get("floor") else "층 미입력"
    ho = f" {detail['ho']}호" if detail.get("ho") else ""

    def unknown(reason: str, scope_text: str) -> BuildingInput:
        return BuildingInput(uses=None, scope=space.get("scope") or "floor", status=status, reason=reason,
                             scope_text=scope_text, candidates=texts)

    if status == FLOOR_MISSING:
        return unknown("층·호 정보가 없어 건축물대장에서 가게 공간의 용도를 찾지 못했어요. 마이페이지에서 층·호를 입력해 주세요.",
                       "층 미입력")
    if status == FLOOR_NOT_FOUND:
        return unknown(f"건축물대장에서 {floor}의 용도를 찾지 못했어요. 층·호가 맞는지 확인하고 구청 건축과에 문의해 주세요.",
                       f"{floor} 행 없음")
    if status == BUILDING_AMBIGUOUS:
        return unknown(f"같은 주소에 건물이 여러 동이라 {floor}이 어느 건물인지 정할 수 없어요. 동·호를 입력하거나 구청 건축과에 확인해 주세요.",
                       f"{floor} · 건물 여러 동")
    if status == UNIT_AMBIGUOUS:
        return unknown(f"건축물대장 전유부에 {detail.get('ho')}호가 여러 곳 있어 어느 공간인지 정할 수 없어요. 동을 함께 입력하거나 구청 건축과에 확인해 주세요.",
                       f"{floor}{ho} · 전유부 후보 여러 곳")
    if status == UNIT_MISMATCH:
        return unknown(f"건축물대장 전유부의 {detail.get('ho')}호가 입력한 {floor}과 맞지 않아요. 층·호를 다시 확인해 주세요.",
                       f"{floor}{ho} · 전유부와 층 불일치")

    if status == UNIT_MATCHED:
        scope_text = f"{floor}{ho} · 전유부에서 호실 확인"
    else:
        note = " (전유부에 이 호실 정보 없음)" if space.get("note") == "unit_not_found" else ""
        scope_text = f"{floor} 전체 후보 {len(cands)}곳 · 호실 미확인{note}"

    unclassified = [c for c in cands if c["status"] != MAPPED]
    if unclassified:
        return unknown("건축물대장 용도 코드를 공식 코드표로 확인할 수 없는 공간이 있어요 ("
                       + ", ".join(_cand_text(c) for c in unclassified)
                       + "). 구청 건축과에서 이 공간의 용도를 확인해 주세요.", scope_text)

    labels = list(dict.fromkeys(use_label(c) for c in cands))
    if business_type is not None and len(labels) > 1:
        verdicts = {judge_building_use(pack, business_type, [label]).verdict for label in labels}
        if len(verdicts) > 1:
            cats = ", ".join(dict.fromkeys(c["category"] for c in cands))
            return unknown(f"{floor}에 용도가 다른 공간({cats})이 있어 어느 호실인지에 따라 판정이 달라져요. "
                           "층·호를 함께 입력하거나 건축물대장 전유부(호실별 용도)를 확인해 주세요.", scope_text)
    return BuildingInput(uses=labels, scope=space.get("scope") or "floor", status=status,
                         scope_text=scope_text, candidates=texts)


def building_identified(data: dict | None) -> bool:
    """위반건축물 같은 건물 단위 항목을 판정할 대상 건물이 하나로 확인됐는지 (옛 형식은 기존대로 본다).
    용도가 섞여 건물 용도를 판정하지 못해도, 후보가 모두 같은 건물(관리번호)이면 건물은 확인된 것으로 본다."""
    space = (data or {}).get("space")
    if space is None:
        return True
    ids = {c.get("building_id") for c in space.get("candidates") or []}
    return space.get("status") in BUILDING_IDENTIFIED and len(ids) == 1 and None not in ids
