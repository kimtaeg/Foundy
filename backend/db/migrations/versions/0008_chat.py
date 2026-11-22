"""AI 상담: 상담방·메시지·도구 실행 기록·답변 출처

- chat_sessions: 사용자·가게별 상담방
- chat_messages: user(사용자) · assistant(AI 답변) · tool(도구 실행 결과) 메시지. assistant 의 도구 요청은 tool_calls 에 둔다
- chat_tool_calls: AI가 실행한 도구와 인자·결과 (추적용)
- chat_citations: 답변에 쓴 법령·자료 출처 (도구 결과에서 코드가 검증한 것만)

Revision ID: 0008_chat
Revises: 0007_documents_no_files
Create Date: 2026-11-22
"""

from alembic import op

revision = "0008_chat"
down_revision = "0007_documents_no_files"
branch_labels = None
depends_on = None

UPGRADE = """
CREATE TABLE chat_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_sessions_store ON chat_sessions (store_id, updated_at DESC);

CREATE TABLE chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content       text NOT NULL DEFAULT '',
  tool_calls    jsonb,
  tool_call_id  text,
  actions       jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_session ON chat_messages (session_id, created_at);

CREATE TABLE chat_tool_calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id  uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  tool_name   text NOT NULL,
  arguments   jsonb NOT NULL DEFAULT '{}',
  result      jsonb,
  status      text NOT NULL CHECK (status IN ('done','failed','denied')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_tool_calls_session ON chat_tool_calls (session_id, created_at);

CREATE TABLE chat_citations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  source_type     text NOT NULL,
  source_id       text,
  source_title    text NOT NULL,
  source_url      text,
  article_number  text
);
CREATE INDEX chat_citations_message ON chat_citations (message_id);
"""

DOWNGRADE = """
DROP TABLE chat_citations;
DROP TABLE chat_tool_calls;
DROP TABLE chat_messages;
DROP TABLE chat_sessions;
"""


def upgrade() -> None:
    op.get_bind().exec_driver_sql(UPGRADE)


def downgrade() -> None:
    op.get_bind().exec_driver_sql(DOWNGRADE)
