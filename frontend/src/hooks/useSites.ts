"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { DEMO_STORE } from "@/data/store";
import { MARKET_DEMO_CENTER } from "@/data/market";
import type { SitesViewData } from "@/types/market";

export function useSites(): SitesViewData | null {
  const { context, api, apiActive } = useFeatureData("sites");
  const store = api?.bundle.store;
  if (!context || (apiActive && !store)) return null;
  const coord = store?.address_codes?.coord;
  const hasCoordinates = !!coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
  return {
    shops: apiActive ? [] : [...context.SHOPS, ...context.EXFOOD],
    initialCenter: hasCoordinates ? coord : MARKET_DEMO_CENTER,
    addressResolved: hasCoordinates || (!apiActive && context.S.address === DEMO_STORE.address),
    address: store?.address ?? context.S.address,
    price: context.PRICE,
    priceRange: context.PRICE_EX,
    pricePosition: context.pricePos(context.PRICE),
  };
}
