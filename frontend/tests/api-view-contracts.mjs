import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { chromium, expect } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import { browserBundle, createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { DEMO_STORE, MPF, IMP, REGIONS } = load('@/data/store');
const { GRANTS } = load('@/data/grants');
const { DataBoundary } = load('@/components/loading/DataBoundary');
const { SectionSkeleton } = load('@/components/loading/SectionSkeleton');
const json = (value) => JSON.parse(JSON.stringify(value));
const results = [];
const task = {
  id: 'api-task', task: 'API에서 내려온 할 일', category: '신고', group: '준비',
  due: '2027-02-20', documents: 'API 서류', agency: 'API 담당 기관', done: false,
};
const card = {
  id: 'api-card', check: 'api-check', stage: 'contract', base: 'ok', by: '계약 전',
  title: 'API 점검 항목', reason: 'API 결과를 그대로 전달한 안내입니다.', options: [],
};
const grant = { ...GRANTS[0], id: 'api-grant', title: 'API 지원사업 공고' };
const cases = [
  {
    name: 'dashboard', path: '@/components/dashboard/DashboardView', component: 'DashboardView', marker: 'API 가게',
    data: {
      store: { ...DEMO_STORE, name: 'API 가게' }, name: 'API 가게', undecided: false, days: 30,
      decisions: [card], taskCount: { done: 0, total: 1 }, unread: 0, actions: [], tasks: [task],
    },
  },
  {
    name: 'report', path: '@/components/report/ReportView', component: 'ReportView', marker: 'API 점검 항목',
    data: {
      locked: false, filter: 'all', counts: { high: 0, low: 0, unknown: 0, ok: 1 }, firstByVerdict: { ok: 'api-card' },
      cards: [{ card, state: {}, verdict: 'ok', action: null, nextSteps: [], shortTitle: 'API 점검 항목', open: false, followUpPending: false, statusLabel: '' }],
    },
  },
  {
    name: 'checklist', path: '@/components/checklist/ChecklistView', component: 'ChecklistView', marker: 'API에서 내려온 할 일',
    data: {
      opening: '2027-03-02', employees: true, view: 'timeline', count: { done: 0, total: 1 }, colors: {},
      groups: [{ title: 'API 준비 그룹', tasks: [{ task, deadline: 'API 마감 안내', documentCount: 0, contact: null }] }],
      calendar: { year: 2027, month: 2, selected: null, days: [], selectedEvents: [] },
    },
  },
  {
    name: 'docs', path: '@/components/docs/DocsView', component: 'DocsView', marker: 'API 전용 서류',
    data: {
      total: 1, finished: 0, remaining: 1, contacts: {},
      rows: [{ task, deadline: 'API 서류 마감', documents: [{ id: 'api-document', name: 'API 전용 서류', agency: 'API 기관', guide: '새 API 서류 안내', sites: [{ label: '새 API 사이트', url: 'https://example.test/new-api-site' }] }] }],
    },
  },
  {
    name: 'grants', path: '@/components/grants/GrantsView', component: 'GrantsView', marker: 'API 지원사업 공고',
    data: {
      filters: { res: 'all', cat: 'all' }, categories: ['all', grant.cat], excludedCount: 0,
      grants: [{ grant, label: 'API 지원 자격', tone: 'ok', deadline: 'API 지원 마감' }],
    },
  },
  {
    name: 'mypage', path: '@/components/mypage/MypageView', component: 'MypageView', marker: 'API 프로필',
    data: {
      onboarded: true, draft: { ...DEMO_STORE, name: 'API 프로필' }, profile: { name: 'API 사용자', provider: 'email' },
      providerLabel: '이메일', impacts: IMP, fields: MPF, regions: REGIONS, changes: [], affectedLabels: [], resetCards: [],
    },
  },
  {
    name: 'register', path: '@/components/onboarding/OnboardingView', component: 'OnboardingView', marker: 'API 등록 가게',
    data: { store: { ...DEMO_STORE, name: 'API 등록 가게' }, userName: 'API 사용자', step: 1, completed: [], analysisSteps: [] },
  },
  {
    name: 'chat', path: '@/components/chat/ChatPanel', component: 'ChatPanel', marker: 'API 상담 답변',
    data: {
      storeName: 'API 상담 가게', undecided: false, messages: [{ role: 'a', kind: 'chitchat', text: 'API 상담 답변' }],
      busy: false, request: null, draft: '', memo: {}, cards: [], contacts: {}, actionLabels: {}, callGuides: {},
    },
  },
];

async function test(name, run) {
  await run();
  results.push({ name, passed: true });
}

function render(component, props) {
  return renderToStaticMarkup(React.createElement(component, props));
}

async function streamPending(element, resolveData) {
  const output = new PassThrough();
  let html = '';
  const errors = [];
  output.on('data', (chunk) => { html += chunk; });
  const firstChunk = new Promise((resolve) => output.once('data', resolve));
  const finished = new Promise((resolve, reject) => { output.on('end', resolve); output.on('error', reject); });
  const shell = new Promise((resolve, reject) => {
    const stream = renderToPipeableStream(React.createElement('main', null, element), {
      onShellReady() { stream.pipe(output); resolve(); },
      onShellError: reject,
      onError(error) { errors.push(error); },
    });
  });
  await shell;
  await firstChunk;
  const pending = html;
  resolveData();
  await finished;
  assert.deepEqual(errors, []);
  return { pending, complete: html };
}

await test('grant cards and details generate matching artwork for API categories without images', () => {
  const { GrantCard } = load('@/components/grants/GrantCard');
  const { GrantDetails } = load('@/components/grants/GrantDetails');
  const { GrantsHeader } = load('@/components/grants/GrantsHeader');
  const result = { label: '일부 확인 필요', tone: 'low' };
  for (const cat of ['교육', '새로운 분야', '']) {
    const apiGrant = { ...grant, cat, org: '새 기관', title: '새 사업', id: 'api-303' };
    const card = render(GrantCard, { grant: apiGrant, ...result, deadline: 'D-2' });
    const dialog = render(GrantDetails, { grant: apiGrant, result, deadline: 'D-2' });
    const artwork = card.match(/data-motif="[^"]+" data-palette="[^"]+"/)?.[0];
    assert.ok(artwork && dialog.includes(artwork));
    assert.ok(!dialog.includes('<img') && !card.includes('<img'));
    for (const html of [card, dialog]) {
      assert.match(html, /<h3[^>]*>새 사업<\/h3>/);
      assert.match(html, /bg-\[var\(--amber-bg\)\][^"]*"[^>]*>일부 확인 필요</);
      assert.match(html, /bg-neutral-100[^"]*"[^>]*><span class="sr-only">주관 기관 <\/span>새 기관</);
      assert.ok(html.includes('새 기관') && html.includes(result.label));
      assert.ok(!html.includes('예시 공고'));
    }
  }
  const dated = { ...grant, deadline: '2026-12-20', checks: [['연령', 'pass', '구간 일치'], ['업력', 'unknown', '추가 확인']] };
  const detail = render(GrantDetails, { grant: dated, deadline: 'D-29', result });
  const summary = render(GrantCard, { grant: dated, deadline: 'D-29', ...result });
  assert.match(detail, /<h3[^>]*>신청 안내<\/h3>/);
  assert.match(detail, /bg-foundy-primary\/10[^"]*"[^>]*>충족</);
  assert.match(detail, /bg-\[var\(--amber-bg\)\][^"]*"[^>]*>확인 필요</);
  for (const html of [detail, summary]) {
    assert.match(html, /<time dateTime="2026-12-20">2026\.12\.20<\/time>/i);
    assert.match(html, /bg-neutral-100[^"]*"[^>]*>D-29</);
  }
  const undated = render(GrantDetails, { grant: { ...dated, deadline: null }, deadline: 'D-29', result });
  assert.ok(undated.includes('일정 미정') && !undated.includes('D-29'));
  assert.ok(!render(GrantsHeader, { sourceLabel: '예시 공고' }).includes('예시 공고'));
  assert.ok(!render(GrantsHeader, { sourceLabel: '예시 데이터 · 실제 조회 아님' }).includes('예시 데이터'));
  assert.ok(render(GrantsHeader, { sourceLabel: '기업마당' }).includes('기업마당'));
});

for (const item of cases) {
  const View = load(item.path)[item.component];
  const data = json(item.data);
  const loadingMarker = item.name === 'chat' ? 'data-skeleton="chat"' : `data-page-skeleton="${item.name}"`;
  await test(`${item.name}: resolved JSON props render without FoundyProvider`, () => {
    const html = render(View, { data });
    assert.ok(html.includes(item.marker), `${item.name} ignored supplied data`);
    assert.ok(!html.includes('data-skeleton='), 'resolved data must not remain a loading placeholder');
    if (item.name === 'grants') {
      assert.ok(html.includes('data-grant-poster="api-grant"'));
      assert.ok(!html.includes('data-k="view"'));
      const legacy = render(View, { data: { ...data, filters: { ...data.filters, view: 'month' }, months: [] } });
      assert.ok(legacy.includes('data-grant-poster="api-grant"'));
    }
    if (item.name === 'docs') assert.ok(html.includes('https://example.test/new-api-site'));
    if (item.name === 'checklist') assert.ok(html.includes('API 마감 안내'));
  });
  await test(`${item.name}: missing data displays an accessible skeleton`, () => {
    const html = render(View, {});
    assert.ok(html.includes(loadingMarker));
    assert.ok(html.includes('aria-busy="true"'));
    assert.ok(!html.includes(item.marker));
  });
  await test(`${item.name}: a pending API Promise streams fallback before supplied content`, async () => {
    let resolve;
    const dataPromise = new Promise((done) => { resolve = done; });
    const html = await streamPending(React.createElement(View, { data: dataPromise }), () => resolve(data));
    assert.ok(html.pending.includes(loadingMarker), `${item.name} did not show its own fallback`);
    assert.ok(!html.pending.includes(item.marker));
    assert.ok(html.complete.includes(item.marker));
  });
}

await test('an individual MetricCard independently suspends for its API props', async () => {
  const { ComponentBoundary } = load('@/components/loading/ComponentBoundary');
  const { MetricCard } = load('@/components/common/MetricCard');
  let resolve;
  const data = new Promise((done) => { resolve = done; });
  const html = await streamPending(
    React.createElement(ComponentBoundary, { component: MetricCard, data }),
    () => resolve({ label: 'API 방문자', value: 4321, caption: 'API 집계 기준' }),
  );
  assert.ok(html.pending.includes('data-skeleton='));
  assert.ok(!html.pending.includes('API 방문자'));
  assert.ok(html.complete.includes('API 방문자'));
  assert.ok(html.complete.includes('4321'));
  assert.ok(html.complete.includes('API 집계 기준'));
});

const sitesData = {
  address: 'API 상권 주소',
  shops: [{ id: 'api-shop', name: 'API 상권 점포', dist: 0, lat: 37.5445, lng: 127.0557, sub: 'API 업종 분류', cat: '카페', ex: false }],
  initialCenter: { lat: 37.5445, lng: 127.0557 },
  price: '0', priceRange: { min: 0, median: 0, max: 0 }, pricePosition: { txt: '미입력', pct: null, lvl: '' },
};
const { SitesView } = load('@/components/sites/SitesView');

await test('sites: JSON props render the analysis without a provider or browser SDK', () => {
  const html = render(SitesView, { data: json(sitesData), populationInsights: { data: null } });
  assert.ok(html.includes('API 업종 분류'));
  assert.ok(html.includes('data-testid="market-workspace"'));
  assert.ok(!html.includes('상권 분석을 불러오는 중'));
  // Next's ssr:false map intentionally remains its own SDK-loading placeholder.
  assert.ok(html.includes('aria-label="상권 지도"'));
});

await test('sites: missing and pending page data display the page skeleton before analysis', async () => {
  const missing = render(SitesView, {});
  assert.ok(missing.includes('data-page-skeleton="sites"'));
  assert.ok(missing.includes('상권 분석을 불러오는 중'));
  assert.ok(!missing.includes('data-testid="market-workspace"'));
  let resolve;
  const data = new Promise((done) => { resolve = done; });
  const html = await streamPending(
    React.createElement(SitesView, { data, populationInsights: { data: null } }),
    () => resolve(json(sitesData)),
  );
  assert.ok(html.pending.includes('data-page-skeleton="sites"'));
  assert.ok(html.pending.includes('상권 분석을 불러오는 중'));
  assert.ok(!html.pending.includes('API 업종 분류'));
  assert.ok(html.complete.includes('API 업종 분류'));
});

await test('sites: empty shop and population data display empty states instead of page loading', () => {
  const html = render(SitesView, { data: { ...sitesData, shops: [] }, populationInsights: { data: null } });
  assert.ok(html.includes('선택한 조건에 표시할 점포가 없어요'));
  assert.ok(html.includes('자료 없음'));
  assert.ok(!html.includes('상권 분석을 불러오는 중'));
  assert.ok(!html.includes('생활인구 요약을 불러오는 중'));
});

await test('resolved empty collections render content rather than staying in loading', () => {
  const { ReportView } = load('@/components/report/ReportView');
  const html = render(ReportView, { data: { locked: false, filter: 'all', counts: { high: 0, low: 0, unknown: 0, ok: 0 }, firstByVerdict: {}, cards: [] } });
  assert.ok(html.includes('해당 단계의 결과가 없어요.'));
  assert.ok(!html.includes('data-skeleton='));
  for (const data of [[], 0, null]) {
    const empty = render(DataBoundary, { data, fallback: React.createElement(SectionSkeleton), children: (value) => React.createElement('p', null, `resolved:${JSON.stringify(value)}`) });
    assert.ok(empty.includes(`resolved:${JSON.stringify(data)}`));
    assert.ok(!empty.includes('data-skeleton='));
  }
});

await test('report: filtered verdicts retain overall counts and only link to available items', () => {
  const { ReportView } = load('@/components/report/ReportView');
  const data = cases.find((item) => item.name === 'report').data;
  const filtered = render(ReportView, { data: { ...data, filter: '개업 전', counts: { ...data.counts, low: 3 } } });
  assert.match(filtered, />4<span[^>]*>건</);
  assert.ok(filtered.includes('확인 권장') && filtered.includes('3건'));
  assert.deepEqual([...filtered.matchAll(/data-focus="([^"]+)"/g)].map((match) => match[1]), ['api-card']);
  assert.ok(filtered.includes('data-v="개업 전" aria-pressed="true"'));
  const revised = render(ReportView, { data: {
    ...data, counts: { high: 1, low: 0, unknown: 0, ok: 0 }, firstByVerdict: { high: 'api-card' },
    cards: [{ ...data.cards[0], verdict: 'high', statusLabel: '결정하기' }],
  } });
  assert.match(revised, /<summary[^>]*>[\s\S]*?위반 소지 높음[\s\S]*?<\/summary>/);
  assert.ok(!revised.includes('결정하기') && !revised.includes('예시 데이터'));
  const locked = render(ReportView, { data: { ...data, locked: true } });
  assert.ok(locked.includes('상권 분석으로 이동'));
  assert.ok(!locked.includes('판정별 분포') && !locked.includes('API 점검 항목'));
});

await test('report stages render chronologically and preserve the choices and guidance for each item', async () => {
  const { ReportView } = load('@/components/report/ReportView');
  const { ReportChoiceDialog } = load('@/components/report/ReportChoiceDialog');
  const base = cases.find((item) => item.name === 'report').data;
  const options = [
    { id: 'revise', label: '계획 수정', summary: '계획을 수정해요.' },
    { id: 'move', label: '입지 변경', summary: '새 입지를 찾아봐요.' },
  ].map((choice) => ({ ...choice, time: ['즉시', 0], cost: ['', null], fx: { changes: [] } }));
  const decision = {
    ...base.cards[0], verdict: 'high',
    card: { ...card, id: 'decision', title: '입지 점검', decisionTask: '입지를 유지할지 정하기', stage: '계약 전', base: 'high', consequence: '신고가 지연될 수 있어요.', options },
  };
  const routine = { ...base.cards[0], card: { ...card, id: 'routine', stage: '운영 중' } };
  const permit = { ...base.cards[0], card: { ...card, id: 'permit', stage: '개업 전' } };
  const data = { ...base, cards: [routine, decision, permit], counts: { ...base.counts, high: 1, ok: 2 }, firstByVerdict: { ok: 'routine', high: 'decision' } };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(render(ReportView, { data }));
    const stages = page.getByRole('region', { name: /^(계약 전|개업 전|운영 중)$/ });
    await expect(stages.getByRole('heading', { name: /^(계약 전|개업 전|운영 중)$/ })).toHaveText(['계약 전', '개업 전', '운영 중']);
    for (const model of data.cards) {
      const item = page.getByRole('region', { name: model.card.stage, exact: true }).locator(`#result-${model.card.id}`);
      await expect(item).toHaveCount(1);
      await expect(item.locator('summary')).not.toContainText(model.card.stage);
    }
    const result = page.locator('#result-decision');
    await result.locator('summary').click();
    await expect(result.getByText('미조치 시', { exact: true })).toHaveCount(0);
    await expect(result.getByText(decision.card.consequence, { exact: true })).toHaveCount(0);
    await expect(result.getByRole('heading', { name: '선택지', exact: true })).toHaveCount(0);
    await expect(result.getByText(decision.card.reason, { exact: true })).toBeVisible();
    const picker = result.getByRole('button', { name: '선택하기', exact: true });
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAccessibleDescription(decision.card.decisionTask);
    await expect(picker).toHaveAttribute('data-id', decision.card.id);
    await expect(picker).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(result.locator('[data-nx="opt"]')).toHaveCount(0);
    for (const option of options) await expect(result.getByText(option.label, { exact: true })).toHaveCount(0);
    await expect(result.locator('[data-nx="evid"][data-id="decision"]')).toBeVisible();
    await expect(page.locator('#result-routine [data-nx="options"], #result-routine [data-nx="optionresult"]')).toHaveCount(0);

    await page.setContent(render(ReportChoiceDialog, { card: decision.card }));
    await expect(page.getByRole('heading', { name: decision.card.decisionTask })).toBeVisible();
    const choices = page.locator('[data-nx="opt"][data-id="decision"]');
    assert.deepEqual(await choices.evaluateAll((buttons) => buttons.map((button) => button.dataset.o)), options.map((option) => option.id));
    for (const option of options) {
      const choice = choices.filter({ hasText: option.label });
      await expect(choice).toBeVisible();
      await expect(choice).toContainText(option.summary);
    }

    const legacyDecision = { ...decision, open: true, card: { ...decision.card, decisionTask: undefined } };
    await page.setContent(render(ReportView, { data: { ...data, cards: [legacyDecision] } }));
    await expect(picker).toHaveAccessibleDescription(/\S/);

    const filtered = { ...data, filter: '운영 중', cards: [routine], firstByVerdict: { ok: 'routine' } };
    await page.setContent(render(ReportView, { data: filtered }));
    await expect(stages).toHaveCount(1);
    await expect(page.getByRole('region', { name: '운영 중', exact: true }).locator('#result-routine')).toHaveCount(1);
    await expect(page.getByRole('region', { name: '전체 점검 항목' })).toContainText('3건');
  } finally { await browser.close(); }
});

await test('explicit loading and error states do not render stale supplied data', () => {
  const { DashboardView } = load('@/components/dashboard/DashboardView');
  const loading = render(DashboardView, { data: cases[0].data, loading: true });
  assert.ok(loading.includes('data-skeleton='));
  assert.ok(!loading.includes('API 가게'));
  const failed = render(DashboardView, { data: cases[0].data, error: 'API 연결을 다시 확인해 주세요.', onRetry() {} });
  assert.ok(failed.includes('role="alert"'));
  assert.ok(failed.includes('API 연결을 다시 확인해 주세요.'));
  assert.ok(failed.includes('다시 시도'));
  assert.ok(!failed.includes('API 가게'));
});

await test('client Promise rejection shows a safe error, retries, and ignores an obsolete request', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: browserBundle({
      React: 'react', ReactDOM: 'react-dom/client',
      boundary: '@/components/loading/DataBoundary', skeleton: '@/components/loading/SectionSkeleton',
    }) });
    await page.evaluate(() => {
      const { React, ReactDOM, boundary: { DataBoundary }, skeleton: { SectionSkeleton } } = window.contractModules;
      window.uncaught = [];
      window.retryCount = 0;
      const root = ReactDOM.createRoot(document.getElementById('root'), {
        onCaughtError() {},
        onUncaughtError(error) { window.uncaught.push(error.message); },
      });
      window.draw = (data, loading = false) => root.render(React.createElement(DataBoundary, {
        data, loading,
        fallback: React.createElement(SectionSkeleton, { label: 'API 테스트 로딩' }),
        onRetry() { window.retryCount++; window.draw(Promise.resolve({ message: '재시도 완료' })); },
      }, (value) => React.createElement('p', { id: 'result' }, value.message)));
      window.start = () => {
        const promise = new Promise((resolve, reject) => { window.resolveData = resolve; window.rejectData = reject; });
        window.draw(promise);
      };
      window.start();
    });
    await expect(page.getByRole('status', { name: 'API 테스트 로딩' })).toBeVisible();
    await page.evaluate(() => window.rejectData(new Error('private internal credential detail')));
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('private internal credential detail');
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.locator('#result')).toHaveText('재시도 완료');
    assert.equal(await page.evaluate(() => window.retryCount), 1);
    await page.evaluate(() => window.start());
    await expect(page.getByRole('status', { name: 'API 테스트 로딩' })).toBeVisible();
    await page.evaluate(() => window.rejectData(new Error('second API failure')));
    await expect(page.getByRole('alert')).toBeVisible();
    await page.evaluate(() => window.draw(undefined, true));
    await expect(page.getByRole('status', { name: 'API 테스트 로딩' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.evaluate(() => window.draw({ message: '새 요청 완료' }));
    await expect(page.locator('#result')).toHaveText('새 요청 완료');
    await page.evaluate(() => { window.start(); window.resolveOld = window.resolveData; });
    await expect(page.getByRole('status', { name: 'API 테스트 로딩' })).toBeVisible();
    await page.evaluate(() => window.start());
    await page.evaluate(() => window.resolveOld({ message: '오래된 응답' }));
    await expect(page.getByRole('status', { name: 'API 테스트 로딩' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('오래된 응답');
    await page.evaluate(() => window.resolveData({ message: '최신 응답' }));
    await expect(page.locator('#result')).toHaveText('최신 응답');
    assert.deepEqual(await page.evaluate(() => window.uncaught), []);
  } finally { await browser.close(); }
});

await test('a saved value and its refresh supersede stale API reads without waiting for them', async () => {
  const { createResourceCache } = load('@/lib/api/resource-cache');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = () => new Promise((resolve) => {
    requests.push(value => resolve(Response.json(value)));
  });
  try {
    const cache = createResourceCache({ token: 'cache-test', storeId: 'test-store', kind: 'account' });
    const oldRead = cache.ensure('grants');
    assert.equal(cache.ensure('grants'), oldRead);
    await Promise.resolve();
    cache.invalidate(['grants']);
    const newRead = cache.ensure('grants');
    await Promise.resolve();
    assert.equal(requests.length, 2);
    requests[1]({ status: 'ready' });
    await newRead;
    requests[0]({ status: 'empty' });
    await oldRead;
    assert.equal(cache.getSnapshot().bundle.grants.status, 'ready');

    cache.invalidate(['grants']);
    const preSave = cache.ensure('grants');
    await Promise.resolve();
    cache.set('grants', { status: 'saved' });
    requests[2]({ status: 'empty' });
    await preSave;
    assert.equal(cache.getSnapshot().bundle.grants.status, 'saved');

    cache.invalidate(['grants']);
    cache.set('grants', { status: 'projected' }, true);
    assert.equal(cache.isStale('grants'), true);
    assert.equal(cache.getSnapshot().bundle.grants.status, 'projected');
    const canonical = cache.ensure('grants');
    await Promise.resolve();
    requests[3]({ status: 'canonical' });
    await canonical;
    assert.equal(cache.getSnapshot().bundle.grants.status, 'canonical');
    assert.equal(cache.isStale('grants'), false);
  } finally { globalThis.fetch = originalFetch; }
});

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
