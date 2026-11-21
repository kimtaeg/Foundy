"""ORM 모델. docs/DB 명세서.md 2장 DDL과 컬럼명·타입을 맞춘다.

테이블은 Alembic 0001_init 이 명세서 DDL로 만든다. 여기서 create_all 을 쓰지 않는다.
CHECK·부분 인덱스 같은 제약은 DDL에만 있고, 모델은 읽고 쓰는 데 필요한 형태만 가진다.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NOW = text("now()")
EMPTY_ARRAY = text("'[]'::jsonb")
EMPTY_OBJECT = text("'{}'::jsonb")


class Base(DeclarativeBase):
    pass


def _id() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))


def _store_fk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)


def _ts(nullable: bool = False) -> Mapped[Any]:
    if nullable:
        return mapped_column(DateTime(timezone=True), nullable=True)
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=NOW)


def _jsonb(default: Any = EMPTY_ARRAY, nullable: bool = False) -> Mapped[Any]:
    if nullable:
        return mapped_column(JSONB, nullable=True)
    return mapped_column(JSONB, nullable=False, server_default=default)


# 2-1
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _id()
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    provider_user_id: Mapped[str | None] = mapped_column(Text)
    username: Mapped[str | None] = mapped_column(Text)  # 아이디·비밀번호 로그인(provider='local')
    password_hash: Mapped[str | None] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    joined_at: Mapped[date] = mapped_column(Date, nullable=False, server_default=text("CURRENT_DATE"))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


# 2-2
class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = _id()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    business_type_input: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'카페'"))
    business_type: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    address_detail: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    address_codes: Mapped[dict | None] = _jsonb(nullable=True)
    region: Mapped[str | None] = mapped_column(Text)
    opening_date: Mapped[date] = mapped_column(Date, nullable=False)
    owner_birth_year: Mapped[int | None] = mapped_column(Integer)
    # 되묻기 답변. NULL = 아직 답하지 않음 (0002_auth_answers)
    sells_alcohol: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    uses_terrace: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    has_employees: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    funds_krw: Mapped[int | None] = mapped_column(BigInteger)
    # 0004_law_rag: 영업장 면적(㎡), 배달 여부. NULL = 입력·답변 없음
    area_sqm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    does_delivery: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    onboarded_at: Mapped[datetime | None] = _ts(nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


# 2-3
class Run(Base):
    __tablename__ = "runs"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    trigger: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[list] = _jsonb()
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'queued'"))
    events: Mapped[list] = _jsonb()
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = _ts(nullable=True)
    finished_at: Mapped[datetime | None] = _ts(nullable=True)
    created_at: Mapped[datetime] = _ts()


# 2-4
class ReportItem(Base):
    __tablename__ = "report_items"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("runs.id", ondelete="SET NULL"))
    item_key: Mapped[str] = mapped_column(Text, nullable=False)
    check_id: Mapped[str] = mapped_column(Text, nullable=False)
    stage: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[str] = mapped_column(Text, nullable=False)
    decided_by: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    consequence: Mapped[str | None] = mapped_column(Text)
    options: Mapped[list] = _jsonb()
    recommendation: Mapped[dict | None] = _jsonb(nullable=True)
    user_action: Mapped[dict | None] = _jsonb(nullable=True)
    contact_key: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[list] = _jsonb()
    chosen_option: Mapped[str | None] = mapped_column(Text)
    chosen_at: Mapped[datetime | None] = _ts(nullable=True)
    action_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    action_reply: Mapped[str | None] = mapped_column(Text)
    action_updated_at: Mapped[datetime | None] = _ts(nullable=True)
    verdict_before: Mapped[str | None] = mapped_column(Text)
    resolved_title: Mapped[str | None] = mapped_column(Text)
    applied_effects: Mapped[dict] = _jsonb(EMPTY_OBJECT)
    applied_changes: Mapped[list] = _jsonb()
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


# 2-5
class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    item_key: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    rule_key: Mapped[str | None] = mapped_column(Text)
    task: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    group_label: Mapped[str] = mapped_column(Text, nullable=False)
    offset_days: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    agency: Mapped[str | None] = mapped_column(Text)
    contact_key: Mapped[str | None] = mapped_column(Text)
    origin_item_key: Mapped[str | None] = mapped_column(Text)
    origin_option: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[list] = _jsonb()
    done: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    done_at: Mapped[datetime | None] = _ts(nullable=True)
    auto_checked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    # 0005: 유형(필수·조건부·권장), 생성 출처, 법정 기한(due_date 는 권장 준비일), 근거·연결·재검토
    task_type: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'preparation'"))
    source_type: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'template'"))
    priority: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'normal'"))
    deadline_type: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'before_opening'"))
    statutory_deadline: Mapped[date | None] = mapped_column(Date)
    statutory_basis: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    law_basis: Mapped[dict | None] = _jsonb(nullable=True)
    obligation_rule_id: Mapped[str | None] = mapped_column(Text)
    sources: Mapped[list] = _jsonb()
    review_needed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    review_reason: Mapped[str | None] = mapped_column(Text)
    review_flagged_at: Mapped[datetime | None] = _ts(nullable=True)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


# 2-6
class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    dedupe_key: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    cta: Mapped[dict | None] = _jsonb(nullable=True)
    diff: Mapped[dict | None] = _jsonb(nullable=True)
    is_example: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = _ts()


# 2-7
class ChangeLog(Base):
    __tablename__ = "change_logs"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    changed: Mapped[list] = mapped_column(JSONB, nullable=False)
    impacts: Mapped[list] = _jsonb()
    reset_items: Mapped[list] = _jsonb()
    lines: Mapped[list] = _jsonb()
    created_at: Mapped[datetime] = _ts()


# 2-8 (시간되면. 테이블만 있고 쓰는 코드는 나중에)
class GrantMatch(Base):
    __tablename__ = "grant_matches"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    grant_id: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    region: Mapped[str | None] = mapped_column(Text)
    amount_text: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[date | None] = mapped_column(Date)
    result: Mapped[str] = mapped_column(Text, nullable=False)
    checks: Mapped[list] = _jsonb()
    summary: Mapped[dict | None] = _jsonb(nullable=True)
    poster: Mapped[dict | None] = _jsonb(nullable=True)
    excluded: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    added_to_checklist: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    judged_at: Mapped[datetime] = _ts()


# 2-9 (쓰는 코드는 나중에)
class ApiCache(Base):
    __tablename__ = "api_cache"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[Any] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = _ts()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


# 2-10 (run_id NULL 허용 + store_id: 2026-11-20 확정. 쓰는 코드는 나중에)
class CostLog(Base):
    __tablename__ = "cost_logs"

    id: Mapped[uuid.UUID] = _id()
    run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("runs.id", ondelete="CASCADE"))
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE")
    )
    step: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    cost_krw: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))


# 0002_auth_answers: 로그아웃한 토큰과 소셜 로그인 state
class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    token_key: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = _ts()


class OAuthState(Base):
    __tablename__ = "oauth_states"

    state: Mapped[str] = mapped_column(Text, primary_key=True)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    redirect_uri: Mapped[str] = mapped_column(Text, nullable=False)
    browser_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = _ts()


# 0004_law_rag: 법령 RAG (수집한 법령 원문과 임베딩, 적용 조건 규칙, 의무사항, 변경 기록)
class Law(Base):
    __tablename__ = "laws"

    id: Mapped[uuid.UUID] = _id()
    law_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    law_type: Mapped[str | None] = mapped_column(Text)
    mst: Mapped[str] = mapped_column(Text, nullable=False)
    promulgation_no: Mapped[str | None] = mapped_column(Text)
    effective_date: Mapped[date | None] = mapped_column(Date)
    ministry: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    body_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    collected_at: Mapped[datetime] = _ts()
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class LawArticle(Base):
    __tablename__ = "law_articles"

    id: Mapped[uuid.UUID] = _id()
    law_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("laws.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    branch: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    label: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class LawArticleHistory(Base):
    __tablename__ = "law_article_history"

    id: Mapped[uuid.UUID] = _id()
    law_name: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    mst: Mapped[str] = mapped_column(Text, nullable=False)
    effective_date: Mapped[date | None] = mapped_column(Date)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_at: Mapped[datetime] = _ts()


class LawEmbedding(Base):
    __tablename__ = "law_embeddings"

    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("law_articles.id", ondelete="CASCADE"), primary_key=True
    )
    chunk_no: Mapped[int] = mapped_column(Integer, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Any] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = _ts()


class ApplicabilityRule(Base):
    __tablename__ = "applicability_rules"

    rule_id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    check_id: Mapped[str | None] = mapped_column(Text)
    law_name: Mapped[str] = mapped_column(Text, nullable=False)
    article_label: Mapped[str | None] = mapped_column(Text)
    conditions: Mapped[dict] = _jsonb(EMPTY_OBJECT)
    exceptions: Mapped[list] = _jsonb()
    required_inputs: Mapped[list] = _jsonb()
    required_action: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'draft'"))
    reviewed_by: Mapped[str | None] = mapped_column(Text)
    pack: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = _ts()


class LegalObligation(Base):
    __tablename__ = "legal_obligations"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("runs.id", ondelete="SET NULL"))
    rule_id: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    missing_inputs: Mapped[list] = _jsonb()
    law_name: Mapped[str | None] = mapped_column(Text)
    article_label: Mapped[str | None] = mapped_column(Text)
    required_action: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _ts()


class LawChangeLog(Base):
    __tablename__ = "law_change_logs"

    id: Mapped[uuid.UUID] = _id()
    law_key: Mapped[str] = mapped_column(Text, nullable=False)
    law_name: Mapped[str] = mapped_column(Text, nullable=False)
    change_type: Mapped[str] = mapped_column(Text, nullable=False)
    old_mst: Mapped[str | None] = mapped_column(Text)
    new_mst: Mapped[str] = mapped_column(Text, nullable=False)
    old_effective: Mapped[date | None] = mapped_column(Date)
    new_effective: Mapped[date | None] = mapped_column(Date)
    changed_articles: Mapped[list] = _jsonb()
    affected_rules: Mapped[list] = _jsonb()
    affected_stores: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    detected_at: Mapped[datetime] = _ts()


# 서류함 (0006): 서류마다 자기 상태를 가진다. 체크리스트 완료와 별개다.
class DocumentRequirement(Base):
    __tablename__ = "document_requirements"

    id: Mapped[uuid.UUID] = _id()
    store_id: Mapped[uuid.UUID] = _store_fk()
    doc_key: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    document_type: Mapped[str] = mapped_column(Text, nullable=False)
    agency: Mapped[str | None] = mapped_column(Text)
    guide: Mapped[str | None] = mapped_column(Text)
    site_keys: Mapped[list] = _jsonb()
    contact_key: Mapped[str | None] = mapped_column(Text)
    form: Mapped[dict | None] = _jsonb(nullable=True)
    applicability_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'applies'"))
    source_type: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'template'"))
    rule_id: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    law_basis: Mapped[dict | None] = _jsonb(nullable=True)
    task_keys: Mapped[list] = _jsonb()
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'not_started'"))
    status_updated_at: Mapped[datetime | None] = _ts(nullable=True)
    note: Mapped[str | None] = mapped_column(Text)
    review_needed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    review_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class UserDocument(Base):
    __tablename__ = "user_documents"

    id: Mapped[uuid.UUID] = _id()
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_requirements.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    issued_on: Mapped[date | None] = mapped_column(Date)
    uploaded_at: Mapped[datetime] = _ts()


class DocumentHistory(Base):
    __tablename__ = "document_history"

    id: Mapped[uuid.UUID] = _id()
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_requirements.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str | None] = mapped_column(Text)
    to_status: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _ts()


class LawForm(Base):
    __tablename__ = "law_forms"

    id: Mapped[uuid.UUID] = _id()
    law_name: Mapped[str] = mapped_column(Text, nullable=False)
    form_no: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str | None] = mapped_column(Text)
    pdf_path: Mapped[str | None] = mapped_column(Text)
    promulgated_on: Mapped[date | None] = mapped_column(Date)
    collected_at: Mapped[datetime] = _ts()
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
