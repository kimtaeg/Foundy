import type { Category, CrowdLevel, PopulationCuts } from "@/types/foot-traffic";

/** Fixed public population per 250m cell; subgroups within each category share one scale. */
export const POPULATION_CUTS = {
  type: [500, 1000, 2000, 4000],
  sex: [250, 500, 1000, 2000],
  age: [50, 200, 500, 2000],
} as const satisfies Record<Category, PopulationCuts>;
export const POPULATION_SCALE_LABELS: Record<Category, string> = {
  type: "전체 기준",
  sex: "성별 공통 기준",
  age: "연령대 공통 기준",
};
export const POPULATION_LEVELS = [1, 2, 3, 4, 5] as const satisfies readonly CrowdLevel[];
export const LEVEL_META: Record<CrowdLevel, { label: string; color: string }> = {
  1: { label: "매우 적음", color: "#FFF4CC" },
  2: { label: "적음", color: "#FFE08A" },
  3: { label: "보통", color: "#FFB547" },
  4: { label: "많음", color: "#F56B32" },
  5: { label: "매우 많음", color: "#CC3030" },
};
export const SUPPRESSED = { color: "#BFC6D0" };
export const LINE_OPACITY = 0.85;

export function populationColor(value: number, cuts: PopulationCuts): string {
  if (!Number.isFinite(value)) return SUPPRESSED.color;
  const firstColor = LEVEL_META[POPULATION_LEVELS[0]].color;
  const lastColor = LEVEL_META[POPULATION_LEVELS[POPULATION_LEVELS.length - 1]].color;
  if (value <= 0) return firstColor;
  if (value >= cuts[cuts.length - 1]) return lastColor;
  for (let index = 0; index < cuts.length; index++) {
    if (value > cuts[index]) continue;
    const fromValue = index === 0 ? 0 : cuts[index - 1];
    const fromColor = LEVEL_META[POPULATION_LEVELS[index]].color;
    const toColor = LEVEL_META[POPULATION_LEVELS[index + 1]].color;
    const position = (value - fromValue) / (cuts[index] - fromValue);
    const channels = [1, 3, 5].map((start) => {
      const low = Number.parseInt(fromColor.slice(start, start + 2), 16);
      const high = Number.parseInt(toColor.slice(start, start + 2), 16);
      return Math.round(low + (high - low) * position).toString(16).padStart(2, "0");
    });
    return `#${channels.join("")}`.toUpperCase();
  }
  return lastColor;
}

/** Service display bands, not official crowd-safety or road pedestrian counts. */
export function toLevel(value: number, cuts: PopulationCuts): CrowdLevel {
  for (let index = cuts.length - 1; index >= 0; index--) {
    if (value >= cuts[index]) return (index + 2) as CrowdLevel;
  }
  return 1;
}
