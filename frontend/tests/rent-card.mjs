// 주변 상가 임대료 분석 카드 (#186): 백엔드와 합의한 응답 계약(예시 1~4)으로 상태별 화면과 만원 변환을 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { RentComparisonCard } = load('@/components/sites/RentComparisonCard');
const { toManwon, manwonInputToKrw, perPyeongManwon, rentDiffShort, rentDiffText, rentScopeName } = load('@/lib/market/rent');
const { manwonText } = load('@/lib/format');
const render = (props) => renderToStaticMarkup(React.createElement(RentComparisonCard, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };
const has = (html, ...texts) => { for (const text of texts) assert.ok(html.includes(text), `없음: ${text}`); };
const lacks = (html, ...texts) => { for (const text of texts) assert.ok(!html.includes(text), `있으면 안 됨: ${text}`); };

const CHECK = '계약 전 확인: 관리비 별도 여부, 권리금(통계에 포함되지 않음), 계약서 임대면적이 전용+공용 기준인지';
const SOURCE = { name: '한국부동산원 상업용부동산 임대동향조사', period: '2026년 3분기', conversion_rate_pct: 6.47 };
const AVERAGE = { area_name: '서울>기타>뚝섬', level: '상권', krw_per_sqm: 67381, conversion_rate_pct: 6.47, period: '2026년 3분기', building_type: '소규모 상가', source: '한국부동산원 상업용부동산 임대동향조사' };
const BASIS = { rent: '월세 + 보증금 × 전환율 6.47% ÷ 12', area: '임대가능면적(전용+공용) 기준', floor: '1층 기준' };

// 예시 1: ready (1층 가게, 면적 입력)
const ready1 = (over = {}) => ({
  status: 'ready', is_example: false, message: null, reason: null, missing: [],
  inputs: { monthly_rent_krw: 2500000, deposit_krw: 30000000, area_sqm: 40, area_source: 'query', floor: '1', underground: false },
  headline: { area_name: '서울>기타>뚝섬', area_level: '상권', building_type: '소규모 상가', floor_label: '1층', krw_per_sqm: 67381, monthly_for_my_area_krw: 2695240, statistic: '평균(면적 가중)' },
  comparison: { converted_monthly_krw: 2661750, deposit_monthly_krw: 161750, mine_krw_per_sqm: 66544, average_krw_per_sqm: 67381, diff_pct: -1.2, level: 'similar', compared_floor: '1층' },
  rows: [
    { label: '뚝섬 1층', krw_per_sqm: 67381, monthly_for_my_area_krw: 2695240, is_my_floor: true },
    { label: '뚝섬 2층', krw_per_sqm: 33300, monthly_for_my_area_krw: 1332000, is_my_floor: false },
    { label: '뚝섬 지하1층', krw_per_sqm: 37800, monthly_for_my_area_krw: 1512000, is_my_floor: false },
    { label: '서울 1층 평균', krw_per_sqm: 53081, monthly_for_my_area_krw: 2123240, is_my_floor: false },
  ],
  readings: ['상권 1층 평균과 비슷해요 (-1.2%). 통계는 실제 계약가가 아니라 조사된 시장임대료 추정치예요.', CHECK],
  notes: [], basis: BASIS, source: SOURCE, average: AVERAGE,
  ...over,
});
// 예시 2: ready (2층 가게 → 2층 통계와 비교)
const ready2 = () => {
  const base = ready1();
  return {
    ...base,
    inputs: { ...base.inputs, floor: '2' },
    headline: { ...base.headline, floor_label: '2층', krw_per_sqm: 33300, monthly_for_my_area_krw: 1332000 },
    comparison: { ...base.comparison, average_krw_per_sqm: 33300, diff_pct: 99.8, level: 'high', compared_floor: '2층' },
    rows: base.rows.map((row) => ({ ...row, is_my_floor: row.label === '뚝섬 2층' })),
    readings: ['상권 2층 평균보다 99.8% 높아요. 통계는 실제 계약가가 아니라 조사된 시장임대료 추정치예요.', CHECK],
    basis: { ...BASIS, floor: '2층 기준' },
  };
};
// 예시 3: need_input (면적 없음)
const needArea = () => ({
  ...ready1(), status: 'need_input', missing: ['area'], comparison: null,
  inputs: { monthly_rent_krw: 2500000, deposit_krw: 0, area_sqm: null, area_source: null, floor: '1', underground: false },
  headline: { ...ready1().headline, monthly_for_my_area_krw: null },
  rows: ready1().rows.map((row) => ({ ...row, monthly_for_my_area_krw: null })),
  readings: [CHECK],
});
// 예시 4: unavailable
const unavailable = () => ({
  status: 'unavailable', is_example: false, message: '임대료 통계를 아직 불러올 수 없어요', reason: '임대료 통계 서비스 인증에 실패했어요', missing: [],
  inputs: { monthly_rent_krw: 2500000, deposit_krw: 30000000, area_sqm: 40, area_source: 'query', floor: '1', underground: false },
  headline: null, comparison: null, rows: null, readings: [], notes: [],
  basis: { rent: '월세 + 보증금 환산(전환율)', area: '임대가능면적(전용+공용) 기준', floor: '1층 기준' },
  source: null, average: null,
});
const source = () => Promise.resolve(ready1());
const myFloorRow = (html) => html.match(/<tr aria-current="true"[^>]*>(.*?)<\/tr>/)?.[1] ?? '';

test('ready 1층: 제목·부제·큰 숫자·결과 카드 2개·비교표·읽는 법·출처', () => {
  const html = render({ source, initial: ready1() });
  has(html, '주변 상가 임대료 분석', '뚝섬 상권 · 소규모 상가 · 1층 평균 (보증금 환산 포함)',
    '약 270만 원/월', '내 면적 40㎡ 기준 (67,381원/㎡)',
    '내 환산 월세', '266만 원', '월세 250만 + 보증금 환산 16만', '평균 대비', '-1.2% · 비슷해요',
    '같은 상권 비교 (2026년 3분기)', '내 면적(40㎡)이면', '서울 1층 평균', '약 133만 원', '약 212만 원',
    '이 숫자 읽는 법', '상권 1층 평균과 비슷해요 (-1.2%)', CHECK,
    '한국부동산원 상업용부동산 임대동향조사 · 2026년 3분기 · 소규모 상가 · 비교 기준: 월세 + 보증금 × 전환율 6.47% ÷ 12 · 임대가능면적(전용+공용) 기준 · 1층 기준');
  assert.ok(myFloorRow(html).includes('뚝섬 1층') && myFloorRow(html).includes('◀ 내 층'));
  assert.equal(html.match(/◀ 내 층/g).length, 1);
  lacks(html, '중앙값', '예시 · 실제 통계 아님', '임대면적을 넣으면 월 금액으로');
});

test('ready 2층: 2층 행을 내 층으로 강조하고 2층 평균 대비 높음을 보여 준다', () => {
  const html = render({ source, initial: ready2() });
  has(html, '뚝섬 상권 · 소규모 상가 · 2층 평균', '약 133만 원/월', '(33,300원/㎡)', '+99.8% · 높아요', '2층 기준');
  assert.ok(myFloorRow(html).includes('뚝섬 2층'));
  assert.ok(!myFloorRow(html).includes('뚝섬 1층'));
});

test('need_input(면적 없음): ㎡당·3.3㎡당 값과 면적 안내, 결과 카드 숨김, 표 셋째 열은 —', () => {
  const html = render({ source, initial: needArea() });
  has(html, '67,381원/㎡ · 3.3㎡당 약 22.3만 원', '임대면적을 넣으면 월 금액으로 보여 줘요',
    '임대면적을 넣거나 마이페이지에서 영업장 면적을 입력해 주세요', '같은 상권 비교', '내 면적이면', CHECK);
  lacks(html, '내 환산 월세', '평균 대비', '/월', '약 270만');
  assert.equal(html.match(/>—</g).length, 4);
});

test('unavailable: 안내 한 줄만, 숫자·표·출처 없음', () => {
  const html = render({ source, initial: unavailable() });
  has(html, '임대료 통계를 아직 불러올 수 없어요');
  lacks(html, '원/㎡', '만 원', '<table', '이 숫자 읽는 법', '한국부동산원', '평균 대비');
});

test('서버 연결 없음(조회 함수 없음): 같은 안내 + 비교 버튼 비활성', () => {
  const html = render({});
  has(html, '임대료 통계를 아직 불러올 수 없어요');
  assert.match(html, /<button[^>]*disabled/);
  lacks(html, '원/㎡');
});

test('예시 응답에만 "예시 · 실제 통계 아님" 배지', () => {
  has(render({ source, initial: ready1({ is_example: true }) }), '예시 · 실제 통계 아님');
  lacks(render({ source, initial: ready1() }), '예시 · 실제 통계 아님');
});

test('notes 는 읽는 법 아래 작은 글씨로 표시', () => {
  const note = '마이페이지의 영업장 면적으로 계산했어요. 통계는 전용+공용 면적 기준이라, 전용면적이면 실제보다 높게 나올 수 있어요. 계약서의 임대면적을 넣으면 더 정확해요.';
  const html = render({ source, initial: ready1({ notes: [note] }) });
  assert.ok(html.indexOf(note) > html.indexOf(CHECK));
});

test('옛 응답(headline·rows·readings·source 없음)도 평균·비교로 최소 표시', () => {
  const old = ready1();
  for (const key of ['headline', 'rows', 'readings', 'source']) delete old[key];
  delete old.comparison.compared_floor;
  const html = render({ source, initial: old });
  has(html, '뚝섬 상권 · 소규모 상가 · 1층 평균', '약 270만 원/월', '266만 원', '-1.2% · 비슷해요',
    '상권 1층 평균과 비슷해요 (-1.2%)', '한국부동산원 상업용부동산 임대동향조사 · 2026년 3분기');
  lacks(html, '<table');
});

test('만원 변환·표시', () => {
  assert.equal(toManwon(2695240), 270);
  assert.equal(toManwon(161750), 16);
  assert.equal(toManwon(2661750), 266);
  assert.equal(manwonInputToKrw('250'), 2500000);
  assert.equal(manwonInputToKrw(' '), undefined);
  assert.equal(perPyeongManwon(67381), 22.3);
  assert.equal(manwonText(270), '270만 원');
  assert.equal(manwonText(1270), '1,270만 원');
  assert.equal(manwonText(22.3), '22.3만 원');
});

test('범위 이름·차이 표시', () => {
  assert.equal(rentScopeName({ area_name: '서울>기타>뚝섬', area_level: '상권' }), '뚝섬 상권');
  assert.equal(rentScopeName({ area_name: '서울>도심', area_level: '권역' }), '도심 권역');
  assert.equal(rentScopeName({ area_name: '서울', area_level: '시도' }), '서울');
  assert.equal(rentDiffShort(ready2()), '+99.8% · 높아요');
  assert.equal(rentDiffShort(ready1({ comparison: { ...ready1().comparison, diff_pct: -20, level: 'low' } })), '-20% · 낮아요');
  assert.equal(rentDiffText(ready2()), '상권 2층 평균보다 99.8% 높아요');
  assert.equal(rentDiffShort(needArea()), null);
});

console.log(`${results.length} passed`);
