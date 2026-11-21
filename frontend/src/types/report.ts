import type { Contact } from "./contact";
export type Verdict = "high" | "low" | "unknown" | "ok";
export interface ObligationData {
  rule_id: string;
  title: string;
  status: "applies" | "needs_check" | "not_applicable";
  reason: string;
  missing_inputs: { key: string; label: string }[];
  law: { law_name: string | null; article: string | null; url: string | null };
  required_action: string | null;
  review_status: "draft" | "reviewed";
}
export interface ReportAction {
  type: string;
  text: string;
  min: number;
  go?: { page: string; label: string };
}
export interface ReportOption {
  id: string;
  label: string;
  summary: string;
  time: [string, unknown];
  cost: [string, unknown];
  fx: { changes: string[]; resolved?: string };
  action?: ReportAction;
}
export interface ReportCardData {
  id: string;
  check: string;
  stage: string;
  contact?: string;
  base: Verdict;
  by: string;
  title: string;
  reason: string;
  consequence?: string;
  options: ReportOption[];
  rec?: { id: string; reason: string } | null;
  action?: ReportAction | null;
}
export interface ReportState {
  chosen?: string;
  action?: "pending" | "sent" | "done";
  reply?: string;
}
export interface LinkedTask {
  id: string;
  task: string;
  done: boolean;
}
export interface NextStep {
  k?: string;
  t: string;
  s: string;
  go: [string, string];
  cta: string;
}
export interface ReportCardModel {
  card: ReportCardData;
  state: ReportState;
  verdict: Verdict;
  action: ReportAction | null;
  contact?: Contact;
  nextSteps: NextStep[];
  shortTitle: string;
  open: boolean;
  /** 선택은 했지만 후속 행동을 아직 마치지 않은 상태 */
  followUpPending: boolean;
  /** 접힌 줄 오른쪽에 보이는 진행 상태 */
  statusLabel: string;
}
export interface ReportViewData {
  obligations: ObligationData[];
  /** 서버가 실제로 조회·판정한 결과로 그린 화면이면 true (로컬 예시 화면이면 false) */
  live: boolean;
  /** 실제 조회가 아니라 예시·캐시 자료로 판정한 점검 항목 제목 (서버 데이터로 그릴 때만) */
  exampleItems: string[];
  locked: boolean;
  filter: string;
  counts: Record<Verdict, number>;
  firstByVerdict: Partial<Record<Verdict, string>>;
  cards: ReportCardModel[];
}
export interface ReportContext {
  /** 서버가 정한 법령 적용 결과 (서버 데이터로 그릴 때만) */
  obligations?: ObligationData[];
  exampleItems?: string[];
  S: { location: string };
  reportFilter: string;
  buildCards(): ReportCardData[];
  ev(card: ReportCardData): Verdict;
  RS: Record<string, ReportState>;
  curAction(card: ReportCardData): ReportAction | null;
  CONTACT: Record<string, Contact>;
  allTasks(): LinkedTask[];
  TASK_LINKS: Record<string, string[]>;
  cardDone(id: string): boolean;
  AUTO: Record<string, boolean>;
  nextSteps(id: string): NextStep[];
  cardShort(card: ReportCardData): string;
}

export interface EvidenceItemData {
  source: string;
  value?: string;
  kind: string;
  url?: string;
  /** false면 실제 조회 결과 (없으면 로컬 예시 데이터라 모의 응답으로 표시) */
  mock?: boolean;
}
