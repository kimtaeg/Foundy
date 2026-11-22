"""지원사업: K-Startup 공고를 조회해 이 가게의 신청 가능성을 판정하고 grant_matches 에 저장한다.

- 조회(tools.grants)는 실제 API → 같은 날 저장된 조회 결과 → 모의 응답 순이다. 실제 모드에서 모의 응답으로 대체됐으면
  예시 공고를 실제 공고처럼 보여 주지 않도록 조회 실패로 둔다 (USE_MOCK=true 화면 시연에서만 예시 공고를 쓴다).
- 판정(agent/grants.py)은 공고문 원문에서 조건을 뽑고 나이·업력·지역은 코드가 계산한다. 명확히 맞지 않는 공고는 excluded 로 남긴다.
- 외부 조회·AI 호출 중에는 DB 트랜잭션을 잡지 않는다.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import date, datetime

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from agent.cost import CostTracker
from agent.prompts import grants as prompt
from agent.ports import StoreInput, ToolResult
from agent.schemas import GrantsResult
from db.models import CostLog, GrantMatch, ReportItem, Store
from services.analysis import store_input
from services.store_collections import read_store_collections
from services.timeutil import iso_kst, now_utc

logger = logging.getLogger(__name__)
EXAMPLE_MARK = "예시"


def snapshot(session: Session, store: Store) -> tuple[StoreInput, list[GrantMatch]]:
    cards, matches = read_store_collections(session, store.id, ReportItem, GrantMatch)
    cards.sort(key=lambda item: item.item_key)
    return store_input(store, cards), matches


def fetch_candidates(value: StoreInput, tools) -> ToolResult:
    try:
        res = tools.grants(value)
    except Exception as exc:  # noqa: BLE001 - 조회 실패는 화면에 '불러오지 못함'으로 알린다
        logger.warning("지원사업 조회 실패: %s", type(exc).__name__)
        res = ToolResult(ok=False, source="K-Startup 사업공고", error="조회 실패")
    if getattr(tools, "use_mock", None) is False and res.ok and res.from_mock:
        res = ToolResult(ok=False, source=res.source, error="REAL_GRANTS_UNAVAILABLE", from_mock=True)
    return res


def judgment_key(value: StoreInput, res: ToolResult, today: date) -> str | None:
    """공고 원문 또는 가게 정보가 달라지면 기존 판정을 재사용하지 않는다."""
    if not res.ok or res.from_mock or not res.data:
        return None
    payload = json.dumps({
        "version": 1, "date": today.isoformat(), "store": value.model_dump(mode="json"),
        "source": res.source, "notices": res.data.get("grants", []),
        "provider": os.getenv("LLM_PROVIDER"), "model": os.getenv("LLM_MODEL_MAIN"),
        "prompt": [prompt.SYSTEM, prompt.USER],
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def saved_rows(session: Session, store: Store) -> list[GrantMatch]:
    return list(session.scalars(select(GrantMatch).where(GrantMatch.store_id == store.id)))


def reusable(rows: list[GrantMatch], key: str | None) -> bool:
    return bool(key and rows and all((row.summary or {}).get("judgment_key") == key for row in rows))


def save(session: Session, store: Store, result: GrantsResult, res: ToolResult, cost: CostTracker,
         key: str | None) -> list[GrantMatch]:
    """새 판정을 저장하고 응답에 사용할 행을 돌려준다."""
    # 같은 가게의 동시 갱신이 기존 목록 삭제와 새 목록 삽입을 섞지 않게 한다.
    session.execute(select(Store.id).where(Store.id == store.id).with_for_update())
    session.execute(delete(GrantMatch).where(GrantMatch.store_id == store.id))
    judged_at = now_utc()
    cache_fields = {"judgment_key": key} if key and not result.extraction_failed else {}
    rows = [{
        "store_id": store.id, "grant_id": m.grant_id, "title": m.title, "source": m.source, "url": m.url,
        "category": m.category, "region": m.region, "amount_text": m.summary.how_much, "deadline": m.deadline,
        "result": m.eligibility.result, "checks": [c.model_dump(mode="json") for c in m.eligibility.checks],
        "summary": {**m.summary.model_dump(mode="json"), "org": m.org, **cache_fields},
        "excluded": False, "judged_at": judged_at,
    } for m in result.items]
    kept = {m.grant_id for m in result.items}
    for g in (res.data or {}).get("grants", []):
        if g.get("grant_id") in kept:
            continue
        # 마감이 지났거나 조건이 명확히 맞지 않아 뺀 공고. 목록에는 보여 주지 않고 개수만 알린다
        rows.append({
            "store_id": store.id, "grant_id": g.get("grant_id", ""), "title": g.get("title", ""),
            "source": g.get("source", ""), "url": g.get("url"), "category": g.get("category"),
            "region": g.get("region"), "amount_text": None, "deadline": None, "result": "unknown",
            "checks": [], "summary": {"org": g.get("org"), **cache_fields},
            "excluded": True, "judged_at": judged_at,
        })
    if rows:
        session.execute(insert(GrantMatch).values(rows))
    if cost.rows:
        session.execute(insert(CostLog).values([{
            "store_id": store.id, "step": c.step, "model": c.model, "input_tokens": c.input_tokens,
            "output_tokens": c.output_tokens, "cost_krw": c.cost_krw,
        } for c in cost.rows]))
    return [GrantMatch(**row) for row in rows]


def _iso(value: datetime | None) -> str | None:
    return iso_kst(value) if value else None


def view(session: Session, store: Store) -> dict:
    return rows_view(saved_rows(session, store))


def rows_view(rows: list[GrantMatch], *, error: str | None = None) -> dict:
    """저장된 지원사업 목록 (화면 응답). status: ready(판정 결과 있음) · empty(아직 조회 안 함) · unavailable(조회 실패)."""
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
