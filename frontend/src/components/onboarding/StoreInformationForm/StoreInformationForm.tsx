import { StoreAddressFields } from "@/components/onboarding/StoreAddressFields";
import { StoreIdentityFields } from "@/components/onboarding/StoreIdentityFields";
import { StoreScheduleFields } from "@/components/onboarding/StoreScheduleFields";
import { Element } from "@/components/view/Element";
import { type OnboardingStore } from "@/types/onboarding";

export interface StoreInformationFormProps { store: OnboardingStore }

export function StoreInformationForm({ store }: StoreInformationFormProps) {
  return (
    <Element as="form" id="nxForm" className="nx-form">
      <StoreIdentityFields store={store} />
      <StoreAddressFields store={store} />
      <StoreScheduleFields store={store} />
      <div
        className="full"
        style={{ display: "flex", justifyContent: "flex-end" }}
      >
        <Element as="button" className="nx-btn" type="submit">
          다음 · 추가 질문 →
        </Element>
      </div>
    </Element>
  );
}
