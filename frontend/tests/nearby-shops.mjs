// 상권 분석: 주소 → 좌표 후보, 카카오 장소 → 점포 변환, 실제/예시 점포 문구를 확인한다 (카카오 SDK 없이 순수 로직과 렌더링만).
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { addressCandidates, placeToShop, dedupeShops, subCategory, analyzeMarket } = load('@/lib/market');
const { MarketEmptyState } = load('@/components/sites/MarketEmptyState');
const { NearbyShopsCard } = load('@/components/sites/NearbyShopsCard');
const { MarketSummaryCard } = load('@/components/sites/MarketSummaryCard');
const { StrategyCard } = load('@/components/sites/StrategyCard');
const { MARKET_DEFAULT_CENTER, MARKET_DEMO_CENTER } = load('@/data/market');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };

test('주소 후보: 원문을 먼저 시도하고 층·괄호·자리표시 번지를 뗀 후보를 뒤에 둔다', () => {
  assert.deepEqual(addressCandidates('서울 강남구 테헤란로 152 3층'), [
    { query: '서울 강남구 테헤란로 152 3층', approximate: false },
    { query: '서울 강남구 테헤란로 152', approximate: false },
    { query: '서울 강남구 테헤란로', approximate: true },
  ]);
  assert.deepEqual(addressCandidates('서울 성동구 성수이로 113 (성수동2가)'), [
    { query: '서울 성동구 성수이로 113 (성수동2가)', approximate: false },
    { query: '서울 성동구 성수이로 113', approximate: false },
    { query: '서울 성동구 성수이로', approximate: true },
  ]);
});

test('주소 후보: 자리표시 번지(00)를 뗀 주소는 정확한 위치가 아니라고 표시한다', () => {
  const [first, second] = addressCandidates('서울특별시 성동구 성수이로 00');
  assert.deepEqual(first, { query: '서울특별시 성동구 성수이로 00', approximate: false });
  assert.deepEqual(second, { query: '서울특별시 성동구 성수이로', approximate: true });
  assert.deepEqual(addressCandidates('   '), []);
});

test('카카오 장소 → 점포: 실제 점포(ex=false)로 바꾸고 좌표·거리·분류·링크를 옮긴다', () => {
  const shop = placeToShop({ id: '123', place_name: '블루보틀 성수', category_name: '음식점 > 카페 > 커피전문점', x: '127.0561', y: '37.5480', distance: '42', place_url: 'http://place.map.kakao.com/123' });
  assert.deepEqual(shop, { id: 'kakao-123', name: '블루보틀 성수', dist: 42, lng: 127.0561, lat: 37.548, sub: '커피전문점', cat: '카페', ex: false, url: 'http://place.map.kakao.com/123' });
  assert.equal(placeToShop({ id: '9', place_name: '한식당', category_name: '음식점 > 한식 > 육류,고기', x: '127', y: '37' }).cat, '음식점');
  assert.equal(placeToShop({ id: '1', place_name: '좌표 없음', category_name: '음식점', x: '', y: 'x' }), null);
  assert.equal(subCategory('음식점 > 한식 > 육류,고기'), '육류,고기');
});

test('두 그룹(CE7·FD6)에서 같은 장소가 오면 한 번만 둔다', () => {
  const a = { id: 'kakao-1', name: 'a', dist: 1, lng: 0, lat: 0, sub: 's', cat: '카페', ex: false };
  assert.equal(dedupeShops([a, { ...a, cat: '음식점' }, { ...a, id: 'kakao-2' }]).length, 2);
});

test('분석: 지도 중심이 어디든 중심에서의 거리를 다시 계산해 반경으로 거른다', () => {
  const far = { id: 'x', name: '먼 점포', dist: 0, lng: MARKET_DEFAULT_CENTER.lng + 0.2, lat: MARKET_DEFAULT_CENTER.lat, sub: '카페', cat: '카페', ex: false };
  const near = { ...far, id: 'y', name: '가까운 점포', lng: MARKET_DEFAULT_CENTER.lng + 0.001 };
  const result = analyzeMarket([far, near], MARKET_DEFAULT_CENTER, 500, 'all');
  assert.deepEqual(result.nearby.map((shop) => shop.name), ['가까운 점포']);
  assert.notDeepEqual(MARKET_DEFAULT_CENTER, MARKET_DEMO_CENTER, '기본 중심은 성수역 예시 좌표가 아니다');
});

const real = (over = {}) => ({ example: false, status: 'ready', truncated: false, nearby: [], count: 0, density: null, franchiseCount: 0, franchisePercent: null, independentCount: 0, dessertCount: 0, composition: [], distanceRows: [], ...over });

test('실제 점포 분석에는 "예시" 문구가 없고, 예시 분석에는 있다', () => {
  const shop = { id: 'kakao-1', name: '실제 카페', dist: 30, lng: 127, lat: 37, sub: '커피전문점', cat: '카페', ex: false, url: 'http://place.map.kakao.com/1' };
  const liveHtml = render(NearbyShopsCard, { analysis: real({ nearby: [shop], count: 1 }), shops: [shop], selectedShop: shop, onSelect: () => {} });
  assert.ok(liveHtml.includes('주변 점포 1곳') && liveHtml.includes('실제 카페') && liveHtml.includes('카카오맵에서 보기'));
  assert.ok(!liveHtml.includes('예시'), '실제 점포에는 예시라고 쓰지 않는다');
  const demo = { ...shop, ex: true, url: undefined };
  const demoHtml = render(NearbyShopsCard, { analysis: real({ example: true, nearby: [demo], count: 1 }), shops: [demo], onSelect: () => {} });
  assert.ok(demoHtml.includes('주변 예시 점포 1곳') && demoHtml.includes('예시'));
  assert.ok(render(StrategyCard, { example: false }).includes('카카오 지도') && !render(StrategyCard, { example: false }).includes('성수역 예시'));
  assert.ok(render(StrategyCard, { example: true }).includes('성수역 예시'));
});

test('조회 상태별 빈 화면 안내 (불러오는 중 · 실패 · 결과 없음)', () => {
  assert.ok(render(MarketEmptyState, { status: 'loading' }).includes('불러오는 중'));
  assert.ok(render(MarketEmptyState, { status: 'error' }).includes('불러오지 못했어요'));
  assert.ok(render(MarketEmptyState, { status: 'ready' }).includes('찾지 못했어요'));
  assert.ok(render(MarketEmptyState, { example: true }).includes('성수역 주변 예시'));
});

test('조회가 한도(45곳)에 걸리면 일부만 보여 준다는 안내를 한다', () => {
  const shop = { id: 'kakao-1', name: '카페', dist: 30, lng: 127, lat: 37, sub: '커피전문점', cat: '카페', ex: false };
  const html = render(MarketSummaryCard, { analysis: real({ truncated: true, nearby: [shop], count: 1, density: 1, composition: [{ label: '커피전문점', value: 1, percent: 100 }], distanceRows: [] }) });
  assert.ok(html.includes('각 45곳까지만') && html.includes('조회된 점포') && !html.includes('예시'));
});

console.log(`${results.length} passed`);
