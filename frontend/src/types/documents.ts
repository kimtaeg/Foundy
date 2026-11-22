import type { ApiDocumentStatus } from "@/lib/api/types";
import type { ChecklistTask } from "./checklist";

/** 서류를 받을 수 있는 공식 사이트. */
export interface DocumentSite {
  label: string;
  url: string;
}
/** 체크리스트 항목에 필요한 서류와 받는 곳. */
export interface TaskDocument {
  id: string;
  name: string;
  agency: string;
  guide: string;
  sites: string[];
}
export interface DocumentTask {
  task: ChecklistTask;
  documents: TaskDocument[];
}
/** API에서 그대로 전달할 수 있는 서류 표시 데이터. */
export interface DocumentViewData extends Omit<TaskDocument, "sites"> {
  sites: DocumentSite[];
  status?: ApiDocumentStatus;
}
export interface DocumentTaskViewData {
  task: ChecklistTask;
  documents: DocumentViewData[];
  deadline: string;
}
export interface DocsViewData {
  rows: DocumentTaskViewData[];
  summaryBasis?: "documents";
  total: number;
  finished: number;
  remaining: number;
}
export interface DocsContext {
  allTasks(): ChecklistTask[];
  dday(date: string): string;
}
