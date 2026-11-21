import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = process.env.FOUNDY_ARTIFACT_DIR || path.resolve('work/population-age-map');
const cuts = [50, 200, 500, 2000];
const labels = ['매우 적음', '적음', '보통', '많음', '매우 많음'];
const ranges = ['50명 미만', '50~200명 미만', '200~500명 미만', '500~2,000명 미만', '2,000명 이상'];
const profiles = {
  type: { cuts: [500, 1000, 2000, 4000], ranges: ['500명 미만', '500~1,000명 미만', '1,000~2,000명 미만', '2,000~4,000명 미만', '4,000명 이상'], label: '전체 기준' },
  sex: { cuts: [250, 500, 1000, 2000], ranges: ['250명 미만', '250~500명 미만', '500~1,000명 미만', '1,000~2,000명 미만', '2,000명 이상'], label: '성별 공통 기준' },
  age: { cuts, ranges, label: '연령대 공통 기준' },
};
const report = { baseURL, checks: [], pageErrors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(output, { recursive: true });

async function openMap(intercept) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.pageErrors.push(error.message.replace(/appkey=[^&\s]+/g, 'appkey=[redacted]')));
  if (intercept) await intercept(page);
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-nx="demologin"]').click();
  await page.locator('#nav [data-page="sites"]').click();
  await expect(page.locator('[aria-label="분석 중심 위치"]')).toBeVisible({ timeout: 25000 });
  return { context, page };
}

async function roadPalette(page) {
  return page.getByTestId('road-population-canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    let warm = 0;
    let publicPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const [red, greenChannel, blue, alpha] = pixels.slice(index, index + 4);
      if (alpha !== 255 || (red === 191 && greenChannel === 198 && blue === 208)) continue;
      publicPixels++;
      colors.add(`${red},${greenChannel},${blue}`);
      if (red > greenChannel && greenChannel > blue) warm++;
    }
    return { publicPixels, warm, colors: [...colors] };
  });
}

async function hoverPublicRoad(page) {
  const point = await page.getByTestId('road-population-canvas').evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 250; y < innerHeight - 100; y += 3) {
      for (let x = 360; x < innerWidth - 440; x += 3) {
        const px = Math.floor((x - rect.left) * canvas.width / rect.width);
        const py = Math.floor((y - rect.top) * canvas.height / rect.height);
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const index = (py * canvas.width + px) * 4;
        if (pixels[index + 3] !== 255 || (pixels[index] === 191 && pixels[index + 1] === 198 && pixels[index + 2] === 208)) continue;
        if (document.elementFromPoint(x, y)?.closest('button, #traffic-controls, [data-testid="market-panel"], [role="tooltip"], [aria-label="분석 중심 위치"]')) continue;
        return { x, y };
      }
    }
    return null;
  });
  assert.ok(point, 'expected a visible public road including pale yellow strokes');
  await page.mouse.move(0, 0);
  await page.mouse.move(point.x, point.y);
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('250m 격자');
  return tooltip;
}

function publicAverage(hours) {
  const observed = hours.flatMap(value => typeof value === 'number' ? [value] : Array.isArray(value) && value[1] > 0 ? [value[0]] : []);
  return observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : null;
}

async function sourceValues(files) {
  const sources = await Promise.all(files.map(async file => JSON.parse(await readFile(`public/data/foot-traffic/pop-${file}.json`, 'utf8'))));
  const ids = new Set(sources.flatMap(source => Object.keys(source.values)));
  return [...ids].map(id => publicAverage(Array.from({ length: 24 }, (_, hour) => {
    const values = sources.flatMap(source => {
      const value = source.values[id]?.[hour];
      return typeof value === 'number' ? [value] : Array.isArray(value) && value[1] > 0 ? [value[0]] : [];
    });
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }))).filter(value => value !== null);
}

async function checkRealPopulation(page, { name, category, files, screenshot }) {
  const legend = page.getByRole('region', { name: '생활인구 범례와 데이터 기준' });
  const profile = profiles[category];
  await expect(legend.getByRole('heading')).toHaveText(`생활인구 · ${name}`);
  await expect(legend).toContainText(profile.label);
  await expect(legend.locator('dt')).toHaveText(labels);
  await expect(legend.locator('dd')).toHaveText(profile.ranges);
  await expect(legend.getByRole('status')).toHaveCount(0);
  await expect.poll(async () => (await roadPalette(page)).warm).toBeGreaterThan(100);
  const palette = await roadPalette(page);
  assert.ok(palette.colors.length > 10, `${name} has no continuous color variation`);
  const tooltip = await hoverPublicRoad(page);
  await expect(tooltip).toContainText(`${name} · 공개시간 평균`);
  const text = await tooltip.innerText();
  const displayedCount = Number(text.match(/약 ([\d,]+)명/)?.[1].replaceAll(',', ''));
  assert.ok(Number.isFinite(displayedCount));
  const knownValues = (await sourceValues(files)).filter(value => Math.round(value) === displayedCount);
  assert.ok(knownValues.length > 0, `${name}: tooltip changed the original public-hour average`);
  const badge = await tooltip.locator('span').first().innerText();
  assert.ok(knownValues.some(value => labels[profile.cuts.filter(cut => value >= cut).length] === badge), `${name}: tooltip badge does not match the selected profile`);
  await page.screenshot({ path: path.join(output, screenshot) });
  report.checks.push({ name: `${name}: real data has continuous road colors, the selected fixed profile and unchanged source value`, passed: true, publicPixels: palette.publicPixels, warmPixels: palette.warm, colors: palette.colors.length, tooltip: text });
  console.log(`PASS ${name}: ${palette.colors.length} road colors, ${category} profile, source ${displayedCount}`);
}

