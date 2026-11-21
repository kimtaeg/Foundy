"use client";

import { useCallback, useMemo, useState } from "react";
import { useMapResource } from "@/hooks/useMapResource";
import { buildPopulationInsights } from "@/lib/foot-traffic/insights";
import type { HourSel, LatLng } from "@/types/foot-traffic";
import type { PopulationDataset, PopulationInsightsDataSource } from "@/types/population-insights";

export interface PopulationInsightsOptions {
  center: LatLng;
  radius: number;
  hour: HourSel;
  dataset?: PopulationDataset;
  dataSource?: PopulationInsightsDataSource;
}

/** Accepts API JSON or an injected loader; no source is selected by this hook. */
export function usePopulationInsights({ center, radius, hour, dataset, dataSource }: PopulationInsightsOptions) {
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => dataSource!.loadDataset(), [dataSource]);
  const resource = useMapResource(!dataset && dataSource ? load : undefined, String(attempt));
  const currentDataset = dataset ?? resource.value;
  const { data, calculationError } = useMemo(() => {
    if (!currentDataset) return { data: null, calculationError: "" };
    try {
      return { data: buildPopulationInsights(currentDataset, { lat: center.lat, lng: center.lng }, radius, hour), calculationError: "" };
    } catch (error) {
      return { data: null, calculationError: error instanceof Error ? error.message : "생활인구 분석 조건을 확인해 주세요." };
    }
  }, [currentDataset, center.lat, center.lng, radius, hour]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const loadError = resource.error ? "생활인구 그래프를 불러오지 못했어요." : "";
  const sourceError = !dataset && !dataSource ? "생활인구 그래프 데이터가 아직 연결되지 않았어요." : "";
  return { data, loading: resource.loading, error: sourceError || loadError || calculationError, retry };
}
