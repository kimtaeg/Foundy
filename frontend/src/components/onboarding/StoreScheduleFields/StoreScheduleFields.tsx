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
        영업장 면적 (㎡, 선택)
        <Element
          as="input"
          id="fArea"
          type="number"
          min="1"
          step="0.1"
          value={store.area || ""}
        />
        <small>소방 안전시설처럼 면적 기준이 있는 규정을 확인하는 데 써요.</small>
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
