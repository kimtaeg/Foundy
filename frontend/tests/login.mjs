import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { browserBundle } from './helpers/source-runtime.mjs';
import { signIn } from './helpers/sign-in.mjs';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = path.resolve(process.env.FOUNDY_ARTIFACT_DIR || 'work/login-redesign');
const report = { baseURL, checks: [], pageErrors: [], screenshots: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(output, { recursive: true });

async function check(page, viewport, name, run) {
  try {
    const detail = await run();
    report.checks.push({ viewport, name, passed: true, detail });
    console.log(`PASS ${viewport}: ${name}`);
  } catch (error) {
    report.checks.push({ viewport, name, passed: false, error: error.message });
    console.error(`FAIL ${viewport}: ${name}: ${error.message.slice(0, 400)}`);
    await page.screenshot({ path: path.join(output, `${viewport}-${report.checks.length}-failure.png`), fullPage: true });
  }
}

async function storageState(page) {
  return page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
}

function assertNoStoredPassword(storage) {
  const inspect = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/password|passwd|^pwd$/i.test(key), `password field persisted: ${key}`);
      inspect(child);
    }
  };
  for (const entries of Object.values(storage)) {
    inspect(entries);
    for (const value of Object.values(entries)) {
      try { inspect(JSON.parse(value)); } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
      }
    }
  }
  assert.ok(!JSON.stringify(storage).includes('wrong-login-password-90210'));
}

async function capture(page, name) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(output, filename), animations: 'disabled', fullPage: true });
  report.screenshots.push(filename);
}

