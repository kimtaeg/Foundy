import type { HourSel, LatLng, PopFile } from "@/types/foot-traffic";
import type {
  PopulationBreakdownRow, PopulationCoverage, PopulationDataset,
  PopulationInsights, PopulationMeasure,
} from "@/types/population-insights";
import { AGE_GROUPS, POP_TYPES, SEX_GROUPS, TYPE_LABEL } from "./categories";
import { cellCenter, utmk } from "./coordinates";
import { allCellIds, cellStat } from "./population";

/** Existing files only: three totals, two domestic sex groups and eight ages. */
export const POPULATION_INSIGHT_FILES = [
  ...POP_TYPES,
  ...SEX_GROUPS.map(([key]) => `local-${key}`),
  ...AGE_GROUPS.map(([key]) => `local-${key}`),
];

function measure(files: PopFile[], ids: string[], hour: HourSel): PopulationMeasure {
  const hours = hour === "avg" ? Array.from({ length: 24 }, (_, index) => index) : [hour];
  const coverage: PopulationCoverage = {
    cellCount: ids.length, observedCells: 0, suppressedCells: 0, missingCells: 0,
    observedCellHours: 0, expectedCellHours: ids.length * hours.length,
    suppressedSourceValues: 0, missingSourceValues: 0,
    expectedSourceValues: ids.length * hours.length * files.length,
  };
  let sum = 0;
  for (const id of ids) {
    const stat = cellStat(files, id, hour);
    if (stat?.observed) {
      sum += stat.sum;
      coverage.observedCells++;
      coverage.observedCellHours += stat.observedHours;
    }
    let suppressed = false;
    let missing = false;
    for (const file of files) {
      for (const selectedHour of hours) {
        const value = file.values[id]?.[selectedHour];
        if (value == null) {
          coverage.missingSourceValues++;
          missing = true;
        } else if (value === "*" || (Array.isArray(value) && value[2] > 0)) {
          coverage.suppressedSourceValues++;
          suppressed = true;
        }
      }
    }
    if (suppressed) coverage.suppressedCells++;
    if (missing) coverage.missingCells++;
  }
  const hasPublic = coverage.observedCells > 0;
  const incomplete = coverage.suppressedSourceValues > 0 || coverage.missingSourceValues > 0;
  return {
    value: hasPublic ? sum : null,
    status: hasPublic ? incomplete ? "partial" : "public"
      : coverage.suppressedCells ? "masked" : "missing",
    coverage,
  };
}

function breakdown(
  dataset: PopulationDataset, ids: string[], hour: HourSel,
  groups: readonly (readonly [string, string])[], prefix = "",
): PopulationBreakdownRow[] {
  const rows = groups.map(([key, label]) => ({ key, label, ...measure([dataset[`${prefix}${key}`]], ids, hour) }));
  const publicSum = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  return rows.map((row) => ({
    ...row,
    share: row.value !== null && publicSum > 0 ? row.value / publicSum * 100 : null,
  }));
}

/**
 * Radius totals use known grid centers, just like the map. The average is the
 * sum of cell-level observed-hour means, not daily visits. Breakdown shares
 * normalize their own public values; independently averaged groups need not
 * add up to the average of their combined population when coverage differs.
 */
export function buildPopulationInsights(
  dataset: PopulationDataset, center: LatLng, radius: number, hour: HourSel,
): PopulationInsights {
  if (!Number.isFinite(center.lat) || Math.abs(center.lat) > 90 ||
      !Number.isFinite(center.lng) || Math.abs(center.lng) > 180 ||
      !Number.isFinite(radius) || radius <= 0 || radius > 2000 ||
      (hour !== "avg" && (!Number.isInteger(hour) || hour < 0 || hour > 23))) {
    throw new Error("분석 위치·반경·시간을 확인해 주세요.");
  }
  const files = POPULATION_INSIGHT_FILES.map((key) => {
    const file = dataset[key];
    if (!file) throw new Error("생활인구 분석에 필요한 기존 파일이 준비되지 않았어요.");
    return file;
  });
  const sourceDates = [...new Set(files.map((file) => file.ymd))];
  if (sourceDates.length !== 1 || !/^\d{8}$/.test(sourceDates[0])) {
    throw new Error("생활인구 파일의 기준일이 달라 함께 분석할 수 없어요.");
  }
  const [cx, cy] = utmk(center);
  const ids = allCellIds(files).filter((id) => {
    const point = cellCenter(id);
    return point !== null && Math.hypot(point[0] - cx, point[1] - cy) <= radius;
  });
  const totals = POP_TYPES.map((type) => dataset[type]);
  const hourly = Array.from({ length: 24 }, (_, selectedHour) => ({
    hour: selectedHour,
    label: `${String(selectedHour).padStart(2, "0")}시`,
    total: measure(totals, ids, selectedHour),
    local: measure([dataset.local], ids, selectedHour),
    foreign: measure([dataset.fornLong, dataset.fornTemp], ids, selectedHour),
  }));
  const peakPoint = hourly.reduce<(typeof hourly)[number] | null>((peak, point) =>
    point.total.value !== null && point.total.value > 0 && (peak === null || point.total.value > (peak.total.value ?? 0))
      ? point : peak, null);
  return {
    sourceDate: sourceDates[0], sourceDates, consistentDate: true, hour,
    total: measure(totals, ids, hour), hourly,
    types: breakdown(dataset, ids, hour, POP_TYPES.map((key) => [key, TYPE_LABEL[key]] as const)),
    sex: breakdown(dataset, ids, hour, SEX_GROUPS, "local-"),
    age: breakdown(dataset, ids, hour, AGE_GROUPS, "local-"),
    peak: peakPoint && peakPoint.total.value !== null ? {
      hour: peakPoint.hour, value: peakPoint.total.value,
      partial: hourly.some((point) => point.total.status !== "public"),
    } : null,
  };
}
