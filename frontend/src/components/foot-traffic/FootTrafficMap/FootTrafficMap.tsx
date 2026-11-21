"use client";

import { Suspense, useState } from "react";
import { SectionSkeleton } from "@/components/loading/SectionSkeleton";
import { useFootTrafficData } from "@/hooks/useFootTrafficData";
import { AGE_GROUPS, SEX_GROUPS, TYPE_LABEL, type Category, type HourSel, type LatLng, type ViewType } from "@/lib/foot-traffic";
import type { Shop } from "@/types/market";
import type { FootTrafficDataSource, FootTrafficDataset } from "@/types/foot-traffic";
import { MapAvailability } from "../MapAvailability";
import { MapCanvas } from "../MapCanvas";
import { MapControls } from "../MapControls";
import { MapDataStatus } from "../MapDataStatus";
import { PopulationLegend } from "../PopulationLegend";

export interface FootTrafficMapProps {
  appKey?: string;
  dataSource?: FootTrafficDataSource;
  dataset?: FootTrafficDataset;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  center: LatLng;
  onCenterChange: (center: LatLng) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  shops: Shop[];
  selectedShopId: string | null;
  onSelectShop: (id: string) => void;
  address?: string;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  hour: HourSel;
  lastHour: number;
  onHourChange: (hour: HourSel) => void;
}

const DEFAULT_SUB: Record<Category, string> = { type: "all", sex: "male", age: "a20" };

export function FootTrafficMap(props: FootTrafficMapProps) {
  const [{ category, sub }, setSelection] = useState<{ category: Category; sub: string }>({ category: "type", sub: "all" });
  const { hour, lastHour, onHourChange } = props;
  const [level, setLevel] = useState(4);
  const [shown, setShown] = useState(true);
  const [region, setRegion] = useState("");
  const [addressStatus, setAddressStatus] = useState("");
  const data = useFootTrafficData({ center: props.center, radius: props.radius, category, sub, hour, level, shown, dataset: props.dataset, dataSource: props.dataSource });
  const label = category === "type" ? TYPE_LABEL[sub as ViewType]
    : (category === "sex" ? SEX_GROUPS : AGE_GROUPS).find(([key]) => key === sub)?.[1] ?? sub;
  const appKey = props.appKey;
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-neutral-100 text-neutral-900" data-testid="traffic-map">
      <Suspense fallback={<SectionSkeleton variant="map" label="상권 지도" className="h-full" />}>
      {appKey ? <MapCanvas {...props} appKey={appKey} level={level} lines={props.loading ? [] : data.lines} cells={data.cells} cuts={data.cuts} label={label} hour={hour}
        onLevelChange={setLevel} onRegionChange={setRegion} onAddressStatusChange={setAddressStatus} />
        : <MapAvailability state="missing-key" />}
      </Suspense>
      <MapControls open={props.settingsOpen} onOpenChange={props.onSettingsOpenChange} category={category} sub={sub} hour={hour} lastHour={lastHour} radius={props.radius} shown={shown} region={region}
        onCategoryChange={(value) => setSelection({ category: value, sub: DEFAULT_SUB[value] })}
        onSubChange={(value) => setSelection({ category, sub: value })}
        onHourChange={onHourChange}
        onRadiusChange={props.onRadiusChange} onToggle={() => setShown(!shown)} />
      <PopulationLegend category={category} settingsOpen={props.settingsOpen} label={label} hour={hour} date={data.pops?.[0]?.ymd ?? data.quality?.ymd ?? ""} radius={props.radius} cuts={data.cuts} hasPublicValues={data.hasPublicValues} summary={data.summary} quality={data.quality} loading={Boolean(props.loading || data.populationLoading)} />
      <MapDataStatus loading={Boolean(props.loading || data.loading)} error={props.error ?? (props.loading ? "" : data.error)} addressStatus={addressStatus} retry={props.onRetry ?? data.retry} />
    </div>
  );
}
