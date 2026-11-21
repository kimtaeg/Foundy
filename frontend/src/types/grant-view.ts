import {
  type Grant,
  type GrantFilters,
  type GrantResultLabels,
} from "@/types/grants";

export {
  type Grant,
  type GrantFilters,
  type GrantResult,
  type GrantResultLabels,
} from "@/types/grants";

export interface GrantsContext {
  GRANTS: Grant[];
  G: GrantFilters;
  RES: GrantResultLabels;
  dday(date: string): string;
  GRANT_EXCLUDED: number;
  /** 서버 연결 모드에서만: 실제 공고 조회 상태 */
  GRANT_STATUS?: GrantStatus;
}
export interface GrantStatus {
  state: "ready" | "loading" | "empty" | "unavailable";
  source: string | null;
  judgedAt: string | null;
  example: boolean;
}
export interface GrantMonth {
  month: string;
  grants: Grant[];
}
export interface GrantViewItem {
  grant: Grant;
  label: string;
  tone: string;
  deadline: string;
}
export interface GrantMonthViewData {
  month: string;
  grants: GrantViewItem[];
}
export interface GrantsViewData {
  filters: GrantFilters;
  categories: string[];
  grants: GrantViewItem[];
  months: GrantMonthViewData[];
  excludedCount: number;
  status: GrantStatus | null;
}
