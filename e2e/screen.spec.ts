import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { new_character, rows } from './moria-page';


test('the terminal shows 24 rows', async ({ page }: { page: Page }) => {
  await page.goto('/');

  await expect(rows(page)).toHaveCount(24);
});


test('the game opens on the news', async ({ page }: { page: Page }) => {
  await page.goto('/');

  await expect(rows(page).nth(1)).toContainText('Moria 4.80');
});


test('a key after the news starts character creation', async ({ page }: { page: Page }) => {
  await page.goto('/');
  await expect(rows(page).nth(1)).toContainText('Moria 4.80');

  await page.keyboard.press('Space');

  await expect(rows(page).nth(20)).toContainText('Choose a race (? for Help):');
});


test('a new character reaches the town', async ({ page }: { page: Page }) => {
  await new_character(page);

  await expect(rows(page).nth(23)).toContainText('Town level');
});
