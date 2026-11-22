import { signIn } from './helpers/sign-in.mjs';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = process.env.FOUNDY_ARTIFACT_DIR || path.join(project, 'work', 'chat-widget');
const report = { checks: [], pageErrors: [], consoleErrors: [], screenshots: [] };
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 320, height: 740 },
];

async function check(page, viewport, name, run) {
  try {
    const detail = await run();
    report.checks.push({ viewport, name, status: 'passed', detail });
  } catch (error) {
    report.checks.push({ viewport, name, status: 'failed', error: error.message });
    await screenshot(page, `${viewport}-${report.checks.length}-failure`).catch(() => {});
  }
}

async function screenshot(page, name) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(output, filename), animations: 'disabled' });
  report.screenshots.push(filename);
}

async function assertFitsViewport(page) {
  const dimensions = await page.locator('#chatPanel').evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    const conversation = panel.querySelector('#chatBox');
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      conversationOverflow: conversation.scrollWidth - conversation.clientWidth,
    };
  });
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.top).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
  expect(dimensions.panelOverflow).toBeLessThanOrEqual(1);
  expect(dimensions.conversationOverflow).toBeLessThanOrEqual(1);
  return dimensions;
}

async function assertReadableText(page) {
  const undersized = await page.locator('#chatPanel').evaluate((panel) =>
    [...panel.querySelectorAll('*')].flatMap((element) => {
      if (element.closest('svg, [hidden], .sr-only')) return [];
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .join(' ')
        .trim();
      const bounds = element.getBoundingClientRect();
      if (!text || bounds.width <= 1 || bounds.height <= 1 || !element.checkVisibility()) return [];
      const size = parseFloat(getComputedStyle(element).fontSize);
      return size < 12 ? [{ text: text.slice(0, 80), size }] : [];
    }),
  );
  expect(undersized).toEqual([]);
  expect(await page.locator('#chatIn').evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(14);
  const messages = page.locator('[data-chat-role]');
  if (await messages.count()) {
    const sizes = await messages.evaluateAll((elements) => elements.map((element) => parseFloat(getComputedStyle(element).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  }
}

async function storeOpening(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('foundy-v5-demo-store') || 'null')?.opening ?? null);
}

async function finishRequest(page) {
  await page.clock.runFor(500);
  await expect(page.locator('[data-chat-processing="processing"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '질문 보내기', exact: true })).toBeVisible();
}

async function sendAndFinish(page, question) {
  const count = await page.locator('[data-chat-processing="completed"]').count();
  await page.getByRole('textbox', { name: '질문 입력', exact: true }).fill(question);
  await page.getByRole('textbox', { name: '질문 입력', exact: true }).press('Enter');
  await expect(page.locator('[data-chat-processing="processing"]')).toHaveCount(1);
  await finishRequest(page);
  await expect(page.locator('[data-chat-processing="completed"]')).toHaveCount(count + 1);
}

async function expandProcessing(processing) {
  const trigger = processing.getByRole('button').first();
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(processing.getByRole('region')).toBeVisible();
  return processing.getByRole('region');
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', (error) => report.pageErrors.push({ viewport: viewport.name, message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') report.consoleErrors.push({ viewport: viewport.name, message: message.text() });
    });

    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
      await signIn(page);
      const launcher = page.locator('[aria-controls="chatPanel"]');
      await expect(launcher).toBeVisible();
      await launcher.click();
      const panel = page.getByRole('dialog', { name: '파운디 도우미' });
      const input = page.getByRole('textbox', { name: '질문 입력', exact: true });
      const users = page.locator('[data-chat-role="user"]');

      // Pause only after login so routing, hydration, and authentication use normal timers.
      // Explicit advancement exercises the actual request callback without arbitrary sleeps.
      await page.clock.install({ time: new Date('2026-11-20T12:00:00+09:00') });
      await page.clock.pauseAt(new Date('2026-11-20T12:00:01+09:00'));

      await check(page, viewport.name, 'welcome, focus, typography, and viewport', async () => {
        await expect(panel).toBeVisible();
        await expect(input).toBeFocused();
        await expect(panel).toContainText('모노커피');
        expect(await panel.locator('[data-nx="cask"]').count()).toBeGreaterThan(0);
        await expect(launcher).toHaveAttribute('aria-expanded', 'true');
        await expect(users).toHaveCount(0);
        await assertReadableText(page);
        const dimensions = await assertFitsViewport(page);
        await screenshot(page, `${viewport.name}-welcome`);
        return dimensions;
      });

      if (viewport.name === 'desktop') {
        await check(page, viewport.name, 'whitespace and IME do not submit; Shift+Enter adds a line', async () => {
          await input.fill('   ');
          await expect(page.getByRole('button', { name: '질문 보내기', exact: true })).toBeDisabled();
          await page.locator('#nxChat').evaluate((form) => form.requestSubmit());
          await input.press('Enter');
          await expect(users).toHaveCount(0);

          await input.fill('첫 줄');
          await input.press('Shift+Enter');
          await page.keyboard.insertText('두번째');
          await expect(input).toHaveValue('첫 줄\n두번째');
          await expect(users).toHaveCount(0);

          await input.fill('한글 조합 중');
          await input.evaluate((element) => element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
          await input.press('Enter');
          await input.evaluate((element) => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
          await input.evaluate((element) => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true })));
          await expect(users).toHaveCount(0);
          await input.fill('');
        });

        await check(page, viewport.name, 'Enter sends once and next draft survives pending response', async () => {
          await input.fill('오늘 할 일을 알려줘');
          await input.press('Enter');
          await expect(users).toHaveCount(1);
          await expect(page.locator('[data-chat-processing="processing"]')).toHaveCount(1);
          await expect(input).toHaveValue('');
          await expandProcessing(page.locator('[data-chat-processing="processing"]'));
          await input.fill('다음에 물어볼 질문');
          await input.press('Enter');
          await expect(users).toHaveCount(1);
          await screenshot(page, 'desktop-pending');
          await finishRequest(page);
          await expect(input).toHaveValue('다음에 물어볼 질문');
          await expect(page.locator('[data-chat-processing="completed"]')).toHaveCount(1);
          const details = await expandProcessing(page.locator('[data-chat-processing="completed"]').last());
          await expect(details).toContainText('질문 확인');
          await expect(details).toContainText('답변 준비 완료');
          await assertReadableText(page);
          await screenshot(page, 'desktop-completed-expanded');
        });

        await check(page, viewport.name, 'stop cancels callback and retry completes the original question', async () => {
          const completedBefore = await page.locator('[data-chat-processing="completed"]').count();
          const userCount = await users.count();
          const question = '필요한 서류를 알려줘';
          await input.fill(question);
          await input.press('Enter');
          await expect(page.locator('[data-chat-processing="processing"]')).toHaveCount(1);
          await page.getByRole('button', { name: '답변 생성 중지', exact: true }).click();
          await expect(page.locator('[data-chat-processing="canceled"]')).toHaveCount(1);
          await page.clock.runFor(1500);
          await expect(page.locator('[data-chat-processing="processing"]')).toHaveCount(0);
          await expect(page.locator('[data-chat-processing="completed"]')).toHaveCount(completedBefore);
          await expect(users).toHaveCount(userCount + 1);
          await page.locator('[data-chat-processing="canceled"]').getByRole('button', { name: '다시 요청', exact: true }).click();
          await finishRequest(page);
          await expect(page.locator('[data-chat-processing="completed"]')).toHaveCount(completedBefore + 1);
          await expect(users).toHaveCount(userCount + 2);
          await expect(users.last()).toContainText(question);
        });

        await check(page, viewport.name, 'store changes require confirmation; canceled proposal leaves data unchanged', async () => {
          const original = await storeOpening(page);
          await sendAndFinish(page, '개업일을 2027-05-01로 바꿔줘');
          expect(await storeOpening(page)).toBe(original);
          const proposal = page.locator('[data-chat-role="assistant"]').last();
          await expect(proposal.getByRole('button', { name: '확인하고 적용', exact: true })).toBeVisible();
          await proposal.getByRole('button', { name: '확인하고 적용', exact: true }).click();
          expect(await storeOpening(page)).toBe('2027-05-01');
          await expect(proposal).toContainText('적용');
          const details = await expandProcessing(proposal.locator('[data-chat-processing="completed"]'));
          await expect(details).toContainText('적용 완료');

          await sendAndFinish(page, '개업일을 2027-06-01로 바꿔줘');
          expect(await storeOpening(page)).toBe('2027-05-01');
          const canceled = page.locator('[data-chat-role="assistant"]').last();
          await canceled.locator('[data-nx="ccancel"]').click();
          expect(await storeOpening(page)).toBe('2027-05-01');
          await expect(canceled).toContainText('취소');
          await expect(canceled.locator('[data-nx="cact"]')).toHaveCount(0);
          return { original, confirmed: await storeOpening(page) };
        });
      } else {
        await check(page, viewport.name, 'mobile question and expanded processing fit the panel', async () => {
          await sendAndFinish(page, '오늘 할 일을 알려줘');
          await expandProcessing(page.locator('[data-chat-processing="completed"]').last());
          await assertReadableText(page);
          const dimensions = await assertFitsViewport(page);
          await screenshot(page, `${viewport.name}-completed-expanded`);
          return dimensions;
        });
      }

      await check(page, viewport.name, 'conversation scroll keeps composer and header in place', async () => {
        for (const question of ['오늘 할 일을 알려줘', '필요한 서류를 알려줘', '지원금을 알려줘']) {
          await sendAndFinish(page, question);
        }
        const conversation = page.getByRole('region', { name: '상담 대화', exact: true });
        const overflow = await conversation.evaluate((element) => element.scrollHeight - element.clientHeight);
        expect(overflow).toBeGreaterThan(0);
        const before = {
          composer: await page.locator('#nxChat').boundingBox(),
          header: await panel.locator('header').boundingBox(),
        };
        await conversation.evaluate((element) => { element.scrollTop = 0; });
        await expect.poll(() => conversation.evaluate((element) => element.scrollTop)).toBe(0);
        const after = {
          composer: await page.locator('#nxChat').boundingBox(),
          header: await panel.locator('header').boundingBox(),
        };
        expect(Math.abs(after.composer.y - before.composer.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(after.header.y - before.header.y)).toBeLessThanOrEqual(1);
        await assertFitsViewport(page);
        await assertReadableText(page);
        return { overflow, composerY: after.composer.y, headerY: after.header.y };
      });

      await check(page, viewport.name, 'Escape closes and restores launcher focus', async () => {
        await input.focus();
        await input.press('Escape');
        await expect(page.locator('#chatPanel')).toHaveCount(0);
        await expect(launcher).toBeFocused();
        await expect(launcher).toHaveAttribute('aria-expanded', 'false');
      });
    } catch (error) {
      report.checks.push({ viewport: viewport.name, name: 'fixture', status: 'failed', error: error.message });
      await screenshot(page, `${viewport.name}-fixture-failure`).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}

const failed = report.checks.filter((check) => check.status === 'failed');
console.log(JSON.stringify({
  passed: report.checks.length - failed.length,
  failed: failed.map(({ viewport, name, error }) => ({ viewport, name, error })),
  pageErrors: report.pageErrors,
  consoleErrors: report.consoleErrors,
  report: path.join(output, 'report.json'),
  screenshots: report.screenshots,
}, null, 2));
if (failed.length || report.pageErrors.length) process.exitCode = 1;
