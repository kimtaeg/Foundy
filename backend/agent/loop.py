"""분석 실행: 조회 → 규칙 판정 → AI 판정 → 결과 카드 → 개업 체크리스트.

순서가 고정된 파이프라인이다 (AI가 도구를 마음대로 고르지 않는다). 날짜·금액 계산은 calc,
업종·건물 용도 판정은 규칙 묶음, 해석·설명·초안만 LLM이 한다.
조회 도구가 실패해도 예외를 내지 않고 해당 항목을 unknown으로 둔 채 끝까지 진행한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from calc.obligation_tasks import apply_obligations
from rules.applicability import APPLIES, NEEDS_CHECK, RuleOutcome, evaluate_rules, facts_of
from rules.building_use import building_input
from rules.engine import (
    active_checks, base_checklist, check_spec, contact_of, derive_business_type, documents_of,
    judge_building_use, load_pack, render_title,
)

from .advise import advise_item
from .grants import grant_checklist_items, judge_grants
from .guardrails import enforce
from .judge import (
    REAL_LAW_UNAVAILABLE, judge_ad_claims, judge_building_use_ai, judge_law_card, judge_trademark, judge_violation_ai,
)
from .llm import LLM, GuardedLLM
from .ports import Calc, Emit, StoreInput, ToolResult, Tools
from .schemas import ChecklistItem, Contact, Document, Evidence, GrantsResult, ReportItem, UserAction


@dataclass
class AnalysisResult:
    business_type: str | None
    items: list[ReportItem]
    checklist: list[ChecklistItem]
    summary: dict
    cost_krw: float = 0.0
    guardrail_changes: list[str] = field(default_factory=list)
    grants: GrantsResult | None = None
    # 실제 조회(또는 그 캐시)로 확인한 주소 코드. 모의 응답·조회 실패면 None (저장하지 않는다)
    address_codes: dict | None = None
    # 규칙 엔진이 이 가게에 대해 정한 법령 적용 결과 (적용·미적용·확인 필요). 화면 판정값과는 별개다
    obligations: list[RuleOutcome] = field(default_factory=list)
    # 이번 분석 범위인데 적용 규칙이 없어 카드를 만들지 않은 점검 (이전 분석에서 만든 같은 카드는 지운다)
    skipped_checks: list[str] = field(default_factory=list)


ADDRESS_CODE_KEYS = ("sigungu_cd", "bjdong_cd", "bun", "ji")


def resolved_address_codes(building: ToolResult) -> dict | None:
    """건축물대장 조회 결과에 실린 주소 코드. 모의 응답의 코드는 다른 주소의 값이라 쓰지 않는다."""
    if not building.ok or building.from_mock:
        return None
    codes = (building.data or {}).get("address_codes")
    if not isinstance(codes, dict) or not all(codes.get(k) for k in ADDRESS_CODE_KEYS):
        return None
    return codes


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


def _has_articles(res: ToolResult | None) -> bool:
    return bool(res and res.ok and any(a.get("text") for a in (res.data or {}).get("articles", [])))


def _ai_status(guarded: GuardedLLM, before: int, done_msg: str) -> tuple[str, str]:
    """AI 호출이 실패해 일부를 AI 없이 처리했으면 fallback으로 알린다."""
    if guarded.failures > before:
        return "fallback", "AI 응답이 불안정해 일부를 AI 없이 처리했어요"
    return "done", done_msg


def run_analysis(
    store: StoreInput, *, tools: Tools, calc: Calc, llm: LLM, pack: dict | None = None,
    emit: Emit | None = None, include_grants: bool = False, today: date | None = None,
    scope: list[str] | None = None,
) -> AnalysisResult:
    pack = pack or load_pack("cafe_restaurant")
    emit = emit or (lambda event, data: None)
    llm = guarded = GuardedLLM(llm)  # 연속 실패·시간 초과 시 남은 LLM 호출을 건너뛴다
    business_type = derive_business_type(pack, store.answers)
    selected = set(scope if scope is not None else ("building", "law", "trademark", "checklist"))
    all_checks = active_checks(pack)
    # 조문을 읽고 AI가 판정하는 점검 (law_card). 연결된 적용 규칙이 모두 미적용이면 카드를 만들지 않는다.
    obligations = evaluate_rules(pack, store, business_type)
    outcome_of = {o.rule_id: o for o in obligations}
    law_card_ids = [c["id"] for c in all_checks if c.get("law_card")]
    def _shown(check: dict) -> bool:
        """적용되거나 예외 때문에 확인이 필요한 규정이 있을 때만 카드를 만든다. 미적용이거나 입력이 없어 모르는 규정은 카드로 만들지 않는다
        (그 결과는 의무사항 목록에 남아 면적 같은 입력을 채우면 다시 판정된다)."""
        linked = [outcome_of[r] for r in check.get("rule_ids", []) if r in outcome_of]
        if not linked:
            return True
        return any(o.status == APPLIES or (o.status == NEEDS_CHECK and not o.missing_inputs) for o in linked)

    skipped_checks = {c["id"] for c in all_checks if c.get("law_card") and c.get("rule_ids") and not _shown(c)}
    check_ids = {
        "building": {"building_use", "building_violation"},
        "law": {"building_use", "permit_docs", *law_card_ids},
        "trademark": {"trademark_similar"},
        "checklist": set(),
    }
    affected = set().union(*(check_ids.get(name, set()) for name in selected))
    if selected == {"building", "law", "trademark", "checklist"}:
        affected = {c["id"] for c in all_checks}
    checks = [c for c in all_checks if c["id"] in affected and c["id"] not in skipped_checks]

    def step(name: str, status: str, message: str, **extra) -> None:
        emit("step", {"step": name, "status": status, "message": message, **extra})

    # 1. 조회
    b = ToolResult(ok=False, source="건축물대장", error="미실행")
    if "building" in selected:
        step("building", "running", "건축물대장 조회 중")
        b = _safe("건축물대장", tools.building, store)
        step("building", _status(b),
             ("캐시·예시 건축물 자료 사용" if b.from_cache or b.from_mock else "건축물대장 조회 완료")
             if b.ok else "건축물대장 조회 실패", source=b.source)
    elif "law" in selected and hasattr(tools, "cached_building"):
        b = _safe("건축물대장 캐시", tools.cached_building, store)
    address_codes = resolved_address_codes(b)
    if b.ok and b.from_mock and getattr(tools, "use_mock", None) is False:
        # 실제 모드에서 조회가 실패해 모의 응답(다른 주소의 예시 건물)으로 대체됐다. 이 자료로 건물 용도·위반건축물을 판정하지 않는다
        b = ToolResult(ok=False, source=b.source, error="실제 조회 실패 (예시 건축물 자료로 판정하지 않음)", from_mock=True)
    building = building_input(pack, business_type, b.data) if b.ok else None
    uses = (building.uses or []) if building else []

    t = ToolResult(ok=False, source="KIPRIS", error="미실행")
    if "trademark" in selected:
        step("trademark", "running", "상표 검색 중")
        t = _safe("KIPRIS", tools.trademark, store.name)
        n_sim = len((t.data or {}).get("similar", [])) if t.ok else 0
        step("trademark", _status(t), f"비슷한 상표 {n_sim}건" if t.ok else "상표 조회 실패", source=t.source)

    # 2. 규칙 판정 + AI 판정 (점검 항목 순서는 규칙 묶음의 순서)
    law_ids = ["building_use", "permit_docs", *[c for c in law_card_ids if c not in skipped_checks]]
    laws = {cid: ToolResult(ok=False, source="국가법령정보", error="미실행") for cid in law_ids}
    if "law" in selected:
        laws = {cid: _safe("국가법령정보", tools.law, cid, store) for cid in laws}
        law_statuses = [_status(r) for r in laws.values()]
        law_status = "failed" if all(s == "failed" for s in law_statuses) else (
            "fallback" if any(s != "done" for s in law_statuses) else "done")
        message = {"done": "조문 조회 완료", "fallback": "캐시·예시 법령 자료로 대체하거나 일부 조문 확인이 필요해요",
                   "failed": "조문을 조회하지 못해 확인이 필요해요"}[law_status]
        step("law", law_status, message)
    if getattr(tools, "use_mock", None) is False:
        if "law" not in selected and any(c["id"] == "building_use" for c in checks):
            # 건물만 다시 반영할 때(층·호 변경 등)도 건물 용도는 조문이 있어야 판정하므로 그 조문만 함께 찾는다
            laws["building_use"] = _safe("국가법령정보", tools.law, "building_use", store)
        # 실제 모드에서는 실제 조문(저장된 법령 검색·법령 API·그 캐시)만 근거로 쓴다. 모의 조문으로 대체됐거나
        # 찾지 못했으면 '실제 조문 없음'으로 표시해 법령에 기대는 판정을 보류하게 한다 (#68). 명시한 모의 모드는 그대로다
        laws = {cid: r if (r.ok and not r.from_mock) else ToolResult(
            ok=False, source=r.source, error=f"{REAL_LAW_UNAVAILABLE}:{r.error or 'mock'}", from_mock=r.from_mock)
            for cid, r in laws.items()}

    step("rules", "running", "규칙표 대조 준비 중")
    found: dict[str, tuple[ReportItem, dict]] = {}  # check_id → (항목, 선택지 만들 때 쓰는 부가 정보)
    rule_building = judge_building_use(pack, business_type, uses)  # AI 판정과 대조하는 안전장치
    for spec in checks:
        if spec["id"] == "labeling" and not _has_articles(laws.get("labeling")):
            # 읽을 조문이 없으면 점검 결과가 아니라 일반 안내라서 unknown으로 둔다
            found["labeling"] = (ReportItem(item_id="", check_id="labeling", stage=spec["stage"], title=spec["title"],
                                            verdict="unknown", decided_by="rule", reason=spec["reason"]), {})
    step("rules", "done", "규칙표 대조 준비 완료")

    step("interpret", "running", "AI 판정 중")
    before = guarded.failures
    for spec in checks:
        cid = spec["id"]
        if cid == "building_use":  # AI가 건축물대장의 층 용도와 조문을 읽고 판정 (규칙표와 대조)
            found[cid] = judge_building_use_ai(llm, store, business_type, b, laws[cid], rule_building, spec, "", pack)
        elif cid == "building_violation":  # AI가 건축물대장의 위반건축물 표기를 읽고 판정
            found[cid] = (judge_violation_ai(llm, b, spec, ""), {})
        elif cid == "permit_docs" or (spec.get("law_card") and _has_articles(laws.get(cid))):
            # AI가 조회한 조문 원문을 읽고 이 가게의 할 일을 판정 (영업신고·원산지 표시·소방·근로계약 등)
            found[cid] = (judge_law_card(llm, store, business_type, laws[cid], spec, "", outcomes=[
                outcome_of[r] for r in spec.get("rule_ids", []) if r in outcome_of]), {})
        elif spec.get("law_card"):
            found[cid] = (judge_law_card(llm, store, business_type, laws.get(cid) or ToolResult(
                ok=False, source="국가법령정보", error="미실행"), spec, ""), {})
        elif cid == "trademark_similar":
            found[cid] = judge_trademark(llm, store, t, spec, "")
        elif cid == "ad_claims":
            item = judge_ad_claims(llm, store, spec, "")
            if item:
                found[cid] = (item, {})
    step("interpret", *_ai_status(guarded, before, "AI 판정 완료"))

    # 카드 번호(r-01…)는 규칙 묶음의 점검 항목 순서가 정한다
    drafts: list[tuple[ReportItem, dict]] = []
    for index, spec in enumerate(all_checks, start=1):
        if spec["id"] in found:
            item, extras = found[spec["id"]]
            drafts.append((item.model_copy(update={"item_id": f"r-{index:02d}"}), extras))

    # 3. 결과 카드 (선택지·추천·기관 연락처)
    step("advise", "running", "해결 방안 만드는 중")
    before = guarded.failures
    items: list[ReportItem] = []
    changes: list[str] = []
    for item, extras in drafts:
        spec = check_spec(pack, item.check_id)
        if item.verdict != "ok":
            item = advise_item(llm, pack, store, item, spec, extras, business_type)
        item, c = enforce(item, allowed_remedies=spec.get("remedies"), ai_high_allowed=bool(spec.get("ai_high_allowed")))
        changes += [f"{item.item_id}: {x}" for x in c]
        items.append(item)
    step("advise", *_ai_status(guarded, before, "해결 방안 준비 완료"))

    # 4. 개업 체크리스트 (날짜는 계산 도구, 시기는 규칙 묶음의 항목별 값)
    if "checklist" in selected:
        step("checklist", "running", "개업 체크리스트 만드는 중")
    sigungu = store.address_codes.get("sigungu_cd")
    card_of = {spec["id"]: f"r-{n:02d}" for n, spec in enumerate(all_checks, start=1)}
    links = pack.get("report_links") or {}
    checklist: list[ChecklistItem] = []
    for base in base_checklist(pack, store.answers) if "checklist" in selected else []:
        d = calc.checklist_dates(store.opening_date, base["offset_days"])
        task = base["task"]
        if base.get("title_prefix_business_type") and business_type:
            task = f"{business_type} 영업신고에 필요한 서류 준비"
        contact = contact_of(pack, base.get("contact"), sigungu)
        checklist.append(ChecklistItem(
            item_id=base["id"], rule_key=base["id"], task=task, category=base["category"],
            due_date=d["due_date"], dday=d["dday"], group_label=base["group"], agency=base.get("agency"),
            contact=Contact(**contact) if contact else None,
            documents=[Document(**doc) for doc in documents_of(pack, base["id"], sigungu)], source="rule",
            report_item_ids=[card_of[c] for c in links.get(base["id"], []) if c in card_of]))
    if "checklist" in selected:
        # 법령 분석 결과를 작업으로: 규칙 엔진이 적용·확인 필요로 정한 의무사항만 체크리스트에 합친다
        checklist = apply_obligations(pack, obligations, checklist, items, card_of, calc, store.opening_date, sigungu,
                                      facts_of(store, business_type))
    for idx, item in enumerate(items):
        task_id = check_spec(pack, item.check_id).get("checklist_task")
        if item.verdict == "ok" or not task_id or not any(c.item_id == task_id for c in checklist):
            continue
        items[idx] = item.model_copy(update={"added_to_checklist": [task_id]})
    if "checklist" in selected:
        step("checklist", "done", f"체크리스트 {len(checklist)}개 항목")

    # 5. 정책 알림 (선택): 공고 자격 판정, 마감일을 체크리스트에 추가
    grants_result: GrantsResult | None = None
    if include_grants:
        if not hasattr(tools, "grants"):
            step("grants", "skipped", "지원사업 조회 도구가 없어요")
        else:
            step("grants", "running", "지원사업 조회 중")
            before = guarded.failures
            g = _safe("지원사업", tools.grants, store)
            grants_result = judge_grants(llm, store, g, today)
            checklist += grant_checklist_items(grants_result, calc, store.opening_date, len(checklist) + 1, today)
            ai_failed = guarded.failures > before
            step("grants", "failed" if not grants_result.ok else ("fallback" if ai_failed else _status(g)),
                 f"지원사업 {len(grants_result.items)}건 (제외 {grants_result.excluded_count}건)"
                 if grants_result.ok else "지원사업 조회 실패", source=g.source)

    summary = {k: sum(1 for i in items if i.verdict == k) for k in ("high", "low", "unknown", "ok")}
    for item in items:
        emit("item", {"check_id": item.check_id, "verdict": item.verdict, "decided_by": item.decided_by,
                      "title": item.title, "has_options": bool(item.options)})
    cost_krw = getattr(getattr(llm, "cost", None), "total_krw", 0.0)
    emit("done", {"summary": summary, "cost_krw": cost_krw})
    return AnalysisResult(business_type, items, checklist, summary, cost_krw, changes, grants_result,
                          address_codes=address_codes, obligations=obligations,
                          skipped_checks=[c["id"] for c in all_checks if c["id"] in skipped_checks and c["id"] in affected])
