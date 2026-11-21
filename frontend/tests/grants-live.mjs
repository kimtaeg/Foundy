// 지원사업 서버 연결: 실제 공고 응답을 화면 데이터로 바꾸고, 예시·불러오는 중·실패를 숨기지 않고 표시하는지 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { grantsModel, toGrant } = load('@/lib/api/grants');
const { grantBadge, grantNote } = load('@/lib/grants/grant-status');
const { GrantsView } = load('@/components/grants/GrantsView');
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };

const item = (over = {}) => ({
  grant_id: 'kstartup-179630', title: '[은행연합회] 청년 소상공인 컨설팅 지원 사업', source: 'K-Startup 사업공고',
  url: 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179630', org: '한국생산성본부',
  category: '멘토링ㆍ컨설팅ㆍ교육', region: '전국', deadline: '2026-11-30', result: 'partial',
  checks: [
    { condition: '만 39세 이하', result: 'pass', note: '만 나이가 28세라 해당돼요', evidence: { text: '만 20세~39세 이하 청년 대표자' } },
    { condition: '매출 1억원 이하', result: 'unknown', note: '공고문과 가게 정보만으로는 확실하지 않아요', evidence: null },
  ],
  summary: { who: '청년 소상공인', how_much: '맞춤형 경영 컨설팅', until: '2026-11-30', what_to_submit: [] },
  ...over,
});
const response = (over = {}) => ({ status: 'ready', error: null, source: 'K-Startup 사업공고', is_example: false,
  judged_at: '2026-11-22T15:00:00+09:00', excluded_count: 5, items: [item()], ...over });

test('실제 공고: 인용과 판단 이유를 조건마다 보여 주고 원문 링크를 남긴다', () => {
  const grant = toGrant(item());
  assert.equal(grant.example, false);
  assert.equal(grant.url, item().url);
  assert.equal(grant.org, '한국생산성본부');
  assert.deepEqual(grant.checks[0], ['만 39세 이하', 'pass', '“만 20세~39세 이하 청년 대표자” · 만 나이가 28세라 해당돼요']);
  assert.equal(grant.checks[1][2], '공고문과 가게 정보만으로는 확실하지 않아요');
});

test('배지: 실제 공고·불러오는 중·실패·예시를 구분한다', () => {
  assert.match(grantBadge(grantsModel(response()).GRANT_STATUS).label, /실제 공고/);
  assert.match(grantBadge(grantsModel(response(), true).GRANT_STATUS).label, /불러오는 중/);
  assert.match(grantBadge(grantsModel(null).GRANT_STATUS).label, /불러오지 못함/);
  assert.match(grantBadge(grantsModel(response({ is_example: true })).GRANT_STATUS).label, /예시/);
  assert.match(grantBadge(null).label, /예시/);
});

test('화면: 실제 공고는 예시 배지 없이 그리고 대조한 날짜를 알린다', () => {
  const model = grantsModel(response());
  const grants = model.GRANTS.map((grant) => ({ grant, label: '일부 확인 필요', tone: 'low', deadline: 'D-8' }));
  const html = renderToStaticMarkup(React.createElement(GrantsView, { data: {
    filters: { res: 'all', cat: 'all', sort: 'deadline', view: 'card' }, categories: ['all'], grants,
    months: [], excludedCount: 5, status: model.GRANT_STATUS } }));
  assert.match(html, /실제 공고 · K-Startup 사업공고/);
  assert.match(html, /2026-11-22에 모집 중인 공고를 대조했어요/);
  assert.doesNotMatch(html, /예시 공고/);
  assert.equal(grantNote(model.GRANT_STATUS), '2026-11-22에 모집 중인 공고를 대조했어요.');
});

console.log(`${results.length} passed`);
