export type ChecklistTaskFilter = "all" | "remaining" | "done";

export interface ChecklistTask {
  id: string;
  task: string;
  category: string;
  group: string;
  due: string;
  documents: string;
  agency: string;
  done: boolean;
}
export interface CalendarEvent {
  t: string;
  cat: string;
  id: string;
  done: boolean;
  kind: "task" | "grant" | "open";
}
export interface CalendarState {
  y: number;
  m: number;
  sel: string | null;
}
export interface ChecklistContext {
  allTasks(): ChecklistTask[];
  taskCount(): { done: number; total: number };
  checkView: "timeline" | "category" | "calendar";
  GROUPS: string[];
  documentCount(taskId: string): number;
  dday(date: string): string;
  S: { opening: string; employees: boolean };
  CAL: CalendarState;
  calEvents(): Record<string, CalendarEvent[]>;
  CATCOLOR: Record<string, string>;
  iso(date: Date): string;
  realToday(): Date;
  TASK_LINKS: Record<string, string[]>;
  AUTO: Record<string, boolean>;
}
export interface TaskGroup {
  title: string;
  tasks: ChecklistTaskRow[];
}
export interface ChecklistTaskRow {
  task: ChecklistTask;
  deadline: string;
  documentCount: number;
}
export interface CalendarDay {
  date: string;
  day: number;
  selected: boolean;
  opening: boolean;
  today: boolean;
  events: CalendarEvent[];
}
export interface ChecklistViewData {
  opening: string;
  employees: boolean;
  view: "timeline" | "category" | "calendar";
  groups: TaskGroup[];
  count: { done: number; total: number };
  colors: Record<string, string>;
  calendar: {
    year: number;
    month: number;
    selected: string | null;
    days: Array<CalendarDay | null>;
    selectedEvents: CalendarEvent[];
  };
}
