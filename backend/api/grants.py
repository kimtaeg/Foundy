"""지원사업 API: 저장된 판정 결과 조회, K-Startup 공고 다시 조회·판정."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from agent.cost import CostTracker
from api.deps import owned_store
from db.models import Store
from db.session import get_db
from services import grants as service

router = APIRouter(prefix="/api/stores/{store_id}/grants")


@router.get("")
def list_grants(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """저장된 지원사업 판정 결과. 아직 조회한 적이 없으면 status=empty 이고, POST /refresh 로 만든다."""
    return service.view(db, store)


@router.post("/refresh")
def refresh_grants(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """K-Startup 모집 중 공고를 조회해 이 가게의 신청 가능성을 다시 판정한다 (AI 호출이 있어 수십 초 걸릴 수 있다).

    조회에 실패하면 이전 결과를 그대로 두고 error 를 함께 돌려준다.
    """
    value = service.snapshot(db, store)
    db.commit()  # 외부 조회·AI 호출 동안 트랜잭션을 잡지 않는다
    cost = CostTracker()
    result, res = service.fetch_and_judge(value, cost=cost)
    service.save(db, store, result, res, cost)
    db.commit()
    return service.view(db, store, error=None if result.ok else (res.error or "조회 실패"))
