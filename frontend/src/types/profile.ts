import type { Store } from "./store";
export type StoreDraft = Omit<
  Store,
  "mainManual" | "onboarded" | "birth" | "funds" | "location"
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
