"use client";

import { useRef } from "react";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";
import { Input } from "@/components/ui/Input";
import type { OnboardingStore } from "@/types/onboarding";
import { fieldControl, fieldHint, fieldLabel } from "../onboarding-styles";

export interface StoreAddressFieldsProps { store: OnboardingStore }

export function StoreAddressFields({ store }: StoreAddressFieldsProps) {
  const address = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className={`${fieldLabel} sm:col-span-2`}>
        <label htmlFor="fAddr">가게 주소 <span aria-hidden="true" className="text-foundy-primary-ink">*</span></label>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <input ref={address} id="fAddr" className={fieldControl} required defaultValue={store.address} placeholder="도로명과 건물번호" aria-describedby="store-address-hint" />
          <AddressSearchButton onSelect={(selected) => {
            if (address.current) address.current.value = selected;
            document.getElementById("fDetail")?.focus();
          }} />
        </div>
        <p id="store-address-hint" className={fieldHint}>이 주소로 점검과 상권 분석을 진행해요.</p>
      </div>
      <label className={fieldLabel}>
        <span>상세 주소 <span className="font-normal text-neutral-600">(선택)</span></span>
        <Input id="fDetail" className={fieldControl} value={store.detail} placeholder="1층 101호" />
      </label>
    </>
  );
}
