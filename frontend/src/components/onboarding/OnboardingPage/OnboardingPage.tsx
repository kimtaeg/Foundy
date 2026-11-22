"use client";
import { OnboardingView } from "@/components/onboarding/OnboardingView";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the setup flow to the application state. */
export interface OnboardingPageProps {
  embedded?: boolean;
}

export function OnboardingPage({ embedded }: OnboardingPageProps = {}) {
  const { data, error, retry } = useOnboarding();
  const { onEvent } = useFoundy();
  return <OnboardingView embedded={embedded} data={data ?? undefined} loading={!data && !error} error={error} onRetry={retry} onEvent={onEvent} />;
}
