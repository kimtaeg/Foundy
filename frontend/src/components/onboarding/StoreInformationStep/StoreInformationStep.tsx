import { DemoScenarioBanner } from "@/components/onboarding/DemoScenarioBanner";
import { StoreInformationForm } from "@/components/onboarding/StoreInformationForm";
import { Element } from "@/components/view/Element";
import { type OnboardingStore } from "@/types/onboarding";

export interface StoreInformationStepProps { store: OnboardingStore }

export function StoreInformationStep({ store }: StoreInformationStepProps) {
  return (
    <Element className="panel">
      <Element as="h2" className="section-title" style={{ marginBottom: 6 }}>
        어떤 가게를 준비하고 있나요?
      </Element>
      <DemoScenarioBanner />
      <StoreInformationForm store={store} />
    </Element>
  );
}
