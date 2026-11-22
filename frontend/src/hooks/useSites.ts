"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { MARKET_DEFAULT_CENTER } from "@/data/market";
import type { SitesViewData } from "@/types/market";

export function useSites(): SitesViewData | null {
  const { context, api, apiActive } = useFeatureData("sites");
  const store = api?.bundle.store;
  if (!context || (apiActive && !store)) return null;
  const coord = store?.address_codes?.coord;
  const hasCoordinates = !!coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
  return {
    initialCenter: hasCoordinates ? coord : MARKET_DEFAULT_CENTER,
    addressResolved: hasCoordinates,
    address: store?.address ?? context.S.address,
  };
}
