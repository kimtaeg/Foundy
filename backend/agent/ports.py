"""AI 파트와 백엔드가 맞출 인터페이스.

백엔드(tools/, calc/)는 이 Protocol을 만족하는 객체를 run_analysis에 넘긴다.
AI 쪽은 이 형태만 믿고 동작하므로, 실제 구현이 없어도 가짜 객체로 개발·테스트할 수 있다.

tools 반환값의 data 형태 (필수 키 기준):
- building(store).data = {"floor_uses": ["제1종근린생활시설", ...],   # 이 가게 층의 용도 목록
                          "violation": True | False | None}           # None = 응답에 위반건축물 표기가 없음
- trademark(name).data = {"similar": [{"reg_no", "name", "class_code", "status", "url"}, ...]}
- law(check_id).data   = {"articles": [{"law_name", "article", "text", "url"}, ...]}  # 해당 점검 항목의 근거 조문
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


class Site(BaseModel):
    """후보 자리 (비교용). floor_uses는 그 자리의 건축물대장 용도."""

    site_id: str
    label: str
    address: str = ""
    floor_uses: list[str] = Field(default_factory=list)
    listing: dict | None = None  # deposit_krw, monthly_rent_krw, maintenance_krw, premium_krw, area_m2
    is_main: bool = False
    # 반경 내 상권 지표. 없는 지표는 키를 빼거나 {"available": False}로 둔다 (숫자를 만들지 않는다)
    # 예: {"same_type_count": 14, "open_close_trend": {"available": False}, "foot_traffic": {"available": False}}
    area_metrics: dict | None = None
    area_avg_rent_per_m2: int | None = None  # 지역 평균 ㎡당 임대료 (원천 확정 전에는 예시 값)


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
    sites: list[Site] = Field(default_factory=list)


class Tools(Protocol):
    def building(self, store: StoreInput) -> ToolResult: ...

    def trademark(self, name: str) -> ToolResult: ...

    def law(self, check_id: str) -> ToolResult: ...

    def grants(self, store: StoreInput) -> ToolResult: ...  # 정책 알림에서만 쓴다


class Calc(Protocol):
    def checklist_dates(self, opening_date: date, week: int) -> dict:
        """{"due_date": date, "dday": int, "group_label": "계약 전|개업 4주 전|개업 직전|개업 후"}"""
        ...

    def date_info(self, opening_date: date, due_date: date) -> dict:
        """마감일처럼 날짜가 이미 정해진 항목용. checklist_dates와 같은 형태로 돌려준다."""
        ...

    def site_cost_delta(self, base_listing: dict, other_listing: dict) -> dict | None:
        """{"initial_delta_krw": int, "monthly_delta_krw": int}. 입력이 모자라면 None."""
        ...


# emit(event, data): event는 "step" | "item" | "done" | "error" (API 명세서 4장 SSE)
Emit = Callable[[str, dict], None]
