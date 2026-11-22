// 상권 분석: 제공된 점포의 반경 집계, 목록 선택 및 빈 상태를 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { analyzeMarket } = load('@/lib/market');
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

console.log(`${results.length} passed`);
