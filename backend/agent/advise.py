"""결과 카드 생성: 문제가 나온 항목에 선택지·추천·사용자가 할 일을 붙인다.

역할 분담
- 코드: 규칙 묶음 remedies 에 있는 선택지의 종류와 적용 방법(apply, 체크리스트에 추가되는 항목), 기관 연락처(contact), id 부여
- AI: 쉬운 말 설명, 추천과 이유, 사용자가 할 일 문장, **그리고 코드가 만든 선택지 외에 필요한 선택지(최대 2개) 제안**
AI가 제안한 선택지(remedy="ai_suggested")는 가게 정보·체크리스트를 바꾸지 않는 안내형이다(apply 없음).
기간·금액 숫자가 들어간 제안은 버린다(근거 없는 숫자 금지). 문의 문구·특약·서류 초안은 만들지 않는다
(foundy 확정: 기관 전화번호와 통화 질문 목록으로 대체).
"""

from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from rules.engine import contact_of

from .analysis_cache import accept_response
from .llm import LLM, LLMError
from .ports import StoreInput
from .prompts import advise as prompt
from .schemas import ApplyAction, Contact, Option, Recommendation, ReportItem, UserAction

# 확인된 사실이 없는 기간·금액은 쓰지 않는다 (Estimate 기본값이 '확인 필요')
# 건물 용도 규칙으로 가능함을 코드가 이미 확인한 대응. AI가 추천할 때 우선하도록 알려준다.
VERIFIED_REMEDIES = {"change_business_type"}


AI_REMEDY = "ai_suggested"
MAX_AI_OPTIONS = 2
MAX_OPTIONS = 5
# 근거 없는 기간·금액 숫자 (예: "3일", "50만원", "2주"). 있으면 그 제안은 버린다.
_NUMERIC_CLAIM = re.compile(r"\d[\d,.]*\s*(원|만원|억|일|주|개월|달|시간|분|%|퍼센트)")


class OptionSummary(BaseModel):
    option_id: str
    summary: str


class ExtraOption(BaseModel):
    """AI가 제안하는 추가 선택지. 가게 정보를 바꾸지 않는 안내형이다."""

    label: str
    summary: str


class AdviceDraft(BaseModel):
    consequence: str
    option_summaries: list[OptionSummary] = Field(default_factory=list)
    extra_options: list[ExtraOption] = Field(default_factory=list)  # 최대 2개, 코드가 검증해서 남긴다
    recommended_option_id: str | None = None  # 코드가 만든 선택지의 id, 또는 extra-1·extra-2 (제안한 추가 선택지)
    recommendation_reason: str = ""
    user_action_text: str
    user_action_type: Literal["send", "sign", "visit", "decide"]
    user_action_est_minutes: int = 1


def adds_checklist(pack: dict, check_id: str, remedy: str) -> list[str]:
    """이 선택지를 고르면 체크리스트에 새로 생기는 항목 id (규칙 묶음 extra_tasks의 from)."""
    return [t["id"] for t in pack.get("extra_tasks", []) if list(t.get("from", [])) == [check_id, remedy]]


def contact_for(pack: dict, spec: dict, sigungu: str | None = None) -> Contact | None:
    """점검 항목의 담당 기관 연락처. 번호는 규칙 묶음 contacts에서만 가져온다 (AI가 만들지 않는다).
    관할 구청은 주소의 시군구 코드로 고르고, 표에 없는 지역은 정부민원안내콜센터로 대체한다."""
    c = contact_of(pack, spec.get("contact"), sigungu)
    return Contact(**c) if c else None


def build_options(
    pack: dict, store: StoreInput, item: ReportItem, spec: dict, extras: dict,
    business_type: str | None,
) -> list[Option]:
    """규칙 묶음의 remedies 중 이 가게에 실제로 적용되는 선택지의 뼈대를 만든다."""
    options: list[Option] = []

    def add(remedy: str, **kw) -> None:
        apply = kw.pop("apply", ApplyAction())
        apply = apply.model_copy(update={"adds_checklist": adds_checklist(pack, item.check_id, remedy)})
        options.append(Option(option_id=f"o-{len(options) + 1}", remedy=remedy, apply=apply, **kw))

    for remedy in spec.get("remedies", []):
        if remedy == "change_business_type" and item.check_id == "building_use":
            alt = "휴게음식점"
            if store.answers.get("sells_alcohol") is True and alt in extras.get("ok_business_types", []):
                add(remedy, label=f"술 빼고 {alt}으로 시작",
                    summary=f"{alt}으로 신고하면 이 건물에서 가능해요. 대신 술은 팔 수 없어요.",
                    apply=ApplyAction(type="update_store", payload={"answers": {"sells_alcohol": False}},
                                      needs_reanalyze=True))
        elif remedy == "request_use_change" and item.check_id == "building_use":
            add(remedy, label="용도변경 신청",
                summary="구청 승인과 건물주 동의가 필요해요. 걸리는 시간은 구청에 확인해야 해요.")
        elif remedy == "find_other_site" and item.check_id == "building_use":
            add(remedy, label="다른 자리를 알아보기",
                summary="계약 전이라면 용도가 맞는 다른 자리에서 시작할 수 있어요. 새 주소를 정하면 정보 수정에서 바꿔 점검을 다시 돌려요.")
        elif remedy == "rename_store":
            for alt in extras.get("alternatives", [])[:2]:
                add(remedy, label=f"'{alt}'(으)로 이름 바꾸기",
                    summary="겹치지 않을 것 같은 이름이에요. 상표 검색으로 다시 확인해 보세요.",
                    apply=ApplyAction(type="update_store", payload={"name": alt}, needs_reanalyze=True))
        elif remedy == "proceed":
            add(remedy, label="그대로 진행",
                summary="위험을 알고 이 이름으로 진행해요. 나중에 문제 삼으면 바꿔야 할 수 있어요.")
        elif remedy == "rewrite_copy":
            add(remedy, label="문구 수정하기", summary="문제가 된 표현을 빼거나 바꿔요.")
    return options


