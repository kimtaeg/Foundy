import { useFeatureData } from "@/hooks/useFeatureData";
import { type OnboardingViewModel } from "@/types/onboarding";

export function useOnboarding(): OnboardingViewModel | null {
  const { context } = useFeatureData("register");
  if (!context) return null;
  return {
    store: context.S,
    userName: context.profile().name || "",
    step: Number(context.W.step),
    completed: context.W.done,
    analysisSteps: context.STEPS_DECIDED,
    server: Boolean(context.W.server),
    notes: context.W.notes ?? {},
  };
}
