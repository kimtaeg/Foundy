import { StoreAddressFields } from "@/components/onboarding/StoreAddressFields";
import { StoreIdentityFields } from "@/components/onboarding/StoreIdentityFields";
import { StoreScheduleFields } from "@/components/onboarding/StoreScheduleFields";
import type { OnboardingStore } from "@/types/onboarding";
import { formGrid, primaryAction, stepFooter } from "../onboarding-styles";

export interface StoreInformationFormProps { store: OnboardingStore; saving?: boolean }

export function StoreInformationForm({ store, saving = false }: StoreInformationFormProps) {
  return (
    <form id="nxForm" className="mt-6" aria-busy={saving}>
      <div className={formGrid}>
        <StoreIdentityFields store={store} />
        <StoreAddressFields store={store} />
        <StoreScheduleFields store={store} />
      </div>
      <div className={`${stepFooter} mt-7 justify-end`}>
        <button className={primaryAction} type="submit" disabled={saving}>
          {saving ? "저장 중…" : <>다음 · 영업 조건 <span aria-hidden="true">→</span></>}
        </button>
      </div>
    </form>
  );
}
