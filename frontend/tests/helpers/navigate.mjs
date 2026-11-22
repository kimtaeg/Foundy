/** Follow the visible navigation, including preparation disclosure and account shortcut. */
export async function navigate(page, destination) {
  const target = page.locator(`#nav [data-page="${destination}"]`);
  if (destination === 'mypage' && !await target.isVisible()) {
    await page.getByRole('button', { name: /가게 정보 열기$/ }).click();
    return;
  }
  if (!await target.isVisible()) {
    const disclosure = page.locator('#nav [data-navigation-group="preparation"]');
    if (await disclosure.count() && await disclosure.getAttribute('aria-expanded') !== 'true') await disclosure.click();
  }
  await target.click();
}
