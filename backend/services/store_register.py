"""가게 등록(첫 설정)과 되묻기 답변 (API 명세서 3장, DB 명세서 4-1).

- 업종 입력은 규칙 묶음의 business_type_inputs 안에서만 받는다 (등록·수정 공용 검증).
- 주소는 tools/address.py 로 변환한다. 실제 조회 결과가 없거나 여럿이면 422, 키 없음·USE_MOCK·조회 장애면 코드 없이 등록.
- 답변 칸은 NULL = 아직 답하지 않음. 부분 답변은 보낸 필드만 바꾸고(생략 = 그대로), 명시한 false 는 false 로 저장한다.
- 신고 업종(business_type)은 규칙 묶음 derive 로 정한다 (AI 아님).
"""

from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from agent.cost import CostTracker
from agent.llm import LLMError, make_llm
from agent.ports import StoreInput
from agent.questions import select_questions
from api.errors import ApiError, invalid_input
from config import get_settings
from db.models import Run, Store, User
from rules.engine import business_type_reason, pending_questions
from services.pack import business_type, get_pack
from services.timeutil import now_utc
from tools.address import AddressResult, resolve_address

ANSWER_KEYS = ("sells_alcohol", "uses_terrace", "has_employees", "funds_krw")
ACTIVE = ("queued", "running")


def supported_business_types(pack: dict) -> list[str]:
    return list(pack.get("business_type_inputs") or [])


def validate_business_type(pack: dict, value: str) -> str:
    """가게 등록·수정이 같이 쓰는 업종 검증. 규칙 묶음에 없는 업종은 400 (DB CHECK 위반으로 500이 나지 않게)."""
    allowed = supported_business_types(pack)
    if value not in allowed:
        raise invalid_input(f"지원하지 않는 업종입니다. 가능한 값: {', '.join(allowed)}")
    return value


def store_exists() -> ApiError:
    return ApiError(409, "STORE_EXISTS", "이미 가게를 등록했습니다. 수정은 마이페이지에서 해 주세요.")


def address_not_resolved(result: AddressResult) -> ApiError:
    message = ("주소를 찾지 못했습니다. 도로명주소를 다시 확인해 주세요." if result.status == "not_found"
               else "주소 후보가 여러 개입니다. 아래 후보 중 하나로 다시 입력해 주세요.")
    return ApiError(422, "ADDRESS_NOT_RESOLVED", message, {"reason": result.status, "candidates": result.candidates})


def question_llm():
    """되묻기 질문을 고를 LLM. 테스트가 바꿔 끼운다. 설정이 없으면 None (규칙 후보를 모두 묻는다)."""
    try:
        return make_llm(CostTracker())
    except LLMError:
        return None


def _answers(store: Store) -> dict:
    return {k: getattr(store, k) for k in ANSWER_KEYS}


def _questions_for_registration(pack: dict, store: Store) -> list[dict]:
    snapshot = StoreInput(store_id=str(store.id), name=store.name, business_type_input=store.business_type_input,
                          address=store.address, address_detail=store.address_detail, opening_date=store.opening_date,
                          answers=_answers(store), owner_birth_year=store.owner_birth_year)
    llm = question_llm()
    try:
        questions = select_questions(llm, pack, snapshot) if llm is not None else pending_questions(pack, snapshot.answers)
    except Exception:  # noqa: BLE001 - 질문 고르기가 실패해도 등록 흐름을 막지 않는다
        questions = pending_questions(pack, snapshot.answers)
    return [q.model_dump(exclude_defaults=False) for q in questions]


def remaining_questions(pack: dict, store: Store) -> list[dict]:
    """아직 답이 없는 필수·기본 질문 (선택 질문은 다시 묻지 않는다)."""
    return [q.model_dump() for q in pending_questions(pack, _answers(store)) if not q.optional]


def register(session: Session, user: User, values: dict[str, Any], *,
             resolver: Callable[[str], AddressResult] | None = None) -> dict:
    """가게를 저장하고 되묻기 질문을 돌려준다. 계정당 1개 (409 STORE_EXISTS)."""
    pack = get_pack()
    validate_business_type(pack, values["business_type_input"])
    if session.scalar(select(Store.id).where(Store.user_id == user.id)):
        raise store_exists()
    settings = get_settings()
    resolve = resolver or (lambda q: resolve_address(q, key=settings.kakao_rest_key, use_mock=settings.use_mock))
    result = resolve(values["address"])
    if result.status in ("not_found", "ambiguous"):
        raise address_not_resolved(result)

    codes = None
    if result.status == "resolved":
        codes = {**result.codes, **({"coord": result.coord} if result.coord else {})}
    store = Store(user_id=user.id, name=values["name"], business_type_input=values["business_type_input"],
                  address=values["address"], address_detail=values.get("address_detail") or "",
                  address_codes=codes, region=result.region, opening_date=values["opening_date"],
                  owner_birth_year=values.get("owner_birth_year"),
                  sells_alcohol=None, uses_terrace=None, has_employees=None, funds_krw=None, is_demo=False)
    session.add(store)
    try:
        session.flush()
    except IntegrityError as exc:  # 같은 계정의 동시 등록 (user_id UNIQUE)
        session.rollback()
        raise store_exists() from exc
    questions = _questions_for_registration(pack, store)
    session.commit()
    resolved = None
    if result.status == "resolved":
        resolved = {"road": result.road, "jibun": result.jibun, "codes": result.codes, "coord": result.coord}
    return {"store_id": str(store.id), "address_status": result.status, "address_resolved": resolved,
            "questions": questions}


def save_answers(session: Session, store: Store, answers: dict[str, Any]) -> dict:
    """보낸 답만 저장한다. 분석 중이면 409, 첫 분석을 마친 뒤에는 마이페이지 안내와 함께 400."""
    store = session.scalar(select(Store).where(Store.id == store.id).with_for_update()
                           .execution_options(populate_existing=True))
    if session.scalar(select(Run.id).where(Run.store_id == store.id, Run.status.in_(ACTIVE))):
        raise ApiError(409, "RUN_IN_PROGRESS", "이미 분석이 실행 중입니다.")
    if store.onboarded_at is not None:
        raise invalid_input("첫 설정이 끝난 가게입니다. 답변 변경은 마이페이지에서 해 주세요.")
    for key, value in answers.items():
        setattr(store, key, value)
    pack = get_pack(store)
    current = _answers(store)
    store.business_type = business_type(pack, current["sells_alcohol"])
    store.updated_at = now_utc()
    session.commit()
    return {"store_id": str(store.id), "answers": current, "business_type": store.business_type,
            "business_type_reason": business_type_reason(pack, current),
            "questions": remaining_questions(pack, store)}
