/** 백엔드 응답 형식 (docs/API 명세서.md, docs/report-schema.json, docs/checklist-schema.json 중 화면에 쓰는 필드). */

export type ApiVerdict = "high" | "low" | "unknown" | "ok";

export interface ApiContact {
  agency: string;
  phone: string;
  is_example?: boolean;
  tip?: string | null;
}

export interface ApiEvidence {
  type: "data" | "law";
  source: string;
  value?: string | null;
  law_name?: string | null;
  article?: string | null;
  text?: string | null;
  url?: string | null;
  from_mock?: boolean;
  from_cache?: boolean;
}

export interface ApiOption {
  option_id: string;
  label: string;
  summary: string;
  time?: { text: string; basis?: string | null } | null;
  cost?: { text: string; basis?: string | null } | null;
  apply?: {
    type: string;
    payload?: Record<string, unknown>;
    needs_reanalyze?: boolean;
    adds_checklist?: string[];
  } | null;
  remedy?: string;
}

export interface ApiUserAction {
  type: string;
  text: string;
  est_minutes?: number | null;
}

export interface ApiReportItem {
  item_id: string;
  check_id: string;
  stage: string;
  title: string;
  verdict: ApiVerdict;
  decided_by: string;
  reason?: string | null;
  consequence?: string | null;
  options: ApiOption[];
  recommendation?: { option_id: string; reason: string } | null;
  contact?: ApiContact | null;
  user_action?: ApiUserAction | null;
  chosen_option: string | null;
  action_status: "pending" | "sent" | "done";
  action_reply: string | null;
  resolved_title: string | null;
  verdict_before: ApiVerdict | null;
  linked_task_ids: string[];
  applied_changes: string[];
  evidence: ApiEvidence[];
}

export interface ApiReport {
  store_id: string;
  run_id: string | null;
  summary: Record<ApiVerdict, number>;
  groups: { stage: string; items: ApiReportItem[] }[];
  is_example?: boolean;
}

export type ApiTaskType = "legal_obligation" | "conditional" | "preparation";
export type ApiDocumentType = "issued" | "application" | "certificate" | "kept" | "reference";
export type ApiDocumentStatus =
  | "not_started"
  | "in_progress"
  | "obtained"
  | "submitted"
  | "needs_fix"
  | "not_applicable";

/** 체크리스트 항목에 붙은 서류 안내 (서류별 상태는 ApiDocumentRequirement) */
export interface ApiDocument {
  doc_id: string;
  name: string;
  type?: ApiDocumentType;
  agency: string;
  guide: string;
  links: { label: string; url: string }[];
  contact?: ApiContact | null;
}

export interface ApiLawBasis {
  law_name?: string | null;
  article?: string | null;
  url?: string | null;
}

/** GET /api/stores/{id}/documents 의 서류 하나: 체크리스트와 따로 자기 상태·파일을 가진다 */
export interface ApiDocumentRequirement {
  doc_key: string;
  name: string;
  type: ApiDocumentType;
  type_label: string;
  status: ApiDocumentStatus;
  status_label: string;
  note: string | null;
  applicability: "applies" | "needs_check" | "not_applicable";
  source_type: "template" | "rule_engine" | "legal_analysis";
  added_by_ai: boolean;
  reason: string | null;
  law_basis: ApiLawBasis | null;
  agency: string;
  guide: string;
  links: { label: string; url: string }[];
  form: {
    law_name: string;
    form_no: string;
    title: string | null;
    pdf_url: string | null;
    file_url: string | null;
    revision_date: string | null;
  } | null;
  tasks: { item_id: string; task: string; done: boolean; category?: string; group_label?: string }[];
  due_date: string | null;
  dday: number | null;
  statutory_deadline: string | null;
  review_needed: boolean;
  review_reason: string | null;
}

export interface ApiDocuments {
  summary: {
    total: number;
    finished: number;
    remaining: number;
    not_applicable: number;
    by_status: Record<ApiDocumentStatus, number>;
    to_obtain: number;
    to_write_or_keep: number;
    review_needed: number;
  };
  requirements: ApiDocumentRequirement[];
}

export interface ApiChecklistItem {
  item_id: string;
  task: string;
  category: string;
  group_label: string;
  due_date: string;
  dday: number;
  documents: ApiDocument[];
  agency?: string | null;
  contact?: ApiContact | null;
  source: string;
  report_item_ids: string[];
  done: boolean;
  auto_checked: boolean;
  /** 필수 / 조건부 / 권장. due_date·dday 는 권장 준비일이고 법령이 정한 기한은 statutory_deadline 이다 */
  task_type?: ApiTaskType;
  source_type?: "template" | "rule_engine" | "legal_analysis" | "inspection" | "grant";
  statutory_deadline?: string | null;
  statutory_basis?: string | null;
  reason?: string | null;
  law_basis?: ApiLawBasis | null;
  added_by_ai?: boolean;
  review_needed?: boolean;
  review_reason?: string | null;
}

