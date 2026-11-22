import type { Contact } from "./contact";
export type Verdict = "high" | "low" | "unknown" | "ok";
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
  decisionTask?: string;
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
  /** @deprecated 이전 API 응답과의 호환용 필드 */
  statusLabel?: string;
}
export interface ReportViewData {
  locked: boolean;
  filter: string;
  counts: Record<Verdict, number>;
  firstByVerdict: Partial<Record<Verdict, string>>;
  cards: ReportCardModel[];
}
export interface ReportContext {
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
}
