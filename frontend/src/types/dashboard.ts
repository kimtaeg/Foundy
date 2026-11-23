import {
  type ReportAction,
  type ReportCardData,
  type ReportState,
  type Verdict,
} from "@/types/report";
import type { ChecklistTask } from "./checklist";
import type { Store } from "./store";

export type DashboardStore = Pick<
  Store,
  "name" | "type" | "address" | "detail" | "opening" | "region" | "location"
>;
export type DashboardTask = Pick<
  ChecklistTask,
  "id" | "task" | "group" | "category" | "due" | "done"
>;
export type DashboardDecision = Pick<ReportCardData, "id" | "stage" | "title" | "base">;
export interface DashboardAction {
  id: string;
  action: ReportAction;
}
export interface DashboardStageProgress {
  label: string;
  done: number;
  total: number;
}
export interface DashboardScheduleMonth {
  /** Calendar month in YYYY-MM format. */
  month: string;
  count: number;
}
export interface OpeningWeekDay {
  /** Calendar date in YYYY-MM-DD format. */
  date: string;
  day: number;
  weekday: string;
  isOpening: boolean;
}
export interface OpeningTimelineDay extends OpeningWeekDay {
  isToday: boolean;
  tasks: DashboardTask[];
}
/** API-ready display data; event handlers are supplied separately by the caller. */
export interface DashboardViewData {
  store: DashboardStore;
  name: string;
  undecided: boolean;
  days: number;
  decisions: DashboardDecision[];
  taskCount: { done: number; total: number };
  /** @deprecated Notifications are displayed by the global navigation. */
  unread?: number;
  actions: DashboardAction[];
  /** Due-ordered preview including completed tasks so checked rows remain visible. */
  tasks: DashboardTask[];
  /** Full checklist schedule for the horizontally scrollable opening timeline. */
  timelineTasks?: DashboardTask[];
  /** Aggregated from the full task collection, not the upcoming task preview. */
  stages?: DashboardStageProgress[];
  /** @deprecated The opening week calendar uses store.opening instead. */
  schedule?: DashboardScheduleMonth[];
  /** Evaluated verdicts include the user's current choices. */
  reportCounts?: Record<Verdict, number>;
  reportSourceLabel?: string;
  /** Local calendar date (YYYY-MM-DD) used for deadline labels. */
  asOf?: string;
  sourceLabel?: string;
}
export interface DashboardContext {
  S: DashboardStore;
  RS: Record<string, ReportState>;
  SIM: string;
  AR: Record<string, boolean | 1>;
  eff(): { name: string };
  pendingDecisions(): ReportCardData[];
  taskCount(): { done: number; total: number };
  alertsFor(simulation: string): { id: string }[];
  diffDays(a: Date, b: Date): number;
  D(date: string): Date;
  realToday(): Date;
  buildCards(): ReportCardData[];
  ev(card: ReportCardData): Verdict;
  curAction(card: ReportCardData): ReportAction | null;
  allTasks(): DashboardTask[];
}
