// 분석 진행 화면과 점검 리포트가 서버의 실제 상태를 숨기지 않고 보여 주는지 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { AnalysisStep } = load('@/components/onboarding/AnalysisStep');
const { ReportView } = load('@/components/report/ReportView');
const { finishedIndexes, stepNote, ANALYSIS_STEP_COUNT } = load('@/lib/api/run-stream');
const { STEPS_DECIDED } = load('@/data/onboarding');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };
const all = Array.from({ length: ANALYSIS_STEP_COUNT }, (_, i) => i);

test('서버 분석: 정상 단계는 "완료", 조문 조회도 실제 상태대로 "완료"로 나오고 고정 문구는 없다', () => {
  const html = render(AnalysisStep, { storeName: 'sh cafe', steps: STEPS_DECIDED, completed: all, server: true, notes: {} });
  assert.ok(!html.includes('저장된 조문으로 대체') && !html.includes('(fallback)'), '고정 fallback 문구는 없다');
  assert.ok(!html.includes('시뮬레이션'), '서버 분석에는 시뮬레이션 배지가 없다');
  assert.equal((html.match(/완료<\/span>|>완료</g) || []).length >= 9, true);
  assert.ok(html.includes('서버가 알려 주는 실제 진행'));
});

test('서버 분석: 예시·캐시로 대체되거나 실패한 단계를 숨기지 않고 그 단계에 표시한다', () => {
  const notes = { 1: '캐시·예시 건축물 자료 사용', 2: '비슷한 상표 2건 · 예시 자료', 3: '조회 실패' };
  const html = render(AnalysisStep, { storeName: 'sh cafe', steps: STEPS_DECIDED, completed: all, server: true, notes });
  for (const text of Object.values(notes)) assert.ok(html.includes(text), text);
  assert.ok(html.includes('예시·캐시 자료를 썼거나 조회하지 못했어요'), '끝난 뒤 요약 안내');
  const clean = render(AnalysisStep, { storeName: 'x', steps: STEPS_DECIDED, completed: all, server: true, notes: {} });
  assert.ok(!clean.includes('예시·캐시 자료를 썼거나'), '대체가 없으면 안내도 없다');
});

test('로컬 시뮬레이션: 배지와 안내를 유지하되 단계를 임의로 fallback 으로 꾸미지 않는다', () => {
  const html = render(AnalysisStep, { storeName: 'x', steps: STEPS_DECIDED, completed: all });
  assert.ok(html.includes('시뮬레이션') && html.includes('SSE') && !html.includes('(fallback)'));
});

test('서버 단계 상태 → 표시 문구 (done 은 문구 없음, fallback·failed·skipped 는 그대로)', () => {
  assert.equal(stepNote('law', 'done', '조문 조회 완료'), null);
  assert.deepEqual(stepNote('building', 'fallback', '캐시·예시 건축물 자료 사용'), { index: 1, note: '캐시·예시 건축물 자료 사용' });
  assert.deepEqual(stepNote('trademark', 'fallback', '비슷한 상표 2건 · 예시 자료'), { index: 2, note: '비슷한 상표 2건 · 예시 자료' });
  assert.deepEqual(stepNote('trademark', 'fallback', '비슷한 상표 2건'), { index: 2, note: '예시·캐시 자료로 대체' }, '출처를 모르는 메시지는 일반 문구로');
  assert.deepEqual(stepNote('law', 'failed', '조문을 조회하지 못해 확인이 필요해요'), { index: 3, note: '조문을 조회하지 못해 확인이 필요해요' });
  assert.deepEqual(stepNote('grants', 'skipped'), { index: 8, note: '건너뜀' });
  assert.equal(stepNote('unknown-step', 'fallback'), null);
  assert.deepEqual(finishedIndexes('law', 'fallback'), [0, 1, 2, 3]);
});

const card = { id: 'r-01', check: 'building_use', stage: '계약 전', base: 'ok', by: 'ai', title: '건물 용도', reason: '', consequence: '', options: [], rec: null, action: null };
const report = (over = {}) => ({ obligations: [], live: true, exampleItems: [], locked: false, filter: 'all', counts: { high: 0, low: 0, unknown: 0, ok: 1 }, firstByVerdict: { ok: 'r-01' },
  cards: [{ card, state: {}, verdict: 'ok', action: null, nextSteps: [], shortTitle: '건물 용도', open: false, followUpPending: false, statusLabel: '' }], ...over });

test('점검 리포트: 예시 자료로 판정한 항목이 있으면 "예시 자료 기준"이라고 항목과 함께 알린다', () => {
  const html = render(ReportView, { data: report({ exampleItems: ['이 건물에서 일반음식점 신고가 가능해요', '상표가 겹치지 않아요'] }) });
  assert.ok(html.includes('예시 자료 기준이에요') && html.includes('이 건물에서 일반음식점 신고가 가능해요') && html.includes('상표가 겹치지 않아요'));
});

test('점검 리포트: 실제 자료로만 판정했으면 예시 안내가 없다', () => {
  assert.ok(!render(ReportView, { data: report() }).includes('예시 자료 기준이에요'));
  assert.ok(!render(ReportView, { data: { ...report(), exampleItems: undefined } }).includes('예시 자료 기준이에요'), '값이 없어도 깨지지 않는다');
});

test('리포트 배지: 실제 조회 · 일부 예시 · 로컬 예시를 구분해 표시한다', () => {
  assert.ok(render(ReportView, { data: report() }).includes('실제 조회 결과'));
  assert.ok(!render(ReportView, { data: report() }).includes('예시 데이터 · 실제 조회 아님'), '서버 실제 결과에 "실제 조회 아님"을 붙이지 않는다');
  assert.ok(render(ReportView, { data: report({ exampleItems: ['건물 용도'] }) }).includes('일부 예시 자료 (1개 항목)'));
  const demo = render(ReportView, { data: report({ live: false }) });
  assert.ok(demo.includes('예시 데이터 · 실제 조회 아님') && !demo.includes('실제 조회 결과'), '로컬 예시 화면은 기존 문구');
});

console.log(`${results.length} passed`);
