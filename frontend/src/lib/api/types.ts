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

export interface ApiDocument {
  doc_id: string;
  name: string;
  agency: string;
  guide: string;
  links: { label: string; url: string }[];
  contact?: ApiContact | null;
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
}

export interface ApiChecklist {
  opening_date: string;
  progress: { done: number; total: number };
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

/** 화면 하나를 그리는 데 필요한 응답 묶음. 변경 요청 뒤에는 통째로 다시 받는다. */
export interface ApiBundle {
  store: ApiStore;
  dashboard: ApiDashboard;
  report: ApiReport;
  checklist: ApiChecklist;
  alerts: ApiAlert[];
}