async function expectRoadColor(page, expected) {
  await expect.poll(async () => {
    const { colors } = await roadPalette(page);
    return colors.includes(expected.join(',')) && colors.every(color => color.split(',').every((channel, index) => Math.abs(Number(channel) - expected[index]) <= 1));
  }).toBe(true);
}

try {
  {
    const { context, page } = await openMap();
    await checkRealPopulation(page, { name: '전체', category: 'type', files: ['local', 'fornLong', 'fornTemp'], screenshot: 'whole-population.png' });
    await page.locator('#traffic-controls').getByRole('button', { name: '성별', exact: true }).click();
    for (const [name, file] of [['남성', 'local-male'], ['여성', 'local-female']]) {
      await page.locator('#traffic-controls').getByRole('button', { name, exact: true }).click();
      await checkRealPopulation(page, { name, category: 'sex', files: [file], screenshot: `${file}.png` });
    }
    await page.locator('#traffic-controls').getByRole('button', { name: '연령대', exact: true }).click();
    for (const age of [10, 20, 30, 40, 50, 60, 70]) {
      const name = age === 70 ? '70세 이상' : `${age}대`;
      await page.locator('#traffic-controls').getByRole('button', { name, exact: true }).click();
      await checkRealPopulation(page, { name, category: 'age', files: [`local-a${age}`], screenshot: `age-${age}.png` });
    }
    await context.close();
  }
  {
    // Test-only network fixture; leave all source files and production data unchanged.
    const { context, page } = await openMap(async page => {
      await page.route('**/data/foot-traffic/pop-local-a10.json', async route => {
        const response = await route.fetch();
        const payload = await response.json();
        for (const [cell, hours] of Object.entries(payload.values)) {
          payload.values[cell] = hours.map(value => typeof value === 'number' ? 8 : Array.isArray(value) && value[1] > 0 ? [8, value[1], value[2]] : value);
        }
        await route.fulfill({ response, json: payload });
      });
    });
    await page.locator('#traffic-controls').getByRole('button', { name: '연령대', exact: true }).click();
    await page.locator('#traffic-controls').getByRole('button', { name: '10대', exact: true }).click();
    const legend = page.getByRole('region', { name: '생활인구 범례와 데이터 기준' });
    await expect(legend.getByRole('heading')).toHaveText('생활인구 · 10대');
    await expect(legend.getByRole('status')).toHaveCount(0);
    await expectRoadColor(page, [255, 241, 193]);
    const tooltip = await hoverPublicRoad(page);
    await expect(tooltip.locator('span').first()).toHaveText('매우 적음');
    await expect(tooltip).toContainText('약 8명');
    await page.screenshot({ path: path.join(output, 'fixture-eight-people.png') });
    report.checks.push({ name: '8 public people render pale yellow roads and the very-low tooltip in the actual map', passed: true, fixture: true, roadColor: '#FFF1C1' });
    console.log('PASS 8-person fixture: pale yellow canvas and 매우 적음 tooltip');
    await context.close();
  }
  {
    // A constant count isolates profile changes from differing demographic data.
    const local = JSON.parse(await readFile('public/data/foot-traffic/pop-local.json', 'utf8'));
    const ids = Object.keys(local.values);
    const { context, page } = await openMap(async page => {
      await page.route('**/data/foot-traffic/pop-*.json', async route => {
        const response = await route.fetch();
        const payload = await response.json();
        const foreign = /pop-forn(Long|Temp)\.json$/.test(new URL(route.request().url()).pathname);
        payload.values = Object.fromEntries(ids.map(id => [id, Array(24).fill(foreign ? 0 : 600)]));
        await route.fulfill({ response, json: payload });
      });
    });
    const legend = page.getByRole('region', { name: '생활인구 범례와 데이터 기준' });
    const settings = page.locator('#traffic-controls');
    for (const selection of [
      { category: 'type', tab: '전체', name: '전체', color: [255, 215, 125], label: '적음' },
      { category: 'sex', tab: '성별', name: '남성', color: [253, 166, 67], label: '보통' },
      { category: 'sex', tab: '성별', name: '여성', color: [253, 166, 67], label: '보통' },
      { category: 'age', tab: '연령대', name: '20대', color: [242, 103, 50], label: '많음' },
      { category: 'age', tab: '연령대', name: '70세 이상', color: [242, 103, 50], label: '많음' },
      { category: 'type', tab: '전체', name: '전체', color: [255, 215, 125], label: '적음' },
    ]) {
      await settings.getByRole('button', { name: selection.tab, exact: true }).first().click();
      if (selection.category !== 'type') await settings.getByRole('button', { name: selection.name, exact: true }).click();
      await expect(legend).toContainText(profiles[selection.category].label);
      await expect(legend.locator('dd')).toHaveText(profiles[selection.category].ranges);
      await expect(legend.getByRole('status')).toHaveCount(0);
      await expectRoadColor(page, selection.color);
      const tooltip = await hoverPublicRoad(page);
      await expect(tooltip).toContainText('약 600명');
      await expect(tooltip.locator('span').first()).toHaveText(selection.label);
    }
    report.checks.push({ name: 'constant 600-person fixture repaints type/sex/age profiles while male/female and 20s/70s retain shared subgroup scales', passed: true, fixture: true });
    console.log('PASS 600-person fixture: canvas and tooltip follow each profile on all category transitions');
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
} finally {
  await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`Age population map checks passed: ${report.checks.length}.`);
