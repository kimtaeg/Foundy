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
  next_steps: ApiNextStep[];
  is_example?: boolean;
}

export type ApiReportUpdate = Pick<ApiReport, "summary" | "groups" | "next_steps">;

export interface ApiReportMutationUpdate {
  report_update?: ApiReportUpdate;
  alerts_update?: { removed_ids: string[]; added: ApiAlert | null };
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
  status_updated_at?: string | null;
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

export type ApiDocumentState = Pick<ApiDocumentRequirement,
  "doc_key" | "status" | "status_label" | "note" | "status_updated_at" | "review_needed" | "review_reason"
>;

export interface ApiDocuments {
  summary: {
    total: number;
    finished: number;
    remaining: number;
    not_applicable: number;
    by_status: Record<ApiDocumentStatus, number>;
    by_type?: Record<ApiDocumentType, number>;
    to_obtain: number;
    to_write_or_keep: number;
    review_needed: number;
  };
  groups: {
    item_id: string;
    task: string;
    group_label: string;
    category: string;
    due_date: string;
    dday: number;
    agency: string | null;
    done: boolean;
    documents: ApiDocumentRequirement[];
  }[];
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
  document_names?: string[];
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

export type ApiChecklistState = Pick<ApiChecklistItem, "item_id" | "done" | "auto_checked" | "review_needed" | "review_reason">;

export interface ApiChecklist {
  opening_date: string;
  as_of: string;
  has_employees: boolean;
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
  last_run: {run_id: string; finished_at: string} | null;
  report_summary: Record<ApiVerdict, number>;
  pending_decisions: {item_id:string; title:string; stage:string; verdict:ApiVerdict; recommended_option:string|null}[];
  today_todos: {item_id:string; task:string; due_date:string|null; category:string|null; est_minutes:number|null}[];
  store: {
    store_id: string;
    name: string;
    registered_name: string;
    business_type: string | null;
    business_type_input: string;
    address: string;
    address_detail: string;
    region: string | null;
    opening_date: string;
    d_day: number;
  };
  checklist_tasks: {
    item_id: string;
    task: string;
    group_label: string;
    category: string;
    due_date: string;
    done: boolean;
  }[];
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
  address_codes?: {coord?: {lat:number; lng:number}} | null;
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

export interface ApiDemoSession extends ApiAuthSession {
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
  checks: Array<{
    condition: string;
    result: "pass" | "unknown";
    note?: string | null;
    evidence?: { text?: string | null } | null;
  }>;
  summary: { who: string | null; how_much: string | null; until: string | null; what_to_submit: string[] | null };
}

export interface ApiGrants {
  status: "ready" | "empty" | "unavailable";
  error: string | null;
  source: string | null;
  is_example: boolean;
  judged_at: string | null;
  excluded_count: number;
  items: ApiGrant[];
}

export interface ApiResources {
  store: ApiStore;
  dashboard: ApiDashboard;
  report: ApiReport;
  checklist: ApiChecklist;
  alerts: ApiAlert[];
  documents: ApiDocuments;
  grants: ApiGrants;
  me: ApiIdentity;
}

export type ApiResource = keyof ApiResources;

export interface ApiSetup {
  status: "missing_store" | "missing_answers" | "needs_analysis" | "analyzing" | "ready" | "failed";
  missing_fields: string[];
  run_id: string | null;
}

export interface ApiIdentity {
  user: { user_id: string; name: string; provider: string; username: string | null; joined_at: string };
  store_id: string | null;
  store_name: string | null;
  store_opening: string | null;
  setup: ApiSetup;
}

/** POST /api/auth/signup · /api/auth/login 응답 */
export interface ApiAuthSession extends ApiIdentity {
  access_token: string;
}

/** POST /api/stores 요청 */
export interface ApiRegisterBody {
  name: string;
  business_type_input: string;
  address: string;
  address_detail: string;
  opening_date: string;
  owner_birth_year?: number;
  fixed_questions?: boolean;
}

export interface ApiChecklistDates {
  as_of: string;
  items: Pick<ApiChecklistItem, "item_id" | "due_date" | "dday" | "statutory_deadline">[];
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
  setup: ApiSetup;
  /** 저장 트랜잭션에서 확정한 가게 정보와 알림 변경분 */
  store?: ApiStore;
  alert?: ApiAlert;
  removed_alert_ids?: string[];
  checklist_dates?: ApiChecklistDates;
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

/** GET /api/stores/{id}/rent — 한국부동산원 임대동향조사 기준 임대료 비교 (저장하지 않음) */
export interface ApiRentQuery {
  monthly_rent?: number;
  deposit?: number;
  area?: number;
}
export interface ApiRent {
  status: "ready" | "need_input" | "unavailable";
  is_example: boolean;
  message: string | null;
  reason: string | null;
  missing: ("monthly_rent" | "area")[];
  inputs: {
    monthly_rent_krw: number | null;
    deposit_krw: number;
    area_sqm: number | null;
    area_source: "query" | "store" | null;
    floor: string | null;
    underground: boolean;
  };
  average: {
    area_name: string;
    level: "상권" | "권역" | "시도";
    krw_per_sqm: number;
    conversion_rate_pct: number;
    period: string;
    building_type: string;
    source: string;
  } | null;
  comparison: {
    converted_monthly_krw: number;
    deposit_monthly_krw: number;
    mine_krw_per_sqm: number;
    average_krw_per_sqm: number;
    diff_pct: number | null;
    level: "low" | "similar" | "high" | null;
    /** 비교한 층 (headline.floor_label 과 같음). 옛 응답에는 없다 */
    compared_floor?: string | null;
  } | null;
  /** 상단 큰 숫자. 옛 응답에는 없다 */
  headline?: ApiRentHeadline | null;
  /** 같은 상권 층별 비교표. 옛 응답에는 없다 */
  rows?: ApiRentRow[] | null;
  /** "이 숫자 읽는 법" 문장 (코드가 만든 규칙 문장) */
  readings?: string[];
  source?: { name: string; period: string; conversion_rate_pct: number } | null;
  basis: { rent: string; area: string; floor: string };
  notes: string[];
}
export interface ApiRentHeadline {
  area_name: string;
  area_level: "상권" | "권역" | "시도";
  building_type: string;
  floor_label: string;
  krw_per_sqm: number;
  monthly_for_my_area_krw: number | null;
  statistic: string;
}
export interface ApiRentRow {
  label: string;
  krw_per_sqm: number;
  monthly_for_my_area_krw: number | null;
  is_my_floor: boolean;
}
