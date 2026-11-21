"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { MARKET_DEFAULT_CENTER } from "@/data/market";
import type { SitesViewData } from "@/types/market";

/** Adapts the local demo store to the same JSON contract an API can supply. */
export function useSites(): SitesViewData | null {
  const { context } = useFeatureData("sites");
  if (!context) return null;
  return {
    shops: [...context.SHOPS, ...context.EXFOOD],
    // 가게 주소를 찾기 전·못 찾았을 때만 쓰는 기본 중심이다 (지도는 주소를 찾은 뒤에 그린다)
    initialCenter: MARKET_DEFAULT_CENTER,
    address: context.S.address,
    price: context.PRICE,
    priceRange: context.PRICE_EX,
    pricePosition: context.pricePos(context.PRICE),
  };
}
