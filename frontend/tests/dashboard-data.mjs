import assert from 'node:assert/strict';
import { createSourceRuntime } from './helpers/source-runtime.mjs';

const { load } = createSourceRuntime();
const { buildDashboardPreparation, buildDashboardSchedule, buildOpeningWeek, countDashboardReports, buildPreparationRingSegments, preparationStageColor } = load('@/lib/dashboard');
const results = [];
function test(name, action) {
  action();
  results.push({ name, passed: true });
}
const task = (id, group, due, done = false) => ({
  id, group, due, done, task: `작업 ${id}`, category: '준비',
});

test('stage totals use every task and keep the chronological preparation stages', () => {
  const tasks = [
    task('after', '개업 후', '2027-03-09'),
    task('before', '개업 직전', '2027-02-28'),
    task('month-done', '개업 4주 전', '2027-02-01', true),
    task('contract', '계약 전', '2027-01-01'),
    task('month-pending', '개업 4주 전', '2027-02-03'),
    task('custom', '추가 준비', '2027-02-04'),
  ];
  const result = buildDashboardPreparation(tasks, 2);
  assert.deepEqual(result.stages, [
    { label: '계약 전', done: 0, total: 1 },
    { label: '개업 4주 전', done: 1, total: 2 },
    { label: '개업 직전', done: 0, total: 1 },
    { label: '개업 후', done: 0, total: 1 },
    { label: '추가 준비', done: 0, total: 1 },
  ]);
  assert.deepEqual(result.taskCount, { done: 1, total: 6 });
  assert.equal(result.stages.reduce((sum, stage) => sum + stage.total, 0), result.taskCount.total);
  assert.equal(result.tasks.length, 2);
});

test('completing a task updates progress while retaining the same preview rows', () => {
  const tasks = [task('first', '계약 전', '2027-01-01'), task('second', '계약 전', '2027-01-02')];
  const before = buildDashboardPreparation(tasks);
  const after = buildDashboardPreparation(tasks.map((item) => item.id === 'first' ? { ...item, done: true } : item));
  assert.deepEqual(before.taskCount, { done: 0, total: 2 });
  assert.deepEqual(after.taskCount, { done: 1, total: 2 });
  assert.deepEqual(after.stages, [{ label: '계약 전', done: 1, total: 2 }]);
  assert.deepEqual(after.tasks.map((item) => item.id), before.tasks.map((item) => item.id));
  assert.equal(after.tasks[0].done, true);
});

test('task previews retain completed items in due order, keeping undated items last', () => {
  const tasks = [
    task('late', '준비', '2027-03-02'),
    task('undated', '준비', ''),
    task('done', '준비', '2026-11-01', true),
    task('early', '준비', '2027-01-01'),
    task('tied', '준비', '2027-01-01'),
  ];
  assert.deepEqual(buildDashboardPreparation(tasks).tasks.map((item) => item.id), ['done', 'early', 'tied', 'late']);
  assert.deepEqual(buildDashboardPreparation(tasks, 5).tasks.map((item) => item.id), ['done', 'early', 'tied', 'late', 'undated']);
  assert.deepEqual(buildDashboardPreparation(tasks, 1).tasks.map((item) => item.id), ['done']);
});

test('an empty checklist has zero counts without invented stages or upcoming tasks', () => {
  assert.deepEqual(buildDashboardPreparation([]), { stages: [], taskCount: { done: 0, total: 0 }, tasks: [] });
});

test('summaries do not mutate the source task order or task objects', () => {
  const tasks = Object.freeze([
    Object.freeze(task('late', '개업 직전', '2027-02-28')),
    Object.freeze(task('early', '계약 전', '2027-01-01')),
  ]);
  const before = JSON.stringify(tasks);
  buildDashboardPreparation(tasks);
  assert.equal(JSON.stringify(tasks), before);
});

