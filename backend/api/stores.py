"""가게·대시보드·점검 리포트 (API 명세서 3·5·6장)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import invalid_input, item_not_found
from db.models import Alert, ReportItem, Run, Store
from db.session import get_db
from services import cards as card_service
from services import serializers
from services.pack import get_pack

router = APIRouter(prefix="/api/stores/{store_id}")


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
