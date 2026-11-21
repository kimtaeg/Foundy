"""개업 체크리스트·서류함 (API 명세서 7장)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import invalid_input, item_not_found
from db.models import Store
from db.session import get_db
from services import cards as card_service
from services import serializers
from services.effective import effective_store
from services.links import link_map
from services.pack import get_pack
from services.timeutil import today_kst

router = APIRouter(prefix="/api/stores/{store_id}")


@router.get("/checklist")
def checklist(view: Literal["timeline", "category"] = Query(default="timeline"),
              store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    cards, items = card_service.load_state(db, store)
    return serializers.checklist(get_pack(store), store, cards, items, view)


class ChecklistPatch(BaseModel):
    done: bool | None = None
    review_ack: bool | None = None  # true: 법령 개정 등으로 표시된 "다시 확인" 안내를 확인했다


@router.patch("/checklist/{item_id}")
def patch_checklist(item_id: str, body: ChecklistPatch, store: Store = Depends(owned_store),
                    db: Session = Depends(get_db)) -> dict:
    cards, items = card_service.load_state(db, store)
    item = next((i for i in items if i.item_key == item_id), None)
    if item is None:
        raise item_not_found()
    if body.done is None and not body.review_ack:
        raise invalid_input("done 또는 review_ack 가 필요합니다.")
    if body.done is not None:
        card_service.set_checklist_done(item, body.done)
    if body.review_ack:
        item.review_needed, item.review_reason = False, None
    db.commit()
    pack = get_pack(store)
    return serializers.checklist_item(pack, item, effective_store(pack, store, cards),
                                      link_map(pack, cards, items), today_kst(),
                                      (store.address_codes or {}).get("sigungu_cd"))
