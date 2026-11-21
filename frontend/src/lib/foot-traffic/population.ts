import type { CellStat, HourSel, HourValue, PopFile } from "@/types/foot-traffic";

function readValue(value: HourValue | undefined): Pick<CellStat, "sum" | "observed" | "suppressed"> | null {
  if (value == null) return null;
  if (value === "*") return { sum: 0, observed: false, suppressed: 1 };
  if (typeof value === "number") return { sum: value, observed: true, suppressed: 0 };
  return { sum: value[0], observed: value[1] > 0, suppressed: value[2] };
}

function cellStatAt(pops: PopFile[], id: string, hour: number): CellStat | null {
  let present = false;
  const stat: CellStat = { sum: 0, observed: false, suppressed: 0, observedHours: 0, presentHours: 0 };
  for (const pop of pops) {
    const value = readValue(pop.values[id]?.[hour]);
    if (!value) continue;
    present = true;
    stat.sum += value.sum;
    stat.observed ||= value.observed;
    stat.suppressed += value.suppressed;
  }
  stat.presentHours = present ? 1 : 0;
  stat.observedHours = stat.observed ? 1 : 0;
  return present ? stat : null;
}

/**
 * Average of hourly public sums with at least one observed value.
 * A fully masked hour is excluded from the denominator, not filled with zero.
 * Valid zero contributes a public hour; missing-only cells remain null.
 */
export function cellStat(pops: PopFile[], id: string, hour: HourSel): CellStat | null {
  if (hour !== "avg") {
    return Number.isInteger(hour) && hour >= 0 && hour < 24 ? cellStatAt(pops, id, hour) : null;
  }
  let sum = 0;
  let observedHours = 0;
  let presentHours = 0;
  let suppressed = 0;
  for (let h = 0; h < 24; h++) {
    const stat = cellStatAt(pops, id, h);
    if (!stat) continue;
    presentHours++;
    suppressed += stat.suppressed;
    if (stat.observed) {
      observedHours++;
      sum += stat.sum;
    }
  }
  if (!presentHours) return null;
  return { sum: observedHours ? sum / observedHours : 0, observed: observedHours > 0, suppressed, observedHours, presentHours };
}

export const allCellIds = (pops: PopFile[]) =>
  [...new Set(pops.flatMap((pop) => Object.keys(pop.values)))];
