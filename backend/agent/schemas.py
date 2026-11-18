"""AI 파트가 만들고 백엔드·프론트가 공유하는 데이터 형식.

docs/API 명세서.md 2장(공통 객체)과 6장(점검 리포트)을 그대로 옮긴 것이다.
형식을 바꾸면 명세서와 docs/report-schema.json도 같은 PR에서 함께 고친다.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Verdict = Literal["high", "low", "unknown", "ok"]
DecidedBy = Literal["rule", "ai"]
Stage = Literal["계약 전", "개업 전", "운영 중"]
Basis = Literal["rule", "calc", "data", "notice"]
Category = Literal["영업 인허가", "세무", "고용", "건물·시설", "간판·광고", "표시 의무", "정책"]
GroupLabel = Literal["계약 전", "개업 4주 전", "개업 직전", "개업 후"]

NEED_CHECK = "확인 필요"


class Evidence(BaseModel):
    """모든 판단 항목에 1개 이상 필수. 근거가 없으면 판정은 unknown이 된다."""

    type: Literal["data", "law", "notice"]
    source: str
    value: str | None = None
    law_name: str | None = None
    article: str | None = None
    text: str | None = None
    url: str | None = None
    fetched_at: datetime | None = None
    from_cache: bool = False
    from_mock: bool = False


class Estimate(BaseModel):
    """선택지의 기간·금액. 근거(basis)가 없으면 숫자를 쓰지 않고 '확인 필요'로 둔다."""

    text: str = NEED_CHECK
    basis: Basis | None = None
    delta_krw: int | None = None

    @model_validator(mode="after")
    def _no_number_without_basis(self) -> "Estimate":
        if self.basis is None:
            self.text = NEED_CHECK
            self.delta_krw = None
        return self


class ApplyAction(BaseModel):
    type: Literal["update_store", "set_main_site", "none"] = "none"
    payload: dict = Field(default_factory=dict)
    needs_reanalyze: bool = False


class Option(BaseModel):
    option_id: str
    label: str
    summary: str = ""
    time: Estimate = Field(default_factory=Estimate)
    cost: Estimate = Field(default_factory=Estimate)
    apply: ApplyAction = Field(default_factory=ApplyAction)
    site_id: str | None = None
    # 규칙 묶음의 remedies 값. 허용된 대응 유형만 선택지로 만들었는지 검증할 때 쓴다.
    remedy: str | None = None


class Recommendation(BaseModel):
    option_id: str
    reason: str


class Prepared(BaseModel):
    """대신 만들어 둔 결과물. 가게 정보와 조회 데이터로 채운 초안이며 모르는 칸은 [확인 필요]."""

    prepared_id: str
    kind: Literal["inquiry_message", "contract_clause", "document_draft", "link"]
    title: str
    body: str | None = None
    url: str | None = None
    editable: bool = False


class UserAction(BaseModel):
    type: Literal["send", "sign", "visit", "decide"]
    text: str
    est_minutes: int | None = None
    prepared_id: str | None = None


class ReportItem(BaseModel):
    item_id: str
    check_id: str
    stage: Stage
    title: str  # 결론 한 줄, 결과 중심의 쉬운 말
    verdict: Verdict
    decided_by: DecidedBy
    reason: str = ""
    consequence: str = ""
    options: list[Option] = Field(default_factory=list)
    recommendation: Recommendation | None = None
    prepared: list[Prepared] = Field(default_factory=list)
    user_action: UserAction | None = None
    chosen_option: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    added_to_checklist: list[str] = Field(default_factory=list)


class ChecklistItem(BaseModel):
    item_id: str
    task: str
    category: Category
    group_label: GroupLabel | None = None  # 계산 도구가 dday로 정한다
    dday: int | None = None  # 계산 도구가 계산한다 (AI는 날짜를 계산하지 않는다)
    due_date: date | None = None
    documents: list[str] = Field(default_factory=list)
    agency: str | None = None
    source: Literal["rule", "report", "grant"] = "rule"
    report_item_id: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    prepared: list[Prepared] = Field(default_factory=list)
    done: bool = False


class Question(BaseModel):
    id: str
    text: str
    type: Literal["boolean", "number", "text"]
    why: str
    optional: bool = False
