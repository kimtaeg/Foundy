"""AI 판정과 근거 검증.

LLM은 조회한 데이터 안에서 판단만 하고, 근거(Evidence)는 코드가 조회 데이터에서 만든다.
AI가 인용한 상표 번호·문구가 실제 데이터에 없으면 그 근거는 버리고 판정을 unknown으로 내린다.
AI 판정은 high가 될 수 없다 (결과 스키마에서 low | ok | unknown만 받는다).
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field

from .llm import LLM, LLMError
from .ports import StoreInput, ToolResult
from .prompts import judge as prompt
from .schemas import Evidence, ReportItem


class TrademarkJudgment(BaseModel):
    verdict: Literal["low", "ok", "unknown"]
    title: str
    reason: str
    cited_reg_nos: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)


class AdJudgment(BaseModel):
    verdict: Literal["low", "ok", "unknown"]
    title: str
    reason: str
    quotes: list[str] = Field(default_factory=list)


def _norm(name: str) -> str:
    return "".join(name.split()).lower()


def _distinct_names(candidates: list[str], own: str, others: list[str]) -> list[str]:
    """기존 이름·비슷하다고 본 상표와 글자가 겹치는 대체 이름은 버린다 (최대 2개)."""
    banned = [_norm(own)] + [_norm(o) for o in others if o]
    out: list[str] = []
    for c in candidates:
        n = _norm(c)
        if n and not any(n in b or b in n for b in banned) and c.strip() not in out:
            out.append(c.strip())
    return out[:2]


def _item(spec: dict, item_id: str, **kw) -> ReportItem:
    return ReportItem(item_id=item_id, check_id=spec["id"], stage=spec["stage"], decided_by="ai", **kw)


def _data_evidence(res: ToolResult, value: str, url: str | None = None) -> Evidence:
    return Evidence(
        type="data", source=res.source, value=value, url=url,
        fetched_at=res.fetched_at, from_cache=res.from_cache, from_mock=res.from_mock,
    )


def judge_trademark(
    llm: LLM, store: StoreInput, res: ToolResult, spec: dict, item_id: str
) -> tuple[ReportItem, dict]:
    """상호가 등록 상표와 겹치는지. 두 번째 값은 선택지 만들 때 쓰는 부가 정보(alternatives)."""
    name = store.name
    if not res.ok or res.data is None:
        return _item(
            spec, item_id, verdict="unknown",
            title="상표가 겹치는지 확인할 수 없어요",
            reason="상표 정보를 조회하지 못했어요. 특허정보 검색서비스(KIPRIS)에서 직접 확인해 보세요.",
        ), {"alternatives": []}

    similar = res.data.get("similar") or []
    if not similar:
        if res.data.get("search_scope") == "name":
            return _item(
                spec, item_id, verdict="unknown", title="상표 유사 여부는 추가 확인이 필요해요",
                reason="제43류 등록 상표 명칭검색은 0건이지만, 발음·표기 유사 상표 전체의 부재를 확인한 결과는 아닙니다.",
                evidence=[_data_evidence(res, "제43류 등록 상표 명칭검색 후보 0건")],
            ), {"alternatives": []}
        return _item(
            spec, item_id, verdict="ok",
            title=f"'{name}'과(와) 비슷한 등록 상표가 없어요",
            reason="조회한 등록 상표 중에 비슷한 이름이 없었어요.",
            evidence=[_data_evidence(res, "비슷한 등록 상표 0건")],
        ), {"alternatives": []}

    by_reg = {s.get("reg_no"): s for s in similar if s.get("reg_no")}
    try:
        j = llm.parse(
            step="judge_trademark", tier="main", system=prompt.TRADEMARK_SYSTEM,
            user=prompt.TRADEMARK_USER.format(
                name=name, similar=json.dumps(similar, ensure_ascii=False)),
            schema=TrademarkJudgment,
        )
    except LLMError:
        return _item(
            spec, item_id, verdict="unknown",
            title="상표가 겹치는지 확인할 수 없어요",
            reason="AI 판단에 실패했어요. 비슷한 상표가 조회됐으니 목록을 직접 확인해 보세요.",
            evidence=[_data_evidence(res, f"비슷할 수 있는 등록 상표 {len(similar)}건 조회")],
        ), {"alternatives": []}

    cited = [r for r in dict.fromkeys(j.cited_reg_nos) if r in by_reg]
    evidence = [
        _data_evidence(
            res,
            f"등록 {r} '{by_reg[r].get('name')}' (제{by_reg[r].get('class_code')}류, {by_reg[r].get('status')})",
            by_reg[r].get("url"),
        )
        for r in cited
    ]
    verdict, reason = j.verdict, j.reason
    if verdict == "ok":
        evidence = evidence or [_data_evidence(res, f"조회된 등록 상표 {len(similar)}건 검토")]
    elif verdict == "low" and not evidence:
        verdict, reason = "unknown", "비슷하다고 본 상표를 조회 결과에서 특정하지 못했어요. 목록을 직접 확인해 보세요."
    alternatives = (
        _distinct_names(j.alternatives, name, [by_reg[r].get("name", "") for r in by_reg]) if verdict == "low" else []
    )
    return _item(spec, item_id, verdict=verdict, title=j.title, reason=reason, evidence=evidence), {
        "alternatives": alternatives
    }


def judge_ad_claims(llm: LLM, store: StoreInput, spec: dict, item_id: str) -> ReportItem | None:
    """메뉴·홍보 문구의 효능 표현. 문구가 없으면 점검하지 않는다(None)."""
    text = (store.menu_text or "").strip()
    if not text:
        return None
    src = "입력한 메뉴·홍보 문구"
    try:
        j = llm.parse(
            step="judge_ad_claims", tier="main", system=prompt.AD_SYSTEM,
            user=prompt.AD_USER.format(menu_text=text), schema=AdJudgment,
        )
    except LLMError:
        return _item(
            spec, item_id, verdict="unknown", title="메뉴 문구를 점검하지 못했어요",
            reason="AI 판단에 실패했어요. 효능을 암시하는 표현이 없는지 직접 확인해 보세요.",
        )
    quotes = [q.strip() for q in dict.fromkeys(j.quotes) if q.strip() and q.strip() in text]
    verdict, reason = j.verdict, j.reason
    if verdict == "low" and not quotes:
        verdict, reason = "unknown", "문제라고 본 표현을 원문에서 찾지 못했어요. 문구를 직접 확인해 보세요."
    evidence = [Evidence(type="data", source=src, value=q) for q in quotes]
    if verdict == "ok":
        evidence = [Evidence(type="data", source=src, value="입력한 문구 전체를 검토했어요")]
    return _item(spec, item_id, verdict=verdict, title=j.title, reason=reason, evidence=evidence)
