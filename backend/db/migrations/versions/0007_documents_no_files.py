"""서류함에서 파일 올리기와 서류 연락처를 없앤다

- user_documents: 파일 업로드 기능을 쓰지 않기로 해서 테이블을 지운다 (올려 둔 파일은 함께 지워진다)
- document_requirements.contact_key: 서류함에는 전화번호를 보여 주지 않는다

Revision ID: 0007_documents_no_files
Revises: 0006_documents
Create Date: 2026-11-22
"""

from alembic import op

revision = "0007_documents_no_files"
down_revision = "0006_documents"
branch_labels = None
depends_on = None

UPGRADE = """
DROP TABLE user_documents;
ALTER TABLE document_requirements DROP COLUMN contact_key;
"""

DOWNGRADE = """
ALTER TABLE document_requirements ADD COLUMN contact_key text;
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
"""


def upgrade() -> None:
    op.get_bind().exec_driver_sql(UPGRADE)


def downgrade() -> None:
    op.get_bind().exec_driver_sql(DOWNGRADE)
