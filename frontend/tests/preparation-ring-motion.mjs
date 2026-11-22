import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { browserBundle } from './helpers/source-runtime.mjs';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const errors = [];
try {
  const page = await browser.newPage({ reducedMotion: 'no-preference' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-11-21T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-21T12:00:01Z'));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: browserBundle({
    React: 'react', ReactDOM: 'react-dom/client', DOM: 'react-dom',
    ring: '@/components/dashboard/PreparationRing',
  }) });
  await page.evaluate(() => {
    const { React, ReactDOM, DOM, ring: { PreparationRing } } = window.contractModules;
    const root = ReactDOM.createRoot(document.getElementById('root'));
    window.draw = (counts, breakdown = true) => {
      const labels = ['계약 전', '개업 4주 전'];
      DOM.flushSync(() => root.render(React.createElement(PreparationRing, {
        done: counts.reduce((sum, count) => sum + count, 0), total: 8,
        stages: breakdown ? counts.map((done, index) => ({ label: labels[index], done, total: 4 })) : undefined,
      })));
    };
  });
  const draw = (counts, breakdown = true) => page.evaluate(({ counts, breakdown }) => window.draw(counts, breakdown), { counts, breakdown });
  const snapshot = () => page.getByRole('img').evaluate((ring) => {
    const extent = (circle) => {
      if (!circle) return 0;
      const dash = circle.getAttribute('stroke-dasharray');
      if (!dash) return 100;
      const cap = circle.getAttribute('stroke-linecap') === 'round'
        ? Number(circle.getAttribute('stroke-width')) / (2 * Math.PI * Number(circle.getAttribute('r'))) * 100 : 0;
      return Number(dash.split(' ')[0]) + cap;
    };
    const svg = ring.querySelector('svg');
    const stages = [...svg.querySelectorAll('[data-stage]')].map((group) => {
      const circle = group.querySelector('circle');
      return { length: extent(circle), offset: -Number(circle?.getAttribute('stroke-dashoffset') || 0) };
    });
    const hasMask = Boolean(svg.querySelector('mask'));
    const progress = hasMask ? extent(svg.querySelector('mask circle'))
      : stages.length ? stages.reduce((sum, stage) => sum + stage.length, 0)
      : extent(svg.querySelector(':scope > circle[pathLength]'));
    return { progress, stages, hasMask, label: ring.getAttribute('aria-label') };
  });
  const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} != ${expected}`);
  const continuous = (frame) => {
    let end = 0;
    for (const stage of frame.stages) {
      if (stage.length) near(stage.offset, end);
      end += stage.length;
    }
    if (frame.stages.length) near(end, frame.progress);
  };
  const test = async (name, run) => { await run(); results.push({ name, passed: true }); };

  await test('initial rendering shows the stored completion without an entrance animation', async () => {
    await draw([1, 1]);
    near((await snapshot()).progress, 25);
    await page.clock.runFor(100);
    near((await snapshot()).progress, 25);
  });

  await test('checking grows the ring smoothly while stage boundaries stay contiguous', async () => {
    await draw([2, 1]);
    near((await snapshot()).progress, 25);
    assert.match((await snapshot()).label, /3개 완료, 38%/);
    let previous = 25;
    for (let index = 0; index < 4; index++) {
      await page.clock.runFor(80);
      const frame = await snapshot();
      assert.ok(frame.progress > previous && frame.progress < 37.5);
      continuous(frame);
      previous = frame.progress;
    }
    await page.clock.runFor(150);
    near((await snapshot()).progress, 37.5);
  });

  await test('rapid checks and unchecks resume from the current frame and reach the latest value', async () => {
    await draw([3, 1]);
    await page.clock.runFor(80);
    const interrupted = (await snapshot()).progress;
    await draw([1, 1]);
    near((await snapshot()).progress, interrupted);
    await page.clock.runFor(80);
    const shrinking = await snapshot();
    assert.ok(shrinking.progress < interrupted && shrinking.progress > 25);
    continuous(shrinking);
    await draw([2, 2]);
    near((await snapshot()).progress, shrinking.progress);
    await page.clock.runFor(500);
    near((await snapshot()).progress, 50);
  });

  await test('empty and complete rings animate without leaving stale arcs or a full-circle mask', async () => {
    await draw([0, 0]);
    await page.clock.runFor(500);
    near((await snapshot()).progress, 0);
    await draw([4, 4]);
    await page.clock.runFor(100);
    const growing = await snapshot();
    assert.ok(growing.progress > 0 && growing.progress < 100);
    continuous(growing);
    await page.clock.runFor(400);
    const complete = await snapshot();
    near(complete.progress, 100);
    assert.equal(complete.hasMask, false);
  });

  await test('legacy data without stage totals animates the fallback ring', async () => {
    await draw([1, 1], false);
    near((await snapshot()).progress, 25);
    await draw([2, 2], false);
    await page.clock.runFor(100);
    const growing = await snapshot();
    assert.ok(growing.progress > 25 && growing.progress < 50);
    await page.clock.runFor(400);
    near((await snapshot()).progress, 50);
  });

  await test('reduced motion immediately applies checked values', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await draw([3, 2], false);
    near((await snapshot()).progress, 62.5);
    await draw([0, 0], false);
    near((await snapshot()).progress, 0);
    await page.clock.runFor(500);
    near((await snapshot()).progress, 0);
  });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally {
  await browser.close();
}
