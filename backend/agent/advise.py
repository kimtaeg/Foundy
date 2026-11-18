"""결과 카드 생성: 문제가 나온 항목에 선택지·추천·대신 만든 결과물·사용자가 할 일을 붙인다.

역할 분담
- 코드: 선택지의 종류와 적용 방법(apply), 후보 자리 적합 여부, 금액 차이(계산 도구), id 부여
- AI: 쉬운 말 설명, 추천과 이유, 문의 문자·특약 문구 초안, 사용자가 할 일 문장
선택지는 규칙 묶음의 remedies, 초안은 drafts 범위 안에서만 만든다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from rules.engine import judge_building_use

from .llm import LLM, LLMError
from .ports import Calc, StoreInput
from .prompts import advise as prompt
from .schemas import (
    ApplyAction, Estimate, Option, Prepared, Recommendation, ReportItem, UserAction,
)

CONTRACT_DISCLAIMER = "\n\n※ 참고용 초안입니다. 계약 전에 전문가(공인중개사·법무사 등) 확인을 권장합니다."
# 확인된 사실이 없는 기간·금액은 쓰지 않는다 (Estimate 기본값이 '확인 필요')
# 건물 용도 규칙으로 가능함을 코드가 이미 확인한 대응. AI가 추천할 때 우선하도록 알려준다.
VERIFIED_REMEDIES = {"change_business_type", "change_site"}


class OptionSummary(BaseModel):
    option_id: str
    summary: str


class DraftText(BaseModel):
    kind: Literal["inquiry_message", "contract_clause"]
    title: str
    body: str


class AdviceDraft(BaseModel):
    consequence: str
    option_summaries: list[OptionSummary] = Field(default_factory=list)
    recommended_option_id: str | None = None
    recommendation_reason: str = ""
    drafts: list[DraftText] = Field(default_factory=list)
    user_action_text: str
    user_action_type: Literal["send", "sign", "visit", "decide"]
    user_action_est_minutes: int = 1
    user_action_draft_kind: Literal["inquiry_message", "contract_clause"] | None = None


@dataclass
class Counters:
    """분석 한 번 안에서 prepared_id를 겹치지 않게 부여한다."""

    prepared: int = 0

    def next_prepared(self) -> str:
        self.prepared += 1
        return f"p-{self.prepared:02d}"


def build_options(
    pack: dict, store: StoreInput, item: ReportItem, spec: dict, extras: dict,
    business_type: str | None, calc: Calc | None,
) -> list[Option]:
    """규칙 묶음의 remedies 중 이 가게에 실제로 적용되는 선택지의 뼈대를 만든다."""
    options: list[Option] = []

    def add(**kw) -> None:
        options.append(Option(option_id=f"o-{len(options) + 1}", **kw))

    uses = extras.get("floor_uses", [])
    main = next((s for s in store.sites if s.is_main), None)
    for remedy in spec.get("remedies", []):
        if remedy == "change_business_type" and item.check_id == "building_use":
            alt = "휴게음식점"
            if store.answers.get("sells_alcohol") is True and judge_building_use(pack, alt, uses).verdict == "ok":
                add(remedy=remedy, label=f"술 빼고 {alt}으로 시작",
                    summary=f"{alt}으로 신고하면 이 건물에서 가능해요. 대신 술은 팔 수 없어요.",
                    apply=ApplyAction(type="update_store", payload={"answers": {"sells_alcohol": False}},
                                      needs_reanalyze=True))
        elif remedy == "change_site" and item.check_id == "building_use":
            for site in store.sites:
                if site.is_main or judge_building_use(pack, business_type, site.floor_uses).verdict != "ok":
                    continue
                cost = Estimate()
                if calc and main and main.listing and site.listing:
                    d = calc.site_cost_delta(main.listing, site.listing)
                    if d:
                        cost = Estimate(
                            text=f"초기 비용 {d['initial_delta_krw']:+,}원, 월 고정비 {d['monthly_delta_krw']:+,}원",
                            basis="calc", delta_krw=d["initial_delta_krw"])
                add(remedy=remedy, label=f"후보 자리 {site.label}로 변경",
                    summary=f"{site.label} 자리는 건물 용도상 {business_type} 신고가 가능해요.",
                    cost=cost, site_id=site.site_id,
                    apply=ApplyAction(type="set_main_site", payload={"site_id": site.site_id},
                                      needs_reanalyze=True))
        elif remedy == "request_use_change" and item.check_id == "building_use":
            add(remedy=remedy, label="용도변경 신청",
                summary="구청 승인과 건물주 동의가 필요해요. 걸리는 시간은 구청에 확인해야 해요.")
        elif remedy == "rename_store":
            for alt in extras.get("alternatives", [])[:2]:
                add(remedy=remedy, label=f"'{alt}'(으)로 이름 바꾸기",
                    summary="겹치지 않을 것 같은 이름이에요. 상표 검색으로 다시 확인해 보세요.",
                    apply=ApplyAction(type="update_store", payload={"name": alt}, needs_reanalyze=True))
        elif remedy == "proceed":
            add(remedy=remedy, label="그대로 진행",
                summary="위험을 알고 이 이름으로 진행해요. 나중에 문제 삼으면 바꿔야 할 수 있어요.")
        elif remedy == "rewrite_copy":
            add(remedy=remedy, label="문구 수정하기", summary="문제가 된 표현을 빼거나 바꿔요.")
    return options


def advise_item(
    llm: LLM, pack: dict, store: StoreInput, item: ReportItem, spec: dict, extras: dict,
    business_type: str | None, calc: Calc | None, counters: Counters,
) -> ReportItem:
    """판정이 ok가 아닌 항목에 결과 카드 필드를 채워 돌려준다. LLM이 실패해도 선택지는 남긴다."""
    options = build_options(pack, store, item, spec, extras, business_type, calc)
    allowed = list(spec.get("drafts", []))
    if not options and not allowed:
        return item

    ctx_store = {
        "name": store.name, "business_type": business_type, "address": store.address,
        "address_detail": store.address_detail, "opening_date": str(store.opening_date),
        "answers": store.answers,
    }
    ctx_item = {
        "check_id": item.check_id, "title": item.title, "verdict": item.verdict, "reason": item.reason,
        "evidence": [{"source": e.source, "value": e.value} for e in item.evidence],
    }
    try:
        d = llm.parse(
            step=f"advise_{item.check_id}", tier="main", system=prompt.SYSTEM,
            user=prompt.USER.format(
                store=json.dumps(ctx_store, ensure_ascii=False),
                item=json.dumps(ctx_item, ensure_ascii=False),
                options=json.dumps(
                    [{"option_id": o.option_id, "label": o.label, "verified": o.remedy in VERIFIED_REMEDIES}
                     for o in options], ensure_ascii=False),
                allowed_draft_kinds=json.dumps(allowed, ensure_ascii=False),
            ),
            schema=AdviceDraft,
        )
    except LLMError:
        # AI 설명 없이도 선택지는 보여준다
        return item.model_copy(update={
            "options": options,
            "user_action": UserAction(type="decide", text="선택지 중 하나를 골라 주세요") if options else None,
        })

    summaries = {s.option_id: s.summary.strip() for s in d.option_summaries if s.summary.strip()}
    options = [o.model_copy(update={"summary": summaries.get(o.option_id, o.summary)}) for o in options]

    prepared: list[Prepared] = []
    for draft in d.drafts:
        if draft.kind not in allowed or not draft.body.strip():
            continue
        body = draft.body.strip() + (CONTRACT_DISCLAIMER if draft.kind == "contract_clause" else "")
        prepared.append(Prepared(prepared_id=counters.next_prepared(), kind=draft.kind,
                                 title=draft.title.strip() or draft.kind, body=body, editable=True))

    recommendation = None
    if d.recommended_option_id in {o.option_id for o in options}:
        recommendation = Recommendation(option_id=d.recommended_option_id, reason=d.recommendation_reason.strip())

    linked = next((p.prepared_id for p in prepared if p.kind == d.user_action_draft_kind), None)
    user_action = UserAction(
        type=d.user_action_type, text=d.user_action_text.strip(),
        est_minutes=max(1, min(d.user_action_est_minutes, 120)), prepared_id=linked,
    )
    return item.model_copy(update={
        "consequence": d.consequence.strip(), "options": options, "recommendation": recommendation,
        "prepared": prepared, "user_action": user_action,
    })
