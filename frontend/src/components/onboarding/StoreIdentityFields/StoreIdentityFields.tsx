import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { OnboardingStore } from "@/types/onboarding";
import { fieldControl, fieldLabel } from "../onboarding-styles";

export interface StoreIdentityFieldsProps { store: OnboardingStore }

export function StoreIdentityFields({ store }: StoreIdentityFieldsProps) {
  return (
    <>
      <label className={fieldLabel}>
        <span>가게 이름 <span aria-hidden="true" className="text-foundy-primary-ink">*</span></span>
        <Input id="fName" className={fieldControl} required value={store.name} placeholder="가게 이름을 입력해 주세요" />
      </label>
      <label className={fieldLabel}>
        <span>업종 <span aria-hidden="true" className="text-foundy-primary-ink">*</span></span>
        <span className="relative block min-w-0">
          <Select id="fType" className={`${fieldControl} appearance-none pr-10`} required value={store.type}>
            <option>카페</option>
            <option>음식점</option>
          </Select>
          <svg aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5 5 5-5" /></svg>
        </span>
      </label>
    </>
  );
}
