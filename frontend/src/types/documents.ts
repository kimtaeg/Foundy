import type { ChecklistTask } from "./checklist";
import type { Contact } from "./contact";

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
  contact?: string;
}
export interface DocumentTask {
  task: ChecklistTask;
  documents: TaskDocument[];
}
/** API에서 그대로 전달할 수 있는 서류 표시 데이터. */
export interface DocumentViewData extends Omit<TaskDocument, "sites"> {
  sites: DocumentSite[];
}
export interface DocumentTaskViewData {
  task: ChecklistTask;
  documents: DocumentViewData[];
  deadline: string;
}
export type ManagedDocumentStatus =
  | "not_started"
  | "in_progress"
  | "obtained"
  | "submitted"
  | "needs_fix"
  | "not_applicable";
export type ManagedDocumentType = "issued" | "application" | "certificate" | "kept" | "reference";
export interface ManagedDocumentFile {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  issuedOn: string | null;
}
/** 서류함의 서류 한 장. 체크리스트와 별개로 자기 상태·파일을 가진다. */
export interface ManagedDocument {
  id: string;
  name: string;
  type: ManagedDocumentType;
  typeLabel: string;
  status: ManagedDocumentStatus;
  statusLabel: string;
  applicability: "applies" | "needs_check" | "not_applicable";
  aiAdded: boolean;
  reason: string | null;
  lawBasis: { label: string; url?: string } | null;
  agency: string;
  guide: string;
  sites: DocumentSite[];
  contact?: string;
  form: { title: string; pdfUrl: string | null; fileUrl: string | null; revision: string | null } | null;
  tasks: { id: string; task: string; done: boolean }[];
  /** 체크리스트의 "서류함에서 보기"가 찾아오는 위치 (작업 id 하나는 서류 한 장에만 둔다) */
  anchors: string[];
  due: string | null;
  deadline: string | null;
  statutoryDate: string | null;
  review: string | null;
  files: ManagedDocumentFile[];
}
/** 서류 목록을 거르는 보기: 전체 / 준비 전 / 준비 중 / 완료 / 보완 필요 */
export type DocFilter = "all" | "todo" | "doing" | "done" | "fix";
export interface ManagedDocumentSection {
  title: string;
  documents: ManagedDocument[];
}
export interface ManagedDocsData {
  total: number;
  finished: number;
  remaining: number;
  notApplicable: number;
  toObtain: number;
  toWrite: number;
  reviewCount: number;
  byStatus: Record<ManagedDocumentStatus, number>;
  sections: ManagedDocumentSection[];
}
export interface DocsViewData {
  rows: DocumentTaskViewData[];
  total: number;
  finished: number;
  remaining: number;
  contacts: Record<string, Contact>;
  /** 서버 연결 모드: 서류별 상태·파일을 관리하는 화면. 없으면 예전처럼 체크리스트 항목별 서류 안내를 보여 준다. */
  managed?: ManagedDocsData;
}
export interface DocsContext {
  allTasks(): ChecklistTask[];
  dday(date: string): string;
  CONTACT: Record<string, Contact>;
  /** 서버 연결 모드에서만. 서류별 상태를 관리하는 서류함 데이터 */
  managedDocuments?(): ManagedDocsData | null;
}
