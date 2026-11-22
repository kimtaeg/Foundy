"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { MARKET_DEMO_CENTER } from "@/data/market";
import type { SitesViewData } from "@/types/market";

export function useSites(): SitesViewData | null {
  const { context, api, apiActive } = useFeatureData("sites");
  const store = api?.bundle.store;
  if (!context || (apiActive && !store)) return null;
  const coord = store?.address_codes?.coord;
  const hasCoordinates = !!coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
  return {
    shops: [...context.SHOPS, ...context.EXFOOD],
    initialCenter: hasCoordinates ? coord : MARKET_DEMO_CENTER,
    addressResolved: hasCoordinates,
    address: store?.address ?? context.S.address,
    price: context.PRICE,
    priceRange: context.PRICE_EX,
    pricePosition: context.pricePos(context.PRICE),
  };
}
