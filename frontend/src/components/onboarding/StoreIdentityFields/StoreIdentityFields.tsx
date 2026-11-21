import { Element } from "@/components/view/Element";
import { type OnboardingStore } from "@/types/onboarding";

export interface StoreIdentityFieldsProps { store: OnboardingStore }

export function StoreIdentityFields({ store }: StoreIdentityFieldsProps) {
  return (
    <>
      <Element as="label" className="nx-f">
        가게 이름 *<Element as="input" id="fName" required value={store.name} />
      </Element>
      <Element as="label" className="nx-f">
        업종 *
        <Element as="select" id="fType" value={store.type}>
          <option>카페</option>
          <option>음식점</option>
        </Element>
      </Element>
    </>
  );
}
