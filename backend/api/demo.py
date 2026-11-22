"""POST /api/demo — 예시 계정(이서연 씨 사례). 미리 저장한 결과를 새 store_id로 복사하고 로그인 토큰을 준다."""

from fastapi import APIRouter, status

from db.seed_demo import seed_demo
from db.session import transaction
from services.auth import issue_token

router = APIRouter()


@router.post("/api/demo", status_code=status.HTTP_201_CREATED)
def create_demo() -> dict:
    with transaction() as session:
        created = seed_demo(session)
    return {"access_token": issue_token(created["user"]["user_id"]), **created, "cached": True,
            "setup": {"status": "ready", "missing_fields": [], "run_id": created["run_id"]}}
