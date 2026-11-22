import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadModule(file) {
  const absolute = path.resolve(file);
  if (modules.has(absolute)) return modules.get(absolute);
  const output = ts.transpileModule(readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  modules.set(absolute, exports);
  const require = (name) => name.startsWith('.')
    ? loadModule(path.resolve(path.dirname(absolute), `${name}.ts`)) : nativeRequire(name);
  vm.runInNewContext(output, { exports, require }, { filename: absolute });
  return exports;
}
const { buildPopulationInsights, POPULATION_INSIGHT_FILES } = loadModule('src/lib/foot-traffic/insights.ts');
const { cellCenter } = loadModule('src/lib/foot-traffic/coordinates.ts');
const proj4 = nativeRequire('proj4');
const cell = '다사60004500';
const [lng, lat] = proj4('EPSG:5179', 'WGS84', cellCenter(cell));
const center = { lat, lng };
const full = (value) => Array(24).fill(value);
function dataset() {
  return Object.fromEntries(POPULATION_INSIGHT_FILES.map((key) => [key, {
    type: key.startsWith('local') ? 'local' : key,
    ...(key.startsWith('local-') ? { group: key.slice(6) } : {}),
    ymd: '20261115', values: { [cell]: full(0) },
  }]));
}
const run = (data, hour = 'avg', point = center) => buildPopulationInsights(data, point, 500, hour);
const results = [];
function test(name, action) { action(); results.push({ name, status: 'passed' }); }

test('hourly totals combine disjoint population types only', () => {
  const data = dataset();
  data.local.values[cell] = full(10);
  data.fornLong.values[cell] = full(20);
  data.fornTemp.values[cell] = full(30);
  data['local-male'].values[cell] = full(900);
  const result = run(data);
  assert.equal(result.total.value, 60);
  assert.equal(result.hourly.length, 24);
  assert.equal(result.hourly[12].total.value, 60);
  assert.equal(result.hourly[12].local.value, 10);
  assert.equal(result.hourly[12].foreign.value, 50);
});
test('averages exclude fully masked and missing hours, retain public coverage', () => {
  const data = dataset();
  data.local.values[cell] = [100, '*', ...Array(22).fill(null)];
  data.fornLong.values[cell] = full(null);
  data.fornTemp.values[cell] = full(null);
  const result = run(data);
  assert.equal(result.total.value, 100);
  assert.equal(result.total.status, 'partial');
  assert.equal(result.total.coverage.observedCellHours, 1);
  assert.equal(result.total.coverage.expectedCellHours, 24);
  assert.equal(result.hourly[1].total.status, 'masked');
  assert.equal(result.hourly[2].total.status, 'missing');
  assert.equal(result.peak.hour, 0);
  assert.equal(result.peak.partial, true);
});
test('public zero stays zero without inventing ratios or a peak', () => {
  const result = run(dataset());
  assert.equal(result.total.value, 0);
  assert.equal(result.total.status, 'public');
  assert.equal(result.peak, null);
  assert.ok(result.types.every((row) => row.value === 0 && row.share === null));
});
test('fully masked population is null rather than zero', () => {
  const data = dataset();
  for (const key of ['local', 'fornLong', 'fornTemp']) data[key].values[cell] = full('*');
  const result = run(data);
  assert.equal(result.total.value, null);
  assert.equal(result.total.status, 'masked');
  assert.equal(result.peak, null);
});
test('missing population remains null and cannot produce a peak', () => {
  const data = dataset();
  for (const key of ['local', 'fornLong', 'fornTemp']) data[key].values[cell] = full(null);
  const result = run(data);
  assert.equal(result.total.value, null);
  assert.equal(result.total.status, 'missing');
  assert.equal(result.peak, null);
});
test('partial tuple values expose suppressed sources', () => {
  const data = dataset();
  data.local.values[cell][12] = [20, 2, 3];
  const result = run(data, 12);
  assert.equal(result.total.value, 20);
  assert.equal(result.total.status, 'partial');
  assert.equal(result.total.coverage.suppressedSourceValues, 1);
  assert.equal(result.total.coverage.expectedSourceValues, 3);
});
test('sex and age percentages use separate domestic marginals', () => {
  const data = dataset();
  data.local.values[cell] = full(999);
  data['local-male'].values[cell] = full(30);
  data['local-female'].values[cell] = full(70);
  data['local-a20'].values[cell] = full(50);
  data['local-a30'].values[cell] = full(50);
  const result = run(data);
  assert.equal(result.sex[0].share, 30);
  assert.equal(result.sex[1].share, 70);
  assert.equal(result.age.find((row) => row.key === 'a20').share, 50);
  assert.equal(result.age.find((row) => row.key === 'a30').share, 50);
  assert.equal(result.total.value, 999);
});
test('different source dates are rejected rather than merged', () => {
  const data = dataset(); data['local-a70'].ymd = '20261116';
  assert.throws(() => run(data), /기준일/);
});
test('grid centers outside radius contribute nothing', () => {
  const data = dataset(); data.local.values['다사65005000'] = full(1234);
  assert.equal(run(data).total.value, 0);
  const empty = run(data, 'avg', { lat: 33.3, lng: 126.5 });
  assert.equal(empty.total.value, null);
  assert.equal(empty.total.status, 'missing');
  assert.equal(empty.total.coverage.cellCount, 0);
  assert.equal(empty.peak, null);
});
test('missing required files and invalid requests fail explicitly', () => {
  const data = dataset(); delete data['local-female'];
  assert.throws(() => run(data), /파일/);
  assert.throws(() => run(dataset(), 24), /시간/);
  assert.throws(() => run(dataset(), 'avg', { lat: NaN, lng: 127 }), /위치/);
});
test('derived analysis leaves source values unchanged', () => {
  const data = dataset(); data.local.values[cell] = full(25);
  const before = JSON.stringify(data);
  const result = run(data, 12);
  assert.equal(JSON.stringify(data), before);
  assert.equal(result.sourceDate, '20261115');
  assert.equal(result.consistentDate, true);
});

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
