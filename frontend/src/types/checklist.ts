/** 필수 / 조건부 / 권장. 서버 연결 모드에서만 값이 있다. */
export type TaskKind = "legal_obligation" | "conditional" | "preparation";
export interface TaskLawBasis {
  label: string;
  url?: string;
}
export interface ChecklistTask {
  id: string;
  task: string;
  category: string;
  group: string;
  /** 권장 준비일. 법령이 정한 기한과 다르다 (statutory 참고). */
  due: string;
  documents: string;
  agency: string;
  done: boolean;
  kind?: TaskKind;
  /** 법령 분석·규칙으로 새로 발견해 추가한 작업 */
  aiAdded?: boolean;
  /** 왜 이 작업이 필요한지 (적용 조건) */
  reason?: string | null;
  lawBasis?: TaskLawBasis | null;
  /** 법령이 개업 전 기한을 정한 작업만. 날짜와 근거 문구 */
  statutory?: { date: string; basis: string } | null;
  /** 법령 개정 등으로 다시 확인해야 할 때의 안내 */
  review?: string | null;
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
  /** 필수·조건부·권장 개수 (서버 연결 모드에서만) */
  typeCounts?(): Record<TaskKind, number> | null;
  checkView: "timeline" | "category" | "calendar";
  GROUPS: string[];
  documentCount(taskId: string): number;
  contactOfAgency(agency: string): { phone: string; ex?: boolean } | null;
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
export interface ChecklistContact {
  phone: string;
  ex?: boolean;
}
export interface ChecklistTaskRow {
  task: ChecklistTask;
  contact: ChecklistContact | null;
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
  /** 필수·조건부·권장 개수. 로컬 예시에는 없다 */
  kinds: Record<TaskKind, number> | null;
  reviewCount: number;
  colors: Record<string, string>;
  calendar: {
    year: number;
    month: number;
    selected: string | null;
    days: Array<CalendarDay | null>;
    selectedEvents: CalendarEvent[];
  };
}
