"""임대료 비교 API: 한국부동산원 통계와 내 월세·보증금을 비교한다 (저장하지 않음)."""

from fastapi import APIRouter, Depends, Query

from api.deps import owned_store
from db.models import Store
from services import rent as service
from tools.analysis import AnalysisTools
from tools.providers import Providers

router = APIRouter(prefix="/api/stores/{store_id}/rent")


@router.get("")
def compare_rent(
    monthly_rent: int | None = Query(default=None, ge=0, le=1_000_000_000, description="월세(원)"),
    deposit: int | None = Query(default=None, ge=0, le=100_000_000_000, description="보증금(원)"),
    area: float | None = Query(default=None, gt=0, le=100_000, description="임대면적(㎡, 전용+공용). 없으면 영업장 면적"),
    store: Store = Depends(owned_store),
) -> dict:
    tools = AnalysisTools(providers=Providers())
    try:
        return service.view(store, tools, monthly_rent=monthly_rent, deposit=deposit, area=area)
    finally:
        tools.close()
