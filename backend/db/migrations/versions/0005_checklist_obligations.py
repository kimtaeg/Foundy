"""체크리스트를 법적 의무사항 중심으로 확장: 작업 유형, 법정 기한과 권장일 분리, 근거·출처·재검토 표시

- task_type: legal_obligation(필수) | conditional(조건부) | preparation(권장)
- source_type: template(기본 일정) | rule_engine(조건 규칙) | legal_analysis(법령 분석) | inspection(점검 리포트) | grant(지원사업)
- due_date·offset_days 는 이제 "권장 준비일"이다. 법령이 기한을 정한 경우에만 statutory_deadline 에 따로 적는다.
- reason: 이 작업이 왜 필요한지(적용 조건), law_basis: 근거 조문, sources: 작업과 법령·점검 카드·규칙의 연결
- review_needed: 법령 개정 등으로 다시 확인이 필요한 작업 (완료 기록은 지우지 않는다)

Revision ID: 0005_checklist_obligations
Revises: 0004_law_rag
Create Date: 2026-11-22
"""

from alembic import op

revision = "0005_checklist_obligations"
down_revision = "0004_law_rag"
branch_labels = None
depends_on = None

UPGRADE = """
ALTER TABLE checklist_items
  ADD COLUMN task_type text NOT NULL DEFAULT 'preparation'
    CHECK (task_type IN ('legal_obligation','conditional','preparation')),
  ADD COLUMN source_type text NOT NULL DEFAULT 'template'
    CHECK (source_type IN ('template','rule_engine','legal_analysis','inspection','grant')),
  ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
  ADD COLUMN deadline_type text NOT NULL DEFAULT 'before_opening'
    CHECK (deadline_type IN ('before_opening','after_opening')),
  ADD COLUMN statutory_deadline date,
  ADD COLUMN statutory_basis text,
  ADD COLUMN reason text,
  ADD COLUMN law_basis jsonb,
  ADD COLUMN obligation_rule_id text,
  ADD COLUMN sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN review_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN review_reason text,
  ADD COLUMN review_flagged_at timestamptz;

UPDATE checklist_items SET
  source_type = CASE source WHEN 'report' THEN 'inspection' WHEN 'grant' THEN 'grant' ELSE 'template' END,
  deadline_type = CASE WHEN offset_days > 0 THEN 'after_opening' ELSE 'before_opening' END;

CREATE INDEX checklist_items_obligation ON checklist_items (store_id, obligation_rule_id)
  WHERE obligation_rule_id IS NOT NULL;
"""

DOWNGRADE = """
DROP INDEX checklist_items_obligation;
ALTER TABLE checklist_items
  DROP COLUMN review_flagged_at, DROP COLUMN review_reason, DROP COLUMN review_needed, DROP COLUMN sources,
  DROP COLUMN obligation_rule_id, DROP COLUMN law_basis, DROP COLUMN reason, DROP COLUMN statutory_basis,
  DROP COLUMN statutory_deadline, DROP COLUMN deadline_type, DROP COLUMN priority, DROP COLUMN source_type,
  DROP COLUMN task_type;
"""


def upgrade() -> None:
    op.get_bind().exec_driver_sql(UPGRADE)


def downgrade() -> None:
    op.get_bind().exec_driver_sql(DOWNGRADE)
