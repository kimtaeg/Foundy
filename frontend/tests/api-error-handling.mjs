import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const web = new URL(process.env.FOUNDY_URL || 'http://localhost:3000');
assert.ok(['localhost', '127.0.0.1'].includes(web.hostname));
const storeId = 'error-test-store';
const token = 'error-test-token';
const store = '/api/stores/' + storeId;
const identity = {
  user: { user_id: 'error-test-user', name: '오류 검증', provider: 'local', username: 'errortest' },
  store_id: storeId,
  store_name: '오류 검증 가게',
  store_opening: '2099-01-01',
  setup: { status: 'ready', missing_fields: [], run_id: 'error-test-run' },
};
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};
const scenarios = {
  dashboard: '/dashboard',
  report: '/report',
  checklist: '/checklist',
  docs: '/documents',
  grants: '/grants',
  mypage: '',
  sites: '',
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ locale: 'ko-KR', reducedMotion: 'reduce' });
page.setDefaultTimeout(10_000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
let scenario;
let auth;
let calls;
let expire = false;
let identityFailure = false;

try {
  await page.addInitScript(session => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('foundy-api-session', JSON.stringify(session));
    sessionStorage.setItem('seeded', '1');
  }, { token, storeId, kind: 'account' });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const json = (body, status = 200) => route.fulfill({ json: body, status, headers });
    const fail = (status, code, message) => json({ error: { code, message } }, status);
    if (path === '/api/me') return identityFailure ? fail(500, 'INTERNAL_ERROR', '계정 정보를 확인할 수 없어요.') : json(identity);
    if (path === store + '/alerts') return json({ items: [] });
    if (path === '/api/auth/' + auth?.route) return fail(auth.status, auth.code, auth.message);
    assert.equal(path, store + scenarios[scenario]);
    assert.equal(request.headers().authorization, 'Bearer ' + token);
    calls++;
    if (expire) return fail(401, 'AUTH_REQUIRED', '세션이 만료됐어요. 새로 로그인해 주세요.');
    if (calls === 1) return fail(503, 'UNAVAILABLE', scenario + ' 조회 오류 메시지');
    return route.fulfill({ status: 502, body: 'Bad Gateway', contentType: 'text/plain', headers });
  });

  for (const path of Object.keys(scenarios)) {
    scenario = path;
    calls = 0;
    await page.goto(new URL('/' + path, web).href, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(path + ' 조회 오류 메시지', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByText('요청을 처리하지 못했어요.', { exact: true })).toBeVisible();
    assert.equal(calls, 2, path + ' only retries its required API');
    console.log('PASS ' + path + ' exact structured 503 and safe non-JSON retry fallback');
  }

  identityFailure = true;
  scenario = 'dashboard';
  calls = 0;
  await page.goto(new URL('/dashboard', web).href, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('계정 정보를 확인할 수 없어요.', { exact: true })).toBeVisible();
  assert.equal(calls, 0);
  identityFailure = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('dashboard 조회 오류 메시지', { exact: true })).toBeVisible();
  console.log('PASS startup API 500 stays recoverable and defers page reads');

  expire = true;
  scenario = 'dashboard';
  await page.goto(new URL('/dashboard', web).href, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText('세션이 만료됐어요. 새로 로그인해 주세요.', { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => localStorage.getItem('foundy-api-session')), null);
  console.log('PASS authenticated 401 signs out and preserves the backend message');

  for (const error of [
    { route: 'login', status: 429, code: 'RATE_LIMITED', message: '로그인 요청이 너무 많아요.' },
    { route: 'login', status: 500, code: 'INTERNAL_ERROR', message: '로그인 서버가 잠시 응답하지 않아요.' },
    { route: 'signup', status: 409, code: 'USERNAME_TAKEN', message: '이미 사용 중인 아이디예요.' },
  ]) {
    auth = error;
    const signup = error.route === 'signup';
    const label = signup ? '회원가입' : '로그인';
    await page.goto(new URL('/login', web).href, { waitUntil: 'domcontentloaded' });
    if (signup) await page.getByRole('button', { name: '회원가입', exact: true }).click();
    const form = page.getByRole('form', { name: label, exact: true });
    if (signup) await form.getByLabel('이름', { exact: true }).fill('오류 검증');
    await form.getByLabel('아이디', { exact: true }).fill('errortest');
    await form.getByLabel('비밀번호', { exact: true }).fill('test-password');
    await form.getByRole('button', { name: label, exact: true }).click();
    await expect(form.getByText(error.message, { exact: true })).toBeVisible();
    if (signup) await expect(form.getByLabel('아이디', { exact: true })).toBeFocused();
    console.log('PASS ' + error.route + ' backend ' + error.status);
  }
  assert.deepEqual(pageErrors, []);
} finally {
  await browser.close();
}
