import { loadPop, loadQuality } from "./data-loader";
import { POPULATION_INSIGHT_FILES } from "./insights";
import { roadsInRadius } from "./roads";
import type { FootTrafficDataSource } from "@/types/foot-traffic";
import type { PopulationInsightsDataSource } from "@/types/population-insights";

/** Existing public files are selected by the connected page, never by a view. */
export const staticFootTrafficSource: FootTrafficDataSource = {
  loadPopulation: loadPop,
  loadQuality,
  loadRoads: roadsInRadius,
};

export const staticPopulationInsightsSource: PopulationInsightsDataSource = {
  async loadDataset() {
    const entries = await Promise.all(
      POPULATION_INSIGHT_FILES.map(async (key) => [key, await loadPop(key)] as const),
    );
    return Object.fromEntries(entries);
  },
};
