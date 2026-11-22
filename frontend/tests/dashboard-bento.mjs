import { navigate } from './helpers/navigate.mjs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceRuntime } from './helpers/source-runtime.mjs';
import { signIn } from './helpers/sign-in.mjs';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = path.resolve('work/dashboard-bento');
const population = JSON.parse(await readFile(new URL('../src/data/dashboard-population.json', import.meta.url), 'utf8'));
const fixedTime = '2026-11-21T16:00:00+09:00';
const report = { baseURL, fixedTime, checks: [], pageErrors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const labels = ['체크리스트 완료율', '먼저 결정할 일', '다음 할 일', '시간대별 생활인구', '개업 일정'];
const safe = (message) => message.replace(/appkey=[^&\s]+/g, 'appkey=[redacted]');
const region = (page, name) => page.getByTestId('dashboard-bento').getByRole('region', { name, exact: true });
await mkdir(output, { recursive: true });

async function check(page, name, run) {
  try {
    const detail = await run();
    report.checks.push({ name, passed: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, error: safe(error.message) });
    console.error(`FAIL ${name}: ${safe(error.message).slice(0, 500)}`);
    await page.screenshot({ path: path.join(output, `failure-${report.checks.length}.png`), fullPage: true });
  }
}

async function openDashboard(name, width = 1440, height = 1000) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const heavyRequests = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => report.pageErrors.push({ name, message: safe(error.message) }));
  page.on('request', (request) => {
    const url = request.url();
    if (/\/data\/foot-traffic\/(?:pop-[^/]+\.json|roads\/)|\/v2\/maps\/sdk\.js|(?:map\d|t\d)\.daumcdn\.net/.test(url)) heavyRequests.push(safe(url));
  });
  await page.clock.setFixedTime(new Date(fixedTime));
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await expect(page.getByTestId('dashboard-bento')).toBeVisible();
  await expect(region(page, '시간대별 생활인구').getByRole('group', { name: '시간대별 공개 생활인구' }).getByRole('button')).toHaveCount(population.hourly.length);
  await page.evaluate(() => document.fonts.ready);
  return { context, page, heavyRequests };
}

async function dashboard(page) {
  await page.locator('#nav [data-page="dashboard"]').click();
  await expect(page.getByTestId('dashboard-bento')).toBeVisible();
}

async function readChecklist(page) {
  await navigate(page, 'checklist');
  await expect(page.locator('#page-checklist.active')).toBeVisible();
  return page.locator('#page-checklist input[data-task]').evaluateAll((inputs) => inputs.map((input) => ({
    id: input.dataset.task,
    done: input.checked,
    label: input.getAttribute('aria-label'),
    group: input.closest('section').querySelector('h3').textContent.replace(/\s*\d+개\s*$/, '').trim(),
  })));
}

async function assertOpeningTimeline(page, opening, today) {
  const card = region(page, '개업 일정');
  const calendar = card.getByRole('figure', { name: '개업 일정 타임라인', exact: true });
  await expect(calendar).toBeVisible();
  const days = calendar.locator('time[datetime]');
  expect(await days.count()).toBeGreaterThan(7);
  await expect(calendar.locator(`time[datetime="${opening}"]`)).toHaveAttribute('aria-label', `개업일 ${opening}`);
  await expect(calendar.getByText('개업일', { exact: true })).toBeVisible();
  if (today) await expect(calendar.locator(`time[datetime="${today}"]`)).toHaveText('오늘');
  await expect(card).toContainText(opening.replaceAll('-', '.'));
  return { opening, totalDays: await days.count() };
}

