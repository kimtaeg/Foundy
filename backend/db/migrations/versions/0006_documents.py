"""서류함을 체크리스트와 독립된 서류 관리로: 서류 요구사항·상태, 업로드 파일, 상태 이력, 법령 공식 서식

- document_requirements: 가게별로 필요한 서류. 기본 템플릿(YAML)·규칙 엔진·법령 분석에서 만들고, 서류마다 자기 상태를 가진다.
  상태: not_started(준비 전) · in_progress(준비 중) · obtained(발급·취득 완료) · submitted(제출 완료) · needs_fix(보완 필요) · not_applicable(해당 없음)
  체크리스트 완료 여부와 상관없이 서류 진행률은 이 상태로 센다. not_applicable 은 분모에서 뺀다.
- user_documents: 사용자가 올린 파일 (Postgres bytea, 파일당 10MB 이하). 나중에 S3 같은 저장소로 옮기면 content 대신 경로만 둔다.
- document_history: 상태 변경 이력 (발급과 제출을 구분해 남긴다)
- law_forms: 법제처에서 수집한 공식 서식(별지 서식) 파일 링크와 공포일. 개정되면 새 행을 만들고 이전 행은 남긴다.

Revision ID: 0006_documents
Revises: 0005_checklist_obligations
Create Date: 2026-11-22
"""

from alembic import op

revision = "0006_documents"
down_revision = "0005_checklist_obligations"
branch_labels = None
depends_on = None

UPGRADE = """
CREATE TABLE document_requirements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  doc_key               text NOT NULL,                 -- 가게 안에서 같은 서류를 한 번만 만드는 키 (예: bldg, edu_cert)
  name                  text NOT NULL,
  document_type         text NOT NULL CHECK (document_type IN ('issued','application','certificate','kept','reference')),
  agency                text,
  guide                 text,
  site_keys             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 규칙 묶음 sites 의 키 (링크는 읽을 때 규칙 묶음에서 채운다)
  contact_key           text,
  form                  jsonb,                          -- {law_name, form_no, title}: 법령 공식 서식 참조 (파일 링크는 law_forms)
  applicability_status  text NOT NULL DEFAULT 'applies' CHECK (applicability_status IN ('applies','needs_check','not_applicable')),
  source_type           text NOT NULL DEFAULT 'template' CHECK (source_type IN ('template','rule_engine','legal_analysis')),
  rule_id               text,
  reason                text,
  law_basis             jsonb,
  task_keys             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 이 서류를 쓰는 체크리스트 항목 item_key
  status                text NOT NULL DEFAULT 'not_started'
                        CHECK (status IN ('not_started','in_progress','obtained','submitted','needs_fix','not_applicable')),
  status_updated_at     timestamptz,
  note                  text,
  review_needed         boolean NOT NULL DEFAULT false,
  review_reason         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, doc_key)
);
CREATE INDEX document_requirements_store ON document_requirements (store_id);

CREATE TABLE user_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id  uuid NOT NULL REFERENCES document_requirements(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  content_type    text NOT NULL,
  size_bytes      integer NOT NULL CHECK (size_bytes > 0),
  content         bytea NOT NULL,
  issued_on       date,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_documents_requirement ON user_documents (requirement_id);

CREATE TABLE document_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id  uuid NOT NULL REFERENCES document_requirements(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_history_requirement ON document_history (requirement_id, created_at);

CREATE TABLE law_forms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name       text NOT NULL,
  form_no        text NOT NULL,                  -- 법제처 별표번호 (예: 003700 = 별지 제37호서식)
  title          text NOT NULL,
  file_path      text,                           -- /LSW/flDownload.do?flSeq=… (원본 파일, HWP 등)
  pdf_path       text,
  promulgated_on date,
  collected_at   timestamptz NOT NULL DEFAULT now(),
  is_current     boolean NOT NULL DEFAULT true,
  UNIQUE (law_name, form_no, promulgated_on)
);
"""

DOWNGRADE = """
DROP TABLE law_forms;
DROP TABLE document_history;
DROP TABLE user_documents;
DROP TABLE document_requirements;
"""


def upgrade() -> None:
    op.get_bind().exec_driver_sql(UPGRADE)


def downgrade() -> None:
    op.get_bind().exec_driver_sql(DOWNGRADE)
