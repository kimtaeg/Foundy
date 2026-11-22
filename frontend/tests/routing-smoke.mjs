import { navigate } from './helpers/navigate.mjs';
import { signIn } from './helpers/sign-in.mjs';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(project, 'work', 'migrated', 'functional');
const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const page = await context.newPage();
const result = { baseURL, checks: [], pageErrors: [] };
page.on('pageerror', error => result.pageErrors.push(error.message));
try {
  await page.goto(`${baseURL}/report`);
  await expect(page).toHaveURL(`${baseURL}/login`);
  await expect(page.locator('#authScreen')).toBeVisible();
  result.checks.push('Unauthenticated direct report URL redirects to login');
  await signIn(page);
  await expect(page).toHaveURL(`${baseURL}/dashboard`);
  await navigate(page, 'report');
  await expect(page).toHaveURL(`${baseURL}/report`);
  await navigate(page, 'checklist');
  await expect(page).toHaveURL(`${baseURL}/checklist`);
  await page.goBack();
  await expect(page).toHaveURL(`${baseURL}/report`);
  await expect(page.locator('#page-report.active')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(`${baseURL}/checklist`);
  await expect(page.locator('#page-checklist.active')).toBeVisible();
  result.checks.push('Browser back and forward restore matching route and view');
  await page.goto(`${baseURL}/mypage`);
  await expect(page.locator('#page-mypage.active')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(`${baseURL}/mypage`);
  await expect(page.locator('#page-mypage.active')).toBeVisible();
  const mypage = page.locator('#page-mypage.active');
  await expect(mypage.getByText('모노커피', { exact: true })).toBeVisible();
  await expect(mypage.getByRole('button', { name: '가게 이름 수정', exact: true })).toBeVisible();
  await expect(mypage.locator('input, select, textarea')).toHaveCount(0);
  result.checks.push('Direct mypage URL and reload preserve session and store data');
  await page.locator('header [data-nx="logout"]').click();
  await expect(page).toHaveURL(`${baseURL}/login`);
  await page.goto(`${baseURL}/mypage`);
  await expect(page).toHaveURL(`${baseURL}/login`);
  result.checks.push('Logout prevents protected page entry on direct navigation');
} catch (error) {
  result.failure = error.message;
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'routing.json'), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
if (result.pageErrors.length) process.exitCode = 1;
