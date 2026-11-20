"""가게·대시보드·점검 리포트 (API 명세서 3·5·6장)."""

from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import current_user, owned_store
from api.errors import invalid_input, item_not_found
from db.models import Alert, ChangeLog, ReportItem, Run, Store, User
from db.session import get_db
from rules.engine import impact_of
from services import cards as card_service
from services import serializers
from services import store_register
from services import store_update
from services.analysis import lock_store, reanalysis_scope, start_run
from services.pack import get_pack
from services.timeutil import iso_kst

router = APIRouter(prefix="/api/stores/{store_id}")
# POST /api/stores 는 아직 store_id 가 없어 접두사 없는 라우터에 둔다
register_router = APIRouter(prefix="/api/stores")


# ---------- 가게 등록(첫 설정)·되묻기 답변 (API 명세서 3장, DB 명세서 4-1) ----------

class StoreCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=100)
    business_type_input: str
    address: str = Field(max_length=300)
    address_detail: str = Field(default="", max_length=100)
    opening_date: date
    owner_birth_year: int | None = Field(default=None, ge=1900, le=2100)


@register_router.post("", status_code=status.HTTP_201_CREATED)
def create_store(body: StoreCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    values = body.model_dump()
    for key in ("name", "business_type_input", "address", "address_detail"):
        values[key] = values[key].strip()
    for key, label in (("name", "가게 이름"), ("address", "주소")):
        if not values[key]:
            raise invalid_input(f"{label}을(를) 비울 수 없습니다.")
    return store_register.register(db, user, values)


class AnswersValues(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sells_alcohol: bool | None = None
    uses_terrace: bool | None = None
    has_employees: bool | None = None
    funds_krw: int | None = Field(default=None, ge=0)


class AnswersBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: AnswersValues


@router.post("/answers")
def save_answers(body: AnswersBody, store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    """보낸 필드만 저장한다 (생략 = 그대로, false = false). 예/아니요 답은 비울 수 없고 준비 자금만 null 로 지울 수 있다."""
    sent = body.answers.model_fields_set
    if not sent:
        raise invalid_input("저장할 답변이 없습니다.")
    values = {k: getattr(body.answers, k) for k in sent}
    for key in ("sells_alcohol", "uses_terrace", "has_employees"):
        if key in values and values[key] is None:
            raise invalid_input(f"{key} 답변은 비울 수 없습니다. 예(true) 또는 아니요(false)로 보내 주세요.")
    return store_register.save_answers(db, store, values)


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
def choose(item_id: str, body: ChooseBody, request: Request, store: Store = Depends(owned_store),
           db: Session = Depends(get_db)) -> dict:
    card = get_card(db, store, item_id)
    pack = get_pack(store)
    try:
        card_service.validate_option(card, body.option_id)
    except card_service.InvalidInput as exc:
        raise invalid_input(str(exc)) from exc
    store = lock_store(db, store)  # 분석 중이면 409이고 아무것도 저장하지 않는다
    result = card_service.choose(db, pack, store, card, body.option_id)
    # 이전 선택을 비우기 전 ↔ 새 선택 적용 후 유효 값이 바뀐 값만 영향 표로 재분석 범위를 정한다
    scope = reanalysis_scope(impact_of(pack, result.changed_fields)["run"])
    response = {
        "item_id": card.item_key,
        "chosen_option": card.chosen_option,
        "applied": result.applied,
        "added_checklist": result.added_checklist,
        "applied_changes": result.applied_changes,
        "verdict_before": card.verdict_before,
        "resolved_title": card.resolved_title,
        "recomputed": ["checklist"] if (result.applied or result.added_checklist) else [],
        # 최종 값은 서버가 실제로 새 run을 만들었는지다 (선택지 apply.needs_reanalyze 는 AI가 붙인 안내일 뿐)
        "needs_reanalyze": False,
        "run_id": None,
    }
    if scope:
        # 선택 내용과 새 run을 같은 트랜잭션으로 커밋한다. 실패하면 예외로 끝나고 선택도 저장되지 않는다
        response["run_id"] = str(start_run(db, store, request.app.state.analysis_manager, scope))
    else:
        db.commit()
    response["needs_reanalyze"] = response["run_id"] is not None
    return response


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


# ---------- 마이페이지: 가게 정보 수정 (API 명세서 3장, DB 명세서 4-5) ----------

class AnswersPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sells_alcohol: bool | None = None
    uses_terrace: bool | None = None
    has_employees: bool | None = None
    funds_krw: int | None = None


class StorePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    business_type_input: str | None = None
    address: str | None = None
    address_detail: str | None = None
    opening_date: date | None = None
    owner_birth_year: int | None = None
    answers: AnswersPatch | None = None


NULLABLE = {"owner_birth_year", "funds_krw"}
REQUIRED_TEXT = {"name", "business_type_input", "address"}


def _patch_values(body: StorePatch) -> dict[str, Any]:
    """보낸 필드만 규칙 묶음 키로 펼친다. 값 검증 실패는 400 INVALID_INPUT."""
    values = {k: getattr(body, k) for k in body.model_fields_set if k != "answers"}
    if body.answers is not None:
        values.update({k: getattr(body.answers, k) for k in body.answers.model_fields_set})
    for key, value in values.items():
        if value is None and key not in NULLABLE:
            raise invalid_input(f"{key} 값은 비울 수 없습니다.")
        if isinstance(value, str):
            values[key] = value = value.strip()
            if key in REQUIRED_TEXT and not value:
                raise invalid_input("주소를 비울 수 없습니다." if key == "address" else f"{key} 값은 비울 수 없습니다.")
    year = values.get("owner_birth_year")
    if year is not None and not 1900 <= year <= date.today().year:
        raise invalid_input("출생 연도가 올바르지 않습니다.")
    if values.get("funds_krw") is not None and values["funds_krw"] < 0:
        raise invalid_input("준비 자금은 0 이상이어야 합니다.")
    return values


@router.patch("")
def update_store(body: StorePatch, request: Request, dry_run: bool = Query(default=False),
                 store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    values = _patch_values(body)
    pack = get_pack(store)
    if not dry_run:
        store = lock_store(db, store)  # 분석 중이면 409이고 아무것도 저장하지 않는다
    cards, items = card_service.load_state(db, store)
    plan = store_update.plan_update(pack, store, cards, items, values)
    if not plan.changes:
        raise invalid_input("바뀐 값이 없습니다.")
    response = store_update.plan_response(store, plan, dry_run=dry_run)
    if dry_run:
        return response  # 미리보기는 DB를 바꾸지 않는다
    store_update.apply_update(db, pack, store, cards, items, plan)
    if plan.scope:
        # 변경 내용과 새 run을 같은 트랜잭션으로 커밋한다 (runs.trigger = user)
        response["run_id"] = str(start_run(db, store, request.app.state.analysis_manager, plan.scope))
    else:
        db.commit()
    response["needs_reanalyze"] = response["run_id"] is not None  # 실제로 새 run을 만들었는지
    return response


@router.get("/changes")
def changes(store: Store = Depends(owned_store), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ChangeLog).where(ChangeLog.store_id == store.id)
                      .order_by(ChangeLog.created_at.desc(), ChangeLog.id.desc()).limit(store_update.KEEP_CHANGES))
    return {"items": [{"change_id": str(r.id), "at": iso_kst(r.created_at)[:10], "changed": r.changed,
                       "impacts": r.impacts, "reset_items": r.reset_items, "lines": r.lines} for r in rows]}
