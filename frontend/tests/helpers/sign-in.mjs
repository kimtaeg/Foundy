import { expect } from '@playwright/test';

/** Exercise the current login form while retaining the archived HTML baseline. */
export async function signIn(page, { mode = 'migrated' } = {}) {
  if (mode === 'baseline') {
    await page.locator('[data-nx="demologin"]').click();
  } else {
    await page.locator('input[name="username"]').fill('demo');
    await page.locator('input[name="password"]').fill('demo');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
  }
  await expect(page.locator('#authScreen')).not.toBeVisible();
}
