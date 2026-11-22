// 임대료 비교 카드 (#181): 실제 통계·예시·입력 필요·불러오기 실패 표시와 비교 기준·출처 표기.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { RentComparisonCard } = load('@/components/sites/RentComparisonCard');
const { rentDiffText } = load('@/lib/market/rent');
const render = (props) => renderToStaticMarkup(React.createElement(RentComparisonCard, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };

// 서버 응답 형식 (services/rent.py view)
const ready = (over = {}) => ({
  status: 'ready', is_example: false, message: null, reason: null, missing: [],
  inputs: { monthly_rent_krw: 2500000, deposit_krw: 30000000, area_sqm: 40, area_source: 'store', floor: '1', underground: false },
  average: { area_name: '서울>기타>뚝섬', level: '상권', krw_per_sqm: 67381, conversion_rate_pct: 6.47, period: '2026년 3분기', building_type: '소규모 상가', source: '한국부동산원 상업용부동산 임대동향조사' },
  comparison: { converted_monthly_krw: 2661750, deposit_monthly_krw: 161750, mine_krw_per_sqm: 66544, average_krw_per_sqm: 67381, diff_pct: -1.2, level: 'similar' },
  basis: { rent: '월세 + 보증금 × 전환율 6.47% ÷ 12', area: '임대가능면적(전용+공용) 기준', floor: '1층 기준' },
  notes: ['마이페이지의 영업장 면적으로 계산했어요.'],
  ...over,
});
const source = () => Promise.resolve(ready());

test('실제 통계: 차이 문장·두 값·비교 기준·출처·기준 분기를 표시하고 예시 배지는 없다', () => {
  const html = render({ source, initial: ready() });
  for (const text of ['상권 평균과 비슷해요 (-1.2%)', '66,544원/㎡', '67,381원/㎡', '뚝섬 소규모 상가 평균',
    '월세 + 보증금 × 전환율 6.47% ÷ 12', '임대가능면적(전용+공용) 기준', '1층 기준',
    '한국부동산원 상업용부동산 임대동향조사', '2026년 3분기', '마이페이지의 영업장 면적으로 계산했어요.'])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes('예시 · 실제 통계 아님'));
});

test('예시 계정 응답에는 예시 배지를 붙인다', () => {
  assert.ok(render({ source, initial: ready({ is_example: true }) }).includes('예시 · 실제 통계 아님'));
});

test('통계를 못 불러오면 평균·비교 없이 안내만 한다 (지어낸 평균 없음)', () => {
  const html = render({ source, initial: ready({ status: 'unavailable', message: '임대료 통계를 아직 불러올 수 없어요', average: null, comparison: null }) });
  assert.ok(html.includes('임대료 통계를 아직 불러올 수 없어요'));
  assert.ok(!html.includes('원/㎡') && !html.includes('평균보다') && !html.includes('67,381원'));
});

test('서버 연결이 없으면(조회 함수 없음) 안내만 하고 비교 버튼을 막는다', () => {
  const html = render({});
  assert.ok(html.includes('임대료 통계를 아직 불러올 수 없어요'));
  assert.match(html, /<button[^>]*disabled/);
});

test('입력 전: 평균만 보여 주고 면적이 없으면 입력을 안내한다', () => {
  const html = render({ source, initial: ready({ status: 'need_input', missing: ['monthly_rent', 'area'], comparison: null, notes: [] }) });
  assert.ok(html.includes('67,381원') && html.includes('영업장 면적이 없어요'));
  assert.ok(!html.includes('내 ㎡당 환산 월세'));
});

test('차이 문장: 높음·낮음·권역/시도 대체', () => {
  assert.equal(rentDiffText(ready({ comparison: { ...ready().comparison, diff_pct: 17.9, level: 'high' } })), '상권 평균보다 17.9% 높아요');
  assert.equal(rentDiffText(ready({ comparison: { ...ready().comparison, diff_pct: -20, level: 'low' } })), '상권 평균보다 20% 낮아요');
  assert.equal(rentDiffText(ready({ average: { ...ready().average, level: '시도' }, comparison: { ...ready().comparison, diff_pct: 26, level: 'high' } })), '시도 평균보다 26% 높아요');
  assert.equal(rentDiffText(ready({ comparison: null })), null);
});

console.log(`${results.length} passed`);
