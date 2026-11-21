"""AI 파트와 백엔드가 맞출 인터페이스.

백엔드(tools/, calc/)는 이 Protocol을 만족하는 객체를 run_analysis에 넘긴다.
AI 쪽은 이 형태만 믿고 동작하므로, 실제 구현이 없어도 가짜 객체로 개발·테스트할 수 있다.

tools 반환값의 data 형태 (필수 키 기준):
- building(store).data = {"floor_uses": ["제1종근린생활시설", ...],   # 이 가게 층의 용도 목록
                          "violation": True | False | None}           # None = 응답에 위반건축물 표기가 없음
- trademark(name).data = {"similar": [{"reg_no", "name", "class_code", "status", "url"}, ...]}
- law(check_id, store).data = {"articles": [{"law_name", "article", "text", "url"}, ...]}  # 해당 점검 항목의 근거 조문 (store 가 있으면 그 가게 조건으로 검색)
- grants(store).data   = {"grants": [{"grant_id", "title", "source", "url", "deadline": "YYYY-MM-DD" | None,
                                       "text": "공고문 본문(대상·조건·지원 내용·제출 서류 등)"}, ...]}
조회에 실패하면 ok=False로 돌려준다 (예외를 던지지 않는다). 캐시·모의 응답이면 from_cache/from_mock을 켠다.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Callable, Protocol

from pydantic import BaseModel, Field


class ToolResult(BaseModel):
    ok: bool
    source: str
    data: dict | None = None
    fetched_at: datetime | None = None
    from_cache: bool = False
    from_mock: bool = False
    error: str | None = None


class StoreInput(BaseModel):
    store_id: str
    name: str
    business_type_input: str = "카페"
    address: str
    address_detail: str | None = None
    address_codes: dict = Field(default_factory=dict)
    opening_date: date
    answers: dict = Field(default_factory=dict)
    menu_text: str | None = None
    owner_birth_year: int | None = None
    area_sqm: float | None = None  # 영업장 면적(㎡). 입력하지 않았으면 None


class Tools(Protocol):
    def building(self, store: StoreInput) -> ToolResult: ...

    def trademark(self, name: str) -> ToolResult: ...

    def law(self, check_id: str, store: StoreInput | None = None) -> ToolResult: ...

    def grants(self, store: StoreInput) -> ToolResult: ...  # 정책 알림에서만 쓴다


class Calc(Protocol):
    def checklist_dates(self, opening_date: date, offset_days: int) -> dict:
        """{"due_date": date, "dday": int}. due_date = 개업일 + offset_days. 시기(group_label)는 규칙 묶음이 항목마다 정한다."""
        ...

    def date_info(self, opening_date: date, due_date: date) -> dict:
        """마감일처럼 날짜가 이미 정해진 항목용(지원사업). {"due_date", "dday", "group_label"}.
        group_label은 dday로 정한다 (-29 이하 계약 전, -28~-15 개업 4주 전, -14~-1 개업 직전, 0 이상 개업 후)."""
        ...


# emit(event, data): event는 "step" | "item" | "done" | "error" (API 명세서 4장 SSE)
Emit = Callable[[str, dict], None]
