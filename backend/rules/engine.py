"""규칙 묶음(rules/packs/*.yaml)을 읽어 코드로 정할 수 있는 판정을 한다.

업종 구분과 건물 용도 적합 여부는 LLM에 맡기지 않고 여기서 정한다.
AI는 이 결과를 쉬운 말로 설명하고 선택지·초안을 만든다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from agent.schemas import Question

PACK_DIR = Path(__file__).parent / "packs"

_USE_RE = re.compile(r"제\s*([12])\s*종\s*근린\s*생활\s*시설")


@dataclass
class RuleResult:
    verdict: str  # high | ok | unknown
    reason: str
    facts: dict = field(default_factory=dict)


@lru_cache(maxsize=None)
def load_pack(name: str) -> dict:
    path = PACK_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"규칙 묶음이 없습니다: {name}")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def pending_questions(pack: dict, answers: dict) -> list[Question]:
    """아직 답이 없는 되묻기 후보. AI가 이 중에서 필요한 것을 고른다."""
    return [Question(**q) for q in pack["ask"] if answers.get(q["id"]) is None]


def derive_business_type(pack: dict, answers: dict) -> str | None:
    """신고 업종을 규칙으로 정한다. 근거가 되는 답이 없으면 None."""
    rule = pack["derive"]["business_type"]
    value = answers.get(rule["key"])
    if value is None:
        return None
    return rule["true"] if value else rule["false"]


def business_type_reason(pack: dict, answers: dict) -> str | None:
    bt = derive_business_type(pack, answers)
    if bt is None:
        return None
    return f"주류 판매 → {bt} (규칙)" if answers.get("sells_alcohol") else f"주류 미판매 → {bt} (규칙)"


def normalize_use(raw: str) -> str | None:
    """건축물대장의 용도 문자열에서 근린생활시설 종류를 뽑는다. 못 뽑으면 None."""
    m = _USE_RE.search(raw or "")
    return f"제{m.group(1)}종근린생활시설" if m else None


def judge_building_use(pack: dict, business_type: str | None, building_uses: list[str]) -> RuleResult:
    """신고 업종에 비해 건물 용도가 맞는지. 데이터가 없거나 규칙 밖 용도면 unknown."""
    rule = pack["building_use"]
    if business_type is None or business_type not in rule["allowed"]:
        return RuleResult("unknown", "신고 업종이 정해지지 않아 건물 용도를 판단할 수 없어요.")
    if not building_uses:
        return RuleResult("unknown", "건축물대장에서 이 층의 용도를 확인하지 못했어요.")

    normalized = [normalize_use(u) for u in building_uses]
    if any(n is None or n not in rule["known_uses"] for n in normalized):
        return RuleResult(
            "unknown",
            "이 건물의 용도가 규칙으로 판단할 수 있는 범위 밖이에요. 구청 건축과에서 확인이 필요해요.",
            {"building_uses": building_uses},
        )

    allowed = rule["allowed"][business_type]
    facts = {"business_type": business_type, "building_uses": normalized, "allowed": allowed}
    if any(n in allowed for n in normalized):
        return RuleResult("ok", f"이 건물 용도로 {business_type} 신고가 가능해요.", facts)
    return RuleResult(
        "high",
        f"{business_type}은(는) {' 또는 '.join(allowed)}에서만 가능한데, 이 건물은 {', '.join(normalized)}이에요.",
        facts,
    )


def area_limit_reason(pack: dict, business_type: str | None, building_uses: list[str], area_sqm: float | None) -> str | None:
    """이 업종이 이 건물 용도에서는 바닥면적 합계 제한이 있는데 기준 이상이거나 면적을 모르면 그 안내 문장을, 아니면 None.

    제한은 "같은 건축물에서 해당 용도로 쓰는 바닥면적 합계"라서 가게 면적만으로 위반을 단정하지 않는다 (호출한 쪽이 low 로 둔다).
    건물 용도에 다른 용도(제2종 등)가 섞여 있거나 못 읽는 용도가 있으면 적용하지 않는다.
    """
    limit = ((pack.get("building_use") or {}).get("area_limits") or {}).get(business_type or "")
    if not limit or not building_uses:
        return None
    if any(normalize_use(u) != limit["use"] for u in building_uses):
        return None
    below = limit["below_sqm"]
    base = (f"{limit['use']}의 {business_type}은(는) 같은 건축물에서 해당 용도로 쓰는 바닥면적 합계가 {below:g}㎡ 미만일 때만 가능해요 "
            f"({below:g}㎡ 이상이면 제2종 근린생활시설).")
    if area_sqm is None:
        return base + " 영업장 면적을 입력하지 않아 기준을 확인할 수 없어요. 구청 건축과에 확인해 보세요."
    if area_sqm >= below:
        return base + f" 이 가게 영업장 면적은 {area_sqm:g}㎡로 기준 이상이에요. 구청 건축과에 확인해 보세요."
    return None


def check_spec(pack: dict, check_id: str) -> dict:
    for c in pack["checks"]:
        if c["id"] == check_id:
            return c
    if check_id.startswith("law_found:"):  # 조문에서 찾은 의무 카드 (agent/discover.py). 공통 값만 있고 선택지·초안은 없다
        conf = ((pack.get("law_rag") or {}).get("discovery") or {}).get("check") or {}
        return {"id": check_id, "stage": conf.get("stage", "개업 전"), "contact": conf.get("contact"), "dynamic": True}
    raise KeyError(f"규칙 묶음에 없는 점검 항목: {check_id}")


def render_title(spec: dict, verdict: str, **fmt) -> str | None:
    """점검 항목의 판정별 제목 템플릿. 템플릿이 없으면 None."""
    tpl = (spec.get("titles") or {}).get(verdict)
    return tpl.format(**fmt) if tpl else None


def required_question_ids(pack: dict) -> set[str]:
    return {q["id"] for q in pack["ask"] if q.get("required")}


def base_checklist(pack: dict, answers: dict) -> list[dict]:
    """개업 체크리스트 기본 항목. when 조건이 있으면 답이 참일 때만 포함한다.

    날짜는 계산 도구(calc/dates.py)가 개업일 + offset_days로 계산하고, 시기(group)는 항목에 적힌 값을 쓴다.
    """
    items = []
    for it in pack["checklist"]:
        cond = it.get("when")
        if cond is not None and not answers.get(cond):
            continue
        items.append({k: v for k, v in it.items() if k != "when"})
    return items


def active_checks(pack: dict) -> list[dict]:
    """점검 항목 중 지금 만드는 것 (deferred: true는 마지막에 구현할 항목이라 건너뛴다)."""
    return [c for c in pack["checks"] if not c.get("deferred")]


def contact_of(pack: dict, key: str | None, sigungu: str | None = None) -> dict | None:
    """기관 연락처. 관할 구청은 시군구 코드의 번호를 쓰고, 표에 없는 지역은 fallback(110)으로 대체한다."""
    c = (pack.get("contacts") or {}).get(key or "")
    if not c:
        return None
    if "by_sigungu" in c:
        c = (c["by_sigungu"] or {}).get(str(sigungu or "")) or c["fallback"]
    return {"agency": c["agency"], "phone": c.get("phone"), "is_example": not c.get("verified", False),
            "tip": c.get("tip")}


def documents_of(pack: dict, task_id: str, sigungu: str | None = None) -> list[dict]:
    """체크리스트 항목의 필요 서류(받는 곳 안내). 링크는 sites의 검증된 첫 화면만 담는다."""
    out = []
    for d in (pack.get("documents") or {}).get(task_id, []):
        sites = pack.get("sites") or {}
        out.append({
            "doc_id": d["id"], "name": d["name"], "type": d.get("type", "reference"), "form": d.get("form"),
            "agency": d.get("agency", ""), "guide": d.get("guide", ""),
            "links": [{"label": sites[k]["label"], "url": sites[k]["url"]} for k in d.get("sites", []) if k in sites],
            "contact": contact_of(pack, d.get("contact"), sigungu),
        })
    return out


def call_questions(pack: dict, check_id: str, business_type: str | None) -> list[str]:
    """통화 준비 질문. {biz}는 신고 업종으로 채우고 모르면 [확인 필요]."""
    biz = business_type or "[확인 필요]"
    return [q.replace("{biz}", biz) for q in check_spec(pack, check_id).get("call_questions", [])]


def impact_of(pack: dict, changed_fields: list[str]) -> dict:
    """마이페이지에서 바꾼 필드 → 다시 할 일(run)과 초기화할 카드(reset). 규칙 묶음 impacts로 코드가 정한다."""
    run: list[str] = []
    reset: list[str] = []
    for f in changed_fields:
        rule = (pack.get("impacts") or {}).get(f)
        if not rule:
            continue
        run += [r for r in rule["run"] if r not in run]
        reset += [r for r in rule["reset"] if r not in reset]
    return {"run": run, "reset": reset}
