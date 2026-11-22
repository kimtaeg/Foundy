import { DatePickerField } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/Input";
import type { OnboardingStore } from "@/types/onboarding";
import { fieldControl, fieldHint, fieldLabel, numberField } from "../onboarding-styles";

export interface StoreScheduleFieldsProps { store: OnboardingStore }

export function StoreScheduleFields({ store }: StoreScheduleFieldsProps) {
  return (
    <>
      <div className={fieldLabel}>
        <label htmlFor="fOpen-trigger">개업 예정일 <span aria-hidden="true" className="text-foundy-primary-ink">*</span></label>
        <DatePickerField id="fOpen" label="개업 예정일" value={store.opening} required />
      </div>
      <div className={fieldLabel}>
        <label htmlFor="fBirth">출생 연도 <span className="font-normal text-neutral-600">(선택)</span></label>
        <Input id="fBirth" className={`${fieldControl} ${numberField}`} type="number" inputMode="numeric" value={store.birth || ""} placeholder="1995" aria-describedby="store-birth-hint" />
        <p id="store-birth-hint" className={fieldHint}>지원사업 대상 조건을 확인할 때 사용해요.</p>
      </div>
    </>
  );
}
