import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = 'src/lib/store-greeting.ts';
const source = ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports }, { filename: file });
const { buildStoreGreeting } = exports;
const results = [];
function test(name, action) {
  action();
  results.push({ name, passed: true });
}
const messages = (copy) => copy.messages;

test('future opening uses remaining days rather than elapsed days', () => {
  const copy = buildStoreGreeting('모노커피', 101);
  assert.equal(copy.dayLabel, 'D-101');
  assert.equal(copy.dateLabel, '개업 예정');
  assert.equal(copy.milestoneLabel, '개업까지');
  assert.equal(copy.openingMessage, '개업까지 101일 남았어요.');
  assert.equal(copy.messages[0], '모노커피 사장님, 환영합니다!');
  assert.ok(messages(copy).every((text) => !text.includes('개업한 지')));
});

test('opening day is D-DAY and never shown as D-0 or already elapsed', () => {
  const copy = buildStoreGreeting('모노커피', 0);
  assert.equal(copy.dayLabel, 'D-DAY');
  assert.equal(copy.dateLabel, '개업일');
  assert.equal(copy.milestoneLabel, '오늘 개업');
  assert.equal(copy.openingMessage, '오늘은 가게를 여는 날이에요!');
  assert.ok(messages(copy).every((text) => !/남았|개업한 지/.test(text)));
});

test('past opening uses elapsed copy and no longer suggests opening preparation', () => {
  const copy = buildStoreGreeting('모노커피', -101);
  assert.equal(copy.dayLabel, 'D+101');
  assert.equal(copy.dateLabel, '개업일');
  assert.equal(copy.milestoneLabel, '개업 후');
  assert.equal(copy.openingMessage, '개업한 지 101일이 되었어요.');
  assert.ok(messages(copy).every((text) => !/남았|준비|첫날|새로운 시작/.test(text)));
});

test('unknown day differences remain helpful without NaN or Infinity', () => {
  for (const days of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const copy = buildStoreGreeting('모노커피', days);
    assert.equal(copy.dayLabel, '일정 미정');
    assert.equal(copy.openingMessage, '개업일을 정해볼까요?');
    assert.ok(!/NaN|Infinity|D[-+]/.test(JSON.stringify(copy)));
  }
});

test('store names are trimmed and a blank name uses the plain-text fallback', () => {
  assert.equal(buildStoreGreeting('  모노커피  ', 101).name, '모노커피');
  const copy = buildStoreGreeting(' \n\t ', 101);
  assert.equal(copy.name, '내 가게');
  assert.equal(copy.messages[0], '내 가게 사장님, 환영합니다!');
  const punctuation = 'A&B <커피> ☕';
  assert.equal(buildStoreGreeting(punctuation, 101).name, punctuation);
});

test('the welcome loop contains three complete messages with a stable personalized first title', () => {
  for (const days of [101, 0, -101, Number.NaN]) {
    const copy = buildStoreGreeting('테스트 매장', days);
    assert.equal(copy.messages.length, 3);
    assert.equal(new Set(copy.messages).size, 3);
    assert.ok(copy.messages.every((text) => typeof text === 'string' && text.trim().length > 0));
    assert.ok(copy.messages.includes(copy.openingMessage));
    assert.equal(copy.messages[0], '테스트 매장 사장님, 환영합니다!');
  }
});

test('fractional day inputs round once and large counts remain readable', () => {
  assert.equal(buildStoreGreeting('모노커피', 100.6).dayLabel, 'D-101');
  assert.equal(buildStoreGreeting('모노커피', -100.6).dayLabel, 'D+101');
  assert.equal(buildStoreGreeting('모노커피', -0.1).dayLabel, 'D-DAY');
  assert.equal(buildStoreGreeting('모노커피', 1001).openingMessage, '개업까지 1,001일 남았어요.');
});

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
