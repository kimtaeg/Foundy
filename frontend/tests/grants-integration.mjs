import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const web = new URL(process.env.FOUNDY_URL || 'http://localhost:3000');
assert.ok(['localhost', '127.0.0.1'].includes(web.hostname));
const store = '/api/stores/grants-test-store';
const identity = {
  user: { user_id: 'grants-test-user', name: '테스트', provider: 'local', username: 'grants-test', joined_at: '2026-01-01' },
  store_id: 'grants-test-store',
  store_name: '지원사업 테스트 가게',
  store_opening: '2099-01-01',
  setup: { status: 'ready', missing_fields: [], run_id: null },
};
const notice = {
  grant_id: 'real-grant',
  title: '소상공인 개업 지원 공고',
  source: 'K-Startup',
  url: 'https://www.k-startup.go.kr/test-notice',
  org: '창업진흥원',
  category: '사업화',
  region: '서울',
  deadline: '2099-01-12',
  result: 'eligible',
  checks: [{ condition: '사업장 소재지', result: 'pass', evidence: { text: '서울 소재 사업장' } }],
  summary: { who: '예비 창업자', how_much: '최대 100만원', until: null, what_to_submit: ['신청서'] },
};
const example = { ...notice, grant_id: 'example', title: '미리보기 전용 공고', source: 'K-Startup(예시)' };
const response = {
  status: 'ready', error: null, source: 'K-Startup', is_example: false,
  judged_at: '2098-12-31T12:00:00', excluded_count: 0, items: [notice],
};
let releaseFirstGet;
const firstGet = new Promise(resolve => { releaseFirstGet = resolve; });
let releaseFirstRefresh;
const firstRefresh = new Promise(resolve => { releaseFirstRefresh = resolve; });
let gets = 0;
let posts = 0;
const requests = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ locale: 'ko-KR', reducedMotion: 'reduce' });
await page.addInitScript(() => {
  localStorage.setItem('foundy-api-session', JSON.stringify({
    token: 'grants-test-token', storeId: 'grants-test-store', kind: 'account',
  }));
});
await page.route('**/api/**', async route => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const method = request.method();
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
  const reply = (json, status = 200) => route.fulfill({ headers, json, status });
  if (method === 'OPTIONS') return route.fulfill({ headers, status: 204 });
  requests.push([method, path]);
  if (path === '/api/me') return reply(identity);
  if (path === store + '/alerts') return reply({ items: [] });
  if (path === store + '/grants' && method === 'GET') {
    if (++gets === 1) {
      await firstGet;
      return reply({ error: { message: '지원사업 조회에 실패했어요.' } }, 503);
    }
    return reply({ ...response, is_example: true, items: [example] });
  }
  if (path === store + '/grants/refresh' && method === 'POST') {
    if (++posts === 1) {
      await firstRefresh;
      return reply(response);
    }
    if (posts === 2) return reply({ ...response, error: 'provider unavailable' });
    return reply({ error: { code: 'UPSTREAM_UNAVAILABLE', message: '공고 서버가 잠시 응답하지 않아요.' } }, 503);
  }
  return reply({ error: { message: 'unexpected request' } }, 500);
});

try {
  await page.goto(new URL('/grants', web).href, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page-skeleton="grants"]')).toBeVisible();
  releaseFirstGet();
  await expect(page.getByText('지원사업 조회에 실패했어요.')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByText('표시할 지원사업 공고가 없어요.', { exact: false })).toBeVisible();
  await expect(page.getByText(example.title)).toHaveCount(0);
  assert.equal(posts, 0);

  const refresh = page.getByRole('button', { name: '공고 새로 조회', exact: true });
  const fields = page.getByRole('group', { name: '지원 분야' });
  await expect(fields.locator('..').getByRole('button', { name: '공고 새로 조회', exact: true })).toBeVisible();
  await expect(page.locator('#page-grants select')).toHaveCount(0);
  await expect(refresh.locator('svg')).toHaveCount(0);
  assert.deepEqual(await refresh.evaluate(element => {
    const style = getComputedStyle(element);
    return [style.borderTopWidth, style.backgroundColor];
  }), ['0px', 'rgba(0, 0, 0, 0)']);
  const [filterBox, refreshBox] = await Promise.all([fields.boundingBox(), refresh.boundingBox()]);
  assert.ok(refreshBox.x >= filterBox.x + filterBox.width);
  await refresh.click();
  await expect(page.getByRole('button', { name: '공고 조회 중' })).toBeDisabled();
  await expect(page.getByRole('status', { name: '지원사업 공고를 조회하는 중' })).toBeVisible();
  releaseFirstRefresh();

  const card = page.getByRole('article').filter({ hasText: notice.title });
  await expect(card).toBeVisible();
  await expect(card.getByText('최대 100만원', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /일부 확인 필요/ }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /^전체\s*1건$/ }).click();
  const opener = card.getByRole('button', { name: /공고 상세/ });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: notice.title });
  await expect(dialog.getByText('서울 소재 사업장', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /공고 원문 보기/ })).toHaveAttribute('href', notice.url);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.getByRole('button', { name: /가장 가까운 마감/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();

  await refresh.click();
  await expect(page.locator('#page-grants').getByRole('alert')).toContainText('새 공고를 조회하지 못했어요.');
  await expect(card).toBeVisible();
  await refresh.click();
  await expect(page.locator('#page-grants').getByRole('alert')).toContainText('공고 서버가 잠시 응답하지 않아요.');
  await expect(card).toBeVisible();
  assert.deepEqual(requests.filter(([, path]) => path.startsWith(store + '/') && path !== store + '/alerts'), [
    ['GET', store + '/grants'],
    ['GET', store + '/grants'],
    ['POST', store + '/grants/refresh'],
    ['POST', store + '/grants/refresh'],
    ['POST', store + '/grants/refresh'],
  ]);
  console.log('PASS grants skeleton, GET retry, real-only content, refresh, filters, detail, and retained results');
} finally {
  releaseFirstGet();
  releaseFirstRefresh();
  await browser.close();
}
