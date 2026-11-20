"""알림 (API 명세서 12장). as_of(시연용 시점 이동)가 오면 저장하지 않는 예시 알림을 앞에 붙인다."""

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import item_not_found
from db.models import Alert, Store
from db.session import get_db
from services import cards as card_service
from services import serializers
from services.effective import effective_store
from services.example_alerts import example_alerts
from services.pack import get_pack, hidden_categories, task_title
from services.timeutil import today_kst

router = APIRouter(prefix="/api/stores/{store_id}")

AlertType = Literal["decision", "next", "deadline", "change", "grant"]


@router.get("/alerts")
def list_alerts(type: AlertType | None = Query(default=None), as_of: date | None = Query(default=None),
                store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    query = select(Alert).where(Alert.store_id == store.id)
    if type:
        query = query.where(Alert.type == type)
    rows = db.scalars(query.order_by(Alert.created_at.desc(), Alert.dedupe_key))
    stored = [serializers.alert(a) for a in rows]
    if as_of is None:
        return {"as_of": today_kst().isoformat(), "items": stored}
    # 시점 이동: 예시 알림은 저장하지 않고 응답에만 붙인다 (is_example: true, 실제 알림 앞)
    pack = get_pack(store)
    cards, items = card_service.load_state(db, store)
    eff = effective_store(pack, store, cards)
    hidden = {h["category"] for h in hidden_categories(pack, eff)}
    examples = example_alerts(items, store.opening_date, as_of, hidden,
                              lambda i: task_title(pack, i.task, eff, i.rule_key))
    if type:
        examples = [a for a in examples if a["type"] == type]
    return {"as_of": as_of.isoformat(), "items": examples + stored}


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
