import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { signIn } from './helpers/sign-in.mjs';

const base = process.env.FOUNDY_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base + '/login');
  await signIn(page);

  async function checkMotion(details, trigger = 'summary') {
    const summary = details.locator(trigger);
    await expect(summary).toBeVisible();
    for (const preference of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: preference });
      for (let i = 0; i < 2; i++) {
        const frames = await details.evaluate(async (element, trigger) => {
          const frames = [element.getBoundingClientRect().height];
          element.querySelector(trigger).click();
          const until = performance.now() + 320;
          do {
            await new Promise(requestAnimationFrame);
            frames.push(element.getBoundingClientRect().height);
          } while (performance.now() < until);
          return frames;
        }, trigger);
        const start = frames[0], end = frames.at(-1);
        assert.notEqual(start, end);
        const hasIntermediateFrame = frames.some((h) => Math.min(start, end) < h && h < Math.max(start, end));
        assert.equal(hasIntermediateFrame, preference === 'no-preference');
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const initialHeight = await details.evaluate((element) => element.getBoundingClientRect().height);
    await summary.press('Enter');
    await summary.press('Space');
    await expect.poll(() => details.evaluate((element) => element.getBoundingClientRect().height)).toBe(initialHeight);
  }

  await page.goto(base + '/report');
  await checkMotion(page.locator('#result-r-02'));
  await page.goto(base + '/checklist');
  await checkMotion(page.locator('[data-checklist-task]').first(), 'button[aria-expanded]');
  await page.goto(base + '/sites');
  await page.getByRole('button', { name: '생활인구', exact: true }).click();
  await checkMotion(page.locator('details').filter({ hasText: '출처와 집계 기준' }));
  await checkMotion(page.locator('details').filter({ hasText: '출처와 표시 기준' }));
  console.log('Report, checklist and both map disclosures passed in both motion modes.');
} finally {
  await browser.close();
}
