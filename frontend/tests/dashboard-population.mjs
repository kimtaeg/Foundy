import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSourceRuntime } from './helpers/source-runtime.mjs';
import {
  buildDashboardPopulationSnapshot,
  dashboardPopulationPath,
  readPopulationDataset,
  summarizePopulationInsights,
} from '../scripts/generate-dashboard-population.mjs';

const { load } = createSourceRuntime();
const { buildPopulationInsights } = load('@/lib/foot-traffic/insights');
const { MARKET_DEMO_CENTER } = load('@/data/market');
const contents = readFileSync(dashboardPopulationPath, 'utf8');
const snapshot = JSON.parse(contents);
const dataset = readPopulationDataset();
const original = JSON.stringify(dataset);
const source = buildPopulationInsights(dataset, MARKET_DEMO_CENTER, 300, 'avg');
const results = [];
function test(name, run) { run(); results.push({ name, passed: true }); }

test('checked-in snapshot matches the current existing source assets', () => {
  assert.deepEqual(snapshot, buildDashboardPopulationSnapshot(dataset));
  assert.equal(JSON.stringify(dataset), original, 'source observations must not be changed');
  assert.equal(snapshot.sourceDate, source.sourceDate);
  assert.equal(snapshot.sourceDate, '20261115');
  assert.equal(snapshot.label, '성수역 기준');
  assert.equal(snapshot.radius, 300);
  assert.ok(Buffer.byteLength(contents) < 15_000, 'dashboard must not ship the full grid dataset');
});

test('all 24 published hourly sums and peak preserve the map aggregation result', () => {
  assert.deepEqual(snapshot.hourly.map((point) => point.hour), Array.from({ length: 24 }, (_, hour) => hour));
  for (const point of source.hourly) {
    assert.equal(snapshot.hourly[point.hour].value, point.total.value);
    assert.equal(snapshot.hourly[point.hour].partial, point.total.status !== 'public');
  }
  assert.deepEqual(snapshot.peak, source.peak);
});

test('missing or suppressed values stay null; public zero and partial sums stay distinct', () => {
  const slim = summarizePopulationInsights({
    sourceDate: '20261115', peak: null,
    hourly: [
      { hour: 0, total: { value: null, status: 'missing' } },
      { hour: 1, total: { value: null, status: 'masked' } },
      { hour: 2, total: { value: 0, status: 'public' } },
      { hour: 3, total: { value: 12, status: 'partial' } },
    ],
  });
  assert.deepEqual(slim.hourly.map(({ value }) => value), [null, null, 0, 12]);
  assert.deepEqual(slim.hourly.map(({ partial }) => partial), [true, true, false, true]);
  assert.equal(slim.peak, null);
});

test('different dates are rejected before a mixed snapshot can be generated', () => {
  const mixed = { ...dataset, local: { ...dataset.local, ymd: '20261116' } };
  assert.throws(() => buildDashboardPopulationSnapshot(mixed), /기준일/);
});

console.log(JSON.stringify({ passed: results.length, bytes: Buffer.byteLength(contents), results }, null, 2));
