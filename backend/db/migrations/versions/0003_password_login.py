"""아이디·비밀번호 로그인: users.username·password_hash 추가, provider 에 'local' 허용

- username: 영문 소문자·숫자 4~20자 (서버가 검증). 같은 아이디는 한 번만 쓴다.
- password_hash: bcrypt 해시. 평문 비밀번호는 저장하지 않는다.
- 기존 소셜·예시(demo) 계정은 두 컬럼이 NULL 이고 그대로 쓴다.
- downgrade 는 'local' 계정이 하나라도 있으면 거절한다 (지우면 그 계정의 가게·점검 결과가 CASCADE 로 함께 삭제된다).

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
    bind = op.get_bind()
    # 'local' 계정을 지우면 stores 등이 ON DELETE CASCADE 로 함께 사라지므로 지우지 않고 되돌리기를 거절한다.
    local_users = bind.exec_driver_sql("SELECT count(*) FROM users WHERE provider = 'local'").scalar()
    if local_users:
        raise RuntimeError(
            f"아이디·비밀번호 계정 {local_users}개가 있어 되돌릴 수 없습니다. "
            "계정과 가게 데이터가 함께 지워지므로, 필요하면 직접 백업·삭제한 뒤 다시 실행하세요."
        )
    bind.exec_driver_sql(DOWNGRADE)
