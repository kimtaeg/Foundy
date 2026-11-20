"""알림 (API 명세서 12장). 시점 이동(as_of)은 아직 만들지 않아 오늘 기준으로만 응답한다."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import item_not_found
from db.models import Alert, Store
from db.session import get_db
from services import serializers
from services.timeutil import today_kst

router = APIRouter(prefix="/api/stores/{store_id}")

AlertType = Literal["decision", "next", "deadline", "change", "grant"]


@router.get("/alerts")
def list_alerts(type: AlertType | None = Query(default=None), store: Store = Depends(owned_store),
                db: Session = Depends(get_db)) -> dict:
    query = select(Alert).where(Alert.store_id == store.id)
    if type:
        query = query.where(Alert.type == type)
    rows = db.scalars(query.order_by(Alert.created_at.desc(), Alert.dedupe_key))
    return {"as_of": today_kst().isoformat(), "items": [serializers.alert(a) for a in rows]}


class AlertPatch(BaseModel):
    read: bool


@router.patch("/alerts/{alert_id}")
def patch_alert(alert_id: str, body: AlertPatch, store: Store = Depends(owned_store),
                db: Session = Depends(get_db)) -> dict:
    try:
        aid = uuid.UUID(alert_id)
    except ValueError:
        raise item_not_found() from None
    alert = db.scalar(select(Alert).where(Alert.id == aid, Alert.store_id == store.id))
    if alert is None:
        raise item_not_found()
    alert.read = body.read
    db.commit()
    return serializers.alert(alert)
