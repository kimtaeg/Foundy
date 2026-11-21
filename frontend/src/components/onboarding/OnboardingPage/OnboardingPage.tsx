"use client";
import { OnboardingView } from "@/components/onboarding/OnboardingView";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the local demo store; the view also accepts API data independently. */
export function OnboardingPage() {
  const data = useOnboarding();
  const { onEvent } = useFoundy();
  return <OnboardingView data={data ?? undefined} loading={data === null} onEvent={onEvent} />;
}
