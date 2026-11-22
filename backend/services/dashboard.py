"""대시보드에 필요한 가게별 상태를 한 번에 읽는다."""

from sqlalchemy import and_, literal, select, union_all
from sqlalchemy.orm import Session

from db.models import Alert, ChecklistItem, DocumentRequirement, ReportItem, Run, Store
from services import serializers
from services.pack import get_pack


def latest_run_query(store_id):
    return (select(Run).where(Run.store_id == store_id, Run.status == "done")
            .order_by(Run.finished_at.desc().nulls_last(), Run.created_at.desc()).limit(1))


def view(db: Session, store: Store) -> dict:
    # 종류별 ID를 먼저 합쳐서 왕복을 하나로 줄이고, 여러 목록을 곱으로 조인하지 않는다.
    models = (ReportItem, ChecklistItem, Alert, DocumentRequirement, Run)
    latest_id = latest_run_query(store.id).with_only_columns(Run.id).scalar_subquery()
    keys = union_all(*(
        select(literal(slot).label("slot"), model.id.label("id")).where(
            model.id == latest_id if model is Run else model.store_id == store.id
        ) for slot, model in enumerate(models)
    )).subquery()
    query = select(keys.c.slot, *models).select_from(keys)
    for slot, model in enumerate(models):
        query = query.outerjoin(model, and_(keys.c.slot == slot, model.id == keys.c.id))

    collections = [[] for _ in models]
    for row in db.execute(query):
        collections[row.slot].append(row[row.slot + 1])
    cards, items, alerts, requirements, runs = collections
    cards.sort(key=lambda item: item.item_key)
    items.sort(key=lambda item: item.item_key)
    # 생성 시간이 같은 알림은 조회 계획과 무관하게 항상 같은 순서로 표시한다.
    alerts.sort(key=lambda alert: alert.dedupe_key)
    return serializers.dashboard(get_pack(store), store, cards, items, alerts, next(iter(runs), None), requirements or None)
