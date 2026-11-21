export type GrantResult = "eligible" | "partial" | "unknown";
export interface Grant {
  id: string;
  title: string;
  org: string;
  cat: string;
  region: string;
  amount: string;
  deadline: string | null;
  res: GrantResult;
  hue: [string, string];
  who: string;
  how: string;
  submit: string[];
  checks: Array<[string, "pass" | "unknown", string]>;
  /** 공고 원문 링크 (실제 공고만) */
  url?: string | null;
  /** 예시 공고(화면 시연용)면 true */
  example?: boolean;
}
export interface GrantFilters {
  res: "all" | GrantResult;
  cat: string;
  sort: "deadline" | "fit";
  view: "card" | "list" | "month";
}
export type GrantResultLabels = Record<GrantResult, [string, string]>;
