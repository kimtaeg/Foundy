"""개업 체크리스트·서류함 (API 명세서 7장)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import invalid_input, item_not_found
from db.models import ChecklistItem, DocumentRequirement, ReportItem, Store
from db.session import get_db
from services import cards as card_service
from services import serializers
from services.effective import effective_store
from services.links import link_map
from services.pack import get_pack
from services.store_collections import read_store_collections
from services.timeutil import today_kst

router = APIRouter(prefix="/api/stores/{store_id}")


@router.get("/checklist")
def checklist(view: Literal["timeline", "category"] = Query(default="timeline"),
              store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    cards, items, requirements = read_store_collections(db, store.id, ReportItem, ChecklistItem, DocumentRequirement)
    cards.sort(key=lambda card: card.item_key)
    return serializers.checklist(get_pack(store), store, cards, items, view, requirements or None)


class ChecklistPatch(BaseModel):
    done: bool | None = None
    review_ack: bool | None = None  # true: 법령 개정 등으로 표시된 "다시 확인" 안내를 확인했다


@router.patch("/checklist/{item_id}")
def patch_checklist(item_id: str, body: ChecklistPatch, store: Store = Depends(owned_store),
                    db: Session = Depends(get_db), detail: Literal["full", "status"] = Query(default="full")) -> dict:
    if body.done is None and not body.review_ack:
        raise invalid_input("done 또는 review_ack 가 필요합니다.")
    values = card_service.checklist_done_values(body.done) if body.done is not None else {}
    if body.review_ack:
        values.update(review_needed=False, review_reason=None)
    # 화면에 이미 있는 항목은 저장한 상태만 적용하므로 관련 카드나 서류를 다시 읽지 않는다.
    if detail == "status":
        query = (update(ChecklistItem).where(ChecklistItem.store_id == store.id, ChecklistItem.item_key == item_id)
                 .values(**values).returning(ChecklistItem.item_key.label("item_id"), ChecklistItem.done,
                                              ChecklistItem.auto_checked, ChecklistItem.review_needed,
                                              ChecklistItem.review_reason))
        row = db.execute(query).mappings().one_or_none()
        if row is None:
            raise item_not_found()
        db.commit()
        return dict(row)
    cards, items = read_store_collections(db, store.id, ReportItem, ChecklistItem)
    cards.sort(key=lambda card: card.item_key)
    item = next((i for i in items if i.item_key == item_id), None)
    if item is None:
        raise item_not_found()
    for key, value in values.items():
        setattr(item, key, value)
    db.commit()
    pack = get_pack(store)
    return serializers.checklist_item(pack, item, effective_store(pack, store, cards),
                                      link_map(pack, cards, items), today_kst(),
                                      (store.address_codes or {}).get("sigungu_cd"))
