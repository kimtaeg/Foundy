import { signIn } from './helpers/sign-in.mjs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = path.resolve('work/dashboard-greeting');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { baseURL, checks: [], pageErrors: [] };
const safe = (message) => message.replace(/appkey=[^&\s]+/g, 'appkey=[redacted]');

async function check(name, action, page) {
  try {
    const detail = await action();
    report.checks.push({ name, passed: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, error: safe(error.message) });
    console.error(`FAIL ${name}: ${safe(error.message).slice(0, 400)}`);
    await page?.screenshot({ path: path.join(output, `failure-${report.checks.length}.png`), fullPage: true });
  }
}

async function openDashboard(width, height, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => report.pageErrors.push(safe(error.message)));
  await page.clock.setFixedTime(new Date('2026-11-21T16:00:00+09:00'));
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await expect(page.getByTestId('dashboard-header')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function fitDetails(page) {
  return page.getByTestId('dashboard-header').evaluate((hero) => {
    const rect = hero.getBoundingClientRect();
    const heading = hero.querySelector('h1');
    const title = heading.getBoundingClientRect();
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      heroClientWidth: hero.clientWidth,
      heroScrollWidth: hero.scrollWidth,
      heroLeft: rect.left,
      heroRight: rect.right,
      heroHeight: rect.height,
      titleHeight: title.height,
      titleRight: title.right,
    };
  });
}

function assertFits(details) {
  assert.ok(details.documentWidth <= details.viewport + 1, 'page overflows horizontally');
  assert.ok(details.heroScrollWidth <= details.heroClientWidth + 1, 'hero content is clipped horizontally');
  assert.ok(details.heroLeft >= 0 && details.heroRight <= details.viewport + 1, 'hero exceeds viewport');
  assert.ok(details.titleRight <= details.heroRight, 'title exceeds card');
}

try {
  for (const [viewport, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
    const { context, page } = await openDashboard(width, height);
    await check(`${viewport}: one welcome page heading replaces the old header and store card`, async () => {
      const hero = page.getByTestId('dashboard-header');
      await expect(page.locator('#page-dashboard h1')).toHaveCount(1);
      await expect(page.getByTestId('store-summary')).toHaveCount(0);
      await expect(page.getByRole('group', { name: '제목 스타일 선택' })).toHaveCount(0);
      await expect(hero).toContainText('모노커피');
      await expect(hero).toContainText('D-101');
      await expect(hero.getByRole('heading', { level: 1 })).toHaveAccessibleName(/모노커피/);
      await expect(hero.locator('[data-typewriter-text]')).not.toBeEmpty();
      const details = await fitDetails(page);
      assertFits(details);
      const screenshot = path.join(output, `${viewport}-header.png`);
      await hero.screenshot({ path: screenshot, animations: 'disabled' });
      return { ...details, screenshot };
    }, page);
    await check(`${viewport}: reduced motion keeps a complete title without a blinking cursor`, async () => {
      const hero = page.getByTestId('dashboard-header');
      const title = hero.locator('[data-typewriter-text]');
      const before = await title.innerText();
      await page.waitForTimeout(400);
      assert.equal(await title.innerText(), before);
      await expect(hero.locator('[data-typewriter-cursor]')).toHaveCount(0);
      return { text: before };
    }, page);

    if (viewport === 'desktop') {
      await check('existing report, map and chatbot actions still work from the redesigned hero', async () => {
        await page.getByTestId('dashboard-header').getByRole('button', { name: '점검 리포트', exact: true }).click();
        await expect(page).toHaveURL(`${baseURL}/report`);
        await expect(page.locator('#page-report h1')).toHaveText('점검 리포트');
        await expect(page.locator('#page-report').getByRole('navigation', { name: '현재 위치' })).toContainText('점검 리포트');
        await expect(page.locator('#page-report [data-typewriter]')).toHaveCount(0);
        await page.locator('#nav [data-page="dashboard"]').click();
        await page.getByTestId('dashboard-header').getByRole('button', { name: '상권 분석', exact: true }).click();
        await expect(page).toHaveURL(`${baseURL}/sites`);
        await page.locator('#nav [data-page="dashboard"]').click();
        await page.getByTestId('dashboard-header').getByRole('button', { name: 'AI에게 오늘 할 일 묻기', exact: true }).click();
        await expect(page.locator('#chatPanel')).toBeVisible();
        await expect(page.locator('#chatPanel')).toContainText('오늘 뭐부터 하죠?');
      }, page);
    }
    if (viewport === 'small-mobile') {
      const longName = '모노커피와 함께하는 성수동 작은 로스터리의 아주 긴 업장 이름 ☕';
      await page.evaluate((name) => {
        const key = 'foundy-v5-demo-store';
        const store = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...store, name }));
      }, longName);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('dashboard-header')).toContainText(longName);
      await check('320px: the welcome heading wraps a long store name without clipping actions', async () => {
        const hero = page.getByTestId('dashboard-header');
        await expect(hero.getByRole('heading', { level: 1 })).toHaveAccessibleName(new RegExp(longName));
        const details = await fitDetails(page);
        assertFits(details);
        await hero.getByRole('button', { name: 'AI에게 오늘 할 일 묻기', exact: true }).scrollIntoViewIfNeeded();
        await expect(hero.getByRole('button', { name: 'AI에게 오늘 할 일 묻기', exact: true })).toBeVisible();
        await hero.screenshot({ path: path.join(output, 'long-name-header.png'), animations: 'disabled' });
        return details;
      }, page);
    }
    await context.close();
  }

  const { context, page } = await openDashboard(1440, 1000, 'no-preference');
  await check('typing and deletion change the title while hero height remains stable', async () => {
    const samples = await page.getByTestId('dashboard-header').evaluate((hero) => new Promise((resolve) => {
      const samples = [];
      const sample = () => samples.push({ text: hero.querySelector('[data-typewriter-text]').textContent, height: hero.getBoundingClientRect().height });
      sample();
      const timer = setInterval(sample, 100);
      setTimeout(() => { clearInterval(timer); sample(); resolve(samples); }, 7000);
    }));
    assert.ok(new Set(samples.map((sample) => sample.text)).size > 8, 'title never animated');
    const lengths = samples.map((sample) => Array.from(sample.text).length);
    assert.ok(lengths.some((length, index) => index > 0 && length < lengths[index - 1]), 'no deletion observed');
    assert.ok(lengths.some((length, index) => index > 0 && length > lengths[index - 1]), 'no typing observed');
    const heights = samples.map((sample) => sample.height);
    assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, 'title animation shifts hero layout');
    return { distinctTexts: new Set(samples.map((sample) => sample.text)).size, minHeight: Math.min(...heights), maxHeight: Math.max(...heights) };
  }, page);
  await context.close();
} finally {
  await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
const failures = report.checks.filter((check) => !check.passed);
console.log(JSON.stringify({ passed: report.checks.length - failures.length, failed: failures.length, pageErrors: report.pageErrors, report: path.join(output, 'report.json') }));
if (failures.length || report.pageErrors.length) process.exitCode = 1;
