import { signIn } from './helpers/sign-in.mjs';
import { navigate } from './helpers/navigate.mjs';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(project, 'work', 'navbar-regression');
const baseURL = process.env.FOUNDY_URL || 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
await mkdir(output, { recursive: true });
try {
  for (const [name, width, height, touch] of [['desktop',1440,1000,false], ['laptop',1024,900,false], ['mobile',390,844,true], ['small-mobile',320,740,true]]) {
    const context = await browser.newContext({ viewport: { width, height }, locale:'ko-KR', timezoneId:'Asia/Seoul', reducedMotion:'reduce', isMobile:touch, hasTouch:touch });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const row = { viewport:name, width, height, checks:[], pageErrors:[] };
    page.on('pageerror', error => row.pageErrors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-20T00:00:00+09:00'));
    const check = async (name, fn) => {
      try { const detail = await fn(); row.checks.push({name,passed:true,detail}); console.log(`PASS ${row.viewport}: ${name}`); }
      catch (error) { row.checks.push({name,passed:false,error:error.message}); console.log(`FAIL ${row.viewport}: ${name}: ${error.message.slice(0,250)}`); await page.screenshot({path:path.join(output,`${row.viewport}-${row.checks.length}-failure.png`),fullPage:true}); await page.keyboard.press('Escape'); }
    };
    await page.goto(`${baseURL}/login`,{waitUntil:'domcontentloaded'});
    await signIn(page);
    await expect(page.locator('#page-dashboard.active')).toBeVisible();
    const bell = page.getByRole('button',{name:/^알림, 읽지 않은 알림/});
    const panel = page.getByRole('dialog',{name:'알림 요약'});
    const openPreview = async () => {
      if(touch) await bell.tap(); else await bell.hover();
      await expect(panel).toBeVisible();
    };
    await check('four primary items fit without horizontal scrolling',async()=>{
      const bounds = await page.evaluate(()=>{
        const header=document.querySelector('header'), nav=document.querySelector('#nav');
        const r=header.getBoundingClientRect();
        return {viewport:innerWidth,document:document.documentElement.scrollWidth,header:{left:r.left,right:r.right},nav:{clientWidth:nav.clientWidth,scrollWidth:nav.scrollWidth,overflowX:getComputedStyle(nav).overflowX}};
      });
      expect(bounds.document).toBeLessThanOrEqual(bounds.viewport+1);
      expect(bounds.header.right).toBeLessThanOrEqual(bounds.viewport+1);
      expect(bounds.nav.overflowX).toBe('visible');
      expect(bounds.nav.scrollWidth).toBeLessThanOrEqual(bounds.nav.clientWidth+1);
      const primary=page.locator('#nav > button, #nav > div > button');
      await expect(primary).toHaveText(['홈','개업 준비','상권 분석','지원사업']);
      const tops=await primary.evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().top));
      expect(Math.max(...tops)-Math.min(...tops)).toBeLessThanOrEqual(1);
      await page.screenshot({path:path.join(output,`${name}-dashboard.png`),fullPage:true,animations:'disabled'});
      await page.getByRole('banner').screenshot({path:path.join(output,`${name}-navbar.png`),animations:'disabled'});
      return bounds;
    });
    await check('notification preview opens, badge matches count, panel fits viewport',async()=>{
      const label=await bell.getAttribute('aria-label');
      const unread=Number(label.match(/알림 (\d+)개/)[1]);
      expect(unread).toBeGreaterThan(0);
      await openPreview();
      // A tap-opened menu must remain available after synthesized touch/mouse events.
      if(touch){await page.waitForTimeout(500);await expect(panel).toBeVisible();}
      await expect(bell).toHaveText(String(unread));
      await expect(panel.getByRole('heading')).toHaveCount(0);
      await expect(panel.locator(':scope > :first-child')).toHaveRole('list');
      const count=await panel.locator('[data-notification-id]').count();
      expect(count).toBeGreaterThan(0);expect(count).toBeLessThanOrEqual(4);
      const rect=await panel.boundingBox();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x+rect.width).toBeLessThanOrEqual(width+1);
      expect(rect.y+rect.height).toBeLessThanOrEqual(height+1);
      await page.screenshot({path:path.join(output,`${name}-notifications.png`),fullPage:true,animations:'disabled'});
      await page.screenshot({path:path.join(output,`${name}-notifications-viewport.png`),fullPage:false,animations:'disabled'});
      return {unread,previewCount:count,rect};
    });
    await check('notification item marks read and updates badge',async()=>{
      if(!await panel.isVisible())await openPreview();
      const before=Number((await bell.getAttribute('aria-label')).match(/알림 (\d+)개/)[1]);
      const first=panel.locator('[data-notification-id]').first();
      const id=await first.getAttribute('data-notification-id');
      if(touch)await first.tap();else await first.click();
      await expect(panel).not.toBeVisible();
      await expect(bell).toHaveAttribute('aria-label',`알림, 읽지 않은 알림 ${before-1}개`);
      const read=await page.evaluate(id=>JSON.parse(localStorage.getItem('foundy-v5-demo-alertread')||'{}')[id],id);
      expect(read).toBe(1);
      return {id,route:page.url(),unread:before-1};
    });
    await check('keyboard disclosure and Escape restore trigger focus',async()=>{
      await page.mouse.move(0,0);
      await bell.focus();await bell.press('ArrowDown');
      await expect(panel).toBeVisible();
      await expect(panel.locator('button').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(panel).not.toBeVisible();
      await expect(bell).toBeFocused();
    });
    await check('preview has no view-all button',async()=>{
      await openPreview();
      await expect(panel.getByRole('button',{name:/알림센터 전체 보기/})).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(panel).not.toBeVisible();
    });
    const preparation=page.locator('#nav [data-navigation-group="preparation"]');
    const preparationPanel=page.getByRole('group',{name:'개업 준비 메뉴',exact:true});
    await check('preparation disclosure fits and closes on outside interaction',async()=>{
      if(touch)await preparation.tap();else await preparation.click();
      await expect(preparation).toHaveAttribute('aria-expanded','true');
      await expect(preparationPanel).toBeVisible();
      await expect(preparationPanel.getByRole('button')).toHaveCount(3);
      const rect=await preparationPanel.boundingBox();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x+rect.width).toBeLessThanOrEqual(width+1);
      expect(rect.y+rect.height).toBeLessThanOrEqual(height+1);
      await page.screenshot({path:path.join(output,`${name}-preparation.png`),fullPage:false,animations:'disabled'});
      await page.mouse.click(width-2,height-2);
      await expect(preparation).toHaveAttribute('aria-expanded','false');
      await expect(preparationPanel).toHaveCount(0);
      return rect;
    });
    await check('preparation keyboard movement, Escape and Tab preserve focus',async()=>{
      await preparation.focus();
      await preparation.press('ArrowDown');
      await expect(preparationPanel.locator('[data-page="report"]')).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(preparationPanel.locator('[data-page="checklist"]')).toBeFocused();
      await page.keyboard.press('End');
      await expect(preparationPanel.locator('[data-page="docs"]')).toBeFocused();
      await page.keyboard.press('Home');
      await expect(preparationPanel.locator('[data-page="report"]')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(preparationPanel).toHaveCount(0);
      await expect(preparation).toBeFocused();
      await preparation.press('ArrowUp');
      await expect(preparationPanel.locator('[data-page="docs"]')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(preparationPanel).toHaveCount(0);
      await expect(page.locator('#nav [data-page="sites"]')).toBeFocused();
      await preparation.press('Enter');
      await expect(preparationPanel).toBeVisible();
      await preparation.press('Space');
      await expect(preparationPanel).toHaveCount(0);
    });
    await check('all nav destinations and active state',async()=>{
      const destinations=['dashboard','report','checklist','docs','sites','grants'];
      for(const destination of destinations){
        await navigate(page,destination);
        await expect(page).toHaveURL(`${baseURL}/${destination}`);
        const grouped=['report','checklist','docs'].includes(destination);
        await expect(preparationPanel).toHaveCount(0);
        if(grouped){
          await expect(preparation).toHaveAttribute('data-active','true');
          await preparation.click();
        }else{
          await expect(preparation).not.toHaveAttribute('data-active','true');
        }
        const button=page.locator(`#nav [data-page="${destination}"]`);
        await expect(button).toHaveAttribute('aria-current','page');
        await expect(page.locator(`#page-${destination}.active`)).toBeVisible();
        if(grouped)await preparation.press('Escape');
      }
      return destinations;
    });
    await check('store shortcut and logout',async()=>{
      await page.getByRole('button',{name:/가게 정보 열기$/}).click();
      await expect(page).toHaveURL(`${baseURL}/mypage`);
      await page.locator('header [data-nx="logout"]').click();
      await expect(page).toHaveURL(`${baseURL}/login`);
      await expect(page.locator('#authScreen')).toBeVisible();
    });
    results.push(row);
    await context.close();
  }
} finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify({baseURL,results},null,2));
  await browser.close();
}
const passed=results.flatMap(x=>x.checks).filter(x=>x.passed).length;
const total=results.flatMap(x=>x.checks).length;
console.log(JSON.stringify({passed,total,errors:results.flatMap(x=>x.pageErrors),output},null,2));
if(passed!==total||results.some(x=>x.pageErrors.length))process.exitCode=1;
