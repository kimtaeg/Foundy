import { configureMapTestOrigin } from './helpers/map-test-origin.mjs';
import { navigate } from './helpers/navigate.mjs';
import { signIn } from './helpers/sign-in.mjs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = process.env.FOUNDY_ARTIFACT_DIR || path.resolve('work/market-map');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { baseURL, checks: [], pageErrors: [], sdkResponses: [] };
const safe = (message) => message.replace(/appkey=[^&\s]+/g, 'appkey=[redacted]');
async function check(name, action) {
  try { const detail = await action(); report.checks.push({ name, passed: true, detail }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: safe(error.message) }); console.log(`FAIL ${name}: ${safe(error.message).slice(0, 450)}`); }
}
async function contextPage(viewport, routes) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
  await configureMapTestOrigin(context);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (error) => report.pageErrors.push(safe(error.message)));
  page.on('response', (response) => {
    if (response.url().includes('/v2/maps/sdk.js')) report.sdkResponses.push(response.status());
  });
  if (routes) await routes(page);
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await page.locator('#nav [data-page="sites"]').click();
  await expect(page.getByTestId('market-workspace')).toBeVisible();
  return { context, page };
}
const legendOf = (page) => page.getByRole('region', { name: '생활인구 범례와 데이터 기준' });
const zoomOf = (page) => page.getByRole('group', { name: '지도 확대와 축소' });
async function coloredRoadPixels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="road-population-canvas"]');
    if (!canvas || !canvas.width || !canvas.height) return 0;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      // The road layer contains only roads; include pale yellow as well as saturated colors.
      if (pixels[i + 3] > 220 && !(pixels[i] === 191 && pixels[i + 1] === 198 && pixels[i + 2] === 208)) count++;
    }
    return count;
  });
}
async function roadPoint(page, painted) {
  return page.evaluate((painted) => {
    const canvas = document.querySelector('[data-testid="road-population-canvas"]');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 250; y < innerHeight - 100; y += 3) {
      for (let x = 360; x < innerWidth - 440; x += 3) {
        const px = Math.floor((x - rect.left) * canvas.width / rect.width);
        const py = Math.floor((y - rect.top) * canvas.height / rect.height);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const i = (py * canvas.width + px) * 4;
        const publicColor = !(pixels[i] === 191 && pixels[i + 1] === 198 && pixels[i + 2] === 208);
        const match = painted ? pixels[i + 3] === 255 && publicColor : pixels[i + 3] === 0;
        if (!match) continue;
        const top = document.elementFromPoint(x, y);
        if (top?.closest('button, #traffic-controls, [data-testid="market-panel"], [role="tooltip"], [aria-label="분석 중심 위치"]')) continue;
        return { x, y };
      }
    }
    return null;
  }, painted);
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return { viewport: [innerWidth, innerHeight], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], map: rect('[data-testid="traffic-map"]'), controls: rect('#traffic-controls'), legend: rect('[aria-label="생활인구 범례와 데이터 기준"]'), panel: rect('[data-testid="market-panel"]') };
  });
}
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['laptop', 1366, 768], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
    const { context, page } = await contextPage({ width, height });
    const mobile = width < 1024;
    await check(`${name}: actual SDK, full viewport and data`, async () => {
      await expect(page.locator('[aria-label="분석 중심 위치"]')).toBeVisible({ timeout: 25000 });
      await expect(legendOf(page)).toContainText('2026-11-15');
      await expect(legendOf(page)).not.toContainText('불러오는 중');
      await expect(zoomOf(page)).toHaveAttribute('data-map-level', '4');
      const scale = page.getByTestId('traffic-map').getByText('100m', { exact: true });
      // Kakao hides its scale bar at 320px; its native scale text still reflects the actual zoom.
      if (width === 320) await expect(scale).toBeAttached();
      else await expect(scale).toBeVisible();
      await expect.poll(() => coloredRoadPixels(page)).toBeGreaterThan(100);
      const g = await geometry(page);
      assert.equal(g.document[0], width);
      assert.ok(g.document[1] <= height + 1, 'map page must not scroll vertically');
      assert.equal(g.map.x, 0); assert.equal(g.map.width, width); assert.equal(g.map.bottom, height);
      if (!mobile) assert.ok(g.controls.bottom + 8 <= g.legend.y, 'settings and legend overlap');
      await page.screenshot({ path: path.join(output, `market-${name}.png`) });
      return g;
    });
    if (mobile) {
      await check(`${name}: independent drawers and keyboard close`, async () => {
        const panel = page.getByTestId('market-panel');
        const settings = page.locator('#traffic-controls');
        await expect(panel).not.toBeVisible();
        await page.getByRole('button', { name: '지도 설정', exact: true }).click();
        await expect(settings).toBeVisible();
        await expect(legendOf(page)).not.toBeVisible();
        await page.getByRole('button', { name: '상권 정보', exact: true }).click();
        await expect(panel).toBeVisible();
        await expect(settings).not.toBeVisible();
        const bounds = await panel.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        assert.ok(bounds.y + bounds.height <= height - 60);
        await page.screenshot({ path: path.join(output, `market-${name}-panel.png`) });
        await page.keyboard.press('Escape');
        await expect(panel).not.toBeVisible();
        await expect(page.getByRole('button', { name: '상권 정보', exact: true })).toBeFocused();
        await page.getByRole('button', { name: '지도 설정', exact: true }).click();
        await settings.getByRole('button', { name: '1km', exact: true }).click();
        await page.screenshot({ path: path.join(output, `market-${name}-settings.png`) });
        await page.keyboard.press('Escape');
        await expect(settings).not.toBeVisible();
        await expect(legendOf(page)).toContainText('반경 1km');
      });
      await check(`${name}: population charts fit the drawer and share map time`, async () => {
        await page.getByRole('button', { name: '상권 정보', exact: true }).click();
        const panel = page.getByTestId('market-panel');
        await panel.getByRole('button', { name: '생활인구', exact: true }).click();
        const chart = panel.getByRole('figure', { name: '24시간 공개 생활인구 막대그래프' });
        await expect(chart.getByRole('button')).toHaveCount(24);
        await panel.getByRole('combobox', { name: '그래프에서 분석 시간 선택' }).selectOption('12');
        await expect(legendOf(page)).toContainText('12시');
        await expect(panel).toContainText('12시 공개값 합');
        await chart.scrollIntoViewIfNeeded();
        const overflow = await panel.evaluate((element) => element.scrollWidth > element.clientWidth);
        assert.equal(overflow, false);
        await page.screenshot({ path: path.join(output, `market-${name}-population.png`) });
        await panel.getByRole('button', { name: '상권 정보 닫기', exact: true }).click();
      });
    }
    if (name === 'desktop') {
      await check('actual road canvas contains continuous colors and preserves road tooltip clicks', async () => {
        const colors = await page.getByTestId('road-population-canvas').evaluate((canvas) => {
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const colors = new Set();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 255 && !(data[i] === 191 && data[i+1] === 198 && data[i+2] === 208)) colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
          }
          return colors.size;
        });
        assert.ok(colors > 30, `expected interpolated road colors, found ${colors}`);
        const point = await roadPoint(page, true);
        assert.ok(point, 'no visible colored road found');
        const panel = page.getByTestId('market-panel');
        const before = (await panel.innerText()).match(/\d{2}\.\d{5}, \d{3}\.\d{5}/)?.[0];
        await page.mouse.move(point.x, point.y);
        await expect(page.getByRole('tooltip')).toContainText('250m 격자');
        await expect(page.getByRole('tooltip')).toContainText('약');
        await page.mouse.click(point.x, point.y);
        await expect(page.getByRole('tooltip')).toBeVisible();
        assert.equal((await panel.innerText()).match(/\d{2}\.\d{5}, \d{3}\.\d{5}/)?.[0], before);
        await page.screenshot({ path: path.join(output, 'market-road-gradient-tooltip.png') });
        await page.mouse.move(0, 0);
        return { opaqueColors: colors, point };
      });
      await check('existing population data charts synchronize hour and preserve source meaning', async () => {
        const panel = page.getByTestId('market-panel');
        await panel.getByRole('button', { name: '생활인구', exact: true }).click();
        await expect(panel.getByTestId('population-report')).toContainText('2026-11-15');
        const chart = panel.getByRole('figure', { name: '24시간 공개 생활인구 막대그래프' });
        await expect(chart.getByRole('button')).toHaveCount(24);
        await chart.getByRole('button', { name: /^12시 생활인구/ }).click();
        await expect(page.getByRole('slider', { name: '분석 시간', exact: true })).toHaveValue('12');
        await expect(panel.getByRole('combobox', { name: '그래프에서 분석 시간 선택' })).toHaveValue('12');
        await expect(legendOf(page)).toContainText('20,818명');
        await expect(panel).toContainText('20,818명');
        await expect(panel).toContainText('내국인 성별 구성');
        await expect(panel).toContainText('내국인 연령별 구성');
        const populationNotes = panel.locator('details').filter({ hasText: '출처와 집계 기준' });
        await populationNotes.locator('summary').click();
        await expect(populationNotes).toContainText('매장 방문·결제 고객 수가 아니에요');
        await expect(populationNotes).toContainText('일일 순방문자 수로 해석하지 않아요');
        const publicShares = panel.getByRole('figure', { name: '공개값 구성비' }).filter({ hasText: '장기외국인' });
        await expect(publicShares).toContainText('공개값 합');
        await expect(publicShares.locator('li').filter({ hasText: '내국인' })).toContainText('85.4%');
        await chart.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, 'market-population-charts.png') });
        await panel.getByRole('combobox', { name: '그래프에서 분석 시간 선택' }).selectOption('avg');
        await expect(legendOf(page)).toContainText('공개시간 평균');
        await panel.getByRole('button', { name: '요약', exact: true }).click();
        const composition = panel.getByRole('figure', { name: '표시된 점포의 업종 비중' });
        await expect(composition.getByRole('listitem').filter({ hasText: '카페' })).toContainText(/[1-9]\d*곳/);
        await expect(composition.getByRole('listitem').filter({ hasText: '음식점' })).toContainText(/[1-9]\d*곳/);
      });
      await check('zoom controls change the actual map scale and retain roads', async () => {
        await page.getByRole('button', { name: '지도 확대', exact: true }).click();
        await expect(zoomOf(page)).toHaveAttribute('data-map-level', '3');
        await expect(page.getByTestId('traffic-map').getByText('50m', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: '지도 축소', exact: true }).click();
        await expect(zoomOf(page)).toHaveAttribute('data-map-level', '4');
        await expect(page.getByTestId('traffic-map').getByText('100m', { exact: true })).toBeVisible();
        await expect.poll(() => coloredRoadPixels(page)).toBeGreaterThan(100);
      });
      await check('map stays centered after viewport resize', async () => {
        try {
          await page.setViewportSize({ width: 390, height: 844 });
          await expect.poll(async () => {
            const r = await page.locator('[aria-label="분석 중심 위치"]').boundingBox();
            return Math.abs(r.x + r.width / 2 - 195);
          }).toBeLessThan(15);
        } finally {
          await page.setViewportSize({ width, height });
        }
        await expect.poll(async () => {
          const r = await page.locator('[aria-label="분석 중심 위치"]').boundingBox();
          return Math.abs(r.x + r.width / 2 - width / 2);
        }).toBeLessThan(15);
      });
      await check('road gradient and source tooltip stay aligned during map panning', async () => {
        let road;
        const tooltip = page.getByRole('tooltip');
        // Resizing the SDK and its road overlay settles in separate animation frames.
        await expect.poll(async () => {
          road = await roadPoint(page, true);
          if (!road) return false;
          await page.mouse.move(0, 0);
          await page.mouse.move(road.x, road.y);
          return tooltip.isVisible();
        }).toBe(true);
        const empty = await roadPoint(page, false);
        assert.ok(road && empty);
        const source = await tooltip.innerText();
        const center = page.locator('[aria-label="분석 중심 위치"]');
        const before = await center.boundingBox();
        await page.mouse.move(empty.x, empty.y);
        await page.mouse.down();
        await page.mouse.move(empty.x + 80, empty.y + 45, { steps: 12 });
        await page.mouse.up();
        // Wait for the SDK's drag completion and the overlay's animation frame.
        await page.waitForTimeout(500);
        const after = await center.boundingBox();
        const dx = after.x - before.x, dy = after.y - before.y;
        assert.ok(Math.hypot(dx, dy) > 30, 'map did not pan');
        await page.mouse.move(road.x + dx, road.y + dy);
        await expect(tooltip).toHaveText(source, { useInnerText: true });
        await expect.poll(() => coloredRoadPixels(page)).toBeGreaterThan(100);
        await page.screenshot({ path: path.join(output, 'market-road-gradient-panned.png') });
        return { dx, dy, source };
      });
      await check('population categories, time, radius and visibility', async () => {
        const settings = page.locator('#traffic-controls');
        await expect(legendOf(page).locator('dt')).toHaveText(['매우 적음', '적음', '보통', '많음', '매우 많음']);
        await expect(legendOf(page)).toContainText('전체 기준');
        await expect(legendOf(page).locator('dd')).toHaveText(['500명 미만', '500~1,000명 미만', '1,000~2,000명 미만', '2,000~4,000명 미만', '4,000명 이상']);
        await settings.getByRole('button', { name: '성별', exact: true }).click();
        await expect(legendOf(page)).toContainText('성별 공통 기준');
        await expect(legendOf(page).locator('dd')).toHaveText(['250명 미만', '250~500명 미만', '500~1,000명 미만', '1,000~2,000명 미만', '2,000명 이상']);
        const genderBands = await legendOf(page).locator('dl').textContent();
        await settings.getByRole('button', { name: '여성', exact: true }).click();
        await expect(legendOf(page)).toContainText('여성');
        await expect(legendOf(page).locator('dl')).toHaveText(genderBands);
        await settings.getByRole('button', { name: '연령대', exact: true }).click();
        await expect(legendOf(page)).toContainText('20대');
        await expect(legendOf(page)).toContainText('연령대 공통 기준');
        await expect(legendOf(page).locator('dd')).toHaveText(['50명 미만', '50~200명 미만', '200~500명 미만', '500~2,000명 미만', '2,000명 이상']);
        const ageBands = await legendOf(page).locator('dl').textContent();
        await settings.getByRole('button', { name: '70세 이상', exact: true }).click();
        await expect(legendOf(page)).toContainText('70세 이상');
        await expect(legendOf(page).locator('dl')).toHaveText(ageBands);
        await settings.getByRole('button', { name: '시간대', exact: true }).click();
        await page.getByRole('slider', { name: '분석 시간', exact: true }).press('Home');
        await expect(legendOf(page)).toContainText('00시');
        await expect(legendOf(page).locator('dl')).toHaveText(ageBands);
        await settings.getByRole('button', { name: '1km', exact: true }).click();
        await expect(legendOf(page)).toContainText('반경 1km');
        await expect(page.getByTestId('market-panel')).toContainText('반경 1,000m');
        await settings.getByRole('button', { name: '생활인구 숨기기', exact: true }).click();
        await expect(settings.getByRole('button', { name: '생활인구 보기', exact: true })).toHaveAttribute('aria-pressed', 'false');
        await expect.poll(() => coloredRoadPixels(page)).toBe(0);
        await settings.getByRole('button', { name: '생활인구 보기', exact: true }).click();
        await expect.poll(() => coloredRoadPixels(page)).toBeGreaterThan(100);
      });
      await check('map click synchronizes analysis coordinates', async () => {
        const panel = page.getByTestId('market-panel');
        const before = (await panel.innerText()).match(/\d{2}\.\d{5}, \d{3}\.\d{5}/)?.[0];
        const point = await roadPoint(page, false);
        assert.ok(point, 'no empty map point found');
        await page.mouse.click(point.x, point.y);
        await expect.poll(async () => (await panel.innerText()).match(/\d{2}\.\d{5}, \d{3}\.\d{5}/)?.[0]).not.toBe(before);
      });
      await check('profile zero and empty funds survive save and reload', async () => {
        await navigate(page, 'mypage');
        const edit = page.getByRole('button', { name: '준비 자금 수정', exact: true });
        const form = page.getByRole('form', { name: '준비 자금 수정', exact: true });
        const input = form.getByLabel('준비 자금', { exact: true });
        for (const value of ['0', '']) {
          await edit.click();
          await input.fill(value);
          await form.getByRole('button', { name: '저장', exact: true }).click();
          await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('foundy-v5-demo-store')).funds)).toBe(value === '' ? null : 0);
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await edit.click();
          await expect(input).toHaveValue(value);
          await form.getByRole('button', { name: '준비 자금 수정 취소', exact: true }).click();
        }
      });
    }
    await context.close();
  }
  {
    let fail = true;
    const { context, page } = await contextPage({ width: 1440, height: 1000 }, async (p) => {
      await p.route('**/data/foot-traffic/pop-*.json', (route) => fail ? route.fulfill({ status: 503, body: 'unavailable' }) : route.continue());
    });
    await check('population failure hides invented thresholds and retry recovers', async () => {
      await expect(page.getByText('생활인구 데이터를 불러오지 못했어요.', { exact: false })).toBeVisible();
      await expect(legendOf(page)).toContainText('데이터 확인 불가');
      await expect(legendOf(page)).not.toContainText('0명 미만');
      await expect(legendOf(page)).not.toContainText('0명 이상');
      await page.screenshot({ path: path.join(output, 'market-population-error.png') });
      fail = false;
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
      await expect(legendOf(page)).not.toContainText('데이터 확인 불가');
      await expect(legendOf(page)).toContainText('명 미만');
    });
    await context.close();
  }
  {
    const { context, page } = await contextPage({ width: 1440, height: 1000 }, async (p) => p.route('**/v2/maps/sdk.js?**', (route) => route.abort('failed')));
    await check('SDK failure keeps analysis usable', async () => {
      await expect(page.getByRole('heading', { name: '지도를 불러오지 못했어요', exact: true })).toBeVisible({ timeout: 25000 });
      const panel = page.getByTestId('market-panel');
      await panel.getByRole('button', { name: '가격·현장', exact: true }).click();
      await page.locator('[data-price]').fill('4800');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('foundy-v5-demo-myprice')))).toBe('4800');
      await page.screenshot({ path: path.join(output, 'market-sdk-error.png') });
    });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'market-browser-tests.json'), JSON.stringify(report, null, 2));
}
assert.equal(report.pageErrors.length, 0, report.pageErrors.join('\n'));
assert.ok(report.sdkResponses.includes(200), 'no real Kakao SDK response verified');
assert.ok(report.checks.every((check) => check.passed), JSON.stringify(report.checks.filter((check) => !check.passed)));
console.log(`Market browser checks passed: ${report.checks.length}.`);
