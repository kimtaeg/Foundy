"use client";

import { useCallback, useMemo, useState } from "react";
import { useMapResource } from "@/hooks/useMapResource";
import {
  allCellIds, cellCenter, cellStat, filesFor,
  maxRankForLevel, POPULATION_CUTS, toLevel, utmk,
  type Category, type CellStat, type HourSel, type LatLng,
  type PopulationRoad, type FootTrafficDataset, type FootTrafficDataSource,
} from "@/lib/foot-traffic";

export interface FootTrafficDataOptions {
  center: LatLng;
  radius: number;
  category: Category;
  sub: string;
  hour: HourSel;
  level: number;
  shown: boolean;
  dataset?: FootTrafficDataset;
  dataSource?: FootTrafficDataSource;
}

/** Async resources and derived population values, independent of the map SDK. */
export function useFootTrafficData({ center, radius, category, sub, hour, level, shown, dataset, dataSource }: FootTrafficDataOptions) {
  const [attempt, setAttempt] = useState(0);
  const loadQuality = useCallback(() => dataSource!.loadQuality(), [dataSource]);
  const loadPopulation = useCallback(
    () => Promise.all(filesFor(category, sub).map((name) => dataSource!.loadPopulation(name))),
    [category, sub, dataSource],
  );
  const loadRoads = useCallback(
    () => dataSource!.loadRoads({ lat: center.lat, lng: center.lng }, radius),
    [center.lat, center.lng, radius, dataSource],
  );
  const remote = !dataset && Boolean(dataSource);
  const qualityResource = useMapResource(remote ? loadQuality : undefined, String(attempt));
  const populationResource = useMapResource(remote ? loadPopulation : undefined, String(attempt));
  const roadResource = useMapResource(remote ? loadRoads : undefined, String(attempt));
  const quality = dataset ? dataset.quality : qualityResource.value ?? null;
  const suppliedPopulation = useMemo(() => {
    if (!dataset) return null;
    const names = filesFor(category, sub);
    return names.every((name) => dataset.populations[name])
      ? names.map((name) => dataset.populations[name])
      : null;
  }, [dataset, category, sub]);
  const pops = dataset ? suppliedPopulation : populationResource.value ?? null;
  const suppliedRoads = useMemo(() => {
    if (!dataset) return null;
    const [x, y] = utmk(center);
    return dataset.roads.filter((road) => (road.mid[0] - x) ** 2 + (road.mid[1] - y) ** 2 <= radius ** 2);
  }, [dataset, center, radius]);
  const roads = dataset ? suppliedRoads : roadResource.value ?? null;
  const populationError = populationResource.error || (dataset && !suppliedPopulation)
    ? "생활인구 데이터를 불러오지 못했어요." : "";
  const roadError = roadResource.error ? "주변 도로를 불러오지 못했어요." : "";
  const qualityError = qualityResource.error || (!qualityResource.loading && quality === null)
    ? "데이터 기준 정보를 불러오지 못했어요." : "";
  const sourceError = !dataset && !dataSource ? "지도 데이터가 아직 연결되지 않았어요." : "";

  const cells = useMemo(() => {
    const result = new Map<string, CellStat>();
    if (!pops) return result;
    for (const id of allCellIds(pops)) {
      const value = cellStat(pops, id, hour);
      if (value) result.set(id, value);
    }
    return result;
  }, [pops, hour]);

  const cuts = POPULATION_CUTS[category];
  const hasPublicValues = useMemo(() => [...cells.values()].some((value) => value.observed), [cells]);

  const lines = useMemo<PopulationRoad[]>(() => {
    if (!roads || !pops || !shown) return [];
    const maxRank = maxRankForLevel(level);
    return roads.filter((road) => road.rank <= maxRank).flatMap((road) => {
      const value = cells.get(road.cell);
      return value ? [{ ...road, value: value.observed ? value.sum : null, lv: value.observed ? toLevel(value.sum, cuts) : 0 as const }] : [];
    }).sort((a, b) => a.lv - b.lv || b.rank - a.rank);
  }, [roads, pops, shown, level, cells, cuts]);

  const summary = useMemo(() => {
    if (!pops) return null;
    const [cx, cy] = utmk(center);
    let sum = 0;
    let total = 0;
    let observed = 0;
    let suppressed = 0;
    for (const [id, value] of cells) {
      const point = cellCenter(id);
      if (!point || Math.hypot(point[0] - cx, point[1] - cy) > radius) continue;
      total++;
      if (value.observed) { sum += value.sum; observed++; }
      if (value.suppressed) suppressed++;
    }
    return { sum, total, observed, suppressed };
  }, [pops, cells, center, radius]);

  return {
    quality, pops, roads, cells, cuts, hasPublicValues, lines, summary,
    populationLoading: populationResource.loading,
    loading: populationResource.loading || roadResource.loading,
    error: [sourceError, populationError, roadError, qualityError].filter(Boolean).join(" "),
    retry: () => setAttempt((value) => value + 1),
  };
}
