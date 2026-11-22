"""임대료 비교 API: 한국부동산원 통계와 내 월세·보증금을 비교한다 (저장하지 않음)."""

from fastapi import APIRouter, Depends, Query

from api.deps import owned_store
from api.errors import invalid_input
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
    lat: float | None = Query(default=None, ge=33, le=39, description="지도 중심 위도. lng 와 함께 보내면 지도 중심 기준"),
    lng: float | None = Query(default=None, ge=124, le=132, description="지도 중심 경도. lat 와 함께 보내야 한다"),
    store: Store = Depends(owned_store),
) -> dict:
    if (lat is None) != (lng is None):
        raise invalid_input("lat·lng 는 함께 보내야 합니다.")
    tools = AnalysisTools(providers=Providers())
    try:
        return service.view(store, tools, monthly_rent=monthly_rent, deposit=deposit, area=area, lat=lat, lng=lng)
    finally:
        tools.close()
