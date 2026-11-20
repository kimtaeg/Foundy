"""GET·PATCH /api/me — 토큰의 계정과 가게 id, 계정 이름 수정 (API 명세서 1장)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import current_user
from api.errors import invalid_input
from db.models import Store, User
from db.session import get_db
from services import serializers
from services.timeutil import now_utc

router = APIRouter()
NAME_MAX = 30


def _me(db: Session, user: User) -> dict:
    store_id = db.scalar(select(Store.id).where(Store.user_id == user.id))
    return {"user": serializers.user(user), "store_id": str(store_id) if store_id else None}


@router.get("/api/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return _me(db, user)


class MePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=NAME_MAX)


@router.patch("/api/me")
def update_me(body: MePatch, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """계정 표시 이름만 바꾼다. 가게 이름·점검 결과에는 영향이 없다."""
    name = body.name.strip()
    if not name:
        raise invalid_input("이름을 비울 수 없습니다.")
    user.name, user.updated_at = name, now_utc()
    db.commit()
    return _me(db, user)
