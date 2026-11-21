import { type ActionHandlers } from "@/types/actions";
import { type ReportState } from "@/types/report";
import { type Store } from "@/types/store";

interface OnboardingState {
  step: number | "choose";
  path: Store["location"] | null;
  done: number[];
  timers: ReturnType<typeof globalThis.setTimeout>[];
}

interface OnboardingActionContext {
  clearTimers: () => void;
  W: OnboardingState;
  goto: (page: string) => void;
  prepareRegistration: () => void;
  $: (id: string) => HTMLElement | null;
  S: Store;
  saveS: () => void;
  runAnalysis: () => void;
  recalc: () => void;
  window: { scrollTo: (x: number, y: number) => void };
  RS: Record<string, ReportState>;
  put: (key: string, value: unknown) => void;
}

/** Commands emitted by onboarding views; view layout is deliberately absent. */
export function createOnboardingActions(
  context: OnboardingActionContext,
): ActionHandlers {
  return {
    newStore: () => {
      context.clearTimers();
      context.W = { step: "choose", path: null, done: [], timers: [] };
      context.goto("register");
      return true;
    },
    path: (button) => {
      const path = button.dataset.v;
      context.W.path = path === "decided" || path === "undecided" ? path : null;
      context.W.step = context.W.path ? 1 : "choose";
      context.prepareRegistration();
      return true;
    },
    yn: (button) => {
      const funds = context.$("fFunds");
      if (funds instanceof HTMLInputElement)
        context.S.funds = funds.value ? Number(funds.value) : null;
      const field = button.dataset.k;
      if (field === "alcohol" || field === "terrace" || field === "employees" || field === "delivery")
        context.S[field] = button.dataset.v === "1";
      context.saveS();
      context.prepareRegistration();
      return true;
    },
    wizback: () => {
      context.W.step = 1;
      context.prepareRegistration();
      return true;
    },
    analyze: () => {
      const funds = context.$("fFunds");
      context.S.funds =
        funds instanceof HTMLInputElement && funds.value
          ? Number(funds.value)
          : null;
      context.saveS();
      context.runAnalysis();
      return true;
    },
    finish: () => {
      context.S.onboarded = true;
      context.saveS();
      context.recalc();
      context.goto(context.W.path === "undecided" ? "sites" : "dashboard");
      context.window.scrollTo(0, 0);
      return true;
    },
    demo: () => {
      context.S = {
        ...context.S,
        name: "모노커피",
        type: "카페",
        address: "서울특별시 성동구 성수이로 00",
        detail: "1층",
        opening: "2027-03-02",
        birth: 1998,
        location: "decided",
        alcohol: true,
        terrace: false,
        employees: true,
        funds: 40000000,
        mainManual: null,
      };
      context.saveS();
      context.RS = {};
      context.put("rs", context.RS);
      context.W.path = "decided";
      context.runAnalysis();
      return true;
    },
  };
}