test('report counts use evaluated verdicts rather than stale base verdicts', () => {
  const cards = Object.freeze([
    Object.freeze({ id: 'resolved', base: 'high' }),
    Object.freeze({ id: 'pending', base: 'low' }),
    Object.freeze({ id: 'unknown', base: 'unknown' }),
  ]);
  const before = JSON.stringify(cards);
  const counts = countDashboardReports(cards, (card) => card.id === 'resolved' ? 'ok' : card.base);
  assert.deepEqual(counts, { high: 0, low: 1, unknown: 1, ok: 1 });
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), cards.length);
  assert.equal(JSON.stringify(cards), before);
  assert.deepEqual(countDashboardReports([], () => 'high'), { high: 0, low: 0, unknown: 0, ok: 0 });
});

test('ring stacks completed counts 1 + 2 + 2 against the global total of 11', () => {
  const stages = Object.freeze([
    Object.freeze({ label: '계약 전', total: 4, done: 1 }),
    Object.freeze({ label: '개업 4주 전', total: 4, done: 2 }),
    Object.freeze({ label: '개업 직전', total: 3, done: 2 }),
  ]);
  const before = JSON.stringify(stages);
  const segments = buildPreparationRingSegments(stages, { done: 5, total: 11 });
  assert.equal(segments.length, 3);
  assert.equal(new Set(segments.map((segment) => segment.color)).size, 3);
  const expectedLengths = [100 / 11, 200 / 11, 200 / 11];
  const expectedOffsets = [0, 100 / 11, 300 / 11];
  for (const [index, segment] of segments.entries()) {
    assert.ok(Math.abs(segment.length - expectedLengths[index]) < 1e-10);
    assert.ok(Math.abs(segment.offset - expectedOffsets[index]) < 1e-10);
    assert.ok(segment.offset + segment.length <= 100);
    assert.equal(segment.color, preparationStageColor(segment.label, 99));
    assert.equal('completedLength' in segment, false);
  }
  assert.ok(Math.abs(segments.at(-1).offset + segments.at(-1).length - 500 / 11) < 1e-10);
  assert.equal(JSON.stringify(stages), before);
});

test('zero-completion stages leave no gap between neighboring completed contributions', () => {
  const stages = [
    { label: '계약 전', total: 2, done: 1 },
    { label: '개업 4주 전', total: 5, done: 0 },
    { label: '개업 직전', total: 3, done: 2 },
  ];
  const segments = buildPreparationRingSegments(stages, { done: 3, total: 10 });
  assert.deepEqual(segments.map(({ offset, length }) => ({ offset, length })), [
    { offset: 0, length: 10 },
    { offset: 10, length: 0 },
    { offset: 10, length: 20 },
  ]);
});

test('all completed tasks fill the full ring and all pending tasks fill none', () => {
  const stages = [
    { label: '계약 전', total: 4, done: 4 },
    { label: '개업 4주 전', total: 4, done: 4 },
    { label: '개업 직전', total: 3, done: 3 },
  ];
  const complete = buildPreparationRingSegments(stages, { done: 11, total: 11 });
  assert.ok(Math.abs(complete.at(-1).offset + complete.at(-1).length - 100) < 1e-10);
  const pending = buildPreparationRingSegments(stages.map((stage) => ({ ...stage, done: 0 })), { done: 0, total: 11 });
  assert.equal(pending.length, 3);
  assert.ok(pending.every((segment) => segment.length === 0 && segment.offset === 0));
});

test('missing or contradictory stage aggregates fall back instead of inventing a ring breakdown', () => {
  assert.deepEqual(buildPreparationRingSegments([], { done: 0, total: 0 }), []);
  assert.deepEqual(buildPreparationRingSegments([{ label: '준비', done: 2, total: 1 }], { done: 2, total: 1 }), []);
  assert.deepEqual(buildPreparationRingSegments([{ label: '준비', done: 0, total: 1 }], { done: 1, total: 1 }), []);
  assert.deepEqual(buildPreparationRingSegments([{ label: '준비', done: 0, total: 1 }], { done: 0, total: 3 }), []);
});

test('schedule groups all incomplete tasks by month in calendar order across years', () => {
  const tasks = [
    task('feb', '준비', '2027-02-10'),
    task('jan', '준비', '2027-01-31'),
    task('dec', '준비', '2026-12-31'),
    task('feb-second', '준비', '2027-02-01'),
    task('completed', '준비', '2027-02-02', true),
  ];
  const schedule = buildDashboardSchedule(tasks);
  assert.deepEqual(schedule, [
    { month: '2026-12', count: 1 },
    { month: '2027-01', count: 1 },
    { month: '2027-02', count: 2 },
  ]);
  assert.equal(schedule.reduce((sum, item) => sum + item.count, 0), 4);
});

