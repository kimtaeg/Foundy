import { useFeatureData } from "@/hooks/useFeatureData";
import { type OnboardingViewModel } from "@/types/onboarding";

export function useOnboarding() {
  const { context, engine } = useFeatureData("register");
  if (!context || context.W.loading || context.W.error) {
    return { data: null, error: context?.W.error, retry: () => engine?.retrySetup() };
  }
  const data: OnboardingViewModel = {
    store: context.S,
    userName: context.profile().name || "",
    step: Number(context.W.step),
    completed: context.W.done,
    finished: context.W.finished,
    notes: context.W.notes,
    answers: context.W.answers,
    saving: context.W.saving,
    analysisFailed: context.W.analysisFailed,
    analysisSteps: context.STEPS_DECIDED,
  };
  return { data, retry: () => engine?.retrySetup(), error: undefined };
}
