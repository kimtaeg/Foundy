"""가게·대시보드·점검 리포트 (API 명세서 3·5·6장)."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import current_user, owned_store
from api.errors import invalid_input, item_not_found
from db.models import Alert, ReportItem, Run, Store, User
from db.session import get_db
from services import cards as card_service
from services import serializers
from services import store_register
from services.pack import get_pack

router = APIRouter(prefix="/api/stores/{store_id}")
# POST /api/stores 는 아직 store_id 가 없어 접두사 없는 라우터에 둔다
register_router = APIRouter(prefix="/api/stores")


# ---------- 가게 등록(첫 설정)·되묻기 답변 (API 명세서 3장, DB 명세서 4-1) ----------

class StoreCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=100)
    business_type_input: str
    address: str = Field(max_length=300)
    address_detail: str = Field(default="", max_length=100)
    opening_date: date
    owner_birth_year: int | None = Field(default=None, ge=1900, le=2100)


@register_router.post("", status_code=status.HTTP_201_CREATED)
def create_store(body: StoreCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    values = body.model_dump()
    for key in ("name", "business_type_input", "address", "address_detail"):
        values[key] = values[key].strip()
    for key, label in (("name", "가게 이름"), ("address", "주소")):
        if not values[key]:
            raise invalid_input(f"{label}을(를) 비울 수 없습니다.")
    return store_register.register(db, user, values)


class AnswersValues(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sells_alcohol: bool | None = None
    uses_terrace: bool | None = None
    has_employees: bool | None = None
    funds_krw: int | None = Field(default=None, ge=0)


class AnswersBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: AnswersValues


@router.post("/answers")
def save_answers(body: AnswersBody, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """보낸 필드만 저장한다 (생략 = 그대로, false = false). 예/아니요 답은 비울 수 없고 준비 자금만 null 로 지울 수 있다."""
    sent = body.answers.model_fields_set
    if not sent:
        raise invalid_input("저장할 답변이 없습니다.")
    values = {k: getattr(body.answers, k) for k in sent}
    for key in ("sells_alcohol", "uses_terrace", "has_employees"):
        if key in values and values[key] is None:
            raise invalid_input(f"{key} 답변은 비울 수 없습니다. 예(true) 또는 아니요(false)로 보내 주세요.")
    return store_register.save_answers(db, store, values)


def latest_run(db: Session, store: Store) -> Run | None:
    return db.scalar(select(Run).where(Run.store_id == store.id, Run.status == "done")
                     .order_by(Run.finished_at.desc().nulls_last(), Run.created_at.desc()).limit(1))


def get_card(db: Session, store: Store, item_id: str) -> ReportItem:
    card = db.scalar(select(ReportItem).where(ReportItem.store_id == store.id, ReportItem.item_key == item_id))
    if card is None:
        raise item_not_found()
    return card


@router.get("")
def get_store(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    cards, _ = card_service.load_state(db, store)
    return serializers.store(get_pack(store), store, cards)


@router.get("/dashboard")
def dashboard(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    cards, items = card_service.load_state(db, store)
    alerts = list(db.scalars(select(Alert).where(Alert.store_id == store.id)))
    return serializers.dashboard(get_pack(store), store, cards, items, alerts, latest_run(db, store))


@router.get("/report")
def report(stage: Literal["계약 전", "개업 전", "운영 중"] | None = Query(default=None),
           store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    cards, items = card_service.load_state(db, store)
    return serializers.report(get_pack(store), store, cards, items, latest_run(db, store), stage)


class ChooseBody(BaseModel):
    option_id: str


@router.post("/report/items/{item_id}/choose")
def choose(item_id: str, body: ChooseBody, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    card = get_card(db, store, item_id)
    try:
        result = card_service.choose(db, get_pack(store), store, card, body.option_id)
    except card_service.InvalidInput as exc:
        raise invalid_input(str(exc)) from exc
    db.commit()
    return {
        "item_id": card.item_key,
        "chosen_option": card.chosen_option,
        "applied": result.applied,
        "added_checklist": result.added_checklist,
        "applied_changes": result.applied_changes,
        "verdict_before": card.verdict_before,
        "resolved_title": card.resolved_title,
        "recomputed": ["checklist"] if (result.applied or result.added_checklist) else [],
        # 재분석(/analyze)은 아직 없어 실행을 시작하지 않는다. run_id 가 null 이면 진행 화면으로 가지 않는다
        "needs_reanalyze": result.needs_reanalyze,
        "run_id": None,
    }


class ActionBody(BaseModel):
    status: Literal["pending", "sent", "done"]
    reply: str | None = None


@router.post("/report/items/{item_id}/action")
def action(item_id: str, body: ActionBody, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    card = get_card(db, store, item_id)
    auto_checked, steps = card_service.set_action(db, get_pack(store), store, card, body.status, body.reply)
    db.commit()
    return {"item_id": card.item_key, "action_status": card.action_status, "action_reply": card.action_reply,
            "auto_checked": auto_checked, "next_steps": steps}
