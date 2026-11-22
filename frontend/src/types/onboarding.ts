import type { Store } from "./store";
export type OnboardingStore = Pick<
  Store,
  | "name"
  | "type"
  | "address"
  | "detail"
  | "opening"
  | "birth"
  | "area"
  | "alcohol"
  | "terrace"
  | "employees"
  | "funds"
  | "onboarded"
>;
export type OnboardingAnswers = Record<"alcohol" | "terrace" | "employees", boolean | null>;
export interface OnboardingViewModel {
  store: OnboardingStore;
  userName: string;
  step: number;
  completed: number[];
  finished?: boolean;
  notes?: Record<number, string>;
  answers?: OnboardingAnswers;
  saving?: boolean;
  analysisFailed?: boolean;
  analysisSteps: string[];
}

export interface OnboardingContext {
  S: OnboardingStore;
  profile(): { name: string };
  W: {
    step: number | "choose";
    done: number[];
    finished?: boolean;
    notes?: Record<number, string>;
    answers?: OnboardingAnswers;
    saving?: boolean;
    analysisFailed?: boolean;
    loading?: boolean;
    error?: string;
  };
  STEPS_DECIDED: string[];
}
