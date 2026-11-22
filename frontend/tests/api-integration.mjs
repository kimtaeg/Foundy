import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { selectOpeningDate } from './helpers/select-opening-date.mjs';

const web = process.env.FOUNDY_URL || 'http://localhost:3000';
const api = process.env.FOUNDY_TEST_API || 'http://127.0.0.1:8000';
for (const url of [web, api]) {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Use a local integration environment');
}
const health = await (await fetch(api + '/api/health')).json();
assert.ok(health.mock && health.db === 'ok', 'Start the local mock backend with an isolated database');

const account = {
  username: 'e2e' + randomBytes(6).toString('hex'),
  password: randomBytes(14).toString('hex'),
  name: '연동확인',
};
let verificationToken;
const read = async (path) => {
  const response = await fetch(api + path, { headers: { Authorization: 'Bearer ' + verificationToken } });
  assert.equal(response.status, 200, path);
  return response.json();
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const serverRequests = [];
page.on('response', response => {
  const pathname = new URL(response.url()).pathname;
  if (pathname.startsWith('/api/')) serverRequests.push([response.request().method(), pathname, response.status()]);
});
const visit = route => page.goto(web + '/' + route, { waitUntil: 'domcontentloaded' });
const save = async (trigger, method, suffix) => {
  const [res] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method),
    trigger(),
  ]);
  assert.ok(res.ok(), method + ' ' + suffix + ' ' + res.status());
  return res.status() === 204 ? null : res.json();
};
const rejectSave = async (trigger, method, suffix, message) => {
  const failedRequest = url => url.pathname.startsWith('/api/') && url.pathname.endsWith(suffix);
  const intercept = route => route.request().method() !== method ? route.fallback() : route.fulfill({
    status: 409,
    headers: { 'access-control-allow-origin': web },
    json: { error: { code: 'WRITE_CONFLICT', message } },
  });
  await page.route(failedRequest, intercept);
  try {
    await trigger();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  } finally {
    await page.unroute(failedRequest, intercept);
  }
};
try {
  await visit('login');
  await expect(page.getByText('미리보기 계정', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  const signupForm = page.getByRole('form', { name: '회원가입', exact: true });
  await signupForm.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(signupForm.getByRole('textbox', { name: '이름', exact: true })).toBeFocused();
  await expect(signupForm.getByText('이름을 입력해 주세요.')).toBeVisible();
  await signupForm.getByLabel('이름', { exact: true }).fill(account.name);
  await signupForm.getByLabel('아이디', { exact: true }).fill(account.username);
  await signupForm.getByLabel('비밀번호', { exact: true }).fill(account.password);
  const signup = await save(() => signupForm.getByRole('button', { name: '회원가입', exact: true }).click(), 'POST', '/auth/signup');
  assert.equal(signup.store_id, null);
  assert.equal(signup.setup.status, 'missing_store');
  await expect(page).toHaveURL(/\/mypage\/?$/);
  await expect(page.getByRole('heading', { name: '가게 정보를 먼저 등록해 주세요' })).toBeVisible();
  await expect(page.locator('#fName')).toBeVisible();
  assert.deepEqual(serverRequests.map(([method, path]) => [method, path]), [['POST', '/api/auth/signup']]);
  await visit('report');
  await expect(page).toHaveURL(/\/mypage\/?$/);
  await expect(page.getByRole('heading', { name: '가게 정보를 먼저 등록해 주세요' })).toBeVisible();
  assert.ok(!serverRequests.some(([, path]) => path.startsWith('/api/stores/')));
  await save(() => page.locator('[data-nx="logout"]:visible').first().click(), 'POST', '/auth/logout');
  await expect(page).toHaveURL(/\/login\/?$/);
  console.log('PASS signup validation, automatic session and registration routing');

  await page.locator('[name="username"]').fill(account.username);
  await page.locator('[name="password"]').fill(account.password);
  const login = await save(() => page.getByRole('button', { name: '로그인', exact: true }).click(), 'POST', '/auth/login');
  verificationToken = login.access_token;
  await expect(page).toHaveURL(/\/mypage\/?$/);
  await expect(page.locator('#fName')).toBeVisible({ timeout: 20000 });
  console.log('PASS login and new-account routing');

  const name = '연동검증점';
  await page.locator('#fName').fill(name);
  const postcodeScript = '**/postcode.v2.js';
  let postcodeLoads = 0;
  await page.route(postcodeScript, route => {
    if (++postcodeLoads === 1) return route.abort('failed');
    return route.fulfill({ contentType: 'application/javascript', body: `
      window.kakao = { ...window.kakao, Postcode: class {
        constructor(options) { this.options = options; }
        embed(host) {
          const result = document.createElement('button');
          result.type = 'button';
          result.textContent = '서울특별시 성동구 성수이로 10';
          result.onclick = () => this.options.oncomplete({ roadAddress: result.textContent });
          host.append(result);
        }
      } };` });
  });
  await page.getByRole('button', { name: '주소 검색', exact: true }).click();
  const postcode = page.getByRole('dialog', { name: '주소 검색' });
  await expect(postcode.getByRole('alert')).toContainText('주소 검색을 불러오지 못했어요.');
  await postcode.getByRole('button', { name: '다시 시도', exact: true }).click();
  await postcode.getByRole('button', { name: '서울특별시 성동구 성수이로 10' }).click();
  await expect(postcode).not.toBeVisible();
  await expect(page.locator('#fAddr')).toHaveValue('서울특별시 성동구 성수이로 10');
  await page.unroute(postcodeScript);
  console.log('PASS address SDK error, retry and selection populates the store form');
  await page.locator('#fDetail').fill('1층');
  const date = new Date();
  const opening = (date.getFullYear() + 1) + '-04-03';
  await selectOpeningDate(page, opening);
  await page.locator('#fBirth').fill('1997');
  await rejectSave(() => page.locator('#nxForm button[type="submit"]').click(), 'POST', '/api/stores', '가게 기본 정보를 저장하지 못했어요.');
  await expect(page.locator('#fName')).toHaveValue(name);
  await expect(page.locator('#fAddr')).toHaveValue('서울특별시 성동구 성수이로 10');
  const [registered] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/stores'),
    page.locator('#nxForm button[type="submit"]').click(),
  ]);
  assert.equal(registered.status(), 201);
  const initialStore = await registered.json();
  assert.equal(initialStore.setup.status, 'missing_answers');
  const store = '/api/stores/' + initialStore.store_id;
  await expect(page.locator('[data-nx="analyze"]')).toBeDisabled();
  await page.reload();
  await expect(page.locator('[data-nx="analyze"]')).toBeDisabled();
  await page.locator('[data-nx="wizback"]').click();
  await expect(page.locator('#fName')).toHaveValue(name);
  await page.locator('#nxForm button[type="submit"]').click();
  await expect(page.locator('[data-nx="analyze"]')).toBeDisabled();
  assert.ok(!serverRequests.some(([method, path]) => method === 'PATCH' && path === store));
  await page.locator('[data-nx="wizback"]').click();
  await page.locator('#fName').fill(`${name} 수정`);
  await save(() => page.locator('#nxForm button[type="submit"]').click(), 'PATCH', store);
  for (const [field, value] of [['alcohol', '1'], ['terrace', '0'], ['employees', '1']]) {
    await page.locator('[data-nx="yn"][data-k="' + field + '"][data-v="' + value + '"]').click();
  }
  await page.locator('#fFunds').fill('30000000');
  await rejectSave(() => page.locator('[data-nx="analyze"]').click(), 'POST', '/answers', '영업 조건을 저장하지 못했어요.');
  await expect(page.locator('[data-nx="analyze"]')).toBeEnabled();
  await expect(page.locator('#fFunds')).toHaveValue('30000000');
  await save(() => page.locator('[data-nx="analyze"]').click(), 'POST', '/analyze');
  const finish = page.locator('[data-nx="finish"]');
  await expect(finish).toBeEnabled({ timeout: 60000 });
  await finish.click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  assert.equal((await read(store)).answers.has_employees, true);
  assert.equal((await read('/api/me')).setup.status, 'ready');
  console.log('PASS store creation, answers, analysis and dashboard');

  await visit('checklist');
  const boxes = page.locator('#page-checklist input[data-task]');
  await expect(boxes.first()).toBeVisible();
  const checkbox = boxes.first();
  const taskId = await checkbox.getAttribute('data-task');
  const before = await checkbox.isChecked();
  const totalBefore = (await read(store + '/dashboard')).checklist_progress.done;
  await rejectSave(() => checkbox.click(), 'PATCH', '/checklist/' + taskId, '체크리스트 변경을 저장하지 못했어요.');
  await expect(checkbox).toBeChecked({ checked: before });
  await save(() => checkbox.click(), 'PATCH', '/checklist/' + taskId);
  await page.reload();
  await expect(page.locator('#page-checklist input[data-task="' + taskId + '"]')).toBeChecked({ checked: !before });
  assert.equal((await read(store + '/dashboard')).checklist_progress.done, totalBefore + (before ? -1 : 1));
  await page.locator('[data-nx="editDate"]').click();
  const newOpening = (date.getFullYear() + 1) + '-04-10';
  await selectOpeningDate(page, newOpening);
  await rejectSave(() => page.locator('#nxDate button[type="submit"]').click(), 'PATCH', store, '개업일 변경을 저장하지 못했어요.');
  await expect(page.locator('#nxDate')).toBeVisible();
  await save(() => page.locator('#nxDate button[type="submit"]').click(), 'PATCH', store);
  await page.reload();
  await expect(page.locator('[data-nx="editDate"]')).toHaveAttribute('aria-label', new RegExp(newOpening));
  assert.equal((await read(store)).opening_date, newOpening);
  console.log('PASS checklist save, reload, dashboard progress and opening date');

  const docData = await read(store + '/documents');
  await visit('docs');
  const group = docData.groups.find(g => g.documents.length);
  const button = page.locator('#doc-' + group.item_id).getByRole('button', { name: group.documents[0].name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const document = group.documents[0];
  const row = page.locator('#doc-' + group.item_id);
  const status = row.locator('select[data-document-status="' + document.doc_key + '"]');
  const picker = row.getByRole('button', { name: document.name + ' 준비 상태', exact: true });
  const choose = async (label) => {
    await picker.click();
    await page.getByRole('option', { name: label, exact: true }).click();
  };
  const previousStatus = await status.inputValue();
  await rejectSave(() => choose('발급·취득 완료'), 'PATCH', '/documents/' + document.doc_key, '서류 상태 저장이 충돌했어요.');
  await expect(status).toHaveValue(previousStatus);
  await save(() => choose('발급·취득 완료'), 'PATCH', '/documents/' + document.doc_key);
  await page.reload();
  await button.click();
  await expect(status).toHaveValue('obtained');
  assert.equal((await read(store + '/documents/' + document.doc_key)).status, 'obtained');
  console.log('PASS document status change and reload');

  await visit('report');
  const report = await read(store + '/report');
  const first = report.groups.flatMap(g => g.items).find(i => i.options?.length && !i.chosen_option);
  assert.ok(first, 'new mock account should have an actionable choice');
  const card = page.locator('#result-' + first.item_id);
  const picker = card.locator('[data-nx="options"]');
  await expect(card).toBeVisible();
  if (!(await card.evaluate(el => el.open))) await card.locator('summary').click();
  await picker.click();
  await page.getByRole('dialog').locator('[data-nx="opt"]').first().click();
  await rejectSave(() => page.getByRole('dialog').locator('[data-nx="confirm"]').click(), 'POST', '/choose', '선택 결과를 저장하지 못했어요.');
  await expect(page.getByRole('dialog').locator('[data-nx="confirm"]')).toBeEnabled();
  const applied = await save(() => page.getByRole('dialog').locator('[data-nx="confirm"]').click(), 'POST', '/choose');
  await page.reload();
  await expect(page.locator('#result-' + first.item_id)).toBeVisible();
  assert.equal((await read(store + '/report')).groups.flatMap(g => g.items).find(i => i.item_id === first.item_id).chosen_option, applied.chosen_option);
  const summary = card.locator('[data-nx="optionresult"]').first();
  if (!(await card.evaluate(el => el.open))) await card.locator('summary').click();
  await summary.click();
  await expect(page.getByRole('button', { name: '선택 되돌리기' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  const action = (await read(store + '/report')).groups.flatMap(g => g.items)
    .find(item => item.user_action && (!item.options.length || item.chosen_option));
  assert.ok(action, 'an actionable report is required to test completion');
  const actionCard = page.locator('#result-' + action.item_id);
  if (!(await actionCard.evaluate(el => el.open))) await actionCard.locator('summary').click();
  await actionCard.locator('[data-nx="optionresult"]').first().click();
  await rejectSave(() => page.getByRole('dialog').locator('[data-nx="actdone"]').click(), 'POST', '/action', '점검 후속 작업을 저장하지 못했어요.');
  await expect(page.getByRole('dialog').locator('[data-nx="actdone"]')).toBeEnabled();
  await save(() => page.getByRole('dialog').locator('[data-nx="actdone"]').click(), 'POST', '/action');
  const getAction = async () => (await read(store + '/report')).groups.flatMap(g => g.items).find(i => i.item_id === action.item_id);
  assert.equal((await getAction()).action_status, 'done');
  await save(() => page.getByRole('dialog').locator('[data-nx="actreset"]').click(), 'POST', '/action');
  assert.equal((await getAction()).action_status, 'pending');
  console.log('PASS report choice persistence, task completion and completion reversal');

  await visit('mypage');
  const field = 'detail';
  await page.locator('[data-nx="mpedit"][data-field="' + field + '"]').click();
  const form = page.locator('form[data-profile-field="' + field + '"]');
  await form.locator('[name="value"]').fill('2층 테스트');
  await rejectSave(() => form.getByRole('button', { name: '저장' }).click(), 'PATCH', store, '가게 정보 저장이 충돌했어요.');
  await expect(form.locator('[name="value"]')).toHaveValue('2층 테스트');
  await save(() => form.getByRole('button', { name: '저장' }).click(), 'PATCH', store);
  await page.reload();
  await expect(page.getByText('2층 테스트', { exact: true })).toBeVisible();
  assert.equal((await read(store)).address_detail, '2층 테스트');
  const toggle = page.locator('button[data-field="employees"][data-answer="false"]');
  await rejectSave(() => toggle.click(), 'PATCH', store, '직원 고용 조건을 저장하지 못했어요.');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await save(() => toggle.click(), 'PATCH', store);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  assert.equal((await read(store)).answers.has_employees, false);
  await page.locator('[data-nx="mpedit"][data-field="accountName"]').click();
  const profileForm = page.locator('form[data-profile-field="accountName"]');
  await profileForm.locator('[name="value"]').fill('연동 이름 확인');
  await rejectSave(() => profileForm.getByRole('button', { name: '저장' }).click(), 'PATCH', '/api/me', '계정 이름을 저장하지 못했어요.');
  await expect(profileForm.locator('[name="value"]')).toHaveValue('연동 이름 확인');
  await save(() => profileForm.getByRole('button', { name: '저장' }).click(), 'PATCH', '/api/me');
  await page.reload();
  await expect(page.getByText('연동 이름 확인', { exact: true })).toBeVisible();
  assert.equal((await read('/api/me')).user.name, '연동 이름 확인');
  console.log('PASS mypage inline store and account save and toggle after reload');

  await visit('dashboard');
  const bell = page.getByRole('button', { name: /^알림,/ });
  await bell.hover();
  const item = page.locator('[data-notification-id]').filter({ hasText: '읽지 않음' }).first();
  await expect(item).toBeVisible();
  const alertId = await item.getAttribute('data-notification-id');
  await rejectSave(() => item.click(), 'PATCH', '/alerts/' + alertId, '알림 읽음 상태를 저장하지 못했어요.');
  await bell.hover();
  await expect(item).toBeVisible();
  await save(() => item.click(), 'PATCH', '/alerts/' + alertId);
  assert.equal((await read(store + '/alerts')).items.find(i => i.alert_id === alertId)?.read, true);
  console.log('PASS notification persisted');

  const beforeStaticPages = serverRequests.length;
  await page.route(/https?:\/\/[^/]*(?:kakao|daumcdn)\.[^/]+\//, route => route.abort());
  await visit('sites');
  await expect(page.locator('#page-sites').getByRole('heading', { name: '상권 분석', exact: true })).toHaveCount(1);
  assert.ok(!serverRequests.slice(beforeStaticPages).some(([, path]) => /\/(grants|chat|market)(\/|$)/.test(path)));
  const beforeGrants = serverRequests.length;
  const grantEndpoint = store + '/grants';
  await save(() => visit('grants'), 'GET', grantEndpoint);
  await expect(page.getByRole('heading', { name: '정책·지원사업', exact: true })).toBeVisible();
  const updatedGrants = await save(
    () => page.getByRole('button', { name: '공고 새로 조회', exact: true }).click(),
    'POST',
    '/grants/refresh',
  );
  await expect(page.getByRole('button', { name: '공고 새로 조회', exact: true })).toBeEnabled();
  const storedGrants = await read(grantEndpoint);
  assert.deepEqual(storedGrants.items, updatedGrants.items);
  assert.deepEqual(
    serverRequests.slice(beforeGrants).filter(([, path]) => path.startsWith(store + '/') && path !== store + '/alerts'),
    [['GET', grantEndpoint, 200], ['POST', grantEndpoint + '/refresh', 200]],
  );
  console.log('PASS sites and grants read, refresh and persistence');
  await save(() => page.locator('[data-nx="logout"]:visible').first().click(), 'POST', '/auth/logout');
  await page.reload();
  await expect(page.locator('[name="username"]')).toBeVisible();
  const revoked = await fetch(api + '/api/me', { headers: { Authorization: 'Bearer ' + login.access_token } });
  assert.equal(revoked.status, 401);
  assert.deepEqual(errors, []);
  console.log('PASS logout and empty session after reload');
} catch (error) {
  console.error('Page:', page.url(), (await page.locator('body').innerText()).slice(0, 1250));
  console.error('API:', serverRequests.slice(-15), 'page errors:', errors);
  throw error;
} finally {
  await browser.close();
}
