import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports }, { filename: file });
  return exports;
}

const { createChatRequest } = load('src/lib/chat/chat-request.ts');
const { createInitialChatState } = load('src/lib/chat/chat-state.ts');
const results = [];
function test(name, run) {
  run();
  results.push({ name, passed: true });
}

function fixture(reply = () => ({ role: 'a', text: '답변' })) {
  let state = createInitialChatState();
  let clock = 100;
  let id = 0;
  const jobs = new Map();
  const canceled = [];
  const request = createChatRequest({
    getState: () => state,
    reply,
    now: () => clock,
    schedule(callback) { jobs.set(++id, callback); return id; },
    cancelTimer(timer) { canceled.push(timer); jobs.delete(timer); },
  });
  return {
    request, jobs, canceled,
    get state() { return state; },
    reset() { state = createInitialChatState(); },
    flush() {
      const pending = [...jobs.values()];
      jobs.clear();
      clock += 420;
      pending.forEach((callback) => callback());
    },
  };
}

test('completed records describe returned content and never apply proposed changes', () => {
  const action = { type: 'update_store', label: '날짜 변경', payload: {}, summary: [] };
  const f = fixture(() => ({ role: 'a', text: '변경 제안', cites: ['permit'], acts: [action] }));
  f.request.send('  날짜를 변경해줘  ');
  assert.equal(f.state.busy, true);
  assert.equal(f.state.request.status, 'processing');
  assert.equal(f.state.msgs.length, 1);
  f.flush();
  assert.equal(f.state.busy, false);
  assert.equal(f.state.request, null);
  const result = f.state.msgs[1];
  assert.equal(result.processing.status, 'completed');
  assert.equal(result.processing.question, '날짜를 변경해줘');
  assert.equal(result.processing.finishedAt - result.processing.startedAt, 420);
  assert.equal(result.processing.steps.some((step) => step.id === 'changes'), true);
  assert.equal(result.processing.steps.some((step) => step.id === 'references'), true);
  assert.equal(action.state, undefined);
});

test('empty and concurrent requests do not duplicate questions or scheduled work', () => {
  const f = fixture();
  f.request.send('   ');
  assert.equal(f.jobs.size, 0);
  f.request.send('첫 질문');
  f.request.send('중복 질문');
  assert.equal(f.jobs.size, 1);
  assert.equal(f.state.msgs.length, 1);
  f.flush();
  assert.equal(f.state.msgs.length, 2);
});

test('stop cancels only its timer and stale callbacks cannot publish', () => {
  let calls = 0;
  const f = fixture(() => { calls++; return { role: 'a', text: '답변' }; });
  f.jobs.set('unrelated', () => calls += 10);
  f.request.send('질문');
  const staleCallback = f.jobs.get(1);
  f.request.stop();
  assert.equal(f.canceled.length, 1);
  assert.equal(f.jobs.has('unrelated'), true);
  assert.equal(f.state.busy, false);
  assert.equal(f.state.request, null);
  assert.equal(f.state.msgs[1].processing.status, 'canceled');
  assert.equal(f.state.msgs[1].processing.steps.length, 1);
  assert.equal(f.state.msgs[1].processing.steps[0].id, 'question');
  staleCallback();
  assert.equal(calls, 0);
  assert.equal(f.state.msgs.length, 2);
  f.flush();
  assert.equal(calls, 10);
});

test('failed replies clear busy and retry the original question without leaking errors', () => {
  let fails = true;
  const received = [];
  const f = fixture((question) => {
    received.push(question);
    if (fails) throw new Error('private internal detail');
    return { role: 'a', text: '완료' };
  });
  f.request.send('질문 원문');
  f.flush();
  assert.equal(f.state.busy, false);
  assert.equal(f.state.request, null);
  assert.equal(f.state.msgs[1].processing.status, 'error');
  assert.equal(f.state.msgs[1].processing.steps.length, 1);
  assert.equal(f.state.msgs[1].processing.steps[0].id, 'question');
  assert.equal(JSON.stringify(f.state).includes('private internal detail'), false);
  fails = false;
  f.request.retry(1);
  f.request.retry(1);
  f.flush();
  assert.deepEqual(received, ['질문 원문', '질문 원문']);
  assert.equal(f.state.msgs.at(-1).processing.status, 'completed');
});

test('reset blocks old results and a new session can send immediately', () => {
  let calls = 0;
  const f = fixture(() => { calls++; return { role: 'a', text: '답변' }; });
  f.request.send('이전 계정 질문');
  const oldCallback = f.jobs.get(1);
  f.reset();
  f.request.send('새 계정 질문');
  oldCallback();
  assert.equal(calls, 0);
  assert.equal(f.state.msgs.length, 1);
  f.flush();
  assert.equal(calls, 1);
  assert.equal(f.state.msgs[1].processing.question, '새 계정 질문');
});

test('request uses the selected card at send time and leaves the current selection intact', () => {
  let receivedFocus;
  const f = fixture((_question, focus) => {
    receivedFocus = focus;
    return { role: 'a', text: '안내', kind: 'oos' };
  });
  f.state.focus = 'original-card';
  f.request.send('질문');
  f.state.focus = 'new-card';
  f.flush();
  assert.equal(receivedFocus, 'original-card');
  assert.equal(f.state.focus, 'new-card');
  assert.equal(f.state.msgs[1].processing.steps.some((step) => step.id === 'references'), false);
});

test('retry is limited to canceled and failed messages', () => {
  const f = fixture();
  f.request.send('질문');
  f.request.stop();
  f.request.retry(1);
  f.flush();
  assert.equal(f.state.msgs.length, 4);
  f.request.retry(3);
  f.request.retry(-1);
  f.request.retry(Number.NaN);
  assert.equal(f.jobs.size, 0);
  assert.equal(f.state.msgs.length, 4);
});

test('retry retains the original selected card after cancellation and a focus change', () => {
  const receivedFocus = [];
  const f = fixture((_question, focus) => {
    receivedFocus.push(focus);
    return { role: 'a', text: '카드 안내' };
  });
  f.state.focus = 'card-a';
  f.request.send('왜 이런가요?');
  f.request.stop();
  f.state.focus = 'card-b';
  f.request.retry(1);
  f.flush();
  assert.deepEqual(receivedFocus, ['card-a']);
  assert.equal(f.state.msgs.at(-1).processing.focus, 'card-a');
  assert.equal(f.state.focus, 'card-b');

  f.state.focus = null;
  f.request.send('전체 안내');
  f.request.stop();
  f.state.focus = 'card-c';
  f.request.retry(5);
  f.flush();
  assert.deepEqual(receivedFocus, ['card-a', null]);
  assert.equal(f.state.msgs.at(-1).processing.focus, null);
  assert.equal(f.state.focus, 'card-c');
});

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
