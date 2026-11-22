"use client";
import { SitesView } from "@/components/sites/SitesView";
import { useSites } from "@/hooks/useSites";
import { useFoundy } from "@/hooks/useFoundy";
import { staticFootTrafficSource, staticPopulationInsightsSource } from "@/lib/foot-traffic/static-data-source";

export function SitesPage() {
  const data = useSites();
  const { navigate, apiError, refreshApi } = useFoundy();
  return (
    <SitesView
      data={data ?? undefined}
      loading={!data && !apiError}
      error={apiError}
      onRetry={() => { void refreshApi(["store"]); }}
      appKey={process.env.NEXT_PUBLIC_KAKAO_APP_KEY}
      footTrafficSource={staticFootTrafficSource}
      populationSource={staticPopulationInsightsSource}
      onOpenReport={() => navigate("report")}
    />
  );
}
