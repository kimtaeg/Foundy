"""같은 가게의 독립적인 목록을 한 번의 DB 왕복으로 읽는다."""

from typing import Any

from sqlalchemy import and_, literal, select, union_all
from sqlalchemy.orm import Session


def read_store_collections(db: Session, store_id, *models, refresh: bool = False) -> list[list[Any]]:
    # 종류별 PK를 합친 뒤 해당 테이블만 연결해 목록 사이의 카테시안 곱을 만들지 않는다.
    keys = union_all(*(
        select(literal(slot).label("slot"), model.id.label("id")).where(model.store_id == store_id)
        for slot, model in enumerate(models)
    )).subquery()
    query = select(keys.c.slot, *models).select_from(keys)
    for slot, model in enumerate(models):
        query = query.outerjoin(model, and_(keys.c.slot == slot, model.id == keys.c.id))
    if refresh:
        query = query.execution_options(populate_existing=True)
    collections = [[] for _ in models]
    for row in db.execute(query):
        collections[row.slot].append(row[row.slot + 1])
    return collections
