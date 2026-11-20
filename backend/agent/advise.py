"""결과 카드 생성: 문제가 나온 항목에 선택지·추천·사용자가 할 일을 붙인다.

역할 분담
- 코드: 선택지의 종류와 적용 방법(apply, 체크리스트에 추가되는 항목), 기관 연락처(contact), id 부여
- AI: 쉬운 말 설명, 추천과 이유, 사용자가 할 일 문장
선택지는 규칙 묶음의 remedies 범위 안에서만 만든다. 문의 문구·특약·서류 초안은 만들지 않는다
(foundy 확정: 기관 전화번호와 통화 질문 목록으로 대체).
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field

from rules.engine import contact_of, judge_building_use

from .llm import LLM, LLMError
from .ports import StoreInput
from .prompts import advise as prompt
from .schemas import ApplyAction, Contact, Option, Recommendation, ReportItem, UserAction

# 확인된 사실이 없는 기간·금액은 쓰지 않는다 (Estimate 기본값이 '확인 필요')
# 건물 용도 규칙으로 가능함을 코드가 이미 확인한 대응. AI가 추천할 때 우선하도록 알려준다.
VERIFIED_REMEDIES = {"change_business_type"}


class OptionSummary(BaseModel):
    option_id: str
    summary: str


class AdviceDraft(BaseModel):
    consequence: str
    option_summaries: list[OptionSummary] = Field(default_factory=list)
    recommended_option_id: str | None = None
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

    uses = extras.get("floor_uses", [])
    for remedy in spec.get("remedies", []):
        if remedy == "change_business_type" and item.check_id == "building_use":
            alt = "휴게음식점"
            if store.answers.get("sells_alcohol") is True and judge_building_use(pack, alt, uses).verdict == "ok":
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


def advise_item(
    llm: LLM, pack: dict, store: StoreInput, item: ReportItem, spec: dict, extras: dict,
    business_type: str | None,
) -> ReportItem:
    """판정이 ok가 아닌 항목에 결과 카드 필드를 채워 돌려준다. LLM이 실패해도 선택지와 연락처는 남긴다."""
    options = build_options(pack, store, item, spec, extras, business_type)
    contact = contact_for(pack, spec, store.address_codes.get("sigungu_cd"))
    base = {"options": options, "contact": contact}
    fixed = spec.get("action")  # 선택지가 없는 항목의 할 일·결과는 규칙 묶음에 정해 둔다 (AI 호출 없음)
    if not options:
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

    recommendation = None
    if d.recommended_option_id in {o.option_id for o in options}:
        recommendation = Recommendation(option_id=d.recommended_option_id, reason=d.recommendation_reason.strip())

    user_action = UserAction(
        type=d.user_action_type, text=d.user_action_text.strip(),
        est_minutes=max(1, min(d.user_action_est_minutes, 120)),
    )
    return item.model_copy(update={
        "consequence": d.consequence.strip(), "options": options, "recommendation": recommendation,
        "contact": contact, "user_action": user_action,
    })
