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
    type: Literal["update_store", "none"] = "none"
    payload: dict = Field(default_factory=dict)
    needs_reanalyze: bool = False
    # 이 선택지를 고르면 체크리스트에 새로 생기는 항목 id (규칙 묶음 extra_tasks). 선택을 되돌리면 다시 빠진다.
    adds_checklist: list[str] = Field(default_factory=list)


class Option(BaseModel):
    option_id: str
    label: str
    summary: str = ""
    time: Estimate = Field(default_factory=Estimate)
    cost: Estimate = Field(default_factory=Estimate)
    apply: ApplyAction = Field(default_factory=ApplyAction)
    # 규칙 묶음의 remedies 값. 허용된 대응 유형만 선택지로 만들었는지 검증할 때 쓴다.
    remedy: str | None = None


class Recommendation(BaseModel):
    option_id: str
    reason: str


class Contact(BaseModel):
    """문의할 기관 연락처. 번호는 규칙 묶음 contacts에서만 가져오고 AI가 만들지 않는다."""

    agency: str
    phone: str | None = None  # 확인하지 못한 번호는 None → 화면에서 "확인 필요"
    is_example: bool = False
    tip: str | None = None  # 대체 번호일 때 안내 ("관할 구청 건축과로 연결해 달라고 말씀하세요")


class Document(BaseModel):
    """체크리스트 항목에 필요한 서류. 서류를 만들어 주지 않고 어디서 받는지만 안내한다."""

    doc_id: str
    name: str
    type: Literal["issued", "application", "certificate", "kept", "reference"] = "reference"
    form: dict | None = None  # 법령 공식 서식 참조 {law_name, no, title}
    agency: str = ""
    guide: str = ""
    links: list[dict] = Field(default_factory=list)  # [{label, url}] 규칙 묶음 sites의 검증된 첫 화면 주소만
    contact: Contact | None = None


class UserAction(BaseModel):
    type: Literal["send", "sign", "visit", "decide"]
    text: str
    est_minutes: int | None = None


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
    contact: Contact | None = None
    user_action: UserAction | None = None
    ai_fallback: bool = False  # AI 판정이 실패해 규칙 안내 카드로 대체했는지
    chosen_option: str | None = None
    # 사용자 진행 상태 (결정 → 실행 → 완료). 백엔드가 DB에서 읽어 채운다 (DB 명세서 2-4)
    action_status: Literal["pending", "sent", "done"] = "pending"
    action_reply: str | None = None
    applied_effects: dict = Field(default_factory=dict)  # 유효 값에 덧씌울 효과 {sells_alcohol|name}
    applied_changes: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    added_to_checklist: list[str] = Field(default_factory=list)


TaskType = Literal["legal_obligation", "conditional", "preparation"]  # 필수 / 조건부 / 권장
SourceType = Literal["template", "rule_engine", "legal_analysis", "inspection", "grant"]


class ChecklistItem(BaseModel):
    item_id: str
    task: str
    category: Category
    group_label: GroupLabel | None = None  # 기본 항목은 규칙 묶음의 고정 값, 지원사업 마감만 dday로 정한다
    dday: int | None = None  # 계산 도구가 계산한다 (AI는 날짜를 계산하지 않는다)
    due_date: date | None = None
    rule_key: str | None = None  # 규칙 묶음의 항목 id (서류 목록을 찾는 키)
    documents: list[Document] = Field(default_factory=list)
    agency: str | None = None
    contact: Contact | None = None
    source: Literal["rule", "report", "grant"] = "rule"
    report_item_ids: list[str] = Field(default_factory=list)  # report_links로 연결된 점검 카드
    evidence: list[Evidence] = Field(default_factory=list)
    done: bool = False
    auto_checked: bool = False  # 점검 카드 완료로 자동 체크됐는지 (직접 한 체크는 False)
    origin_item_id: str | None = None  # source="report": 이 항목을 만든 점검 카드
    origin_option: str | None = None  # source="report": 이 항목을 만든 선택지
    # 법적 의무 중심 체크리스트: due_date·dday 는 "권장 준비일", 법령이 기한을 정했으면 statutory_deadline 에 따로 둔다
    task_type: TaskType = "preparation"
    source_type: SourceType = "template"
    priority: Literal["high", "normal", "low"] = "normal"
    deadline_type: Literal["before_opening", "after_opening"] = "before_opening"
    statutory_deadline: date | None = None
    statutory_basis: str | None = None  # 법정 기한의 근거 문구 (예: 영업 시작 전). 없으면 권장 준비일만 있는 것이다
    reason: str | None = None  # 왜 이 작업이 필요한지 (적용 조건·판단 이유)
    law_basis: dict | None = None  # {law_name, article, url}
    obligation_rule_id: str | None = None  # 이 작업을 만든 적용 조건 규칙
    sources: list[dict] = Field(default_factory=list)  # [{type: law|inspection|rule|template, ...}]
    review_needed: bool = False
    review_reason: str | None = None


