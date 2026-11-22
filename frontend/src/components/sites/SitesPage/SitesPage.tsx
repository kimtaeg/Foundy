"use client";
import { SitesView } from "@/components/sites/SitesView";
import { useSites } from "@/hooks/useSites";
import { useFoundy } from "@/hooks/useFoundy";
import { staticFootTrafficSource, staticPopulationInsightsSource } from "@/lib/foot-traffic/static-data-source";
import { loadKakaoNearbyShops } from "@/lib/market/kakao-shops";

export function SitesPage() {
  const data = useSites();
  const { onEvent, navigate, apiActive, apiError, refreshApi } = useFoundy();
  const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  return (
    <SitesView
      data={data ?? undefined}
      loading={!data && !apiError}
      error={apiError}
      onRetry={() => { void refreshApi(["store"]); }}
      appKey={appKey}
      nearbyShopsSource={appKey || apiActive ? loadKakaoNearbyShops : undefined}
      footTrafficSource={staticFootTrafficSource}
      populationSource={staticPopulationInsightsSource}
      onPriceChange={(event) => onEvent("input", event)}
      onOpenReport={() => navigate("report")}
    />
  );
}
