"""GET /api/me — 토큰의 계정과 가게 id."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import current_user
from db.models import Store, User
from db.session import get_db
from services import serializers

router = APIRouter()


@router.get("/api/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    store_id = db.scalar(select(Store.id).where(Store.user_id == user.id))
    return {"user": serializers.user(user), "store_id": str(store_id) if store_id else None}
