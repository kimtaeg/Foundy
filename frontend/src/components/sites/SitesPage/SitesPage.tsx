"use client";
import { SitesView } from "@/components/sites/SitesView";
import { useSites } from "@/hooks/useSites";
import { useFoundy } from "@/hooks/useFoundy";
import { staticFootTrafficSource, staticPopulationInsightsSource } from "@/lib/foot-traffic/static-data-source";

/** Local demo adapter; replace these data props and callbacks with your API client. */
export function SitesPage() {
  const data = useSites();
  const { onEvent, navigate } = useFoundy();
  return (
    <SitesView
      data={data ?? undefined}
      loading={!data}
      appKey={process.env.NEXT_PUBLIC_KAKAO_APP_KEY}
      footTrafficSource={staticFootTrafficSource}
      populationSource={staticPopulationInsightsSource}
      onPriceChange={(event) => onEvent("input", event)}
      onOpenReport={() => navigate("report")}
    />
  );
}
