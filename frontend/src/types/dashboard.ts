import {
  type ReportAction,
  type ReportCardData,
  type ReportState,
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
export interface DashboardAction {
  id: string;
  action: ReportAction;
}
/** API-ready display data; event handlers are supplied separately by the caller. */
export interface DashboardViewData {
  store: DashboardStore;
  name: string;
  undecided: boolean;
  days: number;
  decisions: ReportCardData[];
  taskCount: { done: number; total: number };
  unread: number;
  actions: DashboardAction[];
  tasks: DashboardTask[];
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
  curAction(card: ReportCardData): ReportAction | null;
  allTasks(): DashboardTask[];
}
