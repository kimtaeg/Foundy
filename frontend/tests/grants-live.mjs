// 지원사업 서버 연결: 실제 공고 응답을 화면 데이터로 바꾸고, 예시·불러오는 중·실패를 숨기지 않고 표시하는지 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { readGrants } = load('@/lib/grants/read-grants');
const { GrantDetails } = load('@/components/grants/GrantDetails');
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
  const [grant] = readGrants(response(), false).catalog;
  assert.equal(grant.url, item().url);
  assert.equal(grant.org, '한국생산성본부');
  assert.deepEqual(grant.checks[0], ['만 39세 이하', 'pass', '“만 20세~39세 이하 청년 대표자” · 만 나이가 28세라 해당돼요']);
  assert.equal(grant.checks[1][2], '공고문과 가게 정보만으로는 확실하지 않아요');
});

test('실제 계정의 목록은 예시 공고를 제외하고 미리보기 계정은 유지한다', () => {
  const example = item({ grant_id: 'example', title: '비교용 (예시 공고)', source: 'K-Startup 사업공고 · 예시' });
  assert.deepEqual(readGrants(response({ items: [item(), example] }), false).catalog.map(grant => grant.id), [item().grant_id]);
  assert.equal(readGrants(response({ items: [item(), example] }), true).catalog.length, 2);
  const exampleOnly = readGrants(response({ is_example: true, items: [example] }), false);
  assert.equal(exampleOnly.status, 'empty');
  assert.equal(exampleOnly.excludedCount, 0);
  assert.equal(exampleOnly.sourceLabel, undefined);
  assert.equal(readGrants(response({ status: 'unavailable', error: '조회 실패', items: [] }), false).status, 'unavailable');
});

test('실제 공고는 기관과 카드 내용을 보여 주며 상세에는 조건별 인용과 원문 링크가 있다', () => {
  const model = readGrants(response(), false);
  const result = { label: '일부 확인 필요', tone: 'low' };
  const grants = model.catalog.map((grant) => ({ grant, ...result, deadline: 'D-8' }));
  const html = renderToStaticMarkup(React.createElement(GrantsView, { data: {
    filters: { res: 'all', cat: 'all' }, categories: ['all'], grants,
    sourceLabel: model.sourceLabel, status: model.status } }));
  assert.match(html, /K-Startup 사업공고/);
  assert.match(html, /청년 소상공인 컨설팅 지원 사업/);
  assert.match(html, /한국생산성본부/);
  assert.doesNotMatch(html, /예시 공고/);
  const details = renderToStaticMarkup(React.createElement(GrantDetails, { ...grants[0], result }));
  assert.match(details, /만 20세~39세 이하 청년 대표자/);
  assert.match(details, /공고 원문 보기/);
  assert.match(details, /pbancSn=179630/);
});

test('공고 링크는 HTTP(S) 주소인 경우만 노출한다', () => {
  const invalid = item({ url: 'javascript:alert(1)' });
  const [grant] = readGrants(response({ items: [invalid] }), false).catalog;
  assert.equal(grant.url, undefined);
});

console.log(`${results.length} passed`);
