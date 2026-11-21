"""지원사업: K-Startup 공고를 조회해 이 가게의 신청 가능성을 판정하고 grant_matches 에 저장한다.

- 조회(tools.grants)는 실제 API → 같은 날 저장된 조회 결과 → 모의 응답 순이다. 실제 모드에서 모의 응답으로 대체됐으면
  예시 공고를 실제 공고처럼 보여 주지 않도록 조회 실패로 둔다 (USE_MOCK=true 화면 시연에서만 예시 공고를 쓴다).
- 판정(agent/grants.py)은 공고문 원문에서 조건을 뽑고 나이·업력·지역은 코드가 계산한다. 명확히 맞지 않는 공고는 excluded 로 남긴다.
- 외부 조회·AI 호출 중에는 DB 트랜잭션을 잡지 않는다.
"""

from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from agent.cost import CostTracker
from agent.grants import judge_grants
from agent.ports import StoreInput, ToolResult
from db.models import CostLog, GrantMatch, Store
from services.analysis import store_input
from services.cards import load_state
from services.timeutil import iso_kst, now_utc, today_kst

logger = logging.getLogger(__name__)
EXAMPLE_MARK = "예시"


def snapshot(session: Session, store: Store) -> StoreInput:
    cards, _ = load_state(session, store)
    return store_input(store, cards)


def fetch_and_judge(value: StoreInput, tools=None, llm=None, cost: CostTracker | None = None):
    """공고를 조회하고 판정한다 (DB 쓰기 없음). (판정 결과, 조회 결과)를 돌려준다."""
    if tools is None or llm is None:
        from tools.analysis import make_dependencies

        tools, llm = make_dependencies(cost or CostTracker())
    try:
        res = tools.grants(value)
    except Exception as exc:  # noqa: BLE001 - 조회 실패는 화면에 '불러오지 못함'으로 알린다
        logger.warning("지원사업 조회 실패: %s", type(exc).__name__)
        res = ToolResult(ok=False, source="K-Startup 사업공고", error="조회 실패")
    if getattr(tools, "use_mock", None) is False and res.ok and res.from_mock:
        res = ToolResult(ok=False, source=res.source, error="REAL_GRANTS_UNAVAILABLE", from_mock=True)
    return judge_grants(llm, value, res, today_kst()), res


def save(session: Session, store: Store, result, res: ToolResult, cost: CostTracker | None = None) -> None:
    """판정 결과로 이 가게의 지원사업 목록을 바꾼다. 조회에 실패했으면 이전 목록을 그대로 둔다."""
    if not result.ok:
        return
    session.execute(delete(GrantMatch).where(GrantMatch.store_id == store.id))
    judged_at = now_utc()
    for m in result.items:
        session.add(GrantMatch(
            store_id=store.id, grant_id=m.grant_id, title=m.title, source=m.source, url=m.url,
            category=m.category, region=m.region, amount_text=m.summary.how_much, deadline=m.deadline,
            result=m.eligibility.result, checks=[c.model_dump(mode="json") for c in m.eligibility.checks],
            summary={**m.summary.model_dump(mode="json"), "org": m.org}, judged_at=judged_at))
    kept = {m.grant_id for m in result.items}
    for g in (res.data or {}).get("grants", []):
        if g.get("grant_id") in kept:
            continue
        # 마감이 지났거나 조건이 명확히 맞지 않아 뺀 공고. 목록에는 보여 주지 않고 개수만 알린다
        session.add(GrantMatch(
            store_id=store.id, grant_id=g.get("grant_id", ""), title=g.get("title", ""), source=g.get("source", ""),
            url=g.get("url"), category=g.get("category"), region=g.get("region"), result="unknown",
            checks=[], summary={"org": g.get("org")}, excluded=True, judged_at=judged_at))
    for c in (cost.rows if cost else []):
        session.add(CostLog(run_id=None, store_id=store.id, step=c.step, model=c.model,
                            input_tokens=c.input_tokens, output_tokens=c.output_tokens, cost_krw=c.cost_krw))


def _iso(value: datetime | None) -> str | None:
    return iso_kst(value) if value else None


def view(session: Session, store: Store, *, error: str | None = None) -> dict:
    """저장된 지원사업 목록 (화면 응답). status: ready(판정 결과 있음) · empty(아직 조회 안 함) · unavailable(조회 실패)."""
    rows = list(session.scalars(select(GrantMatch).where(GrantMatch.store_id == store.id)))
    shown = [r for r in rows if not r.excluded]
    order = {"eligible": 0, "partial": 1, "unknown": 2}
    shown.sort(key=lambda r: (order.get(r.result, 3), r.deadline or datetime.max.date()))
    judged_at = max((r.judged_at for r in rows), default=None)
    status = "unavailable" if error and not rows else ("ready" if rows else "empty")
    return {
        "status": status,
        "error": error,
        "source": next((r.source for r in rows), None),
        "is_example": any(EXAMPLE_MARK in (r.source or "") for r in rows),
        "judged_at": _iso(judged_at),
        "excluded_count": sum(1 for r in rows if r.excluded),
        "items": [{
            "grant_id": r.grant_id, "title": r.title, "source": r.source, "url": r.url,
            "org": (r.summary or {}).get("org"), "category": r.category, "region": r.region,
            "deadline": r.deadline.isoformat() if r.deadline else None, "result": r.result,
            "checks": r.checks or [],
            "summary": {k: (r.summary or {}).get(k) for k in ("who", "how_much", "until", "what_to_submit")},
        } for r in shown],
    }
