"""init: DB 명세서 2장 테이블 10개

명세서(docs/DB 명세서.md) 2장 DDL을 그대로 실행한다. autogenerate를 쓰지 않는다.
cost_logs는 2-10의 두 번째 방식(run_id NULL 허용 + store_id)으로 바꾼다.

Revision ID: 0001_init
Revises:
Create Date: 2026-11-20
"""

from alembic import op

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None

# docs/DB 명세서.md 2-1 ~ 2-10 원문 (수정하지 않는다)
SPEC_DDL = """
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         text NOT NULL CHECK (provider IN ('kakao','google','naver','demo')),
  provider_user_id text,                        -- 소셜 쪽 사용자 id. demo는 NULL
  name             text NOT NULL,               -- 마이페이지에서 바꿀 수 있는 표시 이름
  joined_at        date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_provider_uid ON users (provider, provider_user_id)
  WHERE provider_user_id IS NOT NULL;

CREATE TABLE stores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,  -- 계정당 1개
  name                text NOT NULL,                  -- 상호 (원본. 선택으로 바뀐 이름은 report_items.applied_effects)
  business_type_input text NOT NULL DEFAULT '카페'
                       CHECK (business_type_input IN ('카페','음식점')),
  business_type       text,                           -- 규칙 묶음이 결정한 신고 업종 (휴게음식점|일반음식점)
  address             text NOT NULL,                  -- 도로명주소 (입지를 정한 주소)
  address_detail      text NOT NULL DEFAULT '',       -- 층·호
  address_codes       jsonb,                          -- {sigungu_cd, bjdong_cd, bun, ji, coord:{lat,lng}}
  region              text,                           -- 주소에서 얻은 시군구·동 (예: 서울 성동구 성수동)
  opening_date        date NOT NULL,                  -- 개업 예정일 (역산 기준)
  owner_birth_year    int CHECK (owner_birth_year BETWEEN 1900 AND 2100),  -- 지원사업 자격용, 선택
  sells_alcohol       boolean NOT NULL DEFAULT false,
  uses_terrace        boolean NOT NULL DEFAULT false,
  has_employees       boolean NOT NULL DEFAULT false,
  funds_krw           bigint CHECK (funds_krw >= 0),  -- 준비 자금, 선택
  onboarded_at        timestamptz,                    -- 첫 설정(분석)을 마친 시각. NULL이면 첫 설정 중
  is_demo             boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  trigger     text NOT NULL CHECK (trigger IN ('user','refresh','chat','demo')),
  scope       jsonb NOT NULL DEFAULT '[]',   -- 다시 돌린 단계: ["building","law","trademark","checklist","grants"]
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  events      jsonb NOT NULL DEFAULT '[]',   -- [{step,status,message,source,at}]
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX runs_store ON runs (store_id, created_at DESC);
-- 같은 가게에서 동시에 하나만 실행 (409 RUN_IN_PROGRESS)
CREATE UNIQUE INDEX runs_one_active ON runs (store_id) WHERE status IN ('queued','running');

CREATE TABLE report_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  run_id          uuid REFERENCES runs(id) ON DELETE SET NULL,   -- 이 내용을 만든 실행
  item_key        text NOT NULL,           -- 'r-01' … (API의 item_id)
  check_id        text NOT NULL,           -- 규칙 묶음의 점검 항목 id (building_use …)
  stage           text NOT NULL CHECK (stage IN ('계약 전','개업 전','운영 중')),
  -- 내용 (분석이 만든다)
  verdict         text NOT NULL CHECK (verdict IN ('high','low','unknown','ok')),
  decided_by      text NOT NULL CHECK (decided_by IN ('rule','ai')),
  title           text NOT NULL,           -- 결론 한 줄 (쉬운 말)
  reason          text,
  consequence     text,                    -- 안 하면 생기는 일
  options         jsonb NOT NULL DEFAULT '[]',   -- 선택지 (아래)
  recommendation  jsonb,                   -- {option_id, reason} 또는 NULL
  user_action     jsonb,                   -- {type, text, est_minutes} 또는 NULL (기본 할 일)
  contact_key     text,                    -- 규칙 묶음 contacts의 키 (build|hyg|…). 번호는 응답 때 채운다
  evidence        jsonb NOT NULL DEFAULT '[]',   -- Evidence 목록 (비면 verdict는 unknown)
  -- 사용자 진행 상태
  chosen_option   text,                    -- 고른 option_id. 아직이면 NULL
  chosen_at       timestamptz,
  action_status   text NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending','sent','done')),
  action_reply    text,                    -- 결과·통화 메모
  action_updated_at timestamptz,
  verdict_before  text CHECK (verdict_before IN ('high','low','unknown','ok')),
  resolved_title  text,                    -- 선택 적용 후 바뀐 결론
  applied_effects jsonb NOT NULL DEFAULT '{}',   -- 유효 값에 덧씌울 효과 (아래)
  applied_changes jsonb NOT NULL DEFAULT '[]',   -- 화면에 보일 바뀐 내용 문장 목록
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, item_key),
  UNIQUE (store_id, check_id)
);
CREATE INDEX report_items_store_stage ON report_items (store_id, stage);

CREATE TABLE checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_key        text NOT NULL,        -- 'c-01'…'c-09' (기본), 'x-0'… (선택지로 생김), 'g-…' (지원사업)
  source          text NOT NULL CHECK (source IN ('rule','report','grant')),
  rule_key        text,                 -- 규칙 묶음의 항목 키 (서류 목록을 찾는 키)
  task            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('영업 인허가','세무','고용','건물·시설','간판·광고','표시 의무','정책')),
  group_label     text NOT NULL CHECK (group_label IN ('계약 전','개업 4주 전','개업 직전','개업 후')),
  offset_days     int NOT NULL,         -- 개업일 기준 일수 (음수 = 개업 전). 규칙 묶음 값
  due_date        date NOT NULL,        -- opening_date + offset_days (계산 도구)
  agency          text,                 -- 담당 기관 이름
  contact_key     text,                 -- contacts 키 (번호는 응답 때 채운다)
  origin_item_key text,                 -- source='report': 이 항목을 만든 점검 카드 item_key
  origin_option   text,                 -- source='report': 이 항목을 만든 option_id
  evidence        jsonb NOT NULL DEFAULT '[]',
  done            boolean NOT NULL DEFAULT false,
  done_at         timestamptz,
  auto_checked    boolean NOT NULL DEFAULT false,  -- 점검 카드 완료로 자동 체크됐는지
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, item_key)
);
CREATE INDEX checklist_store_due ON checklist_items (store_id, due_date);

CREATE TABLE alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  dedupe_key  text NOT NULL,          -- 같은 사건을 중복 생성하지 않는 키 (아래 표)
  type        text NOT NULL CHECK (type IN ('decision','next','deadline','change','grant')),
  title       text NOT NULL,
  body        text,
  cta         jsonb,                  -- {label, page, item_id}
  diff        jsonb,                  -- 변경 전후 (선택)
  is_example  boolean NOT NULL DEFAULT false,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, dedupe_key)
);
CREATE INDEX alerts_store_type ON alerts (store_id, type, created_at DESC);

CREATE TABLE change_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  changed     jsonb NOT NULL,                 -- [{field, from, to}]
  impacts     jsonb NOT NULL DEFAULT '[]',    -- ["building","law","checklist"]
  reset_items jsonb NOT NULL DEFAULT '[]',    -- [{item_key, title, chosen_label}] 초기화된 카드
  lines       jsonb NOT NULL DEFAULT '[]',    -- 화면 문장 ["주소: … → …", "건물 용도·주류 카드 선택 초기화 (다시 결정 대기)"]
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_logs_store ON change_logs (store_id, created_at DESC);

CREATE TABLE grant_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  grant_id      text NOT NULL,            -- 공고 id (예: kstartup-000000)
  title         text NOT NULL,
  source        text NOT NULL,            -- K-Startup | 기업마당 …
  url           text,
  category      text,                     -- 사업화 | 융자 | 공간 | 교육 | 멘토링
  region        text,
  amount_text   text,
  deadline      date,                     -- NULL = 상시·미정
  result        text NOT NULL CHECK (result IN ('eligible','partial','unknown')),
  checks        jsonb NOT NULL DEFAULT '[]',   -- [{condition, result: pass|unknown, evidence:{type:'notice', text, url}, note}]
  summary       jsonb,                    -- {who, how_much, until, what_to_submit[], by:'ai'}
  poster        jsonb,                    -- {url, source:'api'|'generated', credit}
  excluded      boolean NOT NULL DEFAULT false,   -- 명확히 fail → 목록 제외 (건수만 알림)
  added_to_checklist boolean NOT NULL DEFAULT false,
  judged_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, grant_id)
);
CREATE INDEX grant_matches_store_deadline ON grant_matches (store_id, deadline);

CREATE TABLE api_cache (
  key         text PRIMARY KEY,         -- '<source>:<params 해시>'
  source      text NOT NULL,            -- address | building | law | trademark | grants
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX api_cache_expires ON api_cache (expires_at);

CREATE TABLE cost_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step           text NOT NULL,         -- select_questions | interpret | advise | grants | chat …
  model          text NOT NULL,
  input_tokens   int NOT NULL DEFAULT 0,
  output_tokens  int NOT NULL DEFAULT 0,
  cost_krw       numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX cost_logs_run ON cost_logs (run_id);
"""

# 2-10: 챗봇 호출은 runs를 만들지 않으므로(runs_one_active 충돌) store_id로 직접 연결한다
COST_LOGS_CHANGE = """
ALTER TABLE cost_logs ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE cost_logs ADD COLUMN store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
"""

# FK 의존 역순
TABLES_DROP_ORDER = [
    "cost_logs",
    "api_cache",
    "grant_matches",
    "change_logs",
    "alerts",
    "checklist_items",
    "report_items",
    "runs",
    "stores",
    "users",
]


def _run(sql: str) -> None:
    # 바인드 파라미터 해석 없이 드라이버에 그대로 보낸다 (psycopg는 여러 문장을 한 번에 실행한다)
    op.get_bind().exec_driver_sql(sql)


def upgrade() -> None:
    _run("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    _run(SPEC_DDL)
    _run(COST_LOGS_CHANGE)


def downgrade() -> None:
    for table in TABLES_DROP_ORDER:
        _run(f"DROP TABLE IF EXISTS {table};")
