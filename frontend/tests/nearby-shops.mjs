// 상권 분석: 제공된 점포의 반경 집계, 목록 선택 및 빈 상태를 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { analyzeMarket } = load('@/lib/market');
const { loadKakaoNearbyShops } = load('@/lib/market/kakao-shops');
const { MarketEmptyState } = load('@/components/sites/MarketEmptyState');
const { NearbyShopsCard } = load('@/components/sites/NearbyShopsCard');
const { MarketSummaryCard } = load('@/components/sites/MarketSummaryCard');
const { StrategyCard } = load('@/components/sites/StrategyCard');
const { MARKET_DEMO_CENTER } = load('@/data/market');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };

test('분석: 지도 중심이 어디든 중심에서의 거리를 다시 계산해 반경으로 거른다', () => {
  const far = { id: 'x', name: '먼 점포', dist: 0, lng: MARKET_DEMO_CENTER.lng + 0.2, lat: MARKET_DEMO_CENTER.lat, sub: '카페', cat: '카페', ex: false };
  const near = { ...far, id: 'y', name: '가까운 점포', lng: MARKET_DEMO_CENTER.lng + 0.001 };
  const result = analyzeMarket([far, near], MARKET_DEMO_CENTER, 500, 'all');
  assert.deepEqual(result.nearby.map((shop) => shop.name), ['가까운 점포']);
});

const shop = (over = {}) => ({
  id: 'sample-1', name: '가까운 카페', dist: 30, lng: MARKET_DEMO_CENTER.lng + 0.0003,
  lat: MARKET_DEMO_CENTER.lat, sub: '커피전문점', cat: '카페', ex: true, ...over,
});

test('점포 목록은 선택한 점포와 중심에서의 거리를 표시한다', () => {
  const selected = shop();
  const other = shop({ id: 'sample-2', name: '다른 음식점', cat: '음식점' });
  const html = render(NearbyShopsCard, { shops: [selected, other], selectedShop: selected, onSelect: () => {} });
  for (const text of ['주변 점포 2곳', selected.name, other.name, '선택한 점포', '중심에서 30m'])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
});

test('점포가 없을 때 지도 중심, 반경, 업종 변경을 안내한다', () => {
  const message = render(MarketEmptyState);
  assert.match(message, /선택한 조건에 표시할 점포가 없어요/);
  assert.match(message, /반경과 업종을 바꿔 보세요/);
  const html = render(NearbyShopsCard, { shops: [], onSelect: () => {} });
  assert.match(html, /주변 점포 0곳/);
  assert.match(html, /선택한 조건에 표시할 점포가 없어요/);
});

test('점포 요약은 제공된 표본의 업종 분포를 표시한다', () => {
  const food = shop({ id: 'sample-2', name: '가까운 식당', cat: '음식점', sub: '한식' });
  const analysis = analyzeMarket([shop(), food], MARKET_DEMO_CENTER, 500, 'all');
  const html = render(MarketSummaryCard, { analysis });
  for (const text of ['표시된 점포','표시된 점포 밀도','표시된 점포의 업종 비중','커피전문점','한식'])
    assert.ok(html.includes(text), text);
  assert.match(render(StrategyCard), /서울시·KT 생활인구 공개값 기반/);
});

test('조회 실패와 정상 조회 0건을 다르게 표시한다', () => {
  const html = render(NearbyShopsCard, { shops: [], status: 'error', onRetry: () => {}, onSelect: () => {} });
  assert.match(html, /role="alert"/);
  assert.match(html, /다시 조회/);
  assert.doesNotMatch(html, /0곳/);
  assert.match(render(MarketEmptyState, { status: 'location' }), /분석 위치를 선택해 주세요/);
});

globalThis.window = { setTimeout, clearTimeout };
const requests = [];
let respond;
globalThis.kakao = {
  maps: {
    LatLng: class { constructor(lat, lng) { Object.assign(this, { lat, lng }); } },
    services: {
      Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' },
      SortBy: { DISTANCE: 'distance' },
      Places: class {
        categorySearch(code, callback, options) {
          requests.push({ code, ...options });
          respond(code, callback, options);
        }
      },
    },
  },
};

const center = { lat: 37.4979, lng: 127.0276 };
const place = (id, category_name, x = '127.0278') => ({ id, place_name: id, category_name, x, y: '37.4980' });
respond = (code, callback, { page }) => {
  const places = code === 'FD6'
    ? [place('cafe', '음식점 > 카페'), place('restaurant', '음식점 > 한식'), place('invalid', '음식점', '')]
    : [place(page === 1 ? 'cafe' : `cafe-${page}`, '음식점 > 카페 > 커피전문점')];
  callback(places, 'OK', { hasNextPage: code === 'CE7' && page < 3, totalCount: code === 'CE7' ? 80 : 3 });
};
const nearby = await loadKakaoNearbyShops(center, 500);
assert.equal(nearby.truncated, true);
assert.deepEqual(nearby.shops.map(({ id, cat, sub }) => [id, cat, sub]), [
  ['kakao-cafe', '카페', '커피전문점'], ['kakao-restaurant', '음식점', '한식'],
  ['kakao-cafe-2', '카페', '커피전문점'], ['kakao-cafe-3', '카페', '커피전문점'],
]);
assert.deepEqual(requests.filter(({ code }) => code === 'CE7').map(({ page }) => page), [1, 2, 3]);
assert.ok(requests.every(({ location, radius, sort }) => location.lat === center.lat && location.lng === center.lng && radius === 500 && sort === 'distance'));
respond = (_, callback) => callback([], 'ZERO_RESULT');
assert.deepEqual(await loadKakaoNearbyShops(center, 1000), { shops: [], truncated: false });
assert.ok(requests.slice(-2).every(({ radius }) => radius === 1000));
respond = (_, callback) => callback([], 'ERROR');
await assert.rejects(loadKakaoNearbyShops(center, 500), /카카오 장소 검색 실패/);
console.log('PASS 카카오 장소 검색 좌표·반경·페이지 제한·중복 제거·빈 응답·오류');
console.log(`${results.length + 1} passed`);
