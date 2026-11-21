// 서류함·체크리스트의 서버 연결 화면: 서류별 상태·서식·재검토와 작업 유형·법정 기한 표시를 렌더링으로 확인한다.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { DocsView } = load('@/components/docs/DocsView');
const { ChecklistView } = load('@/components/checklist/ChecklistView');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const results = [];
const test = (name, run) => { run(); results.push(name); console.log(`PASS ${name}`); };

const doc = (over = {}) => ({
  id: 'edu_cert', name: '식품위생교육 이수증', type: 'certificate', typeLabel: '교육·검사로 취득하는 서류',
  status: 'not_started', statusLabel: '준비 전', applicability: 'applies', aiAdded: true,
  reason: '이 가게가 신고 업종 일반음식점 조건에 해당해 적용돼요.',
  lawBasis: { label: '식품위생법 제41조', url: 'https://www.law.go.kr/x' },
  agency: '식품위생교육전문기관', guide: '영업 전에 교육을 받아요', sites: [], form: null,
  tasks: [{ id: 'c-05', task: '식품위생교육 이수', done: false }], anchors: ['c-05'],
  due: '2027-02-08', deadline: 'D-22', statutoryDate: '2027-03-01', review: null, files: [], ...over,
});
const managed = (docs, over = {}) => ({
  total: 3, finished: 1, remaining: 2, notApplicable: 1, toObtain: 2, toWrite: 1, reviewCount: 0,
  byStatus: { not_started: 2, in_progress: 0, obtained: 1, submitted: 0, needs_fix: 0, not_applicable: 1 },
  sections: [{ title: '영업 인허가', documents: docs }], ...over,
});
const docs = (data) => ({ rows: [], total: data.total, finished: data.finished, remaining: data.remaining, contacts: {}, managed: data });

test('서류함: 진행률은 서류 상태로 세고 해당 없음은 뺀다고 알려 준다', () => {
  const html = render(DocsView, { data: docs(managed([doc()])) });
  assert.ok(html.includes('1 / 3개 준비 완료'));
  assert.ok(html.includes('해당 없음 1개는 빼고 셌어요'));
  assert.ok(html.includes('발급·취득 필요') && html.includes('직접 작성·보관'));
});

test('서류함: 서류마다 유형·상태 선택·AI 추가·근거 법령·이유가 보인다', () => {
  const html = render(DocsView, { data: docs(managed([doc()])) });
  for (const text of ['교육·검사로 취득하는 서류', 'AI 분석에서 추가됨', '식품위생법 제41조', '왜 필요한가요', '법정 기한 03.01까지'])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('data-doc-status="edu_cert"'));
  assert.ok(html.includes('발급·취득 완료') && html.includes('제출 완료'), '발급·취득과 제출은 다른 상태');
  assert.ok(html.includes('id="doc-c-05"'), '체크리스트의 "서류함에서 보기"가 찾아올 위치');
});

