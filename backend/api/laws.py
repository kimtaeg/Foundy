"""법령 RAG API: 가게별 법령 적용 결과(의무사항), 조문 검색, 법령 갱신(내부)."""

import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import current_user, owned_store
from api.errors import ApiError, invalid_input, unauthorized
from config import get_settings
from db.models import ApplicabilityRule, LegalObligation, Store, User
from db.session import get_db, transaction
from rules.applicability import INPUT_LABELS
from services.pack import get_pack

logger = logging.getLogger(__name__)

store_router = APIRouter(prefix="/api/stores/{store_id}")
router = APIRouter()


def _law_url(law_name: str) -> str:
    return f"https://www.law.go.kr/법령/{law_name}"


@store_router.get("/obligations")
def obligations(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """분석 때 규칙 엔진이 정한 법령 적용 결과. status: applies(적용) · needs_check(확인 필요) · not_applicable(미적용).

    화면의 판정값(위반 소지 높음 등)과는 별개다. 확인 필요 항목의 missing_inputs 를 채우면 다시 분석할 때 판정이 바뀐다.
    """
    rows = list(db.scalars(select(LegalObligation).where(LegalObligation.store_id == store.id)))
    reviews = {r.rule_id: r.review_status for r in db.scalars(select(ApplicabilityRule))}
    order = {"applies": 0, "needs_check": 1, "not_applicable": 2}
    rows.sort(key=lambda o: (order.get(o.status, 3), o.rule_id))
    items = [{
        "rule_id": o.rule_id, "title": o.title, "status": o.status, "reason": o.reason,
        "missing_inputs": [{"key": k, "label": INPUT_LABELS.get(k, k)} for k in (o.missing_inputs or [])],
        "law": {"law_name": o.law_name, "article": o.article_label,
                "url": _law_url(o.law_name) if o.law_name else None},
        "required_action": o.required_action, "review_status": reviews.get(o.rule_id, "draft"),
    } for o in rows]
    summary = {k: sum(1 for i in items if i["status"] == k) for k in ("applies", "needs_check", "not_applicable")}
    return {"store_id": str(store.id), "summary": summary, "items": items,
            "disclaimer": "법률 자문이 아니라 사전 점검입니다. 적용 여부가 불분명하면 관할 기관에 확인하세요."}


@router.get("/api/laws/search")
def search_laws(q: str = Query(min_length=2, max_length=200), laws: list[str] | None = Query(default=None),
                limit: int = Query(default=5, ge=1, le=10), _user: User = Depends(current_user)) -> dict:
    """저장된 법령에서 질문과 관련된 조문을 찾는다 (키워드 + 벡터 하이브리드)."""
    from law_rag import retriever
    from law_rag.embedder import make_embedder

    names = laws or get_pack()["law_sources"]
    with transaction() as session:
        hits = retriever.search(session, query=q, keywords=[w for w in q.split() if len(w) >= 2][:6], names=names,
                                embedder=make_embedder(), top_k=limit)
    return {"query": q, "articles": retriever.merge_by_article(hits)}


class RefreshBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    names: list[str] | None = None


def _run_refresh(names: list[str]) -> None:
    from law_rag.changes import refresh
    from law_rag.collector import LawCollector
    from law_rag.embedder import make_embedder

    collector = LawCollector()
    try:
        report = refresh(collector, names, make_embedder())
    finally:
        collector.close()
    logger.info("법령 갱신: 변경 %d건, 실패 %d건, 알림 %d건", len(report.changed), len(report.failed), report.alerts_created)


@router.post("/internal/laws/refresh", status_code=202)
def refresh_laws(background: BackgroundTasks, body: RefreshBody | None = None,
                 authorization: str | None = Header(default=None)) -> dict:
    """예약 작업이 부르는 법령 재수집·변경 감지 (INTERNAL_TOKEN 보호). 오래 걸려서 백그라운드로 돌린다."""
    token = get_settings().internal_token
    sent = (authorization or "").removeprefix("Bearer ").strip()
    if not token or not hmac.compare_digest(sent, token):
        raise unauthorized()
    names = (body.names if body else None) or get_pack()["law_sources"]
    unknown = [n for n in names if n not in get_pack()["law_sources"]]
    if unknown:
        raise invalid_input(f"수집 대상이 아닌 법령입니다: {', '.join(unknown)}")
    background.add_task(_run_refresh, names)
    return {"status": "queued", "laws": len(names)}
