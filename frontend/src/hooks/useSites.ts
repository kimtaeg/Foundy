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
    // 가게 좌표가 없으면 서울시청에서 시작하고, 지도가 가게 주소를 좌표로 바꾼다 (특정 상권을 기본값으로 두지 않는다)
    initialCenter: hasCoordinates ? coord : MARKET_DEFAULT_CENTER,
    addressResolved: hasCoordinates,
    address: store?.address ?? context.S.address,
  };
}
