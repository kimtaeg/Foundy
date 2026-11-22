// 분석 단계 상태와 리포트에서 표시하는 판정 및 근거를 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { AnalysisStep } = load('@/components/onboarding/AnalysisStep');
const { ReportView } = load('@/components/report/ReportView');
const { EvidenceItem } = load('@/components/report/EvidenceItem');
const { finishedIndexes, stepNote, ANALYSIS_STEP_COUNT } = load('@/lib/api/run-stream');
const { STEPS_DECIDED } = load('@/data/onboarding');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };
const all = Array.from({ length: ANALYSIS_STEP_COUNT }, (_, i) => i);

test('서버 분석: 정상 단계는 "완료", 조문 조회도 실제 상태대로 "완료"로 나오고 고정 문구는 없다', () => {
  const html = render(AnalysisStep, { storeName: 'sh cafe', steps: STEPS_DECIDED, completed: all, notes: {} });
  assert.ok(!html.includes('저장된 조문으로 대체') && !html.includes('(fallback)'), '고정 fallback 문구는 없다');
  assert.ok(!html.includes('시뮬레이션'), '서버 분석에는 시뮬레이션 배지가 없다');
  assert.equal((html.match(/완료<\/span>|>완료</g) || []).length >= 9, true);
  assert.match(html, /9\/9단계 처리/);
  assert.match(html, /첫 점검이 완료됐어요/);
});

test('서버 분석: 예시·캐시로 대체되거나 실패한 단계를 숨기지 않고 그 단계에 표시한다', () => {
  const notes = { 1: '캐시·예시 건축물 자료 사용', 2: '비슷한 상표 2건 · 예시 자료', 3: '조회 실패' };
  const html = render(AnalysisStep, { storeName: 'sh cafe', steps: STEPS_DECIDED, completed: all, notes });
  for (const text of Object.values(notes)) assert.ok(html.includes(text), text);
  assert.match(html, /첫 점검이 완료됐어요/);
});

test('분석 중에는 현재 행과 완료 수를 표시하고 홈 버튼을 비활성화한다', () => {
  const html = render(AnalysisStep, { storeName: 'x', steps: STEPS_DECIDED, completed: [0, 1] });
  assert.match(html, /2\/9단계 처리/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /data-nx="finish" disabled=""/);
});

test('서버 단계 상태 → 표시 문구 (done 은 문구 없음, fallback·failed·skipped 는 그대로)', () => {
  assert.equal(stepNote('law', 'done', '조문 조회 완료'), null);
  assert.deepEqual(stepNote('building', 'fallback', '캐시·예시 건축물 자료 사용'), { index: 1, note: '캐시·예시 건축물 자료 사용' });
  assert.deepEqual(stepNote('trademark', 'fallback', '비슷한 상표 2건 · 예시 자료'), { index: 2, note: '비슷한 상표 2건 · 예시 자료' });
  assert.deepEqual(stepNote('trademark', 'fallback', '비슷한 상표 2건'), { index: 2, note: '비슷한 상표 2건' }, '서버 사유를 유지한다');
  assert.deepEqual(stepNote('law', 'failed', '조문을 조회하지 못해 확인이 필요해요'), { index: 3, note: '조문을 조회하지 못해 확인이 필요해요' });
  assert.deepEqual(stepNote('grants', 'skipped'), { index: 8, note: '건너뜀' });
  assert.deepEqual(stepNote('trademark', 'fallback'), { index: 2, note: '대체 방식으로 처리했어요' });
  assert.equal(stepNote('unknown-step', 'fallback'), null);
  assert.deepEqual(finishedIndexes('law', 'fallback'), [0, 1, 2, 3]);
});

const card = { id: 'r-01', check: 'building_use', stage: '계약 전', base: 'ok', by: 'ai', title: '건물 용도', reason: '', consequence: '', options: [], rec: null, action: null };
const report = {
  locked: false, filter: 'all', counts: { high: 0, low: 0, unknown: 0, ok: 1 }, firstByVerdict: { ok: 'r-01' },
  cards: [{ card, state: {}, verdict: 'ok', action: null, nextSteps: [], shortTitle: '건물 용도', open: false, followUpPending: false, statusLabel: '' }],
};

test('리포트에는 시기와 판정이 표시되고 제거한 예시 배지는 나오지 않는다', () => {
  const html = render(ReportView, { data: report });
  assert.match(html, /aria-label="계약 전"/);
  assert.match(html, /건물 용도/);
  assert.match(html, /문제 없음/);
  assert.doesNotMatch(html, /실제 조회 결과|예시 자료 기준이에요|예시 데이터 · 실제 조회 아님/);
});

test('판정 근거에는 제공된 자료와 공식 출처가 표시된다', () => {
  const html = render(EvidenceItem, { item: { kind: 'law', source: '식품위생법 제41조', value: '영업 전에 교육이 필요합니다.', url: 'https://www.law.go.kr/' }, date: '2026-11-22' });
  assert.match(html, /식품위생법 제41조/);
  assert.match(html, /영업 전에 교육이 필요합니다/);
  assert.match(html, /href="https:\/\/www\.law\.go\.kr\/"/);
  assert.match(html, /2026-11-22/);
});

console.log(`${results.length} passed`);
