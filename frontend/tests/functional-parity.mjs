import { selectOpeningDate } from './helpers/select-opening-date.mjs';
import { navigate } from './helpers/navigate.mjs';
import { signIn } from './helpers/sign-in.mjs';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'migrated';
const output = path.join(project, 'work', mode, 'functional');
await mkdir(output, { recursive: true });
let server, baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
if (mode === 'baseline') {
  const html = await readFile(path.join(project, 'foundy_toss_v5.html'));
  server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(new Date('2026-11-20T00:00:00+09:00'));
const result = { mode, checks: [], pageErrors: [], consoleErrors: [] };
page.on('pageerror', error => result.pageErrors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()); });
const saved = key => page.evaluate(key => JSON.parse(localStorage.getItem(`foundy-v5-demo-${key}`) || 'null'), key);
const active = route => page.locator(`#page-${route}.active`);
function backgroundOnWhite(row) {
  return row.evaluate((element) => {
    const context = document.createElement('canvas').getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
}
async function nav(route) {
  await navigate(page, route);
  await expect(active(route)).toBeVisible();
}
async function expectContentFirst(dialog, content) {
  await expect(dialog.locator(':scope > header, :scope > footer')).toHaveCount(0);
  await expect(content).toBeVisible();
  const [panel, first] = await Promise.all([dialog.boundingBox(), content.boundingBox()]);
  expect(first.y - panel.y).toBeGreaterThanOrEqual(0);
  expect(first.y - panel.y).toBeLessThanOrEqual(40);
}
async function expectBodyActions(dialog) {
  const actions = dialog.locator('#modalBody [data-dialog-actions]');
  await expect(actions).toHaveCSS('justify-content', 'space-between');
  await expect(actions).toHaveCSS('position', /^(static|relative)$/);
  return actions;
}
async function check(name, fn) {
  try {
    const detail = await fn();
    result.checks.push({ name, status: 'passed', detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    result.checks.push({ name, status: 'failed', error: error.message });
    await page.screenshot({ path: path.join(output, `${result.checks.length}-failure.png`), fullPage: true });
    console.log(`FAIL ${name}: ${error.message.slice(0, 300)}`);
    await page.keyboard.press('Escape');
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
}
try {
  await page.goto(mode === 'baseline' ? baseURL : `${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  if (mode !== 'baseline') {
    await check('incorrect credentials keep the visitor signed out', async () => {
      await page.locator('input[name="username"]').fill('demo');
      await page.locator('input[name="password"]').fill('incorrect-password');
      await page.getByRole('button', { name: '로그인', exact: true }).click();
      await expect(page.locator('#authScreen').getByRole('alert')).toBeVisible();
      await expect(page.locator('#authScreen')).toBeVisible();
      await expect(page).toHaveURL(`${baseURL}/login`);
      expect(await page.evaluate(() => localStorage.getItem('foundy-session'))).toBeNull();
      return { error: await page.locator('#authScreen').getByRole('alert').innerText() };
    });
  }
  await check('demo account login and dashboard', async () => {
    await signIn(page, { mode });
    await expect(active('dashboard')).toBeVisible();
    return { store: await saved('store'), text: await active('dashboard').innerText() };
  });
  await check('report choice confirmation, follow-up done in one step, linked task', async () => {
    await nav('report');
    if (mode !== 'baseline') {
      const report = active('report');
      const summary = report.getByRole('region', { name: '전체 점검 항목' });
      const filter = report.getByRole('group', { name: '점검 단계 필터' });
      const firstCard = report.locator('#result-r-01');
      const picker = firstCard.getByRole('button', { name: '선택하기', exact: true });
      const comparison = page.getByRole('dialog', { name: '선택지 비교' });
      await expect(picker).toHaveAccessibleDescription('영업 방식 정하기');
      await expect(picker).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(firstCard.locator('[data-nx="opt"]')).toHaveCount(0);
      await expect(firstCard.getByRole('button', { name: '다음', exact: true })).toHaveCount(0);
      await picker.press('Enter');
      await expectContentFirst(comparison, comparison.getByRole('heading', { name: '영업 방식 정하기', exact: true }));
      await expect(comparison.locator('#modalTitle')).toBeFocused();
      const dismiss = comparison.getByRole('button', { name: '창 닫기', exact: true });
      await expect(dismiss).toHaveCSS('position', 'absolute');
      await page.keyboard.press('Shift+Tab');
      await expect(dismiss).toBeFocused();
      await expect(dismiss).toHaveCSS('position', 'static');
      await page.keyboard.press('Enter');
      await expect(comparison).toHaveCount(0);
      await expect(picker).toBeFocused();
      await picker.press('Enter');
      const firstChoices = comparison.locator('[data-nx="opt"][data-id="r-01"]');
      await expect(firstChoices).toHaveCount(3);
      for (const label of ['술 빼고 카페로 시작', '용도변경 신청', '다른 자리를 알아보기']) {
        await expect(firstChoices.filter({ hasText: label })).toBeVisible();
      }
      for (const choice of await firstChoices.all()) {
        const row = await choice.boundingBox();
        const arrow = await choice.locator('svg').boundingBox();
        expect(Math.abs((arrow.y + arrow.height / 2) - (row.y + row.height / 2))).toBeLessThanOrEqual(1);
      }
      await firstChoices.filter({ hasText: '용도변경 신청' }).click();
      const confirmation = page.getByRole('dialog', { name: '선택지 적용 확인' });
      await expectContentFirst(confirmation, confirmation.getByRole('heading', { name: '용도변경 신청' }));
      const confirmActions = await expectBodyActions(confirmation);
      await confirmActions.getByRole('button', { name: '다시 선택', exact: true }).click();
      await expect(comparison).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(comparison).toHaveCount(0);
      await expect(picker).toBeFocused();
      expect((await saved('rs'))?.['r-01']?.chosen).toBeFalsy();
      const total = await report.locator('details[id^="result-"]').count();
      await filter.getByRole('button', { name: '운영 중' }).click();
      await expect(filter.getByRole('button', { name: '운영 중' })).toHaveAttribute('aria-pressed', 'true');
      const operating = report.getByRole('region', { name: '운영 중', exact: true });
      const filtered = await operating.locator('details[id^="result-"]').count();
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThan(total);
      await expect(report.locator('details[id^="result-"]')).toHaveCount(filtered);
      await expect(summary.locator('p')).toHaveText(`${total}건`);
      await filter.getByRole('button', { name: '전체', exact: true }).click();
      await expect(report.locator('details[id^="result-"]')).toHaveCount(total);
    }
    const card = active('report').locator('#result-r-02');
    async function applyNameChoice() {
      if (mode === 'baseline') {
        await card.locator('[data-nx="opt"]').first().click();
        await expect(page.locator('#modal.show')).toBeVisible();
        await page.locator('[data-nx="confirm"][data-id="r-02"]').click();
      } else {
        if (!await card.evaluate((details) => details.open)) await card.locator('summary').click();
        const picker = card.getByRole('button', { name: '선택하기', exact: true });
        await expect(picker).toHaveAccessibleDescription('가게 이름을 바꿀지 정하기');
        await expect(card.locator('[data-nx="opt"]')).toHaveCount(0);
        await picker.click();
        const comparison = page.getByRole('dialog', { name: '선택지 비교' });
        await expect(comparison.getByRole('button', { name: /그대로 진행/ })).toContainText('즉시 · 비용 확인 필요');
        await comparison.getByRole('button', { name: /이름 바꾸기/ }).click();
        const confirmation = page.getByRole('dialog', { name: '선택지 적용 확인' });
        await expect(confirmation.getByRole('heading', { name: '이름 바꾸기' })).toBeVisible();
        expect((await saved('rs'))?.['r-02']?.chosen).toBeFalsy();
        await expect(confirmation.locator('[data-nx="confirm"]')).toHaveCount(1);
        const actions = await expectBodyActions(confirmation);
        await actions.getByRole('button', { name: '선택지 적용' }).click();
      }
      expect((await saved('rs'))['r-02'].chosen).toBe('o-1');
    }
    await applyNameChoice();
    if (mode === 'baseline') {
      await page.locator('[data-nx="act"][data-id="r-02"]').click();
      await page.locator('[data-nx="actdone"][data-id="r-02"]').click();
    } else {
      const dialog = page.getByRole('dialog', { name: '선택 결과' });
      const actions = await expectBodyActions(dialog);
      const complete = actions.getByRole('button', { name: '작업 완료', exact: true });
      const reset = actions.getByRole('button', { name: '완료 취소', exact: true });
      const next = card.getByRole('button', { name: '다음', exact: true });
      const actionTitle = '새 이름 후보 중 하나 정하기';
      await expect(dialog).toHaveCount(1);
      await expect(page.locator('dialog:modal')).toHaveCount(1);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(actions.locator('button.bg-foundy-primary')).toHaveCount(1);
      await expect(actions.locator('button.bg-foundy-primary')).toHaveAccessibleName('작업 완료');
      await expect(complete).toBeVisible();
      await expect(dialog.locator('[data-nx="actdone"]')).toHaveCount(1);
      await expect(dialog.locator('[data-nx="undo"]')).toHaveCount(0);
      await expectContentFirst(dialog, dialog.getByRole('heading', { name: '이름 바꾸기', exact: true }));
      const changes = dialog.getByRole('list', { name: '변경 내용' });
      await expect(dialog.getByText(/변경 내용\s*\d+개/)).toHaveCount(0);
      await expect(changes.getByText(/가게 이름.*모노로스터스/)).toBeVisible();
      await expect(changes.getByText(/재분석.*상표 점검/)).toBeVisible();
      await expect(dialog).toContainText(actionTitle);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      const completedStep = card.getByRole('button', { name: '완료한 작업 가게 이름을 바꿀지 정하기' });
      await expect(completedStep).toContainText('완료');
      await expect(completedStep.locator('svg')).toBeVisible();
      await expect(completedStep.locator('svg')).toHaveCSS('stroke', 'rgb(12, 101, 100)');
      const [red, green, blue] = await backgroundOnWhite(completedStep);
      expect(red).toBeGreaterThan(215);
      expect(green - red).toBeGreaterThan(7);
      expect(Math.abs(green - blue)).toBeLessThanOrEqual(2);
      const neutral = await backgroundOnWhite(next);
      expect(new Set(neutral).size).toBe(1);
      expect(neutral[0]).toBeGreaterThanOrEqual(240);
      expect(neutral[0]).toBeLessThan(255);
      await expect(next.getByText(actionTitle, { exact: true })).toBeVisible();
      await expect(next).toHaveAccessibleDescription(actionTitle);
      const choiceBox = await completedStep.boundingBox();
      expect((await next.boundingBox()).y).toBeGreaterThanOrEqual(choiceBox.y + choiceBox.height);
      await expect(card.locator('[data-nx="undo"], [data-nx="actdone"]')).toHaveCount(0);
      await next.press('Enter');
      await expect(dialog).toContainText(actionTitle);
      await expect(actions.getByRole('button', { name: '선택 되돌리기' })).toHaveCount(0);
      await complete.click();
      await expect(dialog.getByRole('heading', { name: '완료한 작업' })).toBeVisible();
      await expect(complete).toHaveCount(0);
      await expect(reset).toBeVisible();
      await expect(actions.locator('button.bg-foundy-primary')).toHaveCount(0);
      await expect(actions.getByRole('button', { name: '선택 되돌리기', exact: true })).toHaveCount(0);
      await expect(dialog.locator('[data-nx="actreset"]')).toHaveCount(1);
      expect((await saved('tasksdone'))['c-02']).toBe(true);
      await reset.click();
      await expect(complete).toBeVisible();
      expect((await saved('rs'))['r-02']).toMatchObject({ chosen: 'o-1', action: 'pending' });
      expect((await saved('tasksdone'))['c-02']).toBeFalsy();
      await complete.click();
      await expect(reset).toBeVisible();
      const recommendation = dialog.locator('ol').first().getByRole('button').first();
      const nextStep = await recommendation.getAttribute('aria-label');
      expect(nextStep).toBeTruthy();
      await page.keyboard.press('Escape');
      if (!await next.isVisible()) await card.locator('summary').click();
      await expect(next.getByText(nextStep, { exact: true })).toBeVisible();
      await expect(next).toHaveAccessibleDescription(nextStep);
      const finishedAction = card.getByRole('button', { name: `완료한 작업 ${actionTitle}` });
      await expect(finishedAction).toContainText('완료');
      await expect(finishedAction.locator('svg')).toBeVisible();
      await next.click();
      const comparison = page.getByRole('dialog', { name: '선택지 비교' });
      await expect(comparison.getByRole('heading', { name: '영업 방식 정하기' })).toBeVisible();
      await page.keyboard.press('Escape');
      await finishedAction.click();
      await expect(dialog.getByRole('heading', { name: '이어서 할 일' })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: '이름 바꾸기' })).toBeVisible();
      await expect(dialog).toContainText(nextStep);
      await page.keyboard.press('Escape');
    }
    expect((await saved('rs'))['r-02'].action).toBe('done');
    expect((await saved('tasksdone'))['c-02']).toBe(true);
    return { rs: await saved('rs'), done: await saved('tasksdone'), automatic: await saved('autochk') };
  });
  if (mode !== 'baseline') {
    await check('report follow-up without choices opens, completes and can be restored', async () => {
      const item = active('report').locator('#result-r-03');
      const action = '구청 건축과에 전화로 문의하기';
      if (!await item.evaluate((details) => details.open)) await item.locator('summary').click();
      const next = item.getByRole('button', { name: '다음', exact: true });
      await expect(next).toHaveAccessibleDescription(action);
      await expect(item.getByRole('button', { name: '선택하기' })).toHaveCount(0);
      await expect(item.getByRole('button', { name: '작업 완료' })).toHaveCount(0);
      await next.press('Enter');
      const dialog = page.getByRole('dialog', { name: '후속 작업' });
      await expect(dialog).toContainText(action);
      const actions = await expectBodyActions(dialog);
      const complete = actions.getByRole('button', { name: '작업 완료', exact: true });
      await expect(actions.getByRole('button', { name: '선택 되돌리기' })).toHaveCount(0);
      await complete.click();
      await expect(dialog.getByRole('heading', { name: '완료한 작업' })).toBeVisible();
      await page.keyboard.press('Escape');
      if (!await item.evaluate((details) => details.open)) await item.locator('summary').click();
      await item.getByRole('button', { name: `완료한 작업 ${action}` }).click();
      await expect(dialog).toContainText(action);
      await actions.getByRole('button', { name: '완료 취소', exact: true }).click();
      await expect(complete).toBeVisible();
      await page.keyboard.press('Escape');
      expect((await saved('rs'))['r-03'].action).toBe('pending');
      const informational = active('report').locator('#result-r-05');
      if (!await informational.evaluate((details) => details.open)) await informational.locator('summary').click();
      await expect(informational.getByRole('button', { name: /^(선택하기|다음)$/ })).toHaveCount(0);
    });
    await check('completed inquiry links directly to the pending signature task', async () => {
      const tab = await browser.newPage();
      try {
        await tab.goto(`${baseURL}/login`);
        await signIn(tab);
        await tab.evaluate(() => localStorage.setItem('foundy-v5-demo-rs', JSON.stringify({
          'r-01': { chosen: 'o-1', action: 'done' },
          'r-02': { chosen: 'o-1', action: 'done' },
          'r-03': { action: 'done' },
        })));
        await tab.goto(`${baseURL}/report`);
        const inquiry = tab.locator('#result-r-03');
        await expect(inquiry).toBeVisible();
        if (!await inquiry.evaluate((details) => details.open)) await inquiry.locator('summary').click();
        const next = inquiry.getByRole('button', { name: '다음', exact: true });
        const history = inquiry.getByRole('button', { name: '완료한 작업 구청 건축과에 전화로 문의하기' });
        const signature = '영업신고서 확인·서명하기';
        const dialog = tab.getByRole('dialog', { name: '후속 작업' });
        await expect(next).toHaveAccessibleDescription(`${signature} (10분)`);
        await next.press('Enter');
        await expect(dialog.getByText(signature, { exact: true })).toBeVisible();
        await expect(dialog.getByText('10분', { exact: true })).toBeVisible();
        await expect(dialog.getByRole('button', { name: '완료 취소' })).toHaveCount(0);
        await tab.keyboard.press('Escape');
        await expect(next).toBeFocused();
        await history.click();
        await expect(dialog.getByText('구청 건축과에 전화로 문의하기', { exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: `${signature} (10분)` }).click();
        await expect(dialog.getByText(signature, { exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: '작업 완료' }).click();
        await expect(dialog.getByRole('heading', { name: '완료한 작업' })).toBeVisible();
        const states = await tab.evaluate(() => JSON.parse(localStorage.getItem('foundy-v5-demo-rs')));
        expect(states['r-03'].action).toBe('done');
        expect(states['r-04'].action).toBe('done');
        await tab.keyboard.press('Escape');
        await expect(next).toHaveAttribute('data-p', 'checklist');
        await next.click();
        await expect(tab.locator('#page-checklist.active')).toBeVisible();
      } finally {
        await tab.close();
      }
    });
  }
  await check('checklist manual toggle, refresh persistence, calendar, date edit, ICS', async () => {
    await nav('checklist');
    await active('checklist').locator('input[data-task="c-06"]').check();
    expect((await saved('tasksdone'))['c-06']).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(active('checklist').locator('input[data-task="c-06"]')).toBeChecked();
    await page.locator('[data-nx="cview"][data-v="calendar"]').click();
    await page.locator('[data-nx="calmove"][data-n="1"]').click();
    const calendar = await active('checklist').innerText();
    await page.locator('[data-nx="editDate"]').click();
    if (mode === 'baseline') await page.locator('#nxDateVal').fill('2027-04-01');
    else await selectOpeningDate(page.locator('#nxDate'), '2027-04-01');
    await page.locator('#nxDate button[type="submit"]').click();
    expect((await saved('store')).opening).toBe('2027-04-01');
    const pendingDownload = page.waitForEvent('download');
    await page.locator('[data-nx="ics"]').click();
    const download = await pendingDownload;
    const icsPath = path.join(output, download.suggestedFilename());
    await download.saveAs(icsPath);
    const ics = await readFile(icsPath, 'utf8');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270401');
    return { calendar, opening: (await saved('store')).opening, ics };
  });
  await check('docs center lists only receiving places and links from checklist', async () => {
    await nav('checklist');
    await page.locator('[data-nx="cview"][data-value="timeline"], [data-nx="cview"][data-v="timeline"]').first().click();
    await page.locator('[data-nx="godocs"]').first().click();
    await expect(active('docs')).toBeVisible();
    if (mode === 'baseline') expect(await active('docs').innerText()).toContain('정부24');
    if (mode !== 'baseline') {
      const directory = active('docs').getByRole('region', { name: '항목별 발급 안내' });
      const document = directory.locator('#doc-c-03');
      const title = document.getByRole('button', { name: '사업자등록 신청', exact: true });
      const guide = document.getByText(/홈택스 로그인/);
      await expect(guide).toBeHidden();
      await title.focus();
      await title.press('Enter');
      await expect(guide).toBeVisible();
      await expect(document.getByRole('link', { name: /홈택스/ })).toHaveAttribute('href', 'https://www.hometax.go.kr/');
      const contract = directory.getByRole('button', { name: '표준 근로계약서 양식', exact: true });
      const insurance = directory.getByRole('button', { name: '4대보험 취득 신고', exact: true });
      await contract.click();
      await expect(title).toHaveAttribute('aria-expanded', 'false');
      await insurance.press('Enter');
      await expect(contract).toHaveAttribute('aria-expanded', 'false');
      await expect(insurance).toHaveAttribute('aria-expanded', 'true');
      await expect(directory.locator('button[aria-expanded="true"]')).toHaveCount(1);
      await title.press('Enter');
      await expect(insurance).toHaveAttribute('aria-expanded', 'false');
      await title.press('Space');
      await expect(guide).toBeHidden();
      await expect(directory.locator('button[aria-expanded="true"]')).toHaveCount(0);
      const filter = directory.getByRole('group', { name: '완료 상태 필터' });
      const all = await directory.locator('section[id^="doc-"]').count();
      await filter.getByRole('button', { name: '완료', exact: true }).click();
      const complete = await directory.locator('section[id^="doc-"]').count();
      expect(complete).toBeGreaterThan(0);
      await expect(directory.getByText('항목 완료', { exact: true })).toHaveCount(complete);
      await filter.getByRole('button', { name: '남은 일', exact: true }).click();
      await expect(directory.locator('section[id^="doc-"]')).toHaveCount(all - complete);
      await expect(directory.getByText('항목 완료', { exact: true })).toHaveCount(0);
      await expect(directory.locator('section[id^="doc-"] > header').getByText('남은 일', { exact: true })).toHaveCount(all - complete);
    }
    const text = await active('docs').innerText();
    expect(text).not.toContain('만들어 줌');
    expect(text).not.toContain('초안');
    expect(await page.locator('#nav [data-page="alerts"]').count()).toBe(0);
    return { text };
  });
  await check('grant filters, results and detail modal', async () => {
    await nav('grants');
    await page.locator('[data-nx="gf"][data-k="res"][data-v="eligible"]').click();
    if (mode === 'baseline') {
      await page.locator('[data-nx="gf"][data-k="view"][data-v="list"]').click();
      await page.locator('[data-nx="gsort"]').selectOption('fit');
    } else {
      await expect(active('grants').locator('[data-k="view"]')).toHaveCount(0);
      await expect(active('grants').locator('[data-nx="gsort"]')).toHaveCount(0);
      await expect(active('grants').locator('[data-grant-poster]')).toHaveCount(2);
    }
    const grantDetail = mode === 'baseline'
      ? active('grants').locator('[data-nx="gdetail"]')
      : active('grants').getByRole('region', { name: '지원사업 공고', exact: true }).locator('[data-nx="gdetail"]');
    await grantDetail.first().click();
    const text = await page.locator('#modalBody').innerText();
    if (mode !== 'baseline') {
      const id = await grantDetail.first().getAttribute('data-id');
      const poster = active('grants').locator(`[data-grant-poster="${id}"]`);
      const dialog = page.getByRole('dialog');
      const detailPoster = dialog.locator(`[data-grant-poster="${id}"]`);
      await expectContentFirst(dialog, detailPoster);
      await expect(detailPoster).toHaveAttribute('data-motif', await poster.getAttribute('data-motif'));
      await expect(dialog.locator('#modalBody #closeModal')).toBeVisible();
      await expect(dialog).not.toContainText('예시 공고');
      await expect(active('grants')).not.toContainText('예시 공고');
    }
    await page.locator('#closeModal').click();
    if (mode !== 'baseline') await expect(grantDetail.first()).toBeFocused();
    return { detail: text, list: await active('grants').innerText() };
  });
  await check('market radius, category, selected shop and live price', async () => {
    await nav('sites');
    if (mode === 'baseline') {
      await page.locator('[data-nx="mrad"][data-r="100"]').click();
      await page.locator('[data-nx="mcat"][data-v="카페"]').click();
      await page.locator('[data-nx="mk"][data-id="k2"] circle').click();
    } else {
      const workspace = page.getByTestId('market-workspace');
      const panel = workspace.getByTestId('market-panel');
      const radiusChoices = workspace.getByRole('group', { name: '반경 빠른 선택' });
      await radiusChoices.getByRole('button', { name: '1km', exact: true }).click();
      await expect(radiusChoices.getByRole('button', { name: '1km', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel).toContainText('반경 1,000m');
      await radiusChoices.getByRole('button', { name: '500m', exact: true }).click();
      await expect(panel).toContainText('반경 500m');
      const cafeFilter = panel.getByRole('group', { name: '점포 업종' }).getByRole('button', { name: '카페', exact: true });
      await cafeFilter.click();
      await expect(cafeFilter).toHaveAttribute('aria-pressed', 'true');
      await panel.getByRole('button', { name: '주변 점포', exact: true }).click();
      const firstShop = panel.getByRole('button', { name: /^스왈로우라운지커피/ });
      const secondShop = panel.getByRole('button', { name: /^이디야커피 성수아카데미점/ });
      await firstShop.focus();
      await firstShop.press('Enter');
      await expect(firstShop).toHaveAttribute('aria-pressed', 'true');
      await expect(secondShop).toHaveAttribute('aria-pressed', 'false');
      await expect(panel.getByText('선택한 점포', { exact: true })).toBeVisible();
      await secondShop.focus();
      await secondShop.press('Space');
      await expect(secondShop).toHaveAttribute('aria-pressed', 'true');
      await expect(firstShop).toHaveAttribute('aria-pressed', 'false');
      await panel.getByRole('button', { name: '가격·현장', exact: true }).click();
      await expect(panel.getByRole('spinbutton', { name: '내 아메리카노 가격 (원)' })).toBeVisible();
    }
    await page.locator('[data-price]').fill('4800');
    expect(await saved('myprice')).toBe('4800');
    return { price: await saved('myprice'), priceResult: await page.locator('#priceResult').innerText(), text: await active('sites').innerText() };
  });
  await check('chat response and confirmed store date action', async () => {
    expect(await page.locator('#nav [data-page="chat"]').count()).toBe(0);
    await page.locator('[data-nx="chattoggle"]').first().click();
    await expect(page.locator('#chatPanel')).toBeVisible();
    await page.locator('#chatIn').fill('개업일을 2027-05-01로 바꿔줘');
    await page.locator('#nxChat button[type="submit"]').click();
    await page.locator('[data-nx="cact"]').first().click();
    expect((await saved('store')).opening).toBe('2027-05-01');
    const text = await page.locator('#chatBox').innerText();
    if (mode !== 'baseline') await page.locator('#chatPanel').getByRole('button', {name: '상담 닫기'}).click();
    return { opening: (await saved('store')).opening, text };
  });
  await check('mypage edit invalidates affected report choice and persists', async () => {
    await nav('mypage');
    if (mode === 'baseline') {
      await page.locator('[data-mp="name"]').fill('새 모노커피');
      await page.locator('[data-mp="name"]').press('Tab');
      await page.locator('[data-mp="opening"]').fill('2027-05-09');
      await page.locator('[data-nx="mpsave"]').click();
    } else {
      const mypage = active('mypage');
      await expect(mypage.locator('input, select, textarea')).toHaveCount(0);
      const before = await saved('store');
      const choices = await saved('rs');
      const nameButton = mypage.getByRole('button', { name: '가게 이름 수정', exact: true });
      const nameForm = mypage.getByRole('form', { name: '가게 이름 수정', exact: true });
      await nameButton.click();
      const nameInput = nameForm.getByRole('textbox', { name: '가게 이름', exact: true });
      const initialName = await nameInput.inputValue();
      await expect(nameInput).toBeFocused();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await nameInput.fill('취소할 가게 이름');
      await expect(mypage.getByText(/다시 반영할 항목|다시 선택할 점검 항목/)).toHaveCount(0);
      await nameInput.press('Escape');
      await expect(nameForm).not.toBeVisible();
      await expect(nameButton).toBeFocused();
      expect(await saved('store')).toEqual(before);
      expect(await saved('rs')).toEqual(choices);

      await nameButton.click();
      await expect(nameInput).toHaveValue(initialName);
      await nameInput.fill('새 모노커피');
      await nameForm.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(nameButton).toBeFocused();
      expect((await saved('store')).opening).toBe(before.opening);
      expect((await saved('rs'))['r-02']).toBeUndefined();
      await expect(mypage.getByText('새 모노커피', { exact: true })).toBeVisible();

      await mypage.getByRole('button', { name: '개업 예정일 수정', exact: true }).click();
      const dateForm = mypage.getByRole('form', { name: '개업 예정일 수정', exact: true });
      await selectOpeningDate(dateForm, '2027-05-09');
      expect((await saved('store')).opening).toBe(before.opening);
      await dateForm.getByRole('button', { name: '저장', exact: true }).click();
    }
    expect((await saved('store')).name).toBe('새 모노커피');
    expect((await saved('store')).opening).toBe('2027-05-09');
    expect((await saved('rs'))['r-02']).toBeUndefined();
    if (mode === 'baseline') await page.keyboard.press('Escape');
    else await expect(page.getByRole('dialog')).toHaveCount(0);
    return { store: await saved('store'), rs: await saved('rs'), changeLog: await saved('chglog') };
  });
  if (mode !== 'baseline') {
    await check('staff toggle immediately updates the checklist and persists', async () => {
      const group = active('mypage').getByRole('group', { name: '직원 고용' });
      const no = group.getByRole('button', { name: '아니요', exact: true });
      const yes = group.getByRole('button', { name: '네', exact: true });
      await expect(yes).toHaveAttribute('aria-pressed', 'true');
      await no.click();
      await expect(no).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect((await saved('store')).employees).toBe(false);
      const log = await saved('chglog');
      await no.press('Enter');
      expect(await saved('chglog')).toEqual(log);
      await nav('checklist');
      const hiringTask = active('checklist').getByText('근로계약서 및 고용 관련 사항 확인', { exact: true });
      await expect(hiringTask).toHaveCount(0);
      await nav('mypage');
      await page.reload();
      await expect(no).toHaveAttribute('aria-pressed', 'true');
      await yes.press('Space');
      await expect(yes).toHaveAttribute('aria-pressed', 'true');
      await nav('checklist');
      await expect(hiringTask).toBeVisible();
      await nav('mypage');
    });
    await check('account name saves independently and survives a reload', async () => {
      const mypage = active('mypage');
      const before = await saved('store');
      const choices = await saved('rs');
      await mypage.getByRole('button', { name: '계정 이름 수정', exact: true }).click();
      const form = mypage.getByRole('form', { name: '계정 이름 수정', exact: true });
      await form.getByRole('textbox', { name: '계정 이름', exact: true }).fill('수정한 사장님');
      await form.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.reload();
      await expect(mypage.getByText('수정한 사장님', { exact: true })).toBeVisible();
      expect(await saved('store')).toEqual(before);
      expect(await saved('rs')).toEqual(choices);
    });
  }
  await check('logout and same-account restoration', async () => {
    await page.locator('header [data-nx="logout"]').click();
    await expect(page.locator('#authScreen')).toBeVisible();
    await signIn(page, { mode });
    await expect(page.locator('#authScreen')).not.toBeVisible();
    await nav('dashboard');
    expect((await saved('store')).name).toBe('새 모노커피');
    return { store: await saved('store') };
  });
  await check('new account onboarding and account separation', async () => {
    await page.locator('header [data-nx="logout"]').click();
    if (mode === 'baseline') {
      await page.locator('[data-nx="social"][data-p="kakao"]').click();
      await page.locator('#socialName').fill('검증사용자');
      await page.locator('#nxSocial button[type="submit"]').click();
    } else {
      await expect(page.locator('#authScreen')).toBeVisible();
      // Authentication is demo-only. Seed an existing account session to keep
      // onboarding/data isolation coverage independent of removed social UI.
      await page.evaluate(() => {
        const uid = 'onboarding-test-fixture';
        const profile = { name: '검증사용자', provider: 'demo' };
        localStorage.setItem('foundy-session', JSON.stringify({ uid, ...profile }));
        localStorage.setItem(`foundy-v5-${uid}-profile`, JSON.stringify(profile));
      });
      await page.goto(`${baseURL}/register`, { waitUntil: 'domcontentloaded' });
    }
    await expect(active('register')).toBeVisible();
    await page.locator('#fName').fill('검증가게');
    await page.locator('#fAddr').fill('서울특별시 성동구 성수이로 10');
    await page.locator('#fDetail').fill('2층');
    if (mode === 'baseline') await page.locator('#fOpen').fill('2027-06-01');
    else {
      await selectOpeningDate(active('register'), '2027-06-01');
    }
    await page.locator('#fBirth').fill('1995');
    await page.locator('#nxForm button[type="submit"]').click();
    await page.locator('[data-nx="yn"][data-k="employees"][data-v="1"]').click();
    await page.locator('#fFunds').fill('30000000');
    await page.locator('[data-nx="analyze"]').click();
    await expect(page.locator('[data-nx="finish"]')).toBeEnabled({ timeout: 10000 });
    await page.locator('[data-nx="finish"]').click();
    await expect(active('dashboard')).toBeVisible();
    const store = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('foundy-session'));
      return JSON.parse(localStorage.getItem(`foundy-v5-${session.uid}-store`));
    });
    expect(store.name).toBe('검증가게');
    expect(store.employees).toBe(true);
    expect(store.onboarded).toBe(true);
    expect((await saved('store')).name).toBe('새 모노커피');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(active('dashboard')).toBeVisible();
    return { store, demoStore: await saved('store') };
  });
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ passed: result.checks.filter(x => x.status === 'passed').length, failed: result.checks.filter(x => x.status === 'failed').length, pageErrors: result.pageErrors, report: path.join(output, 'report.json') }, null, 2));
if (result.checks.some(x => x.status === 'failed') || result.pageErrors.length) process.exitCode = 1;
