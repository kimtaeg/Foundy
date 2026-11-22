"""가입 이후 첫 가게 분석까지의 상태. 점검 결과 본문을 읽지 않는다."""

from uuid import UUID

from sqlalchemy import select, true
from sqlalchemy.orm import Session

from db.models import Run, Store, User
from services import serializers

REQUIRED_STORE_FIELDS = ("name", "business_type_input", "address", "opening_date")
REQUIRED_ANSWERS = ("sells_alcohol", "uses_terrace", "has_employees")


def missing_fields(store: Store | None) -> list[str]:
    if store is None:
        return [*REQUIRED_STORE_FIELDS, *REQUIRED_ANSWERS]
    fields = [key for key in REQUIRED_STORE_FIELDS if not str(getattr(store, key) or "").strip()]
    return fields + [key for key in REQUIRED_ANSWERS if getattr(store, key) is None]


def setup_status(store: Store | None, run_id: UUID | None = None, run_status: str | None = None) -> dict:
    missing = missing_fields(store)
    if store is None:
        status = "missing_store"
    elif store.onboarded_at is not None or run_status == "done":
        # 이전 버전에서 기본 답변을 일부 받지 않고 분석한 가게도 기존 결과를 유지한다.
        status, missing = "ready", []
    elif missing:
        status = "missing_answers"
    elif run_status in ("queued", "running"):
        status = "analyzing"
    elif run_status == "failed":
        status = "failed"
    else:
        status = "needs_analysis"
    return {"status": status, "missing_fields": missing, "run_id": str(run_id) if run_id else None}


def _latest_run(store_id):
    return (select(Run.id.label("run_id"), Run.status.label("run_status"))
            .where(Run.store_id == store_id).order_by(Run.created_at.desc(), Run.id.desc()).limit(1))


def latest_run_state(db: Session, store: Store) -> tuple[UUID | None, str | None]:
    row = db.execute(_latest_run(store.id)).one_or_none()
    return (row.run_id, row.run_status) if row else (None, None)


def status_for_store(db: Session, store: Store) -> dict:
    return setup_status(store, *latest_run_state(db, store))


def account_identity(user: User, store: Store | None = None, run_id: UUID | None = None,
                     run_status: str | None = None) -> dict:
    return {
        "user": serializers.user(user),
        "store_id": str(store.id) if store else None,
        "store_name": store.name if store else None,
        "store_opening": store.opening_date.isoformat() if store and store.opening_date else None,
        "setup": setup_status(store, run_id, run_status),
    }


def identity_query():
    """계정과 첫 설정 상태를 함께 읽는다. 아직 가게가 없는 계정도 포함한다."""
    latest = _latest_run(Store.id).correlate(Store).lateral()
    return (select(User, Store, latest.c.run_id, latest.c.run_status)
            .outerjoin(Store, Store.user_id == User.id).outerjoin(latest, true()))


def read_identity(db: Session, user: User) -> dict:
    row = db.execute(identity_query().where(User.id == user.id)).one_or_none()
    return account_identity(*row) if row else account_identity(user)