async function assertProgress(page, tasks) {
  const done = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  const progress = region(page, '체크리스트 완료율');
  await expect(progress.getByRole('img')).toHaveAccessibleName(`체크리스트 ${total}개 중 ${done}개 완료, ${Math.round(done / total * 100)}%`);
  await expect(progress.getByText(`전체 ${total}개 기준`, { exact: true })).not.toBeVisible();
  for (const group of new Set(tasks.map((task) => task.group))) {
    const members = tasks.filter((task) => task.group === group);
    const completed = members.filter((task) => task.done).length;
    const stage = progress.getByRole('progressbar', { name: group, exact: true });
    await expect(stage).toHaveAttribute('aria-valuenow', String(completed));
    await expect(stage).toHaveAttribute('aria-valuemax', String(total || 1));
    await expect(stage).toHaveAttribute('aria-valuetext', `전체 ${total}개 중 ${group} ${completed}개 완료`);
    const row = stage.locator('..');
    await expect(row.getByText(`${completed}개`, { exact: true })).toBeVisible();
    await expect(row).not.toContainText(/\d+\s*\/\s*\d+/);
  }
  return { done, total, percentage: Math.round(done / total * 100) };
}

async function assertRingPaint(ring, { done, total, stages = [] }) {
  const expected = total ? done / total * 100 : 0;
  const painted = await ring.locator('svg').evaluate((svg) => {
    const arc = (circle) => {
      const scale = Number(circle.getAttribute('pathLength') || 100);
      const dash = circle.getAttribute('stroke-dasharray');
      const length = dash ? Number(dash.split(/[\s,]+/)[0]) / scale * 100 : 100;
      const offset = -Number(circle.getAttribute('stroke-dashoffset') || 0) / scale * 100;
      const cap = circle.getAttribute('stroke-linecap');
      // Account for the painted round ends, independently of the raw dash length.
      const endLength = dash && cap === 'round'
        ? Number(circle.getAttribute('stroke-width')) / (2 * Math.PI * Number(circle.getAttribute('r'))) * 50
        : 0;
      return { start: offset - endLength, end: offset + length + endLength, length: length + endLength * 2, cap, opacity: circle.getAttribute('stroke-opacity') };
    };
    return {
      stages: [...svg.querySelectorAll('g[data-stage]')].map((group) => ({
        label: group.dataset.stage, arcs: [...group.querySelectorAll('circle')].map(arc),
      })),
      masks: [...svg.querySelectorAll('mask')].map((mask) => ({ id: mask.id, arcs: [...mask.querySelectorAll('circle')].map(arc) })),
      maskReferences: [...svg.querySelectorAll('g[mask]')].map((group) => group.getAttribute('mask')),
      fallback: [...svg.querySelectorAll(':scope > circle[pathLength]')].map(arc),
    };
  });
  expect(painted.stages.map((stage) => stage.label)).toEqual(stages.map((stage) => stage.label));
  let offset = 0;
  for (const [index, stage] of stages.entries()) {
    const arcs = painted.stages[index].arcs;
    expect(arcs).toHaveLength(stage.done ? 1 : 0);
    if (!stage.done) continue;
    const length = stage.done / total * 100;
    expect(arcs[0].cap).toBe('butt');
    expect(arcs[0].opacity).toBe('1');
    expect(arcs[0].start).toBeCloseTo(offset, 10);
    expect(arcs[0].length).toBeCloseTo(length, 10);
    offset += length;
  }
  if (stages.length) {
    expect(painted.fallback).toHaveLength(0);
    expect(offset).toBeCloseTo(expected, 10);
    if (expected > 0 && expected < 100) {
      expect(painted.masks).toHaveLength(1);
      expect(painted.maskReferences).toEqual([`url(#${painted.masks[0].id})`]);
      expect(painted.masks[0].arcs).toHaveLength(1);
      expect(painted.masks[0].arcs[0].start).toBeCloseTo(0, 10);
      expect(painted.masks[0].arcs[0].end).toBeCloseTo(expected, 10);
    }
  } else {
    expect(painted.fallback).toHaveLength(expected ? 1 : 0);
    if (expected) {
      expect(painted.fallback[0].start).toBeCloseTo(0, 10);
      expect(painted.fallback[0].end).toBeCloseTo(expected, 10);
    }
  }
  if (expected === 100) {
    expect(painted.masks).toHaveLength(0);
    expect(painted.maskReferences).toHaveLength(0);
  }
  return { expectedPercentage: expected, ...painted };
}

