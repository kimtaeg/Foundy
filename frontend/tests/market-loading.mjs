import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const gate = () => {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
};
const sdk = gate();
const population = gate();
const roads = gate();
let holdRoads = false;
let roadRequests = 0;

try {
  await page.route("**/v2/maps/sdk.js?*", async (route) => {
    await sdk.promise;
    await route.continue();
  });
  await page.route("**/data/foot-traffic/pop-*.json", async (route) => {
    await population.promise;
    await route.continue();
  });
  await page.route("**/data/foot-traffic/roads/*.json", async (route) => {
    if (holdRoads) {
      roadRequests++;
      await roads.promise;
    }
    await route.continue();
  });
  await page.goto(`${process.env.FOUNDY_URL || "http://localhost:3000"}/login`);
  await page.locator('[data-nx="demologin"]').click();
  await page.locator('#nav [data-page="sites"]').click();
  await expect(page.getByTestId("market-workspace")).toBeVisible();
  await expect(page.getByRole("status", { name: "상권 지도를 불러오는 중", exact: true })).toBeVisible();
  sdk.release();
  const center = page.locator('[aria-label="분석 중심 위치"]');
  await expect(center).toBeVisible({ timeout: 25000 });
  const originalCenter = await center.elementHandle();
  const originalCanvas = await page.getByTestId("road-population-canvas").elementHandle();
  await expect(page.getByRole("status", { name: "생활인구 합계를 불러오는 중", exact: true })).toBeVisible();
  const panel = page.getByTestId("market-panel");
  await expect(panel.locator('[data-skeleton="card"]')).toBeVisible();
  await panel.getByRole("button", { name: "생활인구", exact: true }).click();
  await expect(panel.locator('[data-skeleton="chart"]')).toHaveCount(4);
  await expect(page.locator("#traffic-controls")).toBeVisible();
  console.log("PASS SDK and population waits show layout skeletons while controls and basemap remain usable");

  population.release();
  await expect(panel.getByRole("figure", { name: "24시간 공개 생활인구 막대그래프" })).toBeVisible();
  await expect(page.getByRole("status", { name: "생활인구 합계를 불러오는 중", exact: true })).toHaveCount(0);
  assert.equal(await originalCenter.evaluate((element) => element === document.querySelector('[aria-label="분석 중심 위치"]')), true);
  assert.equal(await originalCanvas.evaluate((element) => element === document.querySelector('[data-testid="road-population-canvas"]')), true);
  console.log("PASS resolved population replaces skeletons without recreating the basemap or road canvas");

  holdRoads = true;
  await page.locator("#traffic-controls").getByRole("button", { name: "1km", exact: true }).click();
  await expect.poll(() => roadRequests).toBeGreaterThan(0);
  await expect(center).toBeVisible();
  assert.equal(await originalCenter.evaluate((element) => element === document.querySelector('[aria-label="분석 중심 위치"]')), true);
  await page.getByRole("group", { name: "지도 확대와 축소" }).getByRole("button", { name: "지도 확대", exact: true }).click();
  await expect(page.getByRole("group", { name: "지도 확대와 축소" })).toHaveAttribute("data-map-level", "3");
  roads.release();
  await expect(page.getByRole("region", { name: "생활인구 범례와 데이터 기준" })).toContainText("반경 1km");
  assert.equal(await originalCenter.evaluate((element) => element === document.querySelector('[aria-label="분석 중심 위치"]')), true);
  assert.deepEqual(errors, []);
  console.log("PASS pending radius requests retain map interaction and mounted center");
} finally {
  sdk.release();
  population.release();
  roads.release();
  await browser.close();
}
