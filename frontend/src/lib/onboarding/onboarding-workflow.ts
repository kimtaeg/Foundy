import { STEPS_DECIDED, STEPS_UNDECIDED } from "@/data/onboarding";
import type { OnboardingDependencies } from "@/types/dependencies";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createOnboardingWorkflow(context: OnboardingDependencies) {
  function clearTimers(): any {
    context.W.timers.forEach(context.clearTimeout);
    context.W.timers = [];
  }

  function prepareRegistration(): void {
    if (context.W.step === "choose") {
      context.W.step = 1;
      context.W.path = "decided";
    }
  }

  function runAnalysis(): any {
    clearTimers();
    context.W.step = 3;
    context.W.done = [];
    prepareRegistration();
    const steps: any =
      context.W.path === "undecided" ? STEPS_UNDECIDED : STEPS_DECIDED;
    steps.forEach((_: string, i: number) =>
      context.W.timers.push(
        context.setTimeout(
          () => {
            context.W.done.push(i);
            if (context.currentPage === "register" && context.W.step === 3)
              prepareRegistration();
          },
          550 * (i + 1),
        ),
      ),
    );
  }

  function readForm(): any {
    if (!context.S.onboarded) {
      context.RS = {};
      context.put("rs", context.RS);
      context.X = {};
      context.put("xdone", context.X);
      context.CANDX = [];
      context.put("candx", context.CANDX);
      context.NEXTLOG = [];
      context.put("nextlog", context.NEXTLOG);
      context.tasks.forEach((t: any) => {
        t.done = false;
      });
      context.put("tasksdone", {});
    }
    context.S.name = context.$("fName").value || context.S.name;
    context.S.type = context.$("fType").value;
    context.S.opening = context.$("fOpen").value || context.S.opening;
    context.S.birth = Number(context.$("fBirth").value) || null;
    context.S.area = Number(context.$("fArea").value) > 0 ? Number(context.$("fArea").value) : null;
    if (context.W.path === "undecided") {
      context.S.region = context.$("fRegion").value;
      context.S.location = "undecided";
    } else {
      context.S.address = context.$("fAddr").value;
      context.S.detail = context.$("fDetail").value;
      context.S.location = "decided";
    }
    context.saveS();
  }
  return { clearTimers, prepareRegistration, runAnalysis, readForm };
}
