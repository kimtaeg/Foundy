"""지원사업 API: 저장된 판정 결과 조회, K-Startup 공고 다시 조회·판정."""

from time import perf_counter

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from agent.cost import CostTracker
from agent.grants import judge_grants
from api.deps import owned_store
from db.models import Store
from db.session import get_db
from services import grants as service
from services.timeutil import today_kst
from tools.analysis import make_dependencies

router = APIRouter(prefix="/api/stores/{store_id}/grants")


@router.get("")
def list_grants(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """저장된 지원사업 판정 결과. 아직 조회한 적이 없으면 status=empty 이고, POST /refresh 로 만든다."""
    return service.view(db, store)


@router.post("/refresh")
def refresh_grants(response: Response, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """K-Startup 공고를 확인하고 원문과 가게 정보가 달라졌을 때 판정한다.

    조회에 실패하면 이전 결과를 그대로 두고 error 를 함께 돌려준다.
    """
    start = perf_counter()
    timings = []

    def measure(name: str) -> None:
        nonlocal start
        now = perf_counter()
        timings.append(f"{name};dur={(now - start) * 1000:.1f}")
        start = now

    value, rows = service.snapshot(db, store)
    db.commit()  # 외부 조회·AI 호출 동안 트랜잭션을 잡지 않는다
    measure("store")
    cost = CostTracker()
    tools, llm = make_dependencies(cost)
    try:
        res = service.fetch_candidates(value, tools)
    finally:
        tools.close()
    measure("notices")

    today = today_kst()
    key = service.judgment_key(value, res, today)
    if not res.ok or not res.data:
        view = service.rows_view(rows, error=res.error or "조회 실패")
    else:
        if not service.reusable(rows, key):
            result = judge_grants(llm, value, res, today)
            measure("judge")
            rows = service.save(db, store, result, res, cost, key)
            db.commit()
            measure("write")
        view = service.rows_view(rows)
    response.headers["Server-Timing"] = ", ".join(timings)
    return view