test('schedule rejects impossible dates and undated tasks without filling missing months', () => {
  const invalid = ['', '2027-2-01', '2027-02', '2027-02-29', '2028-02-30', '2027-04-31', '2027-00-01', '2027-13-01', '2027-01-00', '0000-01-01', '1900-02-29', '2027-01-01T00:00:00Z'];
  const tasks = [
    ...invalid.map((due, index) => task(`invalid-${index}`, '준비', due)),
    task('leap-century', '준비', '2000-02-29'),
    task('leap', '준비', '2028-02-29'),
    task('april', '준비', '2028-04-30'),
  ];
  assert.deepEqual(buildDashboardSchedule(tasks), [
    { month: '2000-02', count: 1 },
    { month: '2028-02', count: 1 },
    { month: '2028-04', count: 1 },
  ]);
  assert.deepEqual(buildDashboardSchedule([]), []);
  assert.deepEqual(buildDashboardSchedule([task('done', '준비', '2027-01-01', true)]), []);
});

test('schedule preserves task objects and order and includes every available month', () => {
  const tasks = Object.freeze([
    Object.freeze(task('last', '준비', '2028-01-01')),
    ...Array.from({ length: 12 }, (_, month) => Object.freeze(task(`month-${month}`, '준비', `2027-${String(month + 1).padStart(2, '0')}-01`))),
  ]);
  const before = JSON.stringify(tasks);
  const schedule = buildDashboardSchedule(tasks);
  assert.equal(schedule.length, 13);
  assert.deepEqual(schedule[0], { month: '2027-01', count: 1 });
  assert.deepEqual(schedule.at(-1), { month: '2028-01', count: 1 });
  assert.equal(JSON.stringify(tasks), before);
});

test('opening week includes exactly seven Sunday-to-Saturday dates containing the opening', () => {
  const week = buildOpeningWeek('2027-03-02');
  assert.deepEqual(week.map((day) => day.date), ['2027-02-28', '2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04', '2027-03-05', '2027-03-06']);
  assert.deepEqual(week.map((day) => day.day), [28, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(week.map((day) => day.weekday), ['일', '월', '화', '수', '목', '금', '토']);
  assert.deepEqual(week.filter((day) => day.isOpening).map((day) => day.date), ['2027-03-02']);
});

test('Sunday and Saturday openings stay at the correct week edge across year boundaries', () => {
  const sunday = buildOpeningWeek('2027-02-28');
  assert.equal(sunday[0].date, '2027-02-28');
  assert.equal(sunday[0].isOpening, true);
  assert.equal(sunday.at(-1).date, '2027-03-06');
  const saturday = buildOpeningWeek('2027-01-02');
  assert.equal(saturday[0].date, '2026-12-27');
  assert.equal(saturday.at(-1).date, '2027-01-02');
  assert.equal(saturday.at(-1).isOpening, true);
  assert.equal(saturday.filter((day) => day.isOpening).length, 1);
});

test('opening week retains leap day and rejects invalid or unset dates without rollover', () => {
  const leap = buildOpeningWeek('2028-02-29');
  assert.equal(leap[0].date, '2028-02-27');
  assert.equal(leap.at(-1).date, '2028-03-04');
  assert.deepEqual(leap.filter((day) => day.isOpening).map((day) => day.date), ['2028-02-29']);
  for (const invalid of ['', '2027-02-29', '1900-02-29', '2027-04-31', '2027-00-01', '2027-13-01', '2027-01-00', '2027-3-02', '0000-01-01', '2027-03-02T00:00:00Z']) {
    assert.deepEqual(buildOpeningWeek(invalid), []);
  }
});

test('opening week dates do not change with the process time zone or daylight saving', () => {
  const originalTimeZone = process.env.TZ;
  const expected = JSON.stringify(buildOpeningWeek('2027-03-14'));
  try {
    for (const timeZone of ['Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC']) {
      process.env.TZ = timeZone;
      assert.equal(JSON.stringify(buildOpeningWeek('2027-03-14')), expected);
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
