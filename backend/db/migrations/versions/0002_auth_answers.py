"""auth·answers: 되묻기 미답변(NULL), 로그아웃 토큰 폐기, 소셜 로그인 state

- stores.sells_alcohol·uses_terrace·has_employees: NOT NULL·DEFAULT false 를 풀어 NULL = 아직 답하지 않음.
  기존 행의 값(false 포함)은 바꾸지 않는다.
- revoked_tokens: 로그아웃한 토큰 (jti 또는 옛 토큰의 sha256). 만료 후 정리한다.
- oauth_states: 소셜 로그인 시작 때 발급한 state (1회용, 10분). redirect_uri 와 브라우저 결속 해시를 함께 저장한다.

Revision ID: 0002_auth_answers
Revises: 0001_init
Create Date: 2026-11-21
"""

from alembic import op

revision = "0002_auth_answers"
down_revision = "0001_init"
branch_labels = None
depends_on = None

ANSWER_BOOLEANS = ("sells_alcohol", "uses_terrace", "has_employees")

UPGRADE = """
CREATE TABLE revoked_tokens (
  token_key   text PRIMARY KEY,                 -- 'jti:<uuid>' 또는 jti 없는 옛 토큰의 'sha256:<hex>'
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,             -- 토큰 만료 시각. 지나면 정리해도 된다
  revoked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revoked_tokens_expires ON revoked_tokens (expires_at);

CREATE TABLE oauth_states (
  state         text PRIMARY KEY,
  provider      text NOT NULL CHECK (provider IN ('kakao','google','naver')),
  redirect_uri  text NOT NULL,                  -- 허용 목록에서 고른 값. 토큰 교환 때 이 값을 쓴다
  browser_hash  text NOT NULL CHECK (browser_hash ~ '^[0-9a-f]{64}$'),  -- 로그인을 시작한 브라우저의 browser_nonce SHA-256
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX oauth_states_expires ON oauth_states (expires_at);
"""


def _run(sql: str) -> None:
    op.get_bind().exec_driver_sql(sql)


def upgrade() -> None:
    for column in ANSWER_BOOLEANS:
        _run(f"ALTER TABLE stores ALTER COLUMN {column} DROP NOT NULL;")
        _run(f"ALTER TABLE stores ALTER COLUMN {column} DROP DEFAULT;")
    _run(UPGRADE)


def downgrade() -> None:
    _run("DROP TABLE IF EXISTS oauth_states;")
    _run("DROP TABLE IF EXISTS revoked_tokens;")
    for column in ANSWER_BOOLEANS:
        _run(f"UPDATE stores SET {column} = false WHERE {column} IS NULL;")
        _run(f"ALTER TABLE stores ALTER COLUMN {column} SET DEFAULT false;")
        _run(f"ALTER TABLE stores ALTER COLUMN {column} SET NOT NULL;")
