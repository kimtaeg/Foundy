import { selectOpeningDate } from './helpers/select-opening-date.mjs';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSourceRuntime } from './helpers/source-runtime.mjs';
import { navigate } from './helpers/navigate.mjs';
import { signIn } from './helpers/sign-in.mjs';

const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const output = path.resolve(import.meta.dirname, '../work/checklist-redesign');
const fixedTime = '2026-11-21T12:00:00+09:00';
const { load } = createSourceRuntime();
const { createTasks } = load('@/lib/checklist/tasks');
const { DEMO_STORE } = load('@/data/store');
const { GROUPS, OFFS } = load('@/data/checklist');
const fixtureTasks = createTasks().filter((task) => DEMO_STORE.employees || task.category !== '고용');
const report = { baseURL, fixedTime, checks: [], pageErrors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(output, { recursive: true });

const checklist = (page) => page.locator('#page-checklist.active');
const rows = (page) => checklist(page).locator('li[data-checklist-task]');
const toolbar = (page) => checklist(page).getByTestId('checklist-toolbar');
const progress = (page) => checklist(page).getByTestId('checklist-progress');
const taskInput = (page, id) => checklist(page).locator(`input[data-task="${id}"]`);
const saved = (page, key) => page.evaluate((name) => JSON.parse(localStorage.getItem(`foundy-v5-demo-${name}`) || 'null'), key);
const addDays = (date, offset) => {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
};

async function selectView(page, view) {
  await checklist(page).locator(`[data-nx="cview"][data-v="${view}"]`).click();
  if (view === 'calendar') await expect(checklist(page).locator('[data-nx="calday"]').first()).toBeVisible();
  else await expect(rows(page).first()).toBeVisible();
}

async function readTasks(page) {
  return rows(page).evaluateAll((items) => items.map((item) => ({
    id: item.dataset.checklistTask,
    done: item.querySelector('input[data-task]').checked,
    group: item.closest('[data-checklist-group]').dataset.checklistGroup,
  })));
}

async function assertProgress(page, tasks) {
  const done = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  const bar = progress(page).getByRole('progressbar', { name: '전체 체크리스트 완료율' });
  await expect(bar).toHaveAttribute('aria-valuenow', String(total ? Math.round(done / total * 100) : 0));
  await expect(bar).toHaveAttribute('aria-valuetext', `${total}개 중 ${done}개 완료`);
}

async function selectMonth(page, date) {
  const [year, month] = date.split('-').map(Number);
  const first = checklist(page).locator('[data-nx="calday"]').first();
  const [currentYear, currentMonth] = (await first.getAttribute('data-d')).split('-').map(Number);
  const distance = (year - currentYear) * 12 + month - currentMonth;
  expect(Math.abs(distance), 'calendar fixture must be reachable in a bounded number of months').toBeLessThan(24);
  for (let index = 0; index < Math.abs(distance); index += 1) {
    const previousDate = await first.getAttribute('data-d');
    await checklist(page).locator(`[data-nx="calmove"][data-n="${distance > 0 ? 1 : -1}"]`).click();
    await expect(first).not.toHaveAttribute('data-d', previousDate);
  }
  await expect(first).toHaveAttribute('data-d', `${date.slice(0, 7)}-01`);
}

async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
  const clipped = await checklist(page).locator('[data-checklist-task], [data-nx="calday"], [data-testid="checklist-progress"]').evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)
      ? [{ tag: element.tagName, id: element.getAttribute('data-checklist-task') || element.getAttribute('data-d'), left: rect.left, right: rect.right }]
      : [];
  }));
  expect(clipped, 'checklist content must fit inside the viewport').toEqual([]);
  return dimensions;
}

