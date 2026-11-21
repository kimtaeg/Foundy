import type { Store } from "./store";
export type StoreDraft = Omit<
  Store,
  "mainManual" | "onboarded" | "birth" | "funds" | "area" | "location"
> & {
  birth: number | string;
  funds: number | string;
  area: number | string;
  location: string;
};
export interface AccountProfile {
  name: string;
  provider: string;
  joined?: string;
}
export interface ChangeLog {
  ts: string;
  lines: string[];
}
export interface StoreChange {
  k: keyof StoreDraft;
  from: StoreDraft[keyof StoreDraft];
  to: StoreDraft[keyof StoreDraft];
}
export interface ResetCard {
  id: string;
  short: string;
  opt: string;
}
export type FieldDefinitions = Record<keyof StoreDraft, [string, string[]]>;

/** 서버 연결 모드의 영향 미리보기 (PATCH ?dry_run=true 응답을 그대로 보여 준다). */
export interface ServerPreview {
  status: "idle" | "loading" | "ready" | "error";
  /** 서버가 정한 다시 반영 범위의 화면 이름 */
  impacts: string[];
  /** 바뀐 값·초기화되는 카드 요약 (서버 응답 기준) */
  lines: string[];
  needsReanalyze: boolean;
  error?: string;
  /** 최신 입력의 미리보기가 성공했고 저장 중이 아닐 때만 true */
  canSave: boolean;
  saving: boolean;
}

export interface ProfileViewModel {
  onboarded: boolean;
  draft: StoreDraft;
  profile: AccountProfile;
  providerLabel: string;
  impacts: Record<string, string>;
  fields: FieldDefinitions;
  regions: string[];
  changes: StoreChange[];
  affectedLabels: string[];
  resetCards: ResetCard[];
  /** 서버 연결 모드에서만: 서버 미리보기 상태 (없으면 로컬 데모 계산) */
  preview?: ServerPreview;
  /** 서버 연결 모드에서만: 미답변(null)을 포함한 예/아니요 값 */
  answered?: Partial<Record<"alcohol" | "terrace" | "employees" | "delivery", boolean | null>>;
  /** 카드 선택으로 저장값과 다르게 적용 중인 값 안내 */
  notes?: Partial<Record<keyof StoreDraft, string>>;
}

export interface ProfileContext {
  S: { onboarded: boolean };
  mpDraft(): StoreDraft;
  profile(): AccountProfile;
  provLabel(provider: string): string;
  IMP: Record<string, string>;
  MPF: FieldDefinitions;
  REGIONS: string[];
  CHGLOG: ChangeLog[];
  mpDiff(): StoreChange[];
  mpImpacts(changes: StoreChange[]): { set: Set<string>; cardIds: Set<string> };
  resetList(cardIds: Set<string>): ResetCard[];
  fmtMp(key: keyof StoreDraft, value: unknown): string;
}
