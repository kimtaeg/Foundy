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
}

export interface OnboardingContext {
  S: OnboardingStore;
  profile(): { name: string };
  W: { step: number | "choose"; done: number[] };
  STEPS_DECIDED: string[];
}
