"""POST /api/demo — 예시 계정(이서연 씨 사례). 미리 저장한 결과를 새 store_id로 복사한다.

로그인(JWT)은 아직 없으므로 access_token 은 내리지 않는다. 시드는 분석 실행(runs)을 만들지 않아 run_id 는 null.
"""

from fastapi import APIRouter, status

from db.seed_demo import seed_demo
from db.session import transaction

router = APIRouter()


@router.post("/api/demo", status_code=status.HTTP_201_CREATED)
def create_demo() -> dict:
    with transaction() as session:
        created = seed_demo(session)
    return {**created, "run_id": None, "cached": True}
