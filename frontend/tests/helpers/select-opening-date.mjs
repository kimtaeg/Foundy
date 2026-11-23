import { expect } from '@playwright/test';

async function chooseOption(scope, label, option) {
  await scope.getByRole('button', {name: label, exact: true}).click();
  const list = scope.getByRole('listbox', {name: label, exact: true});
  await list.getByRole('option', {name: option, exact: true}).click();
  await expect(list).toBeHidden();
}

// Use the same month/year controls as keyboard and pointer users.
export async function selectOpeningDate(scope, value) {
  const [year, month] = value.split('-');
  const trigger = scope.getByRole('button', {name: /^개업 예정일,/});
  await trigger.click();
  await chooseOption(scope, '연도 선택', year);
  await chooseOption(scope, '월 선택', Number(month) + '월');
  const day = scope.locator('[data-day="' + value + '"] button');
  await expect(day).toBeEnabled();
  await day.click();
  await expect(trigger).toHaveText(value);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}
