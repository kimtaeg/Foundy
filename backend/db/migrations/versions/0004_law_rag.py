"""법령 RAG: 법령·조문 저장, 조문 조각 임베딩(pgvector), 적용 조건 규칙, 창업자별 의무사항, 법령 변경 기록, 면적·배달 입력

- laws: 수집한 현행 법령 (법령ID 기준 1행, 법령일련번호·시행일·본문 해시로 변경을 감지한다)
- law_articles: 조문·별표 단위 원문 (+ law_article_history: 내용이 바뀐 이전 버전)
- law_embeddings: 조문을 나눈 조각과 임베딩 벡터 (vector(768), HNSW 코사인 인덱스), 조각 본문의 trigram 인덱스(키워드 검색)
- applicability_rules: 규칙 묶음(YAML)의 적용 조건을 DB에 동기화한 사본과 검토 상태
- legal_obligations: 분석 때 규칙 엔진이 가게마다 정한 의무사항 (적용·미적용·확인 필요)
- law_change_logs: 법령 변경 감지 기록과 영향 범위
- stores.area_sqm·does_delivery: 영업장 면적, 배달 여부 (NULL = 입력 안 함·답하지 않음)

Revision ID: 0004_law_rag
Revises: 0003_password_login
Create Date: 2026-11-21
"""

from alembic import op

revision = "0004_law_rag"
down_revision = "0003_password_login"
branch_labels = None
depends_on = None

UPGRADE = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE laws (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_key          text NOT NULL UNIQUE,              -- 법령ID (예: 001805)
  name             text NOT NULL,                     -- 법령명 한글
  law_type         text,                              -- 법률·대통령령·총리령 …
  mst              text NOT NULL,                     -- 법령일련번호 (현행 버전)
  promulgation_no  text,
  effective_date   date,
  ministry         text,
  source_url       text NOT NULL,
  body_hash        text NOT NULL,                     -- 본문 전체 해시: 바뀌었는지만 빠르게 비교
  is_current       boolean NOT NULL DEFAULT true,
  collected_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX laws_name ON laws (name);

CREATE TABLE law_articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id          uuid NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('article','annex')),
  number          int  NOT NULL,                      -- 조 번호 또는 별표 번호
  branch          int  NOT NULL DEFAULT 0,            -- 가지번호 (제3조의2 → 2)
  label           text NOT NULL,                      -- '제37조' · '제3조의2' · '별표 1'
  title           text,
  content         text NOT NULL,                      -- 원문 전체 (조문·항·호·목을 이어 붙임)
  effective_date  date,
  url             text NOT NULL,
  content_hash    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (law_id, kind, number, branch)
);

CREATE TABLE law_article_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name      text NOT NULL,
  label         text NOT NULL,
  mst           text NOT NULL,                        -- 이 내용이 현행이던 법령일련번호
  effective_date date,
  content       text NOT NULL,
  content_hash  text NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX law_article_history_label ON law_article_history (law_name, label);

CREATE TABLE law_embeddings (
  article_id   uuid NOT NULL REFERENCES law_articles(id) ON DELETE CASCADE,
  chunk_no     int  NOT NULL,
  content      text NOT NULL,                         -- 조각 원문 (AI에 그대로 전달하고 인용 검증에 쓴다)
  model        text NOT NULL,
  embedding    vector(768),                           -- NULL = 임베딩 전 (키워드 검색만 가능)
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, chunk_no)
);
CREATE INDEX law_embeddings_vec ON law_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX law_embeddings_trgm ON law_embeddings USING gin (content gin_trgm_ops);

CREATE TABLE applicability_rules (
  rule_id          text PRIMARY KEY,
  title            text NOT NULL,
  check_id         text,                              -- 어느 점검 항목의 근거인가
  law_name         text NOT NULL,
  article_label    text,
  conditions       jsonb NOT NULL DEFAULT '{}',
  exceptions       jsonb NOT NULL DEFAULT '[]',
  required_inputs  jsonb NOT NULL DEFAULT '[]',
  required_action  text,
  review_status    text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','reviewed')),
  reviewed_by      text,
  pack             text NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legal_obligations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  run_id         uuid REFERENCES runs(id) ON DELETE SET NULL,
  rule_id        text NOT NULL,
  title          text NOT NULL,
  status         text NOT NULL CHECK (status IN ('applies','not_applicable','needs_check')),
  reason         text NOT NULL,
  missing_inputs jsonb NOT NULL DEFAULT '[]',
  law_name       text,
  article_label  text,
  required_action text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, rule_id)
);

CREATE TABLE law_change_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_key           text NOT NULL,
  law_name          text NOT NULL,
  change_type       text NOT NULL CHECK (change_type IN ('added','updated')),
  old_mst           text,
  new_mst           text NOT NULL,
  old_effective     date,
  new_effective     date,
  changed_articles  jsonb NOT NULL DEFAULT '[]',     -- [{label, change: added|changed|removed}]
  affected_rules    jsonb NOT NULL DEFAULT '[]',     -- 영향받는 rule_id
  affected_stores   int NOT NULL DEFAULT 0,
  detected_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ADD COLUMN area_sqm numeric(8,2) CHECK (area_sqm > 0);
ALTER TABLE stores ADD COLUMN does_delivery boolean;
"""

DOWNGRADE = """
ALTER TABLE stores DROP COLUMN does_delivery;
ALTER TABLE stores DROP COLUMN area_sqm;
DROP TABLE law_change_logs;
DROP TABLE legal_obligations;
DROP TABLE applicability_rules;
DROP TABLE law_embeddings;
DROP TABLE law_article_history;
DROP TABLE law_articles;
DROP TABLE laws;
"""
# 확장(vector, pg_trgm)은 다른 곳에서 쓸 수 있어 downgrade 에서 지우지 않는다.


def upgrade() -> None:
    op.get_bind().exec_driver_sql(UPGRADE)


def downgrade() -> None:
    op.get_bind().exec_driver_sql(DOWNGRADE)
