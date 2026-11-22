// 서류함과 체크리스트에서 서버 응답의 필요한 정보를 표시하는지 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { DocsView } = load('@/components/docs/DocsView');
const { ChecklistView } = load('@/components/checklist/ChecklistView');
const { createApiModel } = load('@/lib/api/contexts');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };

const task = (over = {}) => ({ id: 'c-05', task: '식품위생교육 이수', category: '영업 인허가', group: '개업 4주 전', due: '2027-02-08',
  documents: '식품위생교육 이수증', agency: '교육기관', done: false, ...over });
const requirement = (over = {}) => ({
  doc_key: 'edu_cert', name: '식품위생교육 이수증', status: 'obtained',
  agency: '식품위생교육전문기관', guide: '영업 전에 교육을 받아요',
  links: [{ label: '정부24', url: 'https://www.gov.kr/' }], ...over,
});
const apiDocs = createApiModel({ documents: {
  summary: { total: 3, finished: 1, remaining: 2 },
  groups: [{
    item_id: 'c-05', task: '식품위생교육 이수', group_label: '개업 4주 전', category: '영업 인허가',
    due_date: '2027-02-08', dday: 22, done: false, documents: [requirement()],
  }],
} }).docsView;

test('서류함: 서버가 계산한 서류 준비율을 사용한다', () => {
  const html = render(DocsView, { data: apiDocs });
  assert.match(html, /전체 서류 중 준비한 비율/);
  assert.match(html, /aria-valuetext="전체 3개 중 1개"/);
  assert.match(html, /준비할 서류/);
});

test('서류함: 서버 서류 상태, 발급 기관과 공식 링크가 연결된다', () => {
  const html = render(DocsView, { data: apiDocs });
  for (const text of ['식품위생교육 이수증', '식품위생교육전문기관', '영업 전에 교육을 받아요', '서류명', '정부24'])
    assert.ok(html.includes(text), text);
  assert.match(html, /data-document-status="edu_cert"/);
  assert.match(html, /value="obtained" selected="">발급·취득 완료/);
  assert.match(html, /value="submitted">제출 완료/);
  assert.match(html, /href="https:\/\/www\.gov\.kr\/"/);
  assert.match(html, /id="doc-c-05"/);
  assert.doesNotMatch(html, /data-doc-upload|docget|docdel|파일 올리기|번호 복사|☎|tel:/);
});

test('서류함: 공식 링크나 상태가 없는 로컬 서류는 안내만 표시한다', () => {
  const data = { rows: [{ task: task({ task: '건물 용도 확인', done: true }), deadline: 'D-22',
    documents: [{ id: 'bldg', name: '건축물대장', agency: '정부24', guide: '발급', sites: [] }] }],
    total: 1, finished: 1, remaining: 0 };
  const html = render(DocsView, { data });
  assert.match(html, /항목 완료[\s\S]*건물 용도 확인[\s\S]*개업 4주 전[\s\S]*예정 2027\.02\.08/);
  assert.match(html, /체크리스트 기준 서류 현황/);
  assert.match(html, /건축물대장/);
  assert.doesNotMatch(html, /data-document-status|D-22|https?:\/\//);
});

const checklist = tasks => ({
  opening: '2027-03-02', employees: true, view: 'timeline', count: { done: tasks.filter(item => item.done).length, total: tasks.length }, colors: {},
  groups: [{ title: '개업 4주 전', tasks: tasks.map(item => ({ task: item, deadline: 'D-22', documentCount: item.documents ? 1 : 0 })) }],
  calendar: { year: 2027, month: 2, selected: null, days: [], selectedEvents: [] },
});

test('체크리스트: 예정일과 D-day, 체크 상태 및 준비 정보·서류함 연결을 보여 준다', () => {
  const html = render(ChecklistView, { data: checklist([task()]) });
  for (const text of ['식품위생교육 이수', '02.08', 'D-22', '준비 정보', '필요 서류', '식품위생교육 이수증', '교육기관', '서류 안내 1개'])
    assert.ok(html.includes(text), text);
  assert.match(html, /data-nx="godocs" data-tid="c-05"/);
  assert.match(html, /<input(?=[^>]*type="checkbox")(?=[^>]*data-task="c-05")[^>]*>/);
});

test('체크리스트: 완료 항목에는 취소선이 그어지고 비어 있는 준비 정보는 숨긴다', () => {
  const html = render(ChecklistView, { data: checklist([task({ done: true, documents: '', agency: '' })]) });
  assert.match(html, /영업 인허가/);
  assert.match(html, /line-through/);
  assert.doesNotMatch(html, /준비 정보|필요 서류|담당 기관|서류 안내 1개|D-22/);
});

console.log(`${results.length} passed`);