async function scenario(name, run, width = 1440, height = 1000) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => report.pageErrors.push({ name, message: error.message }));
  try {
    await page.clock.setFixedTime(new Date(fixedTime));
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await signIn(page);
    await page.goto(`${baseURL}/checklist`, { waitUntil: 'domcontentloaded' });
    await expect(rows(page)).toHaveCount(fixtureTasks.length);
    await page.evaluate(() => document.fonts.ready);
    const detail = await run(page);
    report.checks.push({ name, passed: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message.slice(0, 700)}`);
    await page.screenshot({ path: path.join(output, `failure-${report.checks.length}.png`), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  }
}

try {
  await scenario('timeline groups and inline preparation disclosure', async (page) => {
    const tasks = await readTasks(page);
    await assertProgress(page, tasks);
    expect(tasks.map((task) => task.id).sort()).toEqual(fixtureTasks.map((task) => task.id).sort());
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);
    const expectedGroups = GROUPS.filter((group) => fixtureTasks.some((task) => task.group === group));
    const groups = checklist(page).locator('section[data-checklist-group]');
    expect(await groups.locator('h3').allTextContents()).toEqual(expectedGroups);
    for (const task of tasks) expect(task.group).toBe(fixtureTasks.find((item) => item.id === task.id).group);
    const row = rows(page).first();
    const fixture = fixtureTasks.find((task) => task.id === tasks[0].id);
    const summary = row.getByRole('button', { name: '준비 정보', exact: true });
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await expect(row.locator('dl')).toBeHidden();
    const guide = await row.locator('[data-nx="godocs"]').boundingBox();
    const disclosure = await summary.boundingBox();
    expect(Math.abs((guide.y + guide.height / 2) - (disclosure.y + disclosure.height / 2))).toBeLessThan(2);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(row.getByText(fixture.documents, { exact: true })).toBeVisible();
    await expect(row.getByText(fixture.agency, { exact: true })).toBeVisible();
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(await summary.boundingBox()).toEqual(disclosure);
    await page.keyboard.press('Space');
    await expect(row.locator('dl')).toBeHidden();
    await expect(row.locator('input[data-task]')).not.toBeChecked();
    return { groups: expectedGroups, tasks: tasks.length };
  });

  await scenario('status filters keep the overall summary and category grouping', async (page) => {
    const tasks = await readTasks(page);
    const summary = await progress(page).innerText();
    await expect(toolbar(page).getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'true');
    for (const [name, done] of [['남은 일', false], ['완료', true]]) {
      const button = toolbar(page).getByRole('button', { name, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      const expected = tasks.filter((task) => task.done === done);
      await expect(rows(page)).toHaveCount(expected.length);
      expect((await readTasks(page)).map((task) => task.id).sort()).toEqual(expected.map((task) => task.id).sort());
      expect(await progress(page).innerText()).toBe(summary);
      await assertProgress(page, tasks);
    }
    await toolbar(page).getByRole('button', { name: '전체', exact: true }).click();
    await selectView(page, 'category');
    await expect(rows(page)).toHaveCount(tasks.length);
    for (const task of await readTasks(page)) expect(task.group).toBe(fixtureTasks.find((item) => item.id === task.id).category);
    expect(await progress(page).innerText()).toBe(summary);
    return { total: tasks.length, done: tasks.filter((task) => task.done).length };
  });

  await scenario('completion updates filters, dashboard progress, and survives reload', async (page) => {
    const before = await readTasks(page);
    const pending = before.find((task) => !task.done);
    const summaryBefore = await progress(page).innerText();
    await toolbar(page).getByRole('button', { name: '남은 일', exact: true }).click();
    // This filter removes the row immediately; check() would retry a detached input.
    await taskInput(page, pending.id).click();
    await expect(rows(page).filter({ has: page.locator(`input[data-task="${pending.id}"]`) })).toHaveCount(0);
    await expect(progress(page)).not.toHaveText(summaryBefore);
    await assertProgress(page, before.map((task) => task.id === pending.id ? { ...task, done: true } : task));
    expect((await saved(page, 'tasksdone'))[pending.id]).toBe(true);
    await toolbar(page).getByRole('button', { name: '완료', exact: true }).click();
    await expect(taskInput(page, pending.id)).toBeChecked();
    await navigate(page, 'dashboard');
    const total = before.length;
    const done = before.filter((task) => task.done).length + 1;
    await expect(page.getByTestId('dashboard-bento').getByRole('region', { name: '체크리스트 완료율', exact: true }).getByRole('img')).toHaveAccessibleName(`체크리스트 ${total}개 중 ${done}개 완료, ${Math.round(done / total * 100)}%`);
    await navigate(page, 'checklist');
    await expect(page).toHaveURL(/\/checklist\/?$/);
    await expect(taskInput(page, pending.id)).toBeChecked();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(taskInput(page, pending.id)).toBeChecked();
    await expect(rows(page)).toHaveCount(total);
    await taskInput(page, pending.id).uncheck();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(taskInput(page, pending.id)).toBeVisible();
    await expect(taskInput(page, pending.id)).not.toBeChecked();
    await assertProgress(page, before);
    return { toggledTask: pending.id, done, total };
  });

  await scenario('empty completed and remaining filters keep all tasks reachable', async (page) => {
    const initial = await readTasks(page);
    await toolbar(page).getByRole('button', { name: '완료', exact: true }).click();
    for (const task of initial.filter(({ done }) => done)) {
      await taskInput(page, task.id).click();
      await expect(taskInput(page, task.id)).toHaveCount(0);
    }
    await expect(checklist(page).getByRole('status')).toHaveText('아직 완료한 항목이 없어요.');
    await assertProgress(page, initial.map((task) => ({ ...task, done: false })));
    await toolbar(page).getByRole('button', { name: '남은 일', exact: true }).click();
    for (const task of initial) {
      await taskInput(page, task.id).click();
      await expect(taskInput(page, task.id)).toHaveCount(0);
    }
    await expect(checklist(page).getByRole('status')).toHaveText('남은 준비가 없어요.');
    await assertProgress(page, initial.map((task) => ({ ...task, done: true })));
    await toolbar(page).getByRole('button', { name: '전체', exact: true }).click();
    await expect(rows(page)).toHaveCount(initial.length);
  });

  await scenario('document action navigates without completing its task', async (page) => {
    const link = checklist(page).locator('[data-nx="godocs"]').first();
    const id = await link.getAttribute('data-tid');
    const checked = await taskInput(page, id).isChecked();
    const savedBefore = await saved(page, 'tasksdone');
    await link.click();
    await expect(page.locator('#page-docs.active')).toBeVisible();
    expect(await saved(page, 'tasksdone')).toEqual(savedBefore);
    await navigate(page, 'checklist');
    await expect(taskInput(page, id)).toBeChecked({ checked });
    return { linkedTask: id, checked };
  });

  await scenario('calendar selection, today semantics, opening date, and task sync', async (page) => {
    const task = fixtureTasks.find((item) => item.id === 'c-06');
    await selectView(page, 'calendar');
    await selectMonth(page, task.due);
    const day = checklist(page).locator(`[data-nx="calday"][data-d="${task.due}"]`);
    await day.focus();
    await page.keyboard.press('Enter');
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    await expect(checklist(page).locator('[data-nx="calday"][aria-pressed="true"]')).toHaveCount(1);
    await expect(taskInput(page, task.id)).not.toBeChecked();
    await checklist(page).getByRole('button', { name: '다음 달' }).click();
    await expect(checklist(page).getByRole('complementary')).toContainText('날짜를 선택');
    await selectMonth(page, task.due);
    await day.click();
    await taskInput(page, task.id).check();
    await selectView(page, 'timeline');
    await expect(taskInput(page, task.id)).toBeChecked();
    await selectView(page, 'calendar');
    await selectMonth(page, DEMO_STORE.opening);
    const openingDay = checklist(page).locator(`[data-nx="calday"][data-d="${DEMO_STORE.opening}"]`);
    await expect(openingDay).toContainText('개업일');
    await expect(openingDay).not.toHaveAttribute('aria-current', 'date');
    await openingDay.click();
    await expect(openingDay).toHaveAttribute('aria-pressed', 'true');
    await selectMonth(page, fixedTime.slice(0, 10));
    const today = checklist(page).locator('[data-nx="calday"][aria-current="date"]');
    await expect(today).toHaveCount(1);
    await expect(today).toHaveAttribute('data-d', fixedTime.slice(0, 10));
    await today.click();
    await expect(today).toHaveAttribute('aria-pressed', 'true');
    const { GRANTS } = load('@/data/grants');
    const sample = GRANTS.find((grant) => grant.deadline && grant.res !== 'unknown');
    await selectMonth(page, sample.deadline);
    await checklist(page).locator('[data-nx="calday"][data-d="' + sample.deadline + '"]').click();
    await expect(checklist(page).getByText('지원사업 마감 · ' + sample.title, {exact: true})).toBeVisible();
    return { task: task.id, today: fixedTime.slice(0, 10), opening: DEMO_STORE.opening };
  });

  await scenario('opening date edit recalculates visible deadlines and exported events', async (page) => {
    const opening = '2027-04-01';
    const titles = await checklist(page).locator('input[data-task]').evaluateAll((inputs) => Object.fromEntries(inputs.map((input) => [input.dataset.task, input.getAttribute('aria-label').replace(/ 완료$/, '')])));
    await checklist(page).locator('[data-nx="editDate"]').click();
    await expect(page.locator('#nxDateVal')).toHaveValue(DEMO_STORE.opening);
    await selectOpeningDate(page.locator('#nxDate'), opening);
    await expect(page.locator('#nxDateVal')).toHaveValue(opening);
    await page.locator('#nxDate button[type="submit"]').click();
    await expect(page.locator('#nxDate')).not.toBeVisible();
    expect((await saved(page, 'store')).opening).toBe(opening);
    const healthTask = rows(page).filter({ has: page.locator('input[data-task="c-06"]') });
    const due = addDays(opening, OFFS[5]);
    await expect(healthTask).toContainText(due.slice(5).replace('-', '.'));
    const downloadPromise = page.waitForEvent('download');
    await checklist(page).locator('[data-nx="ics"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('foundy-checklist.ics');
    const target = path.join(output, download.suggestedFilename());
    await download.saveAs(target);
    const contents = await readFile(target, 'utf8');
    const events = contents.split('BEGIN:VEVENT\r\n').slice(1);
    expect(contents).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    expect(events).toHaveLength(fixtureTasks.length + 1);
    for (const task of fixtureTasks) {
      const sourceIndex = createTasks().findIndex((item) => item.id === task.id);
      const date = addDays(opening, OFFS[sourceIndex]).replaceAll('-', '');
      expect(events.some((event) => event.includes(`DTSTART;VALUE=DATE:${date}\r\n`) && event.includes(`SUMMARY:${titles[task.id].replace(/[,;]/g, ' ')}\r\n`))).toBe(true);
    }
    expect(contents).toContain(`DTSTART;VALUE=DATE:${opening.replaceAll('-', '')}\r\n`);
    expect(contents).toContain('SUMMARY:개업일\r\n');
    expect(contents).not.toContain('SUMMARY:지원사업 마감');
    return { opening, taskDeadline: due, eventCount: events.length };
  });

  for (const width of [320, 390, 768, 1440]) {
    await scenario(`responsive views and dialog at ${width}px`, async (page) => {
      const dimensions = {};
      for (const view of ['timeline', 'category', 'calendar']) {
        await selectView(page, view);
        dimensions[view] = await noOverflow(page);
        if (view === 'calendar') {
          const days = checklist(page).locator('[data-nx="calday"]');
          const smallest = await days.evaluateAll((buttons) => Math.min(...buttons.map((button) => {
            const { width, height } = button.getBoundingClientRect();
            return Math.min(width, height);
          })));
          expect(smallest, 'day touch target').toBeGreaterThanOrEqual(44);
          await selectMonth(page, DEMO_STORE.opening);
          await checklist(page).locator(`[data-nx="calday"][data-d="${DEMO_STORE.opening}"]`).click();
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `${view}-${width}.png`), fullPage: true });
      }
      await checklist(page).locator('[data-nx="editDate"]').click();
      const trigger = page.locator('#nxDateVal-trigger');
      const hint = page.locator('#nxDateDescription');
      const before = await hint.boundingBox();
      await expect(trigger).toHaveText(DEMO_STORE.opening);
      await trigger.click();
      await expect(page.locator('#nxDate').getByRole('grid')).toBeVisible();
      const picker = page.locator('#nxDate').getByRole('dialog');
      await expect(picker).toHaveCSS('position', 'fixed');
      expect(await hint.boundingBox()).toEqual(before);
      const bounds = await picker.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
      dimensions.dialog = await noOverflow(page);
      const dialogBounds = await page.locator('#nxDate').boundingBox();
      expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
      expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(width + 1);
      await page.screenshot({ path: path.join(output, `date-dialog-${width}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#nxDate')).not.toBeVisible();
      return dimensions;
    }, width, width < 768 ? 844 : 1000);
  }
} finally {
  await browser.close();
  report.passed = report.checks.every((check) => check.passed) && report.pageErrors.length === 0;
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`${report.checks.filter((check) => check.passed).length}/${report.checks.length} scenarios passed; ${report.pageErrors.length} browser errors. Report: ${path.join(output, 'report.json')}`);
  if (!report.passed) process.exitCode = 1;
}
