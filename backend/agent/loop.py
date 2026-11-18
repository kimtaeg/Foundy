"""분석 실행: 조회 → 규칙 판정 → AI 판정 → 결과 카드 → 개업 체크리스트.

순서가 고정된 파이프라인이다 (AI가 도구를 마음대로 고르지 않는다). 날짜·금액 계산은 calc,
업종·건물 용도 판정은 규칙 묶음, 해석·설명·초안만 LLM이 한다.
조회 도구가 실패해도 예외를 내지 않고 해당 항목을 unknown으로 둔 채 끝까지 진행한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from rules.engine import (
    base_checklist, check_spec, derive_business_type, judge_building_use, load_pack, render_title,
)

from .advise import Counters, advise_item
from .guardrails import enforce
from .judge import judge_ad_claims, judge_trademark
from .llm import LLM
from .ports import Calc, Emit, StoreInput, ToolResult, Tools
from .schemas import ChecklistItem, Evidence, ReportItem


@dataclass
class AnalysisResult:
    business_type: str | None
    items: list[ReportItem]
    checklist: list[ChecklistItem]
    summary: dict
    cost_krw: float = 0.0
    guardrail_changes: list[str] = field(default_factory=list)


def _safe(source: str, fn, *args) -> ToolResult:
    """조회 도구가 예외를 던져도 분석을 멈추지 않는다."""
    try:
        return fn(*args)
    except Exception as e:  # noqa: BLE001 - 어떤 실패든 unknown으로 처리
        return ToolResult(ok=False, source=source, error=str(e))


def _status(res: ToolResult) -> str:
    if not res.ok:
        return "failed"
    return "fallback" if (res.from_mock or res.from_cache) else "done"


def _data_ev(res: ToolResult, value: str) -> Evidence:
    return Evidence(type="data", source=res.source, value=value, fetched_at=res.fetched_at,
                    from_cache=res.from_cache, from_mock=res.from_mock)


def _law_ev(res: ToolResult) -> list[Evidence]:
    if not res.ok or not res.data:
        return []
    return [
        Evidence(type="law", source=res.source, law_name=a.get("law_name"), article=a.get("article"),
                 text=a.get("text"), url=a.get("url"), fetched_at=res.fetched_at,
                 from_cache=res.from_cache, from_mock=res.from_mock)
        for a in res.data.get("articles", [])
    ]


def run_analysis(
    store: StoreInput, *, tools: Tools, calc: Calc, llm: LLM, pack: dict | None = None,
    emit: Emit | None = None,
) -> AnalysisResult:
    pack = pack or load_pack("cafe_restaurant")
    emit = emit or (lambda event, data: None)
    business_type = derive_business_type(pack, store.answers)
    counters = Counters()

    def step(name: str, status: str, message: str, **extra) -> None:
        emit("step", {"step": name, "status": status, "message": message, **extra})

    # 1. 조회
    step("building", "running", "건축물대장 조회 중")
    b = _safe("건축물대장", tools.building, store)
    uses = (b.data or {}).get("floor_uses", []) if b.ok else []
    step("building", _status(b),
         f"이 층 용도: {', '.join(uses)}" if uses else ("건축물대장 조회 실패" if not b.ok else "이 층 용도 정보 없음"),
         source=b.source)

    step("trademark", "running", "상표 검색 중")
    t = _safe("KIPRIS", tools.trademark, store.name)
    n_sim = len((t.data or {}).get("similar", [])) if t.ok else 0
    step("trademark", _status(t), f"비슷한 상표 {n_sim}건" if t.ok else "상표 조회 실패", source=t.source)

    # 2. 규칙 판정 + AI 판정 (점검 항목 순서는 규칙 묶음의 순서)
    laws = {cid: _safe("국가법령정보", tools.law, cid) for cid in ("building_use", "alcohol_vs_type")}
    law_statuses = [_status(r) for r in laws.values()]
    step("law", "failed" if all(s == "failed" for s in law_statuses)
         else ("fallback" if any(s != "done" for s in law_statuses) else "done"),
         "조문 조회 완료" if "failed" not in law_statuses else "일부 조문을 조회하지 못했어요")

    step("rules", "running", "규칙 판정 중")
    drafts: list[tuple[ReportItem, dict]] = []  # (항목, 선택지 만들 때 쓰는 부가 정보)

    def new_id() -> str:
        return f"r-{len(drafts) + 1:02d}"

    for spec in pack["checks"]:
        cid = spec["id"]
        if cid == "building_use":
            rr = judge_building_use(pack, business_type, uses)
            ev = ([_data_ev(b, ", ".join(uses))] if uses else []) + _law_ev(laws[cid])
            title = render_title(spec, rr.verdict, business_type=business_type) or rr.reason
            drafts.append((ReportItem(item_id=new_id(), check_id=cid, stage=spec["stage"], title=title,
                                      verdict=rr.verdict, decided_by="rule", reason=rr.reason, evidence=ev),
                           {"floor_uses": uses}))
        elif cid == "building_violation":
            violation = (b.data or {}).get("violation") if b.ok else None
            if violation is True:
                v, reason, ev = "high", "건축물대장에 위반건축물로 표기돼 있어요.", [_data_ev(b, "위반건축물 표기 있음")]
            elif violation is False:
                v, reason, ev = "ok", "건축물대장에 위반건축물 표기가 없어요.", [_data_ev(b, "위반건축물 표기 없음")]
            else:
                v = "unknown"
                reason = ("건축물대장 응답에 위반건축물 표기 정보가 없어요." if b.ok
                          else "건축물대장을 조회하지 못했어요.")
                ev = [_data_ev(b, "위반건축물 표기 정보 없음")] if b.ok else []
            drafts.append((ReportItem(item_id=new_id(), check_id=cid, stage=spec["stage"],
                                      title=render_title(spec, v) or reason, verdict=v, decided_by="rule",
                                      reason=reason, evidence=ev), {}))
        elif cid == "alcohol_vs_type":
            ev = _law_ev(laws[cid])
            if store.answers.get("sells_alcohol") is True and business_type == "일반음식점" and ev:
                drafts.append((ReportItem(
                    item_id=new_id(), check_id=cid, stage=spec["stage"], title=render_title(spec, "ok") or "",
                    verdict="ok", decided_by="rule", reason="술을 팔 계획이라 일반음식점으로 신고하면 돼요.",
                    evidence=ev), {}))
    step("rules", "done", "규칙 판정 완료")

    step("interpret", "running", "AI 판정 중")
    for spec in pack["checks"]:
        if spec["id"] == "trademark_similar":
            drafts.append(judge_trademark(llm, store, t, spec, new_id()))
        elif spec["id"] == "ad_claims":
            item = judge_ad_claims(llm, store, spec, new_id())
            if item:
                drafts.append((item, {}))
    step("interpret", "done", "AI 판정 완료")

    # 3. 결과 카드 (선택지·추천·대신 만든 결과물)
    step("advise", "running", "해결 방안 만드는 중")
    items: list[ReportItem] = []
    changes: list[str] = []
    for item, extras in drafts:
        spec = check_spec(pack, item.check_id)
        if item.verdict != "ok":
            item = advise_item(llm, pack, store, item, spec, extras, business_type, calc, counters)
        item, c = enforce(item, allowed_remedies=spec.get("remedies"))
        changes += [f"{item.item_id}: {x}" for x in c]
        items.append(item)
    step("advise", "done", "해결 방안 준비 완료")

    # 4. 개업 체크리스트 (날짜는 계산 도구)
    step("checklist", "running", "개업 체크리스트 만드는 중")
    checklist: list[ChecklistItem] = []
    for i, base in enumerate(base_checklist(pack, store.answers), 1):
        d = calc.checklist_dates(store.opening_date, base["week"])
        checklist.append(ChecklistItem(
            item_id=f"c-{i:02d}", task=base["task"], category=base["category"],
            due_date=d["due_date"], dday=d["dday"], group_label=d["group_label"], source="rule"))
    for idx, item in enumerate(items):
        task = check_spec(pack, item.check_id).get("checklist_task")
        if item.verdict == "ok" or not task:
            continue
        target = next((c for c in checklist if c.task == task), None)
        if target:
            if target.report_item_id is None:
                target.report_item_id = item.item_id
            items[idx] = item.model_copy(update={"added_to_checklist": [target.item_id]})
    step("checklist", "done", f"체크리스트 {len(checklist)}개 항목")

    summary = {k: sum(1 for i in items if i.verdict == k) for k in ("high", "low", "unknown", "ok")}
    for item in items:
        emit("item", {"check_id": item.check_id, "verdict": item.verdict, "decided_by": item.decided_by,
                      "title": item.title, "has_options": bool(item.options)})
    cost_krw = getattr(getattr(llm, "cost", None), "total_krw", 0.0)
    emit("done", {"summary": summary, "cost_krw": cost_krw})
    return AnalysisResult(business_type, items, checklist, summary, cost_krw, changes)
