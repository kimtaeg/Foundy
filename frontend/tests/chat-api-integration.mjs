import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const web = process.env.FOUNDY_URL || 'http://localhost:3000';
const storeId = 'chat-test-store';
const session = { session_id: 'chat-test-session', store_id: storeId, title: null };
const token = 'chat-test-token';
const storeName = '상담검증점';
const cardTitle = '영업신고 서류를 확인하세요';
const cardId = 'chat-test-card';
const today = '2026-11-22';
const opening = '2027-01-20';
const counts = { high: 0, low: 1, unknown: 0, ok: 0 };
const identity = {
  user: { user_id: 'chat-test-user', name: '상담 검증', provider: 'local', username: 'chat-test', joined_at: today },
  store_id: storeId,
  store_name: storeName,
  store_opening: opening,
  setup: { status: 'ready', missing_fields: [], run_id: 'chat-test-run' },
};
const dashboard = {
  store: {
    store_id: storeId, name: storeName, registered_name: storeName, business_type: '카페',
    business_type_input: '카페', address: '서울특별시 성동구 성수이로 10',
    address_detail: '1층', region: '서울', opening_date: opening, d_day: 59,
  },
  last_run: null, report_summary: counts, pending_decisions: [], today_todos: [],
  checklist_tasks: [], next_steps: [], checklist_progress: { done: 0, total: 0 }, alerts: { unread: 0 },
};
const report = {
  store_id: storeId, run_id: null, next_steps: [], summary: counts,
  groups: [{ stage: 'contract', items: [{
    item_id: cardId, check_id: 'permit', stage: 'contract', title: cardTitle, verdict: 'low',
    decided_by: 'rule', reason: '신청 전에 필요한 내용을 점검합니다.', options: [],
    chosen_option: null, action_status: 'pending', action_reply: null, resolved_title: null,
    verdict_before: null, linked_task_ids: [], applied_changes: [], evidence: [],
  }] }],
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ locale: 'ko-KR' });
const requests = [];
const pageErrors = [];
const transcript = [];
let listFailure = true;
let failNextTurn = false;
let rejectNextTurn = false;
let truncateNextTurn = false;
let releasePausedTurn;
let pauseNextTurn = false;
const response = (role, content, fields = {}) => ({
  message_id: String(transcript.length + 1), role, content, created_at: today, actions: [], citations: [], ...fields,
});
const sse = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};
const sessionPath = '/api/chat/sessions';
const messagesPath = `${sessionPath}/${session.session_id}/messages`;
const storePath = '/api/stores/' + storeId;

page.on('pageerror', (error) => pageErrors.push(error.message));
await page.addInitScript((saved) => {
  localStorage.setItem('foundy-api-session', JSON.stringify(saved));
}, { token, storeId, kind: 'account' });

await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const json = (body, status = 200) => route.fulfill({ json: body, status, headers });
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
  assert.equal(request.headers().authorization, 'Bearer ' + token);
  if (url.pathname === '/api/me') return json(identity);
  if (url.pathname === storePath + '/dashboard') return json(dashboard);
  if (url.pathname === storePath + '/report') return json(report);
  if (url.pathname === storePath + '/alerts') return json({ items: [] });

  requests.push([method, url.pathname]);
  if (url.pathname === sessionPath && method === 'GET') {
    assert.equal(url.searchParams.get('store_id'), storeId);
    assert.equal(url.searchParams.get('include_messages'), 'true');
    if (listFailure) {
      listFailure = false;
      return json({ error: { code: 'TEST_UNAVAILABLE', message: '상담 기록 조회 실패' } }, 503);
    }
    return json({ items: transcript.length ? [session] : [], messages: transcript });
  }
  if (url.pathname === sessionPath && method === 'POST') {
    assert.deepEqual(request.postDataJSON(), { store_id: storeId });
    return json(session, 201);
  }
  if (url.pathname === messagesPath && method === 'GET') return json({ session, items: transcript });
  assert.equal(url.pathname, messagesPath);
  assert.equal(method, 'POST');
  const { content } = request.postDataJSON();
  if (rejectNextTurn) {
    rejectNextTurn = false;
    return json({ error: { code: 'CHAT_BUSY', message: '상담 서버가 혼잡해요.' } }, 503);
  }
  if (truncateNextTurn) {
    truncateNextTurn = false;
    return route.fulfill({
      headers,
      contentType: 'text/event-stream',
      body: sse('delta', { text: '완료 이벤트 없이 종료된 답변' }),
    });
  }
  transcript.push(response('user', content));
  if (pauseNextTurn) {
    pauseNextTurn = false;
    return new Promise((resolve) => { releasePausedTurn = resolve; })
      .then(() => route.abort().catch(() => {}));
  }
  if (failNextTurn) {
    failNextTurn = false;
    const reply = response('assistant', '답변을 준비하지 못했어요.');
    transcript.push(reply);
    return route.fulfill({
      headers,
      contentType: 'text/event-stream',
      body: sse('error', { message: '상담 서버에서 답변을 만들지 못했어요.', reply }),
    });
  }
  const reply = response('assistant', '서버에서 조회한 안내예요. [S1]', {
    actions: [{ type: 'navigate', target: 'report', label: '점검 리포트 보기' }],
    citations: [
      { source_type: 'law', source_id: '사례법', title: '근거 법령', url: 'https://example.test/law', article: null },
      { source_type: 'report', source_id: cardId, title: '해당 항목', url: null, article: null },
    ],
  });
  transcript.push(reply);
  return route.fulfill({
    headers,
    contentType: 'text/event-stream',
    body: sse('tool', { name: 'get_report', label: '점검 결과 조회', status: 'ok' }) +
      sse('delta', { text: '정리 전 임시 내용' }) +
      sse('reset', {}) +
      sse('delta', { text: '서버에서 ' }) +
      sse('done', reply),
  });
});

