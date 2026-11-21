import { Element } from "@/components/view/Element";
import { type OnboardingStore } from "@/types/onboarding";

export interface StoreAddressFieldsProps { store: OnboardingStore }

export function StoreAddressFields({ store }: StoreAddressFieldsProps) {
  return (
    <>
      <Element as="label" className="nx-f full">
        가게 주소 *
        <Element as="input" id="fAddr" required value={store.address} />
        <small>
          실제 서비스에서는 주소 검색으로 도로명 주소와 좌표를 확인해요.
        </small>
      </Element>
      <Element as="label" className="nx-f">
        상세 주소 (층)
        <Element as="input" id="fDetail" value={store.detail} />
      </Element>
    </>
  );
}
