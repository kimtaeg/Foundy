"""서류함 (API 명세서 7장): 서류별 상태·이력. 체크리스트 완료와 별개로 관리한다."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import ApiError, invalid_input
from db.models import ChecklistItem, DocumentRequirement, LegalObligation, ReportItem, Store
from db.session import get_db
from services import documents as docs
from services.pack import get_pack
from services.serializers import DOCUMENTS_DISCLAIMER
from services.store_collections import read_store_collections
from services.timeutil import today_kst

router = APIRouter(prefix="/api/stores/{store_id}/documents")


def _not_found() -> ApiError:
    return ApiError(404, "DOCUMENT_NOT_FOUND", "서류를 찾을 수 없습니다.")


def _wrap(error: docs.DocumentError) -> ApiError:
    return ApiError(error.status, error.code, error.message)


def _lock_store(db: Session, store: Store) -> None:
    if db.scalar(select(Store).where(Store.id == store.id).with_for_update()
                 .execution_options(populate_existing=True)) is None:
        raise _not_found()


def _collections(db: Session, store: Store, *, refresh: bool = False):
    cards, items, obligations, rows = read_store_collections(
        db, store.id, ReportItem, ChecklistItem, LegalObligation, DocumentRequirement, refresh=refresh)
    cards.sort(key=lambda card: card.item_key)
    items.sort(key=lambda item: item.item_key)
    return cards, items, obligations, rows


def _state(db: Session, store: Store, *, write: bool = False):
    if write:
        _lock_store(db, store)
    pack = get_pack(store)
    cards, items, obligations, rows = _collections(db, store)
    changes, obsolete = docs.requirement_changes(pack, store, cards, items, obligations, rows)
    if (changes or obsolete) and not write:
        # 일반 조회는 잠그지 않는다. 동기화가 필요할 때만 쓰기 잠금 뒤 최신 상태를 다시 확인한다.
        _lock_store(db, store)
        pack = get_pack(store)
        cards, items, obligations, rows = _collections(db, store, refresh=True)
        changes, obsolete = docs.requirement_changes(pack, store, cards, items, obligations, rows)
    synced = bool(changes or obsolete)
    if synced:
        docs.apply_requirement_changes(db, store, rows, changes, obsolete)
    return pack, cards, items, rows, synced


def _row(db: Session, store: Store, doc_key: str, *, write: bool = False):
    pack, _, items, rows, synced = _state(db, store, write=write)
    row = next((r for r in rows if r.doc_key == doc_key), None)
    if row is None:
        raise _not_found()
    return pack, items, row, synced


def _view(db: Session, pack: dict, items: list, row: DocumentRequirement) -> dict:
    return docs.requirement_view(db, pack, row, {i.item_key: i for i in items}, today_kst(), with_history=True)


@router.get("")
def list_documents(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    pack, cards, items, rows, synced = _state(db, store)
    body = docs.documents_response(db, pack, store, cards, rows, items, today_kst(), DOCUMENTS_DISCLAIMER)
    if synced:
        db.commit()
    return body


@router.get("/{doc_key}")
def get_document(doc_key: str, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    pack, items, row, synced = _row(db, store, doc_key)
    body = _view(db, pack, items, row)
    if synced:
        db.commit()
    return body


class StatusBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    note: str | None = Field(default=None, max_length=500)
    review_ack: bool | None = None  # true: 법령·서식 개정 등으로 표시된 "다시 확인" 안내를 확인했다


@router.patch("/{doc_key}")
def patch_document(doc_key: str, body: StatusBody, store: Store = Depends(owned_store),
                   db: Session = Depends(get_db), detail: Literal["full", "status"] = Query(default="full")) -> dict:
    if body.status is None and not body.review_ack:
        raise invalid_input("status 또는 review_ack 가 필요합니다.")
    pack, items, row, synced = _row(db, store, doc_key, write=True)
    try:
        if body.status is not None:
            docs.set_status(db, row, body.status, body.note)
        if body.review_ack:
            row.review_needed, row.review_reason = False, None
    except docs.DocumentError as e:
        raise _wrap(e)
    if detail == "status":
        result = {**docs.requirement_status(row), "catalog_changed": synced}
    else:
        db.flush()
        result = _view(db, pack, items, row)
    db.commit()
    return result