try {
  await page.goto(web + '/dashboard');
  const launch = page.getByRole('button', { name: '파운디 상담 열기', exact: true });
  const panel = page.getByRole('dialog', { name: '파운디 도우미' });
  const replies = panel.locator('[data-chat-role="assistant"]');
  await expect(launch).toBeVisible();
  assert.deepEqual(requests, []);
  await page.getByRole('button', { name: 'AI에게 오늘 할 일 묻기', exact: true }).click();
  await expect(panel.getByText('상담 기록 조회 실패', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '다시 시도' }).click();
  await expect(replies.first()).toContainText('서버에서 조회한 안내예요.');
  await expect(replies.first()).not.toContainText('[S1]');
  await expect(replies.first()).not.toContainText('정리 전 임시 내용');
  const processing = replies.first().getByRole('button', { name: /처리 완료/ });
  await processing.click();
  await expect(replies.first().getByText('점검 결과 조회', { exact: true })).toBeVisible();
  await expect(replies.first().getByRole('link', { name: /근거 법령/ })).toHaveAttribute('href', 'https://example.test/law');
  await expect(replies.first().getByRole('button', { name: /해당 항목/ })).toHaveAttribute('data-focus', cardId);
  assert.equal(transcript[0].content, '오늘 뭐부터 하죠?');
  assert.deepEqual(requests, [
    ['GET', sessionPath], ['GET', sessionPath], ['POST', sessionPath], ['POST', messagesPath],
  ]);
  console.log('PASS lazy history lookup, history error retry, dashboard launch, tool status and citations');

  await replies.first().getByRole('button', { name: /점검 리포트 보기/ }).click();
  await expect(page).toHaveURL(/\/report$/);
  await panel.getByRole('button', { name: '상담 닫기' }).click();
  const item = page.locator('#result-' + cardId);
  await expect(item).toBeVisible();
  if (!(await item.evaluate((element) => element.open))) await item.locator('summary').click();
  await item.getByRole('button', { name: '이 항목 질문하기' }).click();
  await expect(panel.getByText(cardTitle, { exact: true })).toBeVisible();
  const input = panel.getByRole('textbox', { name: '질문 입력' });
  await input.fill('어떤 서류가 필요하죠?');
  await input.press('Enter');
  await expect(replies).toHaveCount(2);
  await expect(replies.last()).toContainText('서버에서 조회한 안내예요.');
  assert.equal(transcript[2].content, '어떤 서류가 필요하죠?\n\n점검 리포트 항목: ' + cardTitle);
  // 다시 열면 서버 기록을 한 번 다시 읽는다 (바뀐 게 없으면 화면은 그대로)
  assert.deepEqual(requests.slice(4), [['GET', sessionPath], ['POST', messagesPath]]);
  console.log('PASS report navigation, focused question, history recheck on reopen, and existing session reuse');

  failNextTurn = true;
  await input.fill('구청에 무엇을 물어봐야 할까요?');
  await input.press('Enter');
  const failed = panel.locator('[data-chat-processing="error"]');
  await expect(failed).toBeVisible();
  await expect(replies.last()).toContainText('상담 서버에서 답변을 만들지 못했어요.');
  await panel.getByRole('button', { name: '상담 주제 고정 해제' }).click();
  await failed.getByRole('button', { name: '다시 요청' }).click();
  await expect(replies).toHaveCount(4);
  await expect(replies.last()).toContainText('서버에서 조회한 안내예요.');
  assert.equal(transcript[4].content, transcript[6].content);
  assert.match(transcript[6].content, /점검 리포트 항목:/);
  assert.deepEqual(requests.slice(6), [['POST', messagesPath], ['POST', messagesPath]]);
  console.log('PASS stream error recovery and retry with the original report context');

  // 서버 기록이 그대로면 다시 열어도 화면 상태(실패 답변의 '다시 요청')를 유지한다
  await panel.getByRole('button', { name: '상담 닫기' }).click();
  await launch.click();
  await expect.poll(() => requests.length).toBe(9);
  assert.deepEqual(requests.slice(8), [['GET', sessionPath]]);
  await expect(replies).toHaveCount(4);
  await expect(failed.getByRole('button', { name: '다시 요청' })).toBeVisible();
  console.log('PASS reopening with an unchanged server history keeps the on-screen state');

  // 같은 계정이 다른 기기에서 대화를 이어 가면, 다시 열 때 그 대화가 보인다
  await panel.getByRole('button', { name: '상담 닫기' }).click();
  transcript.push(response('user', '다른 기기에서 보낸 질문'));
  transcript.push(response('assistant', '다른 기기에서 받은 답변'));
  await launch.click();
  await expect(panel.getByText('다른 기기에서 받은 답변', { exact: true })).toBeVisible();
  await expect(panel.getByText('다른 기기에서 보낸 질문', { exact: true })).toBeVisible();
  await expect(replies).toHaveCount(5);
  assert.deepEqual(requests.slice(9), [['GET', sessionPath]]);
  console.log('PASS reopening shows messages added from another device');

  // 채팅이 열린 채로 탭이 다시 보이면 서버 기록을 다시 읽는다
  transcript.push(response('user', '세 번째 기기 질문'));
  transcript.push(response('assistant', '세 번째 기기 답변'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(panel.getByText('세 번째 기기 답변', { exact: true })).toBeVisible();
  await expect(replies).toHaveCount(6);
  assert.deepEqual(requests.slice(10), [['GET', sessionPath]]);
  console.log('PASS returning to the tab refreshes the open chat history');

  await page.reload();
  await launch.click();
  await expect(replies).toHaveCount(6);
  await expect(panel.getByText('어떤 서류가 필요하죠?', { exact: true })).toBeVisible();
  assert.deepEqual(requests.slice(11), [['GET', sessionPath]]);
  console.log('PASS reloaded chat session and transcript');

  pauseNextTurn = true;
  await input.fill('이 질문을 중지할게요');
  await input.press('Enter');
  await expect.poll(() => requests.length).toBe(13);
  await panel.getByRole('button', { name: '답변 생성 중지' }).click();
  await expect(panel.locator('[data-chat-processing="canceled"]')).toBeVisible();
  await expect(panel.locator('[data-chat-processing="processing"]')).toHaveCount(0);
  releasePausedTurn();
  assert.equal(transcript.at(-1).content, '이 질문을 중지할게요');
  console.log('PASS stopping an in-flight answer');

  rejectNextTurn = true;
  await input.fill('상담 서버 상태를 확인해 주세요.');
  await input.press('Enter');
  await expect(replies.last()).toContainText('상담 서버가 혼잡해요.');
  await expect(failed.last().getByRole('button', { name: '다시 요청' })).toBeVisible();

  truncateNextTurn = true;
  await input.fill('스트림 중단을 확인해 주세요.');
  await input.press('Enter');
  await expect(failed).toHaveCount(2);
  await expect(replies.last()).toContainText('지금은 답변을 만들지 못했어요.');
  await expect(panel.locator('[data-chat-processing="processing"]')).toHaveCount(0);
  assert.deepEqual(pageErrors, []);
  console.log('PASS HTTP error messages and streams that end without a final event');
} finally {
  releasePausedTurn?.();
  await browser.close();
}
