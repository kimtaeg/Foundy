import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const web = process.env.FOUNDY_URL || 'http://localhost:3000';
const storeId = 'notification-test-store';
const storePath = '/api/stores/' + storeId;
const token = 'notification-test-token';
const storeName = '알림검증점';
const opening = '2027-01-20';
const identity = {
  user: { user_id: 'notification-test-user', name: '알림 검증', provider: 'local', username: 'alerts-test' },
  store_id: storeId,
  store_name: storeName,
  store_opening: opening,
  setup: { status: 'ready', missing_fields: [], run_id: 'notification-test-run' },
};
const dashboard = {
  store: {
    store_id: storeId, name: storeName, registered_name: storeName, business_type: '카페',
    business_type_input: '카페', address: '서울특별시 성동구 성수이로 10',
    address_detail: '1층', region: '서울', opening_date: opening, d_day: 59,
  },
  last_run: null, report_summary: { high: 0, low: 0, unknown: 0, ok: 0 },
  pending_decisions: [], today_todos: [], checklist_tasks: [], next_steps: [],
  checklist_progress: { done: 0, total: 0 }, alerts: { unread: 1 },
};
const exampleAlert = {
  alert_id: 'notification-test-alert', type: 'decision', title: '점검 항목을 확인해 주세요',
  body: '새 결과가 도착했어요.', cta: { page: 'report' }, read: false, created_at: '2026-11-22',
};
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,OPTIONS',
};
const errorMessage = '알림 서버에서 목록을 준비하지 못했어요.';
const error = { error: { code: 'ALERTS_UNAVAILABLE', message: errorMessage } };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ locale: 'ko-KR', reducedMotion: 'reduce' });
page.setDefaultTimeout(10_000);
const pageErrors = [];
const requestPaths = [];
const resolveAlerts = [];
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.addInitScript(value => localStorage.setItem('foundy-api-session', JSON.stringify(value)), {
    token, storeId, kind: 'account',
  });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    assert.equal(request.method(), 'GET');
    assert.equal(request.headers().authorization, `Bearer ${token}`);
    const path = new URL(request.url()).pathname;
    requestPaths.push(path);
    const json = (body, status = 200) => route.fulfill({ json: body, status, headers });
    if (path === '/api/me') return json(identity);
    if (path === storePath + '/dashboard') return json(dashboard);
    assert.equal(path, storePath + '/alerts');
    const { body, status } = await new Promise(resolve => { resolveAlerts.push(resolve); });
    return json(body, status);
  });
  const reply = async (number, body, status = 200) => {
    await expect.poll(() => resolveAlerts.length).toBe(number);
    resolveAlerts[number - 1]({ body, status });
  };

  await page.goto(web + '/dashboard');
  const bell = page.getByRole('button', { name: /^알림(?:,|$)/ });
  const panel = page.getByRole('dialog', { name: '알림 요약' });
  const retry = panel.getByRole('button', { name: '다시 시도' });
  const loading = panel.getByRole('status', { name: '알림을 불러오는 중' });
  const empty = panel.getByText('새로운 알림이 없어요.');
  await bell.hover();
  await expect(loading).toBeVisible();
  await expect(empty).toHaveCount(0);
  await expect(bell).toHaveAccessibleName('알림');
  await reply(1, error, 503);
  await expect(panel.getByRole('alert')).toHaveText(errorMessage);
  await expect(empty).toHaveCount(0);
  await expect(bell).toHaveAccessibleName('알림');

  await bell.focus();
  await bell.press('ArrowDown');
  await expect(retry).toBeFocused();
  const beforeRetry = requestPaths.length;
  await retry.press('Enter');
  await expect(loading).toBeVisible();
  await reply(2, { items: [exampleAlert] });
  await expect(panel.getByText(exampleAlert.title)).toBeVisible();
  await expect(panel.locator('[data-notification-id]')).toBeFocused();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(bell).toHaveAccessibleName('알림, 읽지 않은 알림 1개');
  assert.deepEqual(requestPaths.slice(beforeRetry), [storePath + '/alerts']);
  console.log('PASS notification initial loading, backend error, keyboard retry and badge recovery');

  await page.evaluate(() => window.dispatchEvent(new Event('foundy:analysis-complete')));
  await reply(3, error, 503);
  await expect(panel.getByRole('alert')).toHaveText(errorMessage);
  await expect(panel.getByText(exampleAlert.title)).toBeVisible();
  await expect(bell).toHaveAccessibleName('알림, 읽지 않은 알림 1개');
  await retry.click();
  await reply(4, { items: [] });
  await expect(empty).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(bell).toHaveAccessibleName('알림, 읽지 않은 알림 0개');
  await expect(bell).toBeFocused();
  assert.deepEqual(pageErrors, []);
  console.log('PASS notification background failure retains the previous list and empty only follows success');
} finally {
  await browser.close();
}
