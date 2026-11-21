"""서류함 (API 명세서 7장): 서류별 상태·이력. 체크리스트 완료와 별개로 관리한다."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from api.deps import owned_store
from api.errors import ApiError, invalid_input
from db.models import DocumentRequirement, Store
from db.session import get_db
from services import cards as card_service
from services import documents as docs
from services.pack import get_pack
from services.serializers import DOCUMENTS_DISCLAIMER
from services.timeutil import today_kst

router = APIRouter(prefix="/api/stores/{store_id}/documents")


def _not_found() -> ApiError:
    return ApiError(404, "DOCUMENT_NOT_FOUND", "서류를 찾을 수 없습니다.")


def _wrap(error: docs.DocumentError) -> ApiError:
    return ApiError(error.status, error.code, error.message)


def _state(db: Session, store: Store):
    cards, items = card_service.load_state(db, store)
    pack = get_pack(store)
    rows = docs.sync_requirements(db, pack, store, cards, items)
    return pack, items, rows


def _row(db: Session, store: Store, doc_key: str):
    pack, items, rows = _state(db, store)
    row = next((r for r in rows if r.doc_key == doc_key), None)
    if row is None:
        raise _not_found()
    return pack, items, row


def _view(db: Session, pack: dict, store: Store, items: list, row: DocumentRequirement, history: bool = True) -> dict:
    return docs.requirement_view(db, pack, row, {i.item_key: i for i in items}, today_kst(), with_history=history)


@router.get("")
def list_documents(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    pack, items, rows = _state(db, store)
    body = docs.documents_response(db, pack, store, rows, items, today_kst(), DOCUMENTS_DISCLAIMER)
    db.commit()  # 요구사항 동기화 결과를 저장한다 (멱등)
    return body


@router.get("/{doc_key}")
def get_document(doc_key: str, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    pack, items, row = _row(db, store, doc_key)
    body = _view(db, pack, store, items, row)
    db.commit()
    return body


class StatusBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    note: str | None = Field(default=None, max_length=500)
    review_ack: bool | None = None  # true: 법령·서식 개정 등으로 표시된 "다시 확인" 안내를 확인했다


@router.patch("/{doc_key}")
def patch_document(doc_key: str, body: StatusBody, store: Store = Depends(owned_store),
                   db: Session = Depends(get_db)) -> dict:
    if body.status is None and not body.review_ack:
        raise invalid_input("status 또는 review_ack 가 필요합니다.")
    pack, items, row = _row(db, store, doc_key)
    try:
        if body.status is not None:
            docs.set_status(db, row, body.status, body.note)
        if body.review_ack:
            row.review_needed, row.review_reason = False, None
    except docs.DocumentError as e:
        raise _wrap(e)
    db.commit()
    return _view(db, pack, store, items, row)
