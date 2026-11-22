import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
function loadModule(relativePath, dependencies = {}) {
  const exports = {};
  const filename = fileURLToPath(new URL(relativePath, root));
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  vm.runInNewContext(
    outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      Math,
      Map,
    },
    { filename },
  );
  return exports;
}

const data = loadModule("src/data/market.ts");
const { distanceMeters, analyzeMarket } = loadModule(
  "src/lib/market/analyze-market.ts",
  { "@/data/market": data },
);
const center = data.MARKET_DEMO_CENTER;
const shops = [...data.SHOPS, ...data.EXFOOD];
const original = JSON.stringify(shops);

assert.equal(distanceMeters(center, center), 0);
assert.ok(
  Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195) <
    1,
);

const all = analyzeMarket(shops, center, 500, "all");
assert.equal(all.count, 23);
assert.equal(analyzeMarket(shops, center, 500, "카페").count, 15);
assert.equal(analyzeMarket(shops, center, 500, "음식점").count, 8);
assert.ok(
  all.nearby.every((shop) => shop.ex),
  "Every fixture must be identified as illustrative",
);
assert.ok(analyzeMarket(shops, center, 150, "all").count < all.count);
assert.equal(all.density, Math.round(23 / (Math.PI * 0.5 ** 2)));
assert.equal(
  analyzeMarket(shops, center, 1000, "all").density,
  Math.round(23 / Math.PI),
);

const outsideCoverage = analyzeMarket(
  shops,
  { lat: 37.5563, lng: 126.922 },
  500,
  "all",
);
assert.equal(outsideCoverage.count, 0);
assert.equal(outsideCoverage.density, null);
assert.equal(outsideCoverage.franchisePercent, null);

// The stored historical distances must not determine a moved map's analysis.
const misleadingDistance = [{ ...shops[0], dist: 1_000_000 }];
assert.equal(analyzeMarket(misleadingDistance, center, 500, "all").count, 1);
assert.equal(
  analyzeMarket(
    [{ ...shops[0], dist: 0 }],
    { lat: 37.5563, lng: 126.922 },
    500,
    "all",
  ).count,
  0,
);
assert.ok(
  all.nearby.every(
    (shop, index, sorted) => index === 0 || shop.dist >= sorted[index - 1].dist,
  ),
);
assert.equal(
  JSON.stringify(shops),
  original,
  "Analysis must not mutate source fixtures",
);
console.log(
  "Market calculations passed: coordinates, radius, categories, sample density, missing coverage, ordering and immutable fixtures.",
);
