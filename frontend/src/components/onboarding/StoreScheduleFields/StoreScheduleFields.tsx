import { Element } from "@/components/view/Element";
import { type OnboardingStore } from "@/types/onboarding";

export interface StoreScheduleFieldsProps { store: OnboardingStore }

export function StoreScheduleFields({ store }: StoreScheduleFieldsProps) {
  return (
    <>
      <Element as="label" className="nx-f">
        개업 예정일 *
        <Element
          as="input"
          id="fOpen"
          type="date"
          required
          value={store.opening}
        />
      </Element>
      <Element as="label" className="nx-f">
        출생 연도 (선택)
        <Element
          as="input"
          id="fBirth"
          type="number"
          value={store.birth || ""}
        />
        <small>지원사업 대상 조건 확인에만 써요.</small>
      </Element>
    </>
  );
}
