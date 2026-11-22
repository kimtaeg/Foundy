"""GET·PATCH /api/me — 토큰의 계정과 가게 id, 계정 이름 수정 (API 명세서 1장)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from api.deps import SignedToken, signed_token
from api.errors import invalid_input, unauthorized
from db.session import get_db
from services.store_setup import account_identity, identity_query
from services.timeutil import now_utc

router = APIRouter()
NAME_MAX = 30


def identity_record(token: SignedToken = Depends(signed_token), db: Session = Depends(get_db)):
    result = db.execute(identity_query().where(token.user_filter())).one_or_none()
    if result is None:
        raise unauthorized()
    return result


@router.get("/api/me")
def me(identity=Depends(identity_record)) -> dict:
    return account_identity(*identity)


class MePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=NAME_MAX)


@router.patch("/api/me")
def update_me(body: MePatch, identity=Depends(identity_record), db: Session = Depends(get_db)) -> dict:
    """계정 표시 이름만 바꾼다. 가게 이름·점검 결과에는 영향이 없다."""
    name = body.name.strip()
    if not name:
        raise invalid_input("이름을 비울 수 없습니다.")
    user = identity[0]
    user.name, user.updated_at = name, now_utc()
    db.commit()
    return account_identity(*identity)
