import { expect } from '@playwright/test';

// Use the same month/year controls as keyboard and pointer users.
export async function selectOpeningDate(scope, value) {
  const [year, month] = value.split('-');
  const trigger = scope.getByRole('button', {name: /^개업 예정일,/});
  await trigger.click();
  await scope.getByRole('combobox', {name: '연도 선택'}).selectOption(year);
  await scope.getByRole('combobox', {name: '월 선택'}).selectOption(String(Number(month) - 1));
  const day = scope.locator('[data-day="' + value + '"] button');
  await expect(day).toBeEnabled();
  await day.click();
  await expect(trigger).toHaveText(value);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}