async function assertFits(page, width) {
  const bento = page.getByTestId('dashboard-bento');
  await expect(bento.locator('section[aria-label]')).toHaveCount(5);
  await expect(bento.getByRole('region', { name: '새 알림', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^알림, 읽지 않은 알림 \d+개$/ })).toBeVisible();
  for (const label of labels) await expect(region(page, label)).toBeVisible();
  const dimensions = await bento.evaluate((grid) => {
    const bounds = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll('section[aria-label]')].map((card) => {
      const rect = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      return {
        name: card.getAttribute('aria-label'), left: rect.left, right: rect.right, top: rect.top,
        headingTop: card.querySelector('h2').getBoundingClientRect().top,
        overflow: card.scrollWidth - card.clientWidth,
        background: style.backgroundColor, radius: style.borderRadius,
        borders: { top: style.borderTopWidth, right: style.borderRightWidth, bottom: style.borderBottomWidth, left: style.borderLeftWidth },
      };
    });
    const smallText = [...grid.querySelectorAll('*')].flatMap((element) => {
      if (element.closest('svg, [aria-hidden="true"], .sr-only') || !element.checkVisibility()) return [];
      const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent.trim()).join('').trim();
      if (!text || element.getBoundingClientRect().height < 2) return [];
      const size = parseFloat(getComputedStyle(element).fontSize);
      return size < 12 ? [{ text, size }] : [];
    });
    return { document: document.documentElement.scrollWidth, firstCard: grid.firstElementChild?.getAttribute('aria-label'), grid: { left: bounds.left, right: bounds.right, top: bounds.top }, cards, smallText };
  });
  expect(dimensions.document).toBeLessThanOrEqual(width + 1);
  expect(dimensions.firstCard).toBe('개업 일정');
  const opening = dimensions.cards.find((card) => card.name === '개업 일정');
  expect(Math.abs(opening.left - dimensions.grid.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(opening.right - dimensions.grid.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(opening.top - dimensions.grid.top)).toBeLessThanOrEqual(1);
  for (const card of dimensions.cards) {
    expect(card.left, card.name).toBeGreaterThanOrEqual(0);
    expect(card.right, card.name).toBeLessThanOrEqual(width + 1);
    expect(card.overflow, card.name).toBeLessThanOrEqual(1);
  }
  if (width >= 1280) {
    const preparation = dimensions.cards.find((section) => section.name === '체크리스트 완료율');
    const priority = dimensions.cards.find((section) => section.name === '먼저 결정할 일');
    const upcoming = dimensions.cards.find((section) => section.name === '다음 할 일');
    const population = dimensions.cards.find((section) => section.name === '시간대별 생활인구');
    expect(Math.abs(preparation.left - upcoming.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(priority.left - population.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(preparation.headingTop - priority.headingTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(upcoming.headingTop - population.headingTop)).toBeLessThanOrEqual(1);
    for (const section of dimensions.cards) {
      expect(section.background, section.name).toBe('rgba(0, 0, 0, 0)');
      expect(section.radius, section.name).toBe('0px');
      for (const side of ['top', 'right', 'left']) expect(section.borders[side], `${section.name}: ${side}`).toBe('0px');
      expect(section.borders.bottom, section.name).toBe('0px');
    }
  }
  expect(dimensions.smallText).toEqual([]);
  return dimensions;
}

let taskFixture;
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
    const { context, page, heavyRequests } = await openDashboard(name, width, height);
    try {
      await check(page, `${name}: opening fills the first row and five sections fit with navbar notifications`, () => assertFits(page, width));
      await check(page, `${name}: opening date stays centered in the scrollable timeline`, async () => {
        const viewport = region(page, '개업 일정').getByRole('region', { name: '날짜별 준비 일정, 좌우로 스크롤' });
        const gap = await viewport.evaluate((element) => {
          const opening = element.querySelector('time[aria-label^="개업일"]');
          const area = element.getBoundingClientRect();
          const day = opening.getBoundingClientRect();
          return Math.abs((day.left + day.right - area.left - area.right) / 2);
        });
        expect(gap).toBeLessThan(2);
      });

      if (name === 'desktop') {
        await check(page, 'completion ring and stages match the full checklist', async () => {
          const tasks = await readChecklist(page);
          taskFixture = tasks;
          assert.ok(tasks.length > 3, 'the ring must include more than the upcoming preview');
          await dashboard(page);
          return assertProgress(page, tasks);
        });

        await check(page, 'opening timeline centers the opening date and scrolls through checklist events', async () => {
          const details = await assertOpeningTimeline(page, '2027-03-02', '2026-11-21');
          const calendar = region(page, '개업 일정').getByRole('figure', { name: '개업 일정 타임라인' });
          const viewport = calendar.getByRole('region', { name: '날짜별 준비 일정, 좌우로 스크롤' });
          const position = await viewport.evaluate((element) => {
            const opening = element.querySelector('time[aria-label^="개업일"]');
            const area = element.getBoundingClientRect();
            const day = opening.getBoundingClientRect();
            return { centerGap: Math.abs((day.left + day.right - area.left - area.right) / 2), before: element.scrollLeft, max: element.scrollWidth - element.clientWidth, scrollbar: getComputedStyle(element).scrollbarWidth };
          });
          expect(position.centerGap).toBeLessThan(2);
          expect(position.before).toBeGreaterThan(0);
          expect(position.max).toBeGreaterThan(position.before);
          expect(position.scrollbar).toBe('none');
          expect(await calendar.locator('span[title]').count()).toBeGreaterThan(0);
          await viewport.evaluate((element) => { element.scrollLeft -= 400; });
          expect(await viewport.evaluate((element) => element.scrollLeft)).toBeLessThan(position.before);
          const firstEvent = calendar.locator('span[title]').first();
          await firstEvent.scrollIntoViewIfNeeded();
          await expect(firstEvent).toBeInViewport();
          return details;
        });

        await check(page, 'completed preview rows stay struck through after reload and can be unchecked', async () => {
          assert.ok(taskFixture, 'the checklist oracle is required');
          const upcoming = region(page, '다음 할 일');
          const previewIds = await upcoming.locator('input[data-task]').evaluateAll((inputs) => inputs.map((input) => input.dataset.task));
          const checkbox = upcoming.locator('input[data-task]:not(:checked)').first();
          const id = await checkbox.getAttribute('data-task');
          const before = taskFixture.find((task) => task.id === id);
          assert.ok(before && !before.done);
          await checkbox.click();
          const updated = taskFixture.map((task) => task.id === id ? { ...task, done: true } : task);
          const count = await assertProgress(page, updated);
          const retained = upcoming.getByRole('checkbox', { name: before.label, exact: true });
          const title = retained.locator('..').locator('span').first().locator('span').first();
          await expect(retained).toBeChecked();
          await expect(title).toHaveCSS('text-decoration-line', 'line-through');
          await expect(title).toHaveCSS('font-size', '15px');
          expect(await upcoming.locator('input[data-task]').evaluateAll((inputs) => inputs.map((input) => input.dataset.task))).toEqual(previewIds);
          expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('foundy-v5-demo-tasksdone'))[id], id)).toBe(true);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await assertProgress(page, updated);
          await expect(retained).toBeChecked();
          await expect(title).toHaveCSS('text-decoration-line', 'line-through');
          const persisted = await readChecklist(page);
          expect(persisted.find((task) => task.id === id).done).toBe(true);
          await dashboard(page);
          await retained.uncheck();
          await expect(retained).not.toBeChecked();
          await expect(title).toHaveCSS('text-decoration-line', 'none');
          await assertProgress(page, taskFixture);
          expect(await page.evaluate((id) => Boolean(JSON.parse(localStorage.getItem('foundy-v5-demo-tasksdone'))[id]), id)).toBe(false);
          return { task: id, group: before.group, ...count };
        });

        await check(page, 'priority action navigates to its matching report card', async () => {
          const priority = region(page, '먼저 결정할 일');
          const title = await priority.getByRole('heading', { level: 3 }).innerText();
          const action = priority.getByRole('button', { name: '선택지 확인', exact: true });
          const id = await action.getAttribute('data-focus');
          assert.ok(id);
          await action.click();
          await expect(page).toHaveURL(`${baseURL}/report`);
          const target = page.locator(`#result-${id}`);
          await expect(target).toContainText(title);
          await expect(target).toBeInViewport();
          await dashboard(page);
          return { id, title };
        });

        await check(page, 'population bars select the source hour and value by click and keyboard focus', async () => {
          const card = region(page, '시간대별 생활인구');
          const chart = card.getByRole('group', { name: '시간대별 공개 생활인구' });
          for (const [hour, action] of [[1, 'click'], [14, 'focus']]) {
            const point = population.hourly.find((point) => point.hour === hour);
            const value = Math.round(point.value).toLocaleString('ko-KR');
            const bar = chart.getByRole('button', { name: new RegExp(`^${hour}시, `) });
            await bar[action]();
            if (action === 'focus') await expect(bar).toBeFocused();
            await expect(bar).toHaveAttribute('aria-pressed', 'true');
            await expect(chart.locator('[aria-pressed="true"]')).toHaveCount(1);
            await expect(card.getByText(`${String(hour).padStart(2, '0')}시`, { exact: true }).first()).toBeVisible();
            await expect(card.locator('strong')).toHaveText(value);
            await expect(card.locator('strong').locator('..').getByText(point.partial ? '일부 공개값 합계' : '공개값 합계', { exact: true })).toBeVisible();
          }
          return { clickedHour: 1, focusedHour: 14, sourceDate: population.sourceDate };
        });
      }

      await check(page, `${name}: population tooltip follows hover and keyboard focus without overflowing`, async () => {
        const chart = region(page, '시간대별 생활인구').getByRole('group', { name: '시간대별 공개 생활인구' });
        await page.locator('h1').click();
        for (const hour of [0, 16, 23]) {
          const point = population.hourly.find((point) => point.hour === hour);
          const bar = chart.getByRole('button', { name: new RegExp(`^${hour}시, `) });
          await bar.hover();
          const tooltip = chart.getByRole('tooltip');
          await expect(tooltip).toHaveCount(1);
          await expect(tooltip).toContainText(`${String(hour).padStart(2, '0')}시`);
          await expect(tooltip).toContainText(`${Math.round(point.value).toLocaleString('ko-KR')}명`);
          await expect(bar).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id'));
          const box = await tooltip.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          await tooltip.hover();
          await expect(tooltip).toBeVisible();
          await page.mouse.move(0, 0);
          await expect(tooltip).toHaveCount(0);
        }
        const keyboardBar = chart.getByRole('button').nth(12);
        await keyboardBar.focus();
        await page.keyboard.press('Tab');
        await expect(chart.getByRole('tooltip')).toContainText('13시');
        await page.keyboard.press('Escape');
        await expect(chart.getByRole('tooltip')).toHaveCount(0);
        await page.keyboard.press('Tab');
        await expect(chart.getByRole('tooltip')).toContainText('14시');
        await page.locator('h1').click();
        await expect(chart.getByRole('tooltip')).toHaveCount(0);
        return { hours: [0, 16, 23], width, keyboardDismissal: true };
      });

      await check(page, `${name}: dashboard does not request original population assets or a map SDK`, async () => {
        expect(heavyRequests).toEqual([]);
        return { heavyRequests };
      });
    } finally { await context.close(); }
  }

  for (const complete of [false, true]) {
    const name = complete ? 'all-complete' : 'zero-complete';
    const { context, page } = await openDashboard(name);
    try {
      await check(page, `${name}: stored task completion renders the correct edge state after reload`, async () => {
        assert.ok(taskFixture, 'the checklist oracle is required');
        const tasks = taskFixture.map((task) => ({ ...task, done: complete }));
        await page.evaluate((tasks) => {
          localStorage.setItem('foundy-v5-demo-tasksdone', JSON.stringify(Object.fromEntries(tasks.map((task) => [task.id, task.done]))));
        }, tasks);
        await page.reload({ waitUntil: 'domcontentloaded' });
        const count = await assertProgress(page, tasks);
        const preview = region(page, '다음 할 일');
        await expect(preview.getByRole('checkbox')).toHaveCount(3);
        for (const checkbox of await preview.getByRole('checkbox').all()) {
          await expect(checkbox).toBeChecked({ checked: complete });
          const title = checkbox.locator('..').locator('span').first().locator('span').first();
          await expect(title).toHaveCSS('text-decoration-line', complete ? 'line-through' : 'none');
        }
        return count;
      });
    } finally { await context.close(); }
  }

  const page = await browser.newPage();
  const { load } = createSourceRuntime();
  const { DashboardView } = load('@/components/dashboard/DashboardView');
  const { DEMO_STORE } = load('@/data/store');
  const resolvedDashboard = JSON.parse(JSON.stringify({
    store: DEMO_STORE, name: '검증 가게', undecided: false, days: 100,
    decisions: [], taskCount: { done: 2, total: 9 }, unread: 0, actions: [], tasks: [],
  }));
  page.on('pageerror', (error) => report.pageErrors.push({ name: 'JSON props', message: safe(error.message) }));

  await check(page, 'stage contributions share the overall denominator from JSON props', async () => {
    const stages = [
      { label: '계약 전', done: 1, total: 4 },
      { label: '개업 4주 전', done: 2, total: 4 },
      { label: '개업 직전', done: 2, total: 3 },
    ];
    const tasks = stages.flatMap((stage) => Array.from({ length: stage.total }, (_, index) => ({
      id: `${stage.label}-${index}`, group: stage.label, done: index < stage.done,
    })));
    await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
      data: { ...resolvedDashboard, taskCount: { done: 5, total: 11 }, stages },
    })));
    const count = await assertProgress(page, tasks);
    const ring = region(page, '체크리스트 완료율').getByRole('img');
    await expect(ring).toHaveAccessibleName('체크리스트 11개 중 5개 완료, 45%');
    const paint = await assertRingPaint(ring, { done: 5, total: 11, stages });
    return { ...count, paint, stages: stages.map(({ label, done }) => ({ label, done, denominator: 11 })) };
  });

  await check(page, 'ring preserves tiny contributions and paints exact zero and full completion', async () => {
    const fixtures = [
      { done: 1, total: 1000, stages: [{ label: '계약 전', done: 1, total: 1000 }] },
      { done: 500, total: 1000, stages: [
        { label: '계약 전', done: 1, total: 400 },
        { label: '개업 4주 전', done: 0, total: 100 },
        { label: '개업 직전', done: 499, total: 500 },
      ] },
      { done: 0, total: 11, stages: [{ label: '계약 전', done: 0, total: 11 }] },
      { done: 0, total: 0, stages: [] },
      { done: 11, total: 11, stages: [
        { label: '계약 전', done: 4, total: 4 },
        { label: '개업 4주 전', done: 4, total: 4 },
        { label: '개업 직전', done: 3, total: 3 },
      ] },
      { done: 1, total: 1, stages: [{ label: '계약 전', done: 1, total: 1 }] },
    ];
    const results = [];
    for (const { done, total, stages } of fixtures) {
      await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
        data: { ...resolvedDashboard, taskCount: { done, total }, stages },
      })));
      const ring = region(page, '체크리스트 완료율').getByRole('img');
      await expect(ring).toHaveAccessibleName(total
        ? `체크리스트 ${total}개 중 ${done}개 완료, ${Math.round(done / total * 100)}%`
        : '아직 등록된 체크리스트가 없습니다');
      results.push(await assertRingPaint(ring, { done, total, stages }));
    }
    return results;
  });

  await check(page, 'missing or inconsistent stage aggregates retain the exact overall fallback arc', async () => {
    const results = [];
    for (const [done, total, stages] of [
      [1, 1000, undefined],
      [5, 11, [{ label: '계약 전', done: 4, total: 11 }]],
      [5, 11, [{ label: '계약 전', done: 5, total: 10 }]],
    ]) {
      await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
        data: { ...resolvedDashboard, taskCount: { done, total }, stages },
      })));
      results.push(await assertRingPaint(region(page, '체크리스트 완료율').getByRole('img'), { done, total }));
    }
    return results;
  });

  await check(page, 'API opening date renders the timeline across a year boundary without a provider', async () => {
    await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
      data: { ...resolvedDashboard, store: { ...resolvedDashboard.store, opening: '2027-01-01' } },
    })));
    return assertOpeningTimeline(page, '2027-01-01');
  });

  await check(page, 'invalid and unset opening dates show an unset countdown without a fabricated week', async () => {
    for (const opening of ['2027-02-30', '']) {
      await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
        data: { ...resolvedDashboard, store: { ...resolvedDashboard.store, opening } },
      })));
      const card = region(page, '개업 일정');
      await expect(card.getByText('미정', { exact: true })).toBeVisible();
      await expect(card.getByRole('figure', { name: '개업 일정 타임라인' })).toHaveCount(0);
      await expect(card.locator('time[datetime]')).toHaveCount(0);
    }
  });

  await check(page, 'opening countdown distinguishes opening day and days since opening', async () => {
    for (const [days, label] of [[0, 'D-DAY'], [-3, 'D+3']]) {
      await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
        data: { ...resolvedDashboard, days },
      })));
      await expect(region(page, '개업 일정').getByText(label, { exact: true })).toBeVisible();
      await expect(region(page, '개업 일정').getByRole('figure', { name: '개업 일정 타임라인' })).toBeVisible();
    }
  });

  await check(page, 'undecided JSON props offer location discovery without report counts', async () => {
    // The existing store normalizes undecided persisted locations. This isolates
    // the supported view contract without changing that unrelated lifecycle.
    const data = JSON.parse(JSON.stringify({
      store: { ...DEMO_STORE, location: 'undecided', address: '' }, name: '미정 가게', undecided: true, days: 100,
      decisions: [], taskCount: { done: 0, total: 0 }, unread: 0, actions: [], tasks: [],
      reportCounts: { high: 99, unknown: 88, low: 77, ok: 66 },
    }));
    await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, { data })));
    const priority = region(page, '먼저 결정할 일');
    await expect(priority.getByRole('button', { name: '상권 둘러보기', exact: true })).toHaveAttribute('data-p', 'sites');
    await expect(priority).not.toContainText('점검 현황');
    await expect(priority).not.toContainText('모의 점검');
    await expect(priority).not.toContainText(/\d+건|99|88|77|66/);
    await expect(priority.getByRole('button', { name: /선택지 확인|점검 리포트 보기/ })).toHaveCount(0);
    return { fixture: 'DashboardView JSON props, no provider', locationAction: 'sites' };
  });

  await check(page, 'population loading leaves resolved dashboard cards available', async () => {
    await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
      data: resolvedDashboard, population: { loading: true },
    })));
    await expect(region(page, '체크리스트 완료율').getByRole('img')).toHaveAccessibleName('체크리스트 9개 중 2개 완료, 22%');
    await expect(region(page, '먼저 결정할 일')).toBeVisible();
    await expect(page.getByRole('status', { name: '생활인구를 불러오는 중', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(1);
    await expect(page.getByTestId('dashboard-bento-skeleton')).toHaveCount(0);
    return { completed: 2, total: 9, loadingSection: 'population only' };
  });

  await check(page, 'population failure leaves resolved dashboard cards available', async () => {
    const message = '생활인구 연결을 확인해 주세요.';
    await page.setContent(renderToStaticMarkup(React.createElement(DashboardView, {
      data: resolvedDashboard, population: { error: message },
    })));
    await expect(region(page, '체크리스트 완료율').getByRole('img')).toHaveAccessibleName('체크리스트 9개 중 2개 완료, 22%');
    await expect(region(page, '먼저 결정할 일')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-bento-skeleton')).toHaveCount(0);
    return { completed: 2, total: 9, errorSection: 'population only' };
  });
  await page.close();
} finally {
  await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify({ passed: report.checks.filter((check) => check.passed).length, failed: report.checks.filter((check) => !check.passed).length, pageErrors: report.pageErrors, report: path.join(output, 'report.json') }, null, 2));
if (report.checks.some((check) => !check.passed) || report.pageErrors.length) process.exitCode = 1;
