"""아이디·비밀번호 로그인: users.username·password_hash 추가, provider 에 'local' 허용

- username: 영문 소문자·숫자 4~20자 (서버가 검증). 같은 아이디는 한 번만 쓴다.
- password_hash: bcrypt 해시. 평문 비밀번호는 저장하지 않는다.
- 기존 소셜·예시(demo) 계정은 두 컬럼이 NULL 이고 그대로 쓴다.

Revision ID: 0003_password_login
Revises: 0002_auth_answers
Create Date: 2026-11-21
"""

from alembic import op

revision = "0003_password_login"
down_revision = "0002_auth_answers"
branch_labels = None
depends_on = None

UPGRADE = """
ALTER TABLE users ADD COLUMN username text;
ALTER TABLE users ADD COLUMN password_hash text;
CREATE UNIQUE INDEX users_username ON users (username) WHERE username IS NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_provider_check;
ALTER TABLE users ADD CONSTRAINT users_provider_check
  CHECK (provider IN ('kakao','google','naver','demo','local'));
ALTER TABLE users ADD CONSTRAINT users_local_credentials
  CHECK ((provider = 'local') = (username IS NOT NULL AND password_hash IS NOT NULL));
"""

DOWNGRADE = """
DELETE FROM users WHERE provider = 'local';
ALTER TABLE users DROP CONSTRAINT users_local_credentials;
ALTER TABLE users DROP CONSTRAINT users_provider_check;
ALTER TABLE users ADD CONSTRAINT users_provider_check
  CHECK (provider IN ('kakao','google','naver','demo'));
DROP INDEX users_username;
ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN username;
"""


def upgrade() -> None:
    op.get_bind().exec_driver_sql(UPGRADE)


def downgrade() -> None:
    op.get_bind().exec_driver_sql(DOWNGRADE)
