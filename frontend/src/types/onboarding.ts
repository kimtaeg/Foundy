import type { Store } from "./store";
export type OnboardingStore = Pick<
  Store,
  | "name"
  | "type"
  | "address"
  | "detail"
  | "opening"
  | "birth"
  | "alcohol"
  | "terrace"
  | "area"
  | "delivery"
  | "employees"
  | "funds"
  | "onboarded"
>;
export interface OnboardingViewModel {
  store: OnboardingStore;
  userName: string;
  step: number;
  completed: number[];
  analysisSteps: string[];
  /** 서버 분석의 실제 진행이면 true, 로컬 시뮬레이션이면 false */
  server: boolean;
  /** 단계 번호 → 실제 상태 문구 (예시·캐시 자료로 대체, 조회 실패 등). 없으면 "완료" */
  notes: Record<number, string>;
}

export interface OnboardingContext {
  S: OnboardingStore;
  profile(): { name: string };
  W: { step: number | "choose"; done: number[]; server?: boolean; notes?: Record<number, string> };
  STEPS_DECIDED: string[];
}
