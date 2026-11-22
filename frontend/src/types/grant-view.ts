import {
  type Grant,
  type GrantFilters,
  type GrantResult,
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
  months?: GrantMonthViewData[];
  excludedCount: number;
  sourceLabel?: string;
  status?: "ready" | "empty" | "unavailable";
  overview?: {
    /** All eligibility outcomes within the selected category, before the status filter. */
    counts: Record<GrantResult, number>;
    /** Earliest unexpired deadline in the filtered results, including today. */
    nextDeadline: GrantViewItem | null;
  };
}
