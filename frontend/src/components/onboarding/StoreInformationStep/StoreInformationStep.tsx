import { DemoScenarioBanner } from "@/components/onboarding/DemoScenarioBanner";
import { StoreInformationForm } from "@/components/onboarding/StoreInformationForm";
import type { OnboardingStore } from "@/types/onboarding";
import { stepTitle } from "../onboarding-styles";

export interface StoreInformationStepProps { store: OnboardingStore; saving?: boolean; showDemo?: boolean }

export function StoreInformationStep({ store, saving, showDemo = true }: StoreInformationStepProps) {
  return (
    <section aria-labelledby="store-information-title" className="min-w-0">
      <h2 id="store-information-title" tabIndex={-1} className={stepTitle}>어떤 가게를 준비하고 있나요?</h2>
      {showDemo && <DemoScenarioBanner />}
      <StoreInformationForm store={store} saving={saving} />
    </section>
  );
}
