"""되묻기: 규칙 묶음의 후보 중에서 지금 물어볼 질문을 고른다."""

from __future__ import annotations

import json

from pydantic import BaseModel, Field

from rules.engine import pending_questions, required_question_ids

from .llm import LLM, LLMError
from .ports import StoreInput
from .prompts import ask as prompt
from .schemas import Question


class QuestionPick(BaseModel):
    ids: list[str] = Field(description="물어볼 질문 후보의 id 목록")


def select_questions(llm: LLM, pack: dict, store: StoreInput) -> list[Question]:
    """아직 답이 없는 후보 중 필요한 질문을 돌려준다.

    - 필수 질문(required)은 AI가 빼도 항상 포함한다.
    - 후보에 없는 id는 무시한다.
    - LLM이 실패하면 남은 후보를 모두 묻는다 (등록 흐름을 막지 않는다).
    """
    pending = pending_questions(pack, store.answers)
    if not pending:
        return []
    required = required_question_ids(pack)
    pending_ids = {q.id for q in pending}
    try:
        pick = llm.parse(
            step="ask",
            tier="fast",
            system=prompt.SYSTEM,
            user=prompt.USER.format(
                store=json.dumps(
                    {"name": store.name, "업종": store.business_type_input, "주소": store.address,
                     "개업일": str(store.opening_date)},
                    ensure_ascii=False,
                ),
                answers=json.dumps(store.answers, ensure_ascii=False),
                candidates=json.dumps([{"id": q.id, "why": q.why} for q in pending], ensure_ascii=False),
            ),
            schema=QuestionPick,
        )
        chosen = {i for i in pick.ids if i in pending_ids} | (required & pending_ids)
    except LLMError:
        chosen = pending_ids
    return [q for q in pending if q.id in chosen]
