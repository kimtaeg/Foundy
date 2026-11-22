"use client";
import { SitesView } from "@/components/sites/SitesView";
import { useSites } from "@/hooks/useSites";
import { useFoundy } from "@/hooks/useFoundy";
import { staticFootTrafficSource, staticPopulationInsightsSource } from "@/lib/foot-traffic/static-data-source";
import { loadKakaoNearbyShops } from "@/lib/market/kakao-shops";
import { loadRentComparison } from "@/lib/market/rent";

export function SitesPage() {
  const data = useSites();
  const { navigate, apiActive, apiError, refreshApi } = useFoundy();
  const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  return (
    <SitesView
      data={data ?? undefined}
      loading={!data && !apiError}
      error={apiError}
      onRetry={() => { void refreshApi(["store"]); }}
      appKey={appKey}
      nearbyShopsSource={appKey || apiActive ? loadKakaoNearbyShops : undefined}
      rentSource={apiActive ? loadRentComparison : undefined}
      footTrafficSource={staticFootTrafficSource}
      populationSource={staticPopulationInsightsSource}
      onOpenReport={() => navigate("report")}
    />
  );
}
