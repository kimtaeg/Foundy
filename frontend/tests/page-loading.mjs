import { chromium, expect } from '@playwright/test';
import { signIn } from './helpers/sign-in.mjs';
import { navigate } from './helpers/navigate.mjs';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const routes = ['dashboard', 'report', 'checklist', 'docs', 'grants', 'sites', 'mypage', 'register', 'login'];
const browser = await chromium.launch({ channel: 'chrome' });

try {
  // With hydration paused, the DOM is exactly what a visitor sees while the session loads.
  const cold = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const layouts = new Set();
  for (const route of routes) {
    await cold.goto(`${baseURL}/${route}`, { waitUntil: 'domcontentloaded' });
    const skeleton = cold.locator('[data-page-skeleton]');
    await expect(skeleton).toHaveCount(1);
    await expect(skeleton).toHaveAttribute('data-page-skeleton', route);
    await expect(skeleton).toBeVisible();
    await expect(cold.locator('[data-skeleton="navigation"]')).toHaveCount(route === 'login' ? 0 : 1);
    const shape = await skeleton.evaluate((node) => Array.from(node.querySelectorAll('[aria-hidden] div'), (item) => item.className).join('|'));
    expect(shape.length).toBeGreaterThan(0);
    expect(layouts.has(shape), `duplicated page layout on /${route}`).toBe(false);
    layouts.add(shape);
    expect(await cold.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow on /${route}`).toBe(true);
  }
  await cold.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(cold.locator('[data-page-skeleton="dashboard"]')).toBeVisible();
  await cold.close();
  console.log('PASS unique initial skeleton and mobile width on all nine pages and home alias');

  const live = await browser.newPage();
  await live.goto(`${baseURL}/login`);
  await signIn(live);
  await expect(live.locator('#page-dashboard.active')).toBeVisible();
  // Hold only the destination payload, leaving navigation, styles and hydration active.
  let resume;
  const gate = new Promise((resolve) => { resume = resolve; });
  await live.route((url) => url.pathname === '/report', async (request) => {
    if (request.request().headers().rsc === '1') await gate;
    await request.continue();
  });
  try {
    await navigate(live, 'report');
    await expect(live.locator('[data-page-skeleton="report"]')).toBeVisible();
    await expect(live.locator('[data-page-skeleton="dashboard"]')).toHaveCount(0);
    await expect(live.locator('#nav')).toBeVisible();
  } finally {
    resume();
  }
  await expect(live.locator('#page-report.active')).toBeVisible();
  await expect(live.locator('[data-page-skeleton]')).toHaveCount(0);
  console.log('PASS pending client navigation shows the destination and resolves to the report');
} finally {
  await browser.close();
}
