"use client";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { analyzeMarket } from "@/lib/market";
import { CompetitionCard } from "@/components/sites/CompetitionCard";
import { FieldChecklistCard } from "@/components/sites/FieldChecklistCard";
import { MarketAnalysisPanel } from "@/components/sites/MarketAnalysisPanel";
import { MarketSummaryCard } from "@/components/sites/MarketSummaryCard";
import { NearbyShopsCard } from "@/components/sites/NearbyShopsCard";
import { PricePositionCard } from "@/components/sites/PricePositionCard";
import { PopulationReport } from "@/components/sites/PopulationReport";
import { PopulationSummaryCard } from "@/components/sites/PopulationSummaryCard";
import { StrategyCard } from "@/components/sites/StrategyCard";
import { usePopulationInsights } from "@/hooks/usePopulationInsights";
import type { HourSel } from "@/types/foot-traffic";
import type { MarketCategory, MarketPoint, SitesDataServices, SitesViewData } from "@/types/market";

const FootTrafficMap = dynamic(
  () =>
    import("@/components/foot-traffic/FootTrafficMap").then((module) => module.FootTrafficMap),
  {
    ssr: false,
    loading: () => <SectionSkeleton variant="map" label="상권 지도" className="h-full" />,
  },
);

export interface SitesWorkspaceProps extends SitesDataServices {
  data: SitesViewData;
}

export function SitesWorkspace({
  data,
  appKey,
  footTrafficData,
  footTrafficSource,
  footTrafficLoading,
  footTrafficError,
  onFootTrafficRetry,
  populationData,
  populationSource,
  populationInsights,
  onPriceChange,
  onOpenReport,
  onAnalysisChange,
}: SitesWorkspaceProps) {
  const [center, setCenter] = useState<MarketPoint>(data.initialCenter);
  const [radius, setRadius] = useState(500);
  const [category, setCategory] = useState<MarketCategory>("all");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [time, setTime] = useState<{ hour: HourSel; lastHour: number }>({ hour: "avg", lastHour: 12 });
  const toggleButton = useRef<HTMLButtonElement>(null);
  const analysis = useMemo(
    () => analyzeMarket(data.shops, center, radius, category),
    [data.shops, center, radius, category],
  );
  const selectedShop = analysis.nearby.find((shop) => shop.id === selectedShopId);
  const loadedPopulation = usePopulationInsights({
    center, radius, hour: time.hour,
    dataset: populationInsights ? undefined : populationData,
    dataSource: populationInsights ? undefined : populationSource,
  });
  const population = populationInsights ? {
    data: populationInsights.data,
    loading: populationInsights.loading,
    error: populationInsights.error ?? "",
    retry: populationInsights.onRetry,
  } : loadedPopulation;
  const analysisChange = useRef(onAnalysisChange);
  useEffect(() => { analysisChange.current = onAnalysisChange; }, [onAnalysisChange]);
  useEffect(() => {
    analysisChange.current?.({ center: { lat: center.lat, lng: center.lng }, radius, category, hour: time.hour });
  }, [center.lat, center.lng, radius, category, time.hour]);
  const changeHour = (hour: HourSel) => setTime((previous) => ({ hour, lastHour: hour === "avg" ? previous.lastHour : hour }));
  const closePanel = () => {
    setPanelOpen(false);
    toggleButton.current?.focus();
  };
  return (
    <section
      data-testid="market-workspace"
      id="page-sites"
      className="page active relative h-full min-h-0 w-full overflow-hidden bg-white"
      aria-label="상권 분석 지도"
    >
      <h1 className="sr-only">상권 분석</h1>
      <Suspense fallback={<SectionSkeleton variant="map" label="상권 지도" className="h-full" />}>
        <FootTrafficMap
          appKey={appKey}
          dataset={footTrafficData}
          dataSource={footTrafficSource}
          loading={footTrafficLoading}
          error={footTrafficError}
          onRetry={onFootTrafficRetry}
          center={center}
          onCenterChange={setCenter}
          radius={radius}
          hour={time.hour}
          lastHour={time.lastHour}
          onHourChange={changeHour}
          onRadiusChange={setRadius}
          shops={analysis.nearby}
          selectedShopId={selectedShop?.id ?? null}
          onSelectShop={setSelectedShopId}
          address={data.address}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={(open) => {
            setSettingsOpen(open);
            if (open) setPanelOpen(false);
          }}
        />
      </Suspense>
      <button
        ref={toggleButton}
        type="button"
        onClick={() => {
          setPanelOpen((open) => !open);
          setSettingsOpen(false);
        }}
        aria-expanded={panelOpen}
        aria-controls="market-analysis-panel"
        className="absolute right-3 top-3 z-30 min-h-10 rounded-xl border border-solid border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 shadow-sm lg:hidden"
      >
        상권 정보
      </button>
      <MarketAnalysisPanel
        open={panelOpen}
        onClose={closePanel}
        center={center}
        radius={radius}
        category={category}
        onCategoryChange={setCategory}
        summary={
          <>
            <PopulationSummaryCard data={population.data} loading={population.loading} error={population.error} onRetry={population.retry} />
            <Suspense fallback={<SectionSkeleton variant="card" label="상권 요약" />}>
              <MarketSummaryCard analysis={analysis} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton variant="chart" label="주변 경쟁" />}>
              <CompetitionCard analysis={analysis} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton variant="list" label="분석 안내" />}>
              <StrategyCard />
            </Suspense>
          </>
        }
        population={<PopulationReport {...population} hour={time.hour} onHourChange={changeHour} />}
        shops={
          <Suspense fallback={<SectionSkeleton variant="list" label="주변 점포" />}>
            <NearbyShopsCard
              shops={analysis.nearby}
              selectedShop={selectedShop}
              onSelect={setSelectedShopId}
            />
          </Suspense>
        }
        planning={
          <>
            <Suspense fallback={<SectionSkeleton variant="chart" label="가격 비교" />}>
              <PricePositionCard
                price={data.price}
                range={data.priceRange}
                position={data.pricePosition}
                onPriceChange={onPriceChange}
              />
            </Suspense>
            <FieldChecklistCard onOpenReport={onOpenReport} />
          </>
        }
      />
    </section>
  );
}
