import { signIn } from './helpers/sign-in.mjs';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'baseline';
if (!['baseline', 'migrated'].includes(mode)) throw new Error('Use baseline or migrated');
const output = path.resolve(process.argv[3] || path.join(project, 'work', mode));
const routes = ['dashboard', 'report', 'checklist', 'docs', 'grants', 'sites', 'mypage', 'register'];
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const fixedTime = new Date('2026-11-20T00:00:00+09:00');
let server;
let baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
if (mode === 'baseline') {
  const html = await readFile(path.join(project, 'foundy_toss_v5.html'));
  server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
const result = { mode, fixedTime: fixedTime.toISOString(), baseURL, pages: [], errors: [] };

async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(250);
}

async function capture(page, viewportName, route) {
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const dom = await page.evaluate((route) => {
    const root = route === 'login'
      ? document.querySelector('#authScreen')
      : document.querySelector('.page.active') || document.querySelector('main');
    const props = ['display', 'position', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'borderRadius', 'padding', 'gap', 'gridTemplateColumns'];
    const styleOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return {
        tag: el.tagName, className: el.className,
        rect: Object.fromEntries(['x','y','width','height'].map(k => [k, Math.round(r[k] * 100) / 100])),
        style: Object.fromEntries(props.map(p => [p, s[p]])),
      };
    };
    const selectors = route === 'login'
      ? ['.nx-authbox', '.nx-btn', '[data-testid="login-layout"]', '[data-testid="login-artwork"]', 'form', 'input[name="username"]', 'input[name="password"]']
      : ['body', '.sidebar', '.topbar', '.container', '.pagetitle', '.nx-card', '.nx-btn', '.nx-authbox'];
    const elements = Object.fromEntries(selectors.map(selector => {
      const el = [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width && e.getBoundingClientRect().height);
      return [selector, styleOf(el)];
    }));
    return { text: root?.innerText || '', root: styleOf(root), elements, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  }, route);
  const filename = `${viewportName}-${route}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage: route !== 'login', animations: 'disabled' });
  result.pages.push({ viewport: viewportName, route, filename, url: page.url(), ...dom });
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(`Captured ${viewportName}/${route}`);
}

try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push({ viewport: viewportName, url: page.url(), message: error.message }));
    await page.clock.setFixedTime(fixedTime);
    await page.goto(mode === 'baseline' ? baseURL : `${baseURL}/login`, { waitUntil: 'networkidle' });
    await page.locator('#authScreen').waitFor({ state: 'visible' });
    await capture(page, viewportName, 'login');
    await signIn(page, { mode });
    await page.locator('#page-dashboard.active').waitFor({ state: 'visible' });
    for (const route of routes) {
      if (mode === 'baseline') {
        await page.evaluate(route => window.goto(route), route);
      } else {
        await page.goto(`${baseURL}/${route}`, { waitUntil: 'networkidle' });
      }
      await page.locator(`#page-${route}.active`).waitFor({ state: 'visible' });
      await capture(page, viewportName, route);
    }
    await context.close();
  }
} finally {
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(result, null, 2));
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ output, captures: result.pages.length, errors: result.errors }, null, 2));
