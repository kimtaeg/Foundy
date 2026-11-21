import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in dependencies, `unexpected runtime dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const levels = load('src/lib/foot-traffic/levels.ts');
const cuts = levels.POPULATION_CUTS.age;
const { roadGradientSegments } = load('src/lib/foot-traffic/road-gradient.ts', { './levels': levels });
const { hitTestRoad, paintRoadCanvas } = load('src/lib/foot-traffic/road-canvas.ts', { './roads': { strokeWeight: () => 6 } });
const point = (lat, lng) => ({ lat, lng });
const road = (cell, value, path) => ({ cell, value, path, rank: 3, mid: [0, 0], lv: value === null ? 0 : levels.toLevel(value, cuts) });
const a = road('a', 500, [point(0, 0), point(0, 1)]);
const b = road('b', 3500, [point(0, 1), point(1, 1)]);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }

test('connected cells share an exact boundary color and retain their own interior color', () => {
  const segments = roadGradientSegments([a, b], cuts);
  const first = segments.filter(s => s.cell === 'a'), second = segments.filter(s => s.cell === 'b');
  assert.equal(first.at(-1).toColor, second[0].fromColor);
  assert.equal(first.at(-1).toColor, levels.populationColor(2000, cuts));
  assert.ok(first.some(s => s.toColor === levels.populationColor(500, cuts)));
  assert.ok(second.some(s => s.fromColor === levels.populationColor(3500, cuts)));
  assert.equal(a.value, 500); assert.equal(b.value, 3500);
});
test('junction color is independent of road ordering and the number of roads in one cell', () => {
  const extra = road('a', 500, [point(-1, 1), point(0, 1)]);
  for (const input of [[a,b,extra], [b,extra,a]]) {
    const segments = roadGradientSegments(input, cuts);
    assert.equal(segments.find(s => s.cell === 'b').fromColor, levels.populationColor(2000, cuts));
  }
});
test('masked roads stay gray and do not alter adjacent public values', () => {
  const segments = roadGradientSegments([a, road('masked', null, b.path)], cuts);
  for (const s of segments) {
    const color = s.cell === 'masked' ? levels.SUPPRESSED.color : levels.populationColor(500, cuts);
    assert.equal(s.fromColor, color); assert.equal(s.toColor, color);
  }
});
test('single-digit age counts retain pale anchors while connecting smoothly to busier cells', () => {
  const low = road('low', 8, a.path);
  const higher = road('higher', 150, b.path);
  const segments = roadGradientSegments([low, higher], cuts);
  const first = segments.filter(s => s.cell === 'low');
  const second = segments.filter(s => s.cell === 'higher');
  assert.equal(first[0].fromColor, levels.populationColor(8, cuts));
  assert.equal(first.at(-1).toColor, second[0].fromColor);
  assert.equal(first.at(-1).toColor, levels.populationColor(79, cuts));
  assert.equal(second.at(-1).toColor, levels.populationColor(150, cuts));
  assert.notEqual(first[0].fromColor, second.at(-1).toColor);
  assert.equal(low.value, 8);
  assert.equal(low.lv, 1);
  assert.equal(levels.LEVEL_META[low.lv].label, '매우 적음');
});
test('changing only the selected profile repaints roads and their shared junctions', () => {
  const input = [road('whole', 3889, a.path), road('neighbor', 600, b.path)];
  const whole = roadGradientSegments(input, levels.POPULATION_CUTS.type);
  const age = roadGradientSegments(input, levels.POPULATION_CUTS.age);
  assert.equal(whole[0].fromColor, levels.populationColor(3889, levels.POPULATION_CUTS.type));
  assert.notEqual(whole[0].fromColor, levels.LEVEL_META[5].color);
  assert.equal(age[0].fromColor, levels.LEVEL_META[5].color);
  assert.notEqual(whole[0].fromColor, age[0].fromColor);
  for (const [segments, selectedCuts] of [[whole, levels.POPULATION_CUTS.type], [age, levels.POPULATION_CUTS.age]]) {
    const first = segments.filter(segment => segment.cell === 'whole');
    const second = segments.filter(segment => segment.cell === 'neighbor');
    assert.equal(first.at(-1).toColor, second[0].fromColor);
    assert.equal(first.at(-1).toColor, levels.populationColor((3889 + 600) / 2, selectedCuts));
  }
});
test('public zero remains colored and disconnected roads are never joined', () => {
  const isolated = road('zero', 0, [point(5, 5), point(6, 5)]);
  const segments = roadGradientSegments([a, isolated], cuts);
  assert.equal(segments.length, 2);
  const zero = segments.find(s => s.cell === 'zero');
  assert.equal(zero.fromColor, levels.populationColor(0, cuts));
  assert.notEqual(zero.fromColor, levels.SUPPRESSED.color);
  assert.deepEqual(JSON.parse(JSON.stringify(zero.from)), isolated.path[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(zero.to)), isolated.path[1]);
});
test('zero-length source edges produce no draw or hit area', () => {
  assert.equal(roadGradientSegments([road('same', 1000, [point(1,1),point(1,1)])], cuts).length, 0);
});
test('canvas paints gradients opaquely and hit testing returns source cells', () => {
  const gradients = [], strokes = [];
  const context = {
    clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    createLinearGradient() { const stops=[]; gradients.push(stops); return { addColorStop: (...args) => stops.push(args) }; },
    stroke() { strokes.push(this.strokeStyle); },
  };
  const segments = roadGradientSegments([a,b], cuts);
  const projected = paintRoadCanvas(context, segments, p => ({ x: p.lng*100, y: p.lat*100 }), 4, null, 300, 300);
  assert.equal(strokes.length, segments.length);
  assert.ok(gradients.some(stops => stops[0][1] !== stops[1][1]));
  assert.equal(hitTestRoad(projected, { x: 25, y: 0 }), 'a');
  assert.equal(hitTestRoad(projected, { x: 100, y: 75 }), 'b');
  assert.equal(hitTestRoad(projected, { x: 50, y: 50 }), null);
  assert.equal('globalAlpha' in context, false, 'opacity belongs to the complete layer, not overlapping strokes');
});
console.log(`Road gradient checks passed: ${passed}.`);
