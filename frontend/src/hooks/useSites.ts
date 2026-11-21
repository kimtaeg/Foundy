"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { MARKET_DEMO_CENTER } from "@/data/market";
import type { SitesViewData } from "@/types/market";

/** Adapts the local demo store to the same JSON contract an API can supply. */
export function useSites(): SitesViewData | null {
  const { context } = useFeatureData("sites");
  if (!context) return null;
  return {
    shops: [...context.SHOPS, ...context.EXFOOD],
    initialCenter: MARKET_DEMO_CENTER,
    address: context.S.address,
    price: context.PRICE,
    priceRange: context.PRICE_EX,
    pricePosition: context.pricePos(context.PRICE),
  };
}
