import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'migrated';
const output = path.join(project, 'work', mode, 'functional');
await mkdir(output, { recursive: true });
let server, baseURL = process.env.FOUNDY_URL || 'http://localhost:3100';
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
async function nav(route) {
  await page.locator(`#nav [data-page="${route}"]`).click();
  await expect(active(route)).toBeVisible();
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
  await check('demo login and dashboard', async () => {
    await page.locator('[data-nx="demologin"]').click();
    await expect(active('dashboard')).toBeVisible();
    return { store: await saved('store'), text: await active('dashboard').innerText() };
  });
  await check('report choice confirmation, follow-up done in one step, linked task', async () => {
    await nav('report');
    await page.locator('#result-r-02 > summary').click();
    await page.locator('[data-nx="opt"][data-id="r-02"]').first().click();
    await expect(page.locator('#modal.show')).toBeVisible();
    await page.locator('[data-nx="confirm"][data-id="r-02"]').click();
    expect((await saved('rs'))['r-02'].chosen).toBeTruthy();
    await page.locator('[data-nx="actdone"][data-id="r-02"]').click();
    expect((await saved('rs'))['r-02'].action).toBe('done');
    expect((await saved('tasksdone'))['c-02']).toBe(true);
    return { rs: await saved('rs'), done: await saved('tasksdone'), automatic: await saved('autochk') };
  });
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
    await page.locator('#nxDateVal').fill('2027-04-01');
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
    const text = await active('docs').innerText();
    expect(text).toContain('정부24');
    expect(text).not.toContain('만들어 줌');
    expect(text).not.toContain('초안');
    expect(await page.locator('#nav [data-page="alerts"]').count()).toBe(0);
    return { text };
  });
  await check('grant filters, list and detail modal', async () => {
    await nav('grants');
    await page.locator('[data-nx="gf"][data-k="res"][data-v="eligible"]').click();
    await page.locator('[data-nx="gf"][data-k="view"][data-v="list"]').click();
    await page.locator('[data-nx="gsort"]').selectOption('fit');
    await page.locator('[data-nx="gdetail"]').first().click();
    const text = await page.locator('#modalBody').innerText();
    await page.locator('#closeModal').click();
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
      await expect(panel.getByText('선택한 예시 점포', { exact: true })).toBeVisible();
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
    return { opening: (await saved('store')).opening, text: await page.locator('#chatBox').innerText() };
  });
  await check('mypage edit invalidates affected report choice and persists', async () => {
    await nav('mypage');
    await page.locator('[data-mp="name"]').fill('새 모노커피');
    await page.locator('[data-mp="name"]').press('Tab');
    await page.locator('[data-nx="mpsave"]').click();
    expect((await saved('store')).name).toBe('새 모노커피');
    expect((await saved('rs'))['r-02']).toBeUndefined();
    await page.keyboard.press('Escape');
    return { store: await saved('store'), rs: await saved('rs'), changeLog: await saved('chglog') };
  });
  await check('logout and same-account restoration', async () => {
    await page.locator('header [data-nx="logout"]').click();
    await expect(page.locator('#authScreen')).toBeVisible();
    await page.locator('[data-nx="demologin"]').click();
    await expect(page.locator('#authScreen')).not.toBeVisible();
    await nav('dashboard');
    expect((await saved('store')).name).toBe('새 모노커피');
    return { store: await saved('store') };
  });
  await check('new account onboarding and account separation', async () => {
    await page.locator('header [data-nx="logout"]').click();
    await page.locator('[data-nx="social"][data-p="kakao"]').click();
    await page.locator('#socialName').fill('검증사용자');
    await page.locator('#nxSocial button[type="submit"]').click();
    await expect(active('register')).toBeVisible();
    await page.locator('#fName').fill('검증가게');
    await page.locator('#fAddr').fill('서울특별시 성동구 성수이로 10');
    await page.locator('#fDetail').fill('2층');
    await page.locator('#fOpen').fill('2027-06-01');
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