class NextStep(BaseModel):
    """다음으로 할 일 (코드가 정렬한다. API 명세서 2장 NextStep)."""

    kind: Literal["new", "decide", "do", "task"]
    title: str
    sub: str = ""
    go: dict = Field(default_factory=dict)  # {page, item_id}


class Question(BaseModel):
    id: str
    text: str
    type: Literal["boolean", "number", "text"]
    why: str
    optional: bool = False


class ChatAction(BaseModel):
    """챗봇이 제안하는 동작. 사용자가 확인해야 프론트가 해당 API를 호출한다 (API 명세서 8장)."""

    type: Literal["update_store", "choose_option", "check_item", "navigate"]
    label: str
    payload: dict = Field(default_factory=dict)
    summary: list[str] = Field(default_factory=list)  # 적용하면 바뀌는 내용 (전→후 미리보기). 코드가 만든다
    requires_confirm: bool = True


class CallPrep(BaseModel):
    """통화 준비 도우미. 번호는 규칙 묶음에서, 질문은 규칙 묶음 call_questions에서 코드가 만든다."""

    item_id: str | None = None
    contact: Contact
    steps: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)


class ChatReply(BaseModel):
    kind: Literal["grounded", "change", "oos", "chitchat"] = "chitchat"
    answer: str
    evidence: list[Evidence] = Field(default_factory=list)
    actions: list[ChatAction] = Field(default_factory=list)
    contacts: list[Contact] = Field(default_factory=list)  # 범위 밖 질문에 문의할 기관 (규칙 묶음)
    call_prep: CallPrep | None = None
    follow_up: list[str] = Field(default_factory=list)
    note: str = ""


class GrantCheck(BaseModel):
    condition: str  # 조건을 쉬운 말로 ("만 39세 이하")
    result: Literal["pass", "unknown"]  # 명확히 맞지 않는(fail) 공고는 목록에서 제외된다
    evidence: Evidence | None = None  # 공고문 원문 문장 (type="notice")
    note: str = ""


class GrantEligibility(BaseModel):
    result: Literal["eligible", "partial", "unknown"]
    decided_by: Literal["ai"] = "ai"
    checks: list[GrantCheck] = Field(default_factory=list)


class GrantSummary(BaseModel):
    who: str = "[확인 필요]"
    how_much: str = "[확인 필요]"
    until: str | None = None
    what_to_submit: list[str] = Field(default_factory=list)
    by: Literal["ai"] = "ai"


class GrantMatch(BaseModel):
    grant_id: str
    title: str
    source: str
    url: str | None = None
    org: str | None = None  # 공고 기관
    category: str | None = None  # 지원 분야
    region: str | None = None  # 지원 지역
    deadline: date | None = None
    eligibility: GrantEligibility
    summary: GrantSummary
    added_to_checklist: bool = False


class GrantsResult(BaseModel):
    ok: bool = True
    fetched_at: datetime | None = None
    items: list[GrantMatch] = Field(default_factory=list)
    excluded_count: int = 0  # 조건이 명확히 맞지 않아 뺀 공고
    closed_count: int = 0  # 마감이 지나 뺀 공고
