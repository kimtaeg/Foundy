import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSourceRuntime } from '../tests/helpers/source-runtime.mjs';

const root = path.resolve(import.meta.dirname, '..');
const { load } = createSourceRuntime();
const { MARKET_DEMO_CENTER } = load('@/data/market');
const { buildPopulationInsights, POPULATION_INSIGHT_FILES } = load('@/lib/foot-traffic/insights');

export const dashboardPopulationRadius = 300;
export const dashboardPopulationPath = path.join(root, 'src/data/dashboard-population.json');

/** Read the existing assets only; this command never fetches or creates source observations. */
export function readPopulationDataset() {
  return Object.fromEntries(POPULATION_INSIGHT_FILES.map((key) => [
    key,
    JSON.parse(readFileSync(path.join(root, 'public/data/foot-traffic', `pop-${key}.json`), 'utf8')),
  ]));
}

/** Keep disclosure states while dropping the unused demographic graphs and coverage payloads. */
export function summarizePopulationInsights(insights) {
  return {
    label: '성수역 기준',
    radius: dashboardPopulationRadius,
    sourceDate: insights.sourceDate,
    sourceLabel: '서울특별시·KT 생활인구 공개자료',
    hourly: insights.hourly.map(({ hour, total }) => ({
      hour,
      value: total.value,
      partial: total.status !== 'public',
    })),
    peak: insights.peak,
  };
}

export function buildDashboardPopulationSnapshot(dataset = readPopulationDataset()) {
  return summarizePopulationInsights(
    buildPopulationInsights(dataset, MARKET_DEMO_CENTER, dashboardPopulationRadius, 'avg'),
  );
}

// This runs at authoring/build time. The browser receives only the small generated JSON.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = buildDashboardPopulationSnapshot();
  const output = `${JSON.stringify(snapshot)}\n`;
  writeFileSync(dashboardPopulationPath, output);
  console.log(`Generated ${path.relative(root, dashboardPopulationPath)}: ${Buffer.byteLength(output)} bytes, source ${snapshot.sourceDate}`);
}