def _normalize(text: str) -> str:
    return re.sub(r"[\s\W_]+", "", text or "").lower()


def add_ai_options(options: list[Option], extras: list[ExtraOption]) -> tuple[list[Option], dict[str, str]]:
    """AI가 제안한 선택지를 검증해서 붙인다. 돌려주는 dict 는 extra-N → 실제 option_id 이다.

    버리는 것: 기간·금액 숫자가 있는 제안, 라벨·설명이 비었거나 너무 긴 제안, 이미 있는 선택지와 같은 라벨, 최대 개수 초과.
    붙이는 선택지는 가게 정보를 바꾸지 않는 안내형이다 (apply 없음, 기간·금액은 '확인 필요').
    """
    result = list(options)
    ids: dict[str, str] = {}
    seen = {_normalize(o.label) for o in result}
    taken = 0
    for number, extra in enumerate(extras, start=1):
        label, summary = (extra.label or "").strip(), (extra.summary or "").strip()
        if not label or not summary or len(label) > 40 or len(summary) > 160:
            continue
        if _NUMERIC_CLAIM.search(label) or _NUMERIC_CLAIM.search(summary):
            continue
        if _normalize(label) in seen:
            continue
        if taken >= MAX_AI_OPTIONS or len(result) >= MAX_OPTIONS:
            break
        option = Option(option_id=f"o-{len(result) + 1}", label=label, summary=summary, remedy=AI_REMEDY)
        result.append(option)
        ids[f"extra-{number}"] = option.option_id
        seen.add(_normalize(label))
        taken += 1
    return result, ids


def advise_item(
    llm: LLM, pack: dict, store: StoreInput, item: ReportItem, spec: dict, extras: dict,
    business_type: str | None,
) -> ReportItem:
    """판정이 ok가 아닌 항목에 결과 카드 필드를 채워 돌려준다. LLM이 실패해도 선택지와 연락처는 남긴다."""
    options = build_options(pack, store, item, spec, extras, business_type)
    contact = contact_for(pack, spec, store.address_codes.get("sigungu_cd"))
    base = {"options": options, "contact": contact}
    fixed = spec.get("action")  # 선택지가 없는 항목의 할 일·결과는 규칙 묶음에 정해 둔다 (AI 호출 없음)
    if not options and not spec.get("ai_options"):  # ai_options: true 인 항목은 코드 선택지가 없어도 AI가 선택지를 제안한다
        update = {"contact": contact}
        if spec.get("consequence"):
            update["consequence"] = spec["consequence"]
        if fixed:
            update["user_action"] = UserAction(**fixed)
        return item.model_copy(update=update)

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
            ),
            schema=AdviceDraft,
        )
    except LLMError:
        # AI 설명 없이도 선택지는 보여준다
        return item.model_copy(update={**base, "user_action": UserAction(type="decide", text="선택지 중 하나를 골라 주세요")})

    summaries = {s.option_id: s.summary.strip() for s in d.option_summaries if s.summary.strip()}
    options = [o.model_copy(update={"summary": summaries.get(o.option_id, o.summary)}) for o in options]
    option_ids = {o.option_id for o in options}
    options, extra_ids = add_ai_options(options, d.extra_options)

    recommendation = None
    recommended = extra_ids.get(d.recommended_option_id, d.recommended_option_id)
    if recommended in {o.option_id for o in options}:
        recommendation = Recommendation(option_id=recommended, reason=d.recommendation_reason.strip())

    user_action = UserAction(
        type=d.user_action_type, text=d.user_action_text.strip(),
        est_minutes=max(1, min(d.user_action_est_minutes, 120)),
    )
    if (recommendation and recommendation.reason and user_action.text and d.consequence.strip()
            and summaries.keys() <= option_ids and len(extra_ids) == len(d.extra_options)):
        accept_response(llm, d)
    return item.model_copy(update={
        "consequence": d.consequence.strip(), "options": options, "recommendation": recommendation,
        "contact": contact, "user_action": user_action,
    })
