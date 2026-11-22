import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'src/lib/foot-traffic/levels.ts';
const source = ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports }, { filename: file });
const { POPULATION_CUTS, LEVEL_META, SUPPRESSED, populationColor, toLevel } = exports;
const results = [];
function test(name, action) {
  action();
  results.push({ name, passed: true });
}
const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

test('whole, gender and age use explicit fixed profiles with inclusive lower boundaries', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(POPULATION_CUTS)), {
    type: [500, 1000, 2000, 4000], sex: [250, 500, 1000, 2000], age: [50, 200, 500, 2000],
  });
  for (const cuts of Object.values(POPULATION_CUTS)) {
    assert.equal(toLevel(0, cuts), 1);
    cuts.forEach((cut, index) => {
      assert.equal(toLevel(cut - 0.001, cuts), index + 1);
      assert.equal(toLevel(cut, cuts), index + 2);
    });
    assert.equal(toLevel(50000, cuts), 5);
  }
});

test('whole-population 3889 is high rather than saturated very high', () => {
  assert.equal(toLevel(3889, POPULATION_CUTS.type), 4);
  assert.equal(toLevel(4000, POPULATION_CUTS.type), 5);
  assert.notEqual(populationColor(3889, POPULATION_CUTS.type), LEVEL_META[5].color);
  assert.equal(populationColor(4000, POPULATION_CUTS.type), LEVEL_META[5].color);
  assert.equal(toLevel(3889, POPULATION_CUTS.age), 5);
});

test('road colors and legend share every selected profile anchor', () => {
  for (const cuts of Object.values(POPULATION_CUTS)) {
    [0, ...cuts].forEach((value, index) => {
      assert.equal(populationColor(value, cuts), LEVEL_META[index + 1].color);
    });
  }
});

test('eight age-group people are very low and visibly paler than higher counts', () => {
  const cuts = POPULATION_CUTS.age;
  assert.equal(LEVEL_META[toLevel(8, cuts)].label, '매우 적음');
  const eight = rgb(populationColor(8, cuts));
  const twoHundred = rgb(populationColor(200, cuts));
  assert.deepEqual(eight, [255, 235, 172], 'eight people use the interpolated pale yellow');
  assert.ok(eight[0] > eight[1] && eight[1] > eight[2], 'very low roads remain in the yellow-to-red palette');
  assert.ok(eight.every((channel, index) => channel >= twoHundred[index]) && eight[1] > twoHundred[1] && eight[2] > twoHundred[2], 'eight people must be lighter than two hundred');
  assert.equal(new Set([8, 50, 200, 500, 2000].map((value) => toLevel(value, cuts))).size, 5);
});

test('all five bands blend continuously within every profile', () => {
  for (const cuts of Object.values(POPULATION_CUTS)) {
    const anchors = [0, ...cuts];
    for (let i = 1; i < anchors.length; i++) {
      const from = anchors[i - 1], to = anchors[i];
      const middle = rgb(populationColor((from + to) / 2, cuts));
      const low = rgb(populationColor(from, cuts));
      const high = rgb(populationColor(to, cuts));
      assert.ok(middle.every((channel, index) => Math.abs(channel - (low[index] + high[index]) / 2) <= 0.5));
      assert.notEqual(populationColor(from, cuts), populationColor((from + to) / 2, cuts));
      assert.notEqual(populationColor((from + to) / 2, cuts), populationColor(to, cuts));
    }
  }
});

test('within age or gender, other subgroup values cannot change the selected count scale', () => {
  for (const category of ['age', 'sex']) {
    const cuts = POPULATION_CUTS[category];
    const expectedColor = populationColor(600, cuts);
    const expectedLevel = toLevel(600, cuts);
    for (const otherSelection of [4000, 8000, 0, 120, 2500]) {
      populationColor(otherSelection, cuts);
      toLevel(otherSelection, cuts);
      assert.equal(populationColor(600, cuts), expectedColor);
      assert.equal(toLevel(600, cuts), expectedLevel);
    }
  }
  assert.equal(new Set(Object.values(POPULATION_CUTS).map(cuts => populationColor(600, cuts))).size, 3);
});

test('color remains continuous across every profile boundary', () => {
  for (const cuts of Object.values(POPULATION_CUTS)) {
    for (const value of cuts) {
      const before = rgb(populationColor(value - 0.01, cuts));
      const after = rgb(populationColor(value + 0.01, cuts));
      assert.ok(before.every((channel, i) => Math.abs(channel - after[i]) <= 1));
    }
  }
});

test('public zero remains colored and invalid data remains gray in every profile', () => {
  for (const cuts of Object.values(POPULATION_CUTS)) {
    assert.equal(populationColor(0, cuts), LEVEL_META[1].color);
    assert.notEqual(populationColor(0, cuts), SUPPRESSED.color);
    assert.equal(populationColor(Number.NaN, cuts), SUPPRESSED.color);
    assert.equal(populationColor(Number.POSITIVE_INFINITY, cuts), SUPPRESSED.color);
    assert.equal(populationColor(-1, cuts), populationColor(0, cuts));
    assert.equal(populationColor(100000, cuts), populationColor(cuts.at(-1), cuts));
    assert.equal(toLevel(100000, cuts), 5);
  }
});

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