test('서류함: 공식 서식 링크는 열 수 있고 파일 올리기·전화번호는 없다', () => {
  const form = { title: '식품 영업 신고서', pdfUrl: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=1', fileUrl: null, revision: '2026-09-01' };
  const html = render(DocsView, { data: docs(managed([doc({ form, status: 'obtained', statusLabel: '발급·취득 완료' })])) });
  assert.ok(html.includes('공식 서식 열기') && html.includes('2026-09-01 공포'));
  for (const gone of ['data-doc-upload', 'docget', 'docdel', '파일 올리기', '내려받기', '내 파일', '번호 복사', '☎', 'tel:'])
    assert.ok(!html.includes(gone), `${gone} 는 서류함에서 없앴다`);
});

test('서류함: 서식 링크를 못 받았으면 지어내지 않고 안내한다', () => {
  const form = { title: '식품 영업 신고서', pdfUrl: null, fileUrl: null, revision: null };
  const html = render(DocsView, { data: docs(managed([doc({ form })])) });
  assert.ok(html.includes('링크를 아직 받아 오지 못했어요') && !html.includes('공식 서식 열기'));
});

test('서류함: 재검토 안내와 해당 여부 확인 표시', () => {
  const html = render(DocsView, { data: docs(managed([doc({ review: '식품위생법이 개정됐어요', applicability: 'needs_check' })], { reviewCount: 1 })) });
  assert.ok(html.includes('식품위생법이 개정됐어요') && html.includes('data-nx="docack"') && html.includes('해당 여부 확인'));
});

test('서류함: 서버 연결이 아니면 예전 체크리스트 항목별 안내를 그대로 보여 준다', () => {
  const task = { id: 'c-01', task: '예전 화면 작업', category: '건물·시설', group: '계약 전', due: '2027-01-05', documents: '', agency: '', done: false };
  const legacy = { rows: [{ task, deadline: 'D-1', documents: [{ id: 'bldg', name: '건축물대장', agency: '정부24', guide: '발급', sites: [] }] }],
    total: 1, finished: 0, remaining: 1, contacts: {} };
  const html = render(DocsView, { data: legacy });
  assert.ok(html.includes('예전 화면 작업') && html.includes('건축물대장') && !html.includes('data-doc-status'));
  assert.ok(!html.includes('번호 복사') && !html.includes('☎'), '예전 화면의 서류 안내에도 전화번호는 없다');
});

const task = (over = {}) => ({ id: 'c-05', task: '식품위생교육 이수', category: '영업 인허가', group: '개업 4주 전', due: '2027-02-08',
  documents: '식품위생교육 이수증', agency: '교육기관', done: false, ...over });
const checklist = (tasks, over = {}) => ({
  opening: '2027-03-02', employees: true, view: 'timeline', count: { done: 0, total: tasks.length }, colors: {},
  kinds: null, reviewCount: 0, groups: [{ title: '개업 4주 전', tasks: tasks.map((t) => ({ task: t, deadline: 'D-22', documentCount: 1, contact: null })) }],
  calendar: { year: 2027, month: 2, selected: null, days: [], selectedEvents: [] }, ...over,
});

test('체크리스트: 필수·조건부·권장 개수와 작업 유형·AI 추가 표시', () => {
  const rows = [task({ kind: 'legal_obligation' }), task({ id: 'o-fire', task: '소방 확인', kind: 'conditional', aiAdded: true }), task({ id: 'c-01', kind: 'preparation' })];
  const html = render(ChecklistView, { data: checklist(rows, { kinds: { legal_obligation: 1, conditional: 1, preparation: 1 } }) });
  for (const text of ['필수 1개', '조건부 1개', '권장 1개', 'AI 분석에서 추가됨']) assert.ok(html.includes(text), text);
});

test('체크리스트: 권장 준비일과 법정 기한을 따로 보여 주고 이유·근거를 붙인다', () => {
  const t = task({ kind: 'legal_obligation', reason: '이 가게가 신고 업종 일반음식점 조건에 해당해 적용돼요.',
    lawBasis: { label: '식품위생법 제41조', url: 'https://www.law.go.kr/x' }, statutory: { date: '2027-03-01', basis: '영업 시작 전 교육' } });
  const html = render(ChecklistView, { data: checklist([t]) });
  for (const text of ['권장 준비일', '02.08', '법정 03.01', '법정 기한 03.01까지', '식품위생법 제41조', '왜 필요한가요']) assert.ok(html.includes(text), text);
});

test('체크리스트: 법령 개정으로 다시 확인할 작업 안내와 확인 버튼', () => {
  const html = render(ChecklistView, { data: checklist([task({ kind: 'legal_obligation', review: '식품위생법이 개정됐어요' })], { reviewCount: 1 }) });
  assert.ok(html.includes('다시 확인할 작업이 1개') && html.includes('data-nx="taskack"') && html.includes('data-tid="c-05"'));
});

test('체크리스트: 서버 연결이 아니면 예전 모양 그대로 (유형·법정 기한 표시 없음)', () => {
  const html = render(ChecklistView, { data: checklist([task()]) });
  assert.ok(html.includes('식품위생교육 이수') && !html.includes('권장 준비일') && !html.includes('필수 ') && !html.includes('법정'));
});

test('체크리스트: 서류·담당 정보가 비어 있으면 빈 "필요 서류:"를 그리지 않는다', () => {
  const html = render(ChecklistView, { data: checklist([task({ documents: '', agency: '', kind: 'conditional' })]) });
  assert.ok(html.includes('영업 인허가') && !html.includes('필요 서류:') && !html.includes('담당:'));
});

console.log(`${results.length} passed`);