export interface ApiChecklist {
  opening_date: string;
  progress: { done: number; total: number };
  type_counts?: Record<ApiTaskType, number>;
  review_needed?: number;
  hidden_categories: { category: string; hidden_reason: string }[];
  groups: { group_label: string; items: ApiChecklistItem[] }[];
}

export interface ApiAlert {
  alert_id: string;
  type: "decision" | "next" | "deadline" | "change" | "grant";
  title: string;
  body?: string | null;
  cta?: { page: string; label?: string; item_id?: string } | null;
  is_example?: boolean;
  read: boolean;
  created_at: string;
}

export interface ApiNextStep {
  kind: string;
  title: string;
  sub: string;
  go: { page: string; item_id?: string };
}

export interface ApiDashboard {
  store: { store_id: string; name: string; business_type: string | null; opening_date: string; d_day: number };
  next_steps: ApiNextStep[];
  checklist_progress: { done: number; total: number };
  documents_progress?: { finished: number; total: number };
  alerts: { unread: number };
}

export interface ApiStore {
  store_id: string;
  name: string;
  business_type_input: string;
  business_type: string | null;
  address: string;
  address_detail: string;
  opening_date: string;
  owner_birth_year: number | null;
  region: string | null;
  is_demo: boolean;
  answers: {
    sells_alcohol: boolean | null;
    uses_terrace: boolean | null;
    does_delivery?: boolean | null;
    area_sqm?: number | null;
    has_employees: boolean | null;
    funds_krw: number | null;
  };
  effective: {
    name: string;
    business_type: string | null;
    answers: { sells_alcohol: boolean | null; has_employees: boolean | null };
  };
}

export interface ApiDemoSession {
  access_token: string;
  user: { user_id: string; name: string; provider: string };
  store_id: string;
}

/** GET /api/stores/{id}/obligations: 규칙 엔진이 정한 법령 적용 결과 (화면 판정값과 별개) */
export interface ApiObligation {
  rule_id: string;
  title: string;
  status: "applies" | "needs_check" | "not_applicable";
  reason: string;
  missing_inputs: { key: string; label: string }[];
  law: { law_name: string | null; article: string | null; url: string | null };
  required_action: string | null;
  review_status: "draft" | "reviewed";
}

/** GET /api/stores/{id}/grants 의 공고 하나 */
export interface ApiGrant {
  grant_id: string;
  title: string;
  source: string;
  url: string | null;
  org: string | null;
  category: string | null;
  region: string | null;
  deadline: string | null;
  result: "eligible" | "partial" | "unknown";
  checks: Array<{ condition: string; result: "pass" | "unknown"; note?: string | null; evidence?: { text?: string | null } | null }>;
  summary: { who: string | null; how_much: string | null; until: string | null; what_to_submit: string[] | null };
}

/** GET /api/stores/{id}/grants · POST …/grants/refresh */
export interface ApiGrants {
  status: "ready" | "empty" | "unavailable";
  error: string | null;
  source: string | null;
  is_example: boolean;
  judged_at: string | null;
  excluded_count: number;
  items: ApiGrant[];
}

/** 화면 하나를 그리는 데 필요한 응답 묶음. 변경 요청 뒤에는 통째로 다시 받는다. */
export interface ApiBundle {
  store: ApiStore;
  dashboard: ApiDashboard;
  report: ApiReport;
  checklist: ApiChecklist;
  alerts: ApiAlert[];
  obligations: ApiObligation[];
  /** 서류함. 못 받아도 화면은 체크리스트에 붙은 서류 안내로 그린다 */
  documents: ApiDocuments | null;
  /** 지원사업. 못 받으면 null (화면은 '불러오지 못함'으로 표시) */
  grants: ApiGrants | null;
}

/** POST /api/auth/signup · /api/auth/login 응답 */
export interface ApiAuthSession {
  access_token: string;
  user: { user_id: string; name: string; provider: string; username: string | null; joined_at: string };
  store_id: string | null;
}

/** POST /api/stores 요청 */
export interface ApiRegisterBody {
  name: string;
  business_type_input: string;
  address: string;
  address_detail: string;
  opening_date: string;
  owner_birth_year?: number;
}

/** PATCH /api/stores/{id} 응답 (변경 반영 결과) */
export interface ApiPatchResult {
  dry_run?: boolean;
  changed: { field: string; from: unknown; to: unknown }[];
  impacts: string[];
  reset_items: { item_id: string; title: string; chosen_label?: string | null }[];
  recomputed?: string[];
  /** 미리보기면 저장 시 재분석 예정, 저장이면 실제로 새 run 을 만들었는지 */
  needs_reanalyze: boolean;
  run_id: string | null;
}

/** GET /api/stores/{id}/changes 항목 */
export interface ApiChangeLog {
  change_id: string;
  at: string;
  changed: { field: string; from: unknown; to: unknown }[];
  impacts: string[];
  reset_items: { item_id: string; title: string; chosen_label?: string | null }[];
  lines: string[];
}