try {
  for (const [viewport, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
    const context = await browser.newContext({
      viewport: { width, height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', (error) => report.pageErrors.push({ viewport, message: error.message }));
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
      const screen = page.locator('#authScreen');
      const username = page.getByLabel('아이디', { exact: true });
      const password = page.getByLabel('비밀번호', { exact: true });
      const submit = page.getByRole('button', { name: '로그인', exact: true });
      await expect(username).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      await check(page, viewport, 'accessible ID/password form without social or placeholder links', async () => {
        await expect(username).toHaveAttribute('name', 'username');
        await expect(username).toHaveAttribute('autocomplete', 'username');
        await expect(password).toHaveAttribute('name', 'password');
        await expect(password).toHaveAttribute('autocomplete', 'current-password');
        await expect(password).toHaveAttribute('type', 'password');
        await expect(submit).toBeVisible();
        await expect(screen.locator('[data-nx="social"], [data-nx="demologin"]')).toHaveCount(0);
        await expect(screen.getByRole('button', { name: /카카오|네이버|Google|구글|예시 계정/i })).toHaveCount(0);
        await expect(screen.locator('a:not([href]), a[href=""], a[href="#"], a[href^="javascript:"]')).toHaveCount(0);
      });

      await check(page, viewport, 'login fills the viewport without overflow and the desktop image is loaded on the left', async () => {
        const dimensions = await screen.evaluate((element) => {
          const form = element.querySelector('form').getBoundingClientRect();
          const layout = element.querySelector('[data-testid="login-layout"]');
          const bounds = layout.getBoundingClientRect();
          const style = getComputedStyle(layout);
          return {
            viewport: innerWidth, document: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            form: { left: form.left, right: form.right, top: form.top, bottom: form.bottom },
            layout: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, borderRadius: style.borderRadius, borderWidth: style.borderWidth },
          };
        });
        expect(dimensions.document).toBeLessThanOrEqual(width + 1);
        expect(dimensions.documentHeight).toBeLessThanOrEqual(height + 1);
        expect(dimensions.layout.left).toBe(0);
        expect(dimensions.layout.top).toBe(0);
        expect(dimensions.layout.right).toBe(width);
        expect(dimensions.layout.bottom).toBeGreaterThanOrEqual(height);
        expect(dimensions.layout.borderRadius).toBe('0px');
        expect(dimensions.layout.borderWidth).toBe('0px');
        expect(dimensions.form.left).toBeGreaterThanOrEqual(0);
        expect(dimensions.form.right).toBeLessThanOrEqual(width + 1);
        expect(dimensions.form.top).toBeGreaterThanOrEqual(0);
        expect(dimensions.form.bottom).toBeLessThanOrEqual(height + 1);
        for (const field of [username, password, submit]) {
          const bounds = await field.boundingBox();
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        }
        if (viewport === 'desktop') {
          const illustration = screen.locator('img').first();
          await expect(illustration).toBeVisible();
          await expect.poll(() => illustration.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
          await illustration.evaluate(async (image) => {
            await image.decode();
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          const imageBounds = await illustration.boundingBox();
          expect(imageBounds.x + imageBounds.width).toBeLessThanOrEqual(dimensions.form.left + 1);
        }
        await capture(page, `${viewport}-login`);
        return dimensions;
      });

      await check(page, viewport, 'empty and missing-password submissions remain signed out', async () => {
        await submit.click();
        await expect(page).toHaveURL(`${baseURL}/login`);
        expect(await page.evaluate(() => localStorage.getItem('foundy-session'))).toBeNull();
        await expect(username).toHaveAttribute('aria-invalid', 'true');
        await expect(username).toBeFocused();
        await username.fill('demo');
        await submit.click();
        await expect(page).toHaveURL(`${baseURL}/login`);
        expect(await page.evaluate(() => localStorage.getItem('foundy-session'))).toBeNull();
        expect(await password.evaluate((input) => input.validity.valueMissing)).toBe(true);
        await expect(password).toHaveAttribute('aria-invalid', 'true');
        await expect(password).toBeFocused();
      });

      await check(page, viewport, 'invalid credentials show an inline error and never persist the password', async () => {
        await password.fill('wrong-login-password-90210');
        await submit.click();
        await expect(screen.getByRole('alert')).toBeVisible();
        await expect(page).toHaveURL(`${baseURL}/login`);
        const storage = await storageState(page);
        expect(storage.local['foundy-session']).toBeUndefined();
        assertNoStoredPassword(storage);
        await capture(page, `${viewport}-invalid-credentials`);
        return { error: await screen.getByRole('alert').innerText() };
      });

      await check(page, viewport, 'password visibility toggle preserves the value and keyboard submission signs in', async () => {
        await password.fill('demo');
        await page.getByRole('button', { name: '비밀번호 보기', exact: true }).click();
        await expect(password).toHaveAttribute('type', 'text');
        await expect(password).toHaveValue('demo');
        await page.getByRole('button', { name: '비밀번호 숨기기', exact: true }).click();
        await expect(password).toHaveAttribute('type', 'password');
        await password.press('Enter');
        await expect(page).toHaveURL(`${baseURL}/dashboard`);
        await expect(page.locator('#page-dashboard.active')).toBeVisible();
        const storage = await storageState(page);
        const session = JSON.parse(storage.local['foundy-session']);
        expect(session.uid).toBe('demo');
        expect(Object.keys(session).sort()).toEqual(['name', 'provider', 'uid']);
        assertNoStoredPassword(storage);
        return { session };
      });

      await check(page, viewport, 'reload preserves the session and logout protects direct routes', async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('#page-dashboard.active')).toBeVisible();
        await page.locator('header [data-nx="logout"]').click();
        await expect(screen).toBeVisible();
        await expect(page).toHaveURL(`${baseURL}/login`);
        expect(await page.evaluate(() => localStorage.getItem('foundy-session'))).toBeNull();
        await expect(password).toHaveValue('');
        await page.goto(`${baseURL}/report`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(`${baseURL}/login`);
        await signIn(page);
        await expect(page).toHaveURL(`${baseURL}/dashboard`);
      });
    } finally {
      await context.close();
    }
  }

  const page = await browser.newPage();
  page.on('pageerror', (error) => report.pageErrors.push({ viewport: 'callback', message: error.message }));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: browserBundle({
    React: 'react', ReactDOM: 'react-dom/client', form: '@/components/login/LoginForm',
  }) });
  await page.evaluate(() => {
    const { React, ReactDOM, form: { LoginForm } } = window.contractModules;
    window.signInCalls = [];
    window.delegatedSubmits = 0;
    const root = ReactDOM.createRoot(document.getElementById('root'));
    window.renderLogin = (withCallback = true) => root.render(React.createElement('div', {
      onSubmit() { window.delegatedSubmits++; },
    }, React.createElement(LoginForm, {
      onSignIn: withCallback ? (credentials) => {
        window.signInCalls.push(credentials);
        return new Promise((resolve, reject) => { window.resolveSignIn = resolve; window.rejectSignIn = reject; });
      } : undefined,
    })));
    window.renderLogin();
  });
  const username = page.getByLabel('아이디', { exact: true });
  const password = page.getByLabel('비밀번호', { exact: true });
  const form = page.getByRole('form', { name: '로그인', exact: true });

  await check(page, 'callback', 'async sign-in receives credentials once and blocks duplicate submission while pending', async () => {
    await username.fill('  api-user  ');
    await password.fill('callback-password');
    await password.press('Enter');
    await expect(form).toHaveAttribute('aria-busy', 'true');
    await expect(username).toBeDisabled();
    await expect(password).toBeDisabled();
    await expect(page.getByRole('button', { name: '비밀번호 보기', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '로그인 중…', exact: true })).toBeDisabled();
    await form.evaluate((element) => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(await page.evaluate(() => window.signInCalls)).toEqual([{ username: 'api-user', password: 'callback-password' }]);
    expect(await page.evaluate(() => window.delegatedSubmits)).toBe(0);
  });

  await check(page, 'callback', 'callback rejection is safe and retry clears the password after success', async () => {
    await page.evaluate(() => window.rejectSignIn(new Error('private callback credential detail')));
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('private callback credential detail');
    await expect(form).toHaveAttribute('aria-busy', 'false');
    await expect(password).toBeEnabled();
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(form).toHaveAttribute('aria-busy', 'true');
    expect(await page.evaluate(() => window.signInCalls.length)).toBe(2);
    await page.evaluate(() => window.resolveSignIn());
    await expect(form).toHaveAttribute('aria-busy', 'false');
    await expect(password).toHaveValue('');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  await check(page, 'callback', 'a standalone form without an auth callback reports unavailable login', async () => {
    await page.evaluate(() => window.renderLogin(false));
    await password.fill('callback-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('로그인 연결을 준비 중이에요');
    await expect(form).toHaveAttribute('aria-busy', 'false');
    expect(await page.evaluate(() => window.signInCalls.length)).toBe(2);
  });
  await page.close();
} finally {
  await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify({
  passed: report.checks.filter((check) => check.passed).length,
  failed: report.checks.filter((check) => !check.passed).length,
  pageErrors: report.pageErrors,
  report: path.join(output, 'report.json'),
}, null, 2));
if (report.checks.some((check) => !check.passed) || report.pageErrors.length) process.exitCode = 1;
