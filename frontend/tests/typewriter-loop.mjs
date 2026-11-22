import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { chromium, expect } from '@playwright/test';
import { browserBundle, createSourceRuntime } from './helpers/source-runtime.mjs';

const results = [];
async function test(name, run) {
  await run();
  results.push({ name, passed: true });
}

await test('server output includes the completed first greeting and a stable accessible description', () => {
  const { TypewriterText } = createSourceRuntime().load('@/components/ui/TypewriterText');
  const markup = renderToString(React.createElement(TypewriterText, {
    texts: ['모노커피 사장님, 환영합니다!', '개업까지 101일 남았어요.'],
    accessibleText: '모노커피 사장님, 환영합니다! 개업까지 101일 남았어요.',
  }));
  assert.match(markup, /data-typewriter-text[^>]*>모노커피 사장님, 환영합니다!/);
  assert.match(markup, /class="sr-only">모노커피 사장님, 환영합니다! 개업까지 101일 남았어요\./);
  assert.ok(!markup.includes('aria-live'));
});

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: browserBundle({
    React: 'react', ReactDOM: 'react-dom/client', typewriter: '@/components/ui/TypewriterText',
  }) });
  await page.evaluate(() => {
    const { React, ReactDOM, typewriter: { TypewriterText } } = window.contractModules;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    window.animationTimers = new Set();
    window.setTimeout = (callback, delay, ...args) => {
      const id = nativeSetTimeout(() => { window.animationTimers.delete(id); callback(...args); }, delay);
      if ([350, 30, 45].includes(delay)) window.animationTimers.add(id);
      return id;
    };
    window.clearTimeout = (id) => { window.animationTimers.delete(id); nativeClearTimeout(id); };
    window.hiddenForTest = false;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.hiddenForTest ? 'hidden' : 'visible' });
    window.props = { texts: ['모노👨‍👩‍👧‍👦', '환영🙂'], holdMs: 350, typingMs: 45, deletingMs: 30 };
    window.typewriterRoot = ReactDOM.createRoot(document.getElementById('root'));
    window.draw = (patch = {}) => {
      window.props = { ...window.props, ...patch };
      window.typewriterRoot.render(React.createElement(TypewriterText, window.props));
    };
    window.samples = [];
    new MutationObserver(() => {
      const text = document.querySelector('[data-typewriter-text]')?.textContent;
      if (text !== undefined) window.samples.push(text);
    }).observe(document.getElementById('root'), { childList: true, characterData: true, subtree: true });
    window.draw();
  });
  const text = page.locator('[data-typewriter-text]');
  const timers = () => page.evaluate(() => window.animationTimers.size);

  await test('typing and deletion loop over whole Korean and emoji graphemes', async () => {
    await expect.poll(() => page.evaluate(() => {
      const next = window.samples.indexOf('환영🙂');
      return next >= 0 && window.samples.slice(next + 1).includes('모노👨‍👩‍👧‍👦');
    }), { timeout: 7000 }).toBe(true);
    const samples = await page.evaluate(() => window.samples);
    const allowed = new Set(['', '모', '모노', '모노👨‍👩‍👧‍👦', '환', '환영', '환영🙂']);
    assert.ok(samples.includes('') && samples.includes('모노') && samples.includes('환영'));
    assert.ok(samples.every((sample) => allowed.has(sample)), `split grapheme: ${samples.find((sample) => !allowed.has(sample))}`);
  });

  await test('pause removes timers, preserves a frame across equivalent props, and resumes', async () => {
    await page.evaluate(() => window.draw({ paused: true }));
    await expect.poll(timers).toBe(0);
    const before = await text.textContent();
    await page.evaluate(() => window.draw({ texts: [...window.props.texts] }));
    await page.waitForTimeout(500);
    assert.equal(await text.textContent(), before);
    assert.ok(!(await page.locator('[data-typewriter-cursor]').getAttribute('class')).includes('animate-pulse'));
    await page.evaluate(() => window.draw({ paused: false }));
    await expect(text).not.toHaveText(before, { timeout: 2000 });
  });

  await test('changed props immediately replace the previous store greeting', async () => {
    await page.evaluate(() => window.draw({ paused: true, texts: ['새 가게 👩‍🍳', '새 안내'], accessibleText: '새 가게의 개업 준비 안내' }));
    await expect(text).toHaveText('새 가게 👩‍🍳');
    await expect(page.locator('[data-typewriter] .sr-only')).toHaveText('새 가게의 개업 준비 안내');
    await expect(page.locator('[aria-live]')).toHaveCount(0);
    await expect.poll(timers).toBe(0);
  });

  await test('reduced-motion changes keep the first message complete with no cursor or timers', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.draw({ paused: false }));
    await expect(text).toHaveText('새 가게 👩‍🍳');
    await expect(page.locator('[data-typewriter-cursor]')).toHaveCount(0);
    await expect.poll(timers).toBe(0);
    await page.waitForTimeout(500);
    await expect(text).toHaveText('새 가게 👩‍🍳');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(text).not.toHaveText('새 가게 👩‍🍳', { timeout: 2000 });
  });

  await test('hidden tabs suspend their timer and resume without catching up', async () => {
    await page.evaluate(() => { window.hiddenForTest = true; document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(timers).toBe(0);
    const before = await text.textContent();
    await page.waitForTimeout(500);
    assert.equal(await text.textContent(), before);
    await page.evaluate(() => { window.hiddenForTest = false; document.dispatchEvent(new Event('visibilitychange')); });
    await expect(text).not.toHaveText(before, { timeout: 2000 });
  });

  await test('empty and single-message inputs stay stable, and unmount clears a running timer', async () => {
    await page.evaluate(() => window.draw({ texts: [], accessibleText: undefined }));
    await expect(text).toHaveText('');
    await expect(page.locator('[data-typewriter-cursor]')).toHaveCount(0);
    await expect.poll(timers).toBe(0);
    await page.evaluate(() => window.draw({ texts: ['하나뿐인 문장'] }));
    await expect(text).toHaveText('하나뿐인 문장');
    await page.waitForTimeout(500);
    await expect(text).toHaveText('하나뿐인 문장');
    await expect.poll(timers).toBe(0);
    await page.evaluate(() => window.draw({ texts: ['첫 문장', '두 번째 문장'] }));
    await expect.poll(timers).toBe(1);
    await page.evaluate(() => window.typewriterRoot.unmount());
    await expect.poll(timers).toBe(0);
    assert.deepEqual(errors, []);
  });
} finally {
  await browser.close();
}

console.log(JSON.stringify({ passed: results.length, results }, null, 2));
