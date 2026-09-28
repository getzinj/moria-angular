import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';


export function rows(page: Page): Locator {
  return page.locator('moria-vt100-screen .row');
}


export async function screen(page: Page): Promise<string[]> {
  return rows(page).allTextContents();
}


/** From the news to the town, as a human warrior named Bob. */
export async function new_character(page: Page): Promise<void> {
  await page.goto('/');
  await expect(rows(page).nth(1)).toContainText('Moria 4.80');
  await page.keyboard.press('Space');
  await expect(rows(page).nth(20)).toContainText('Choose a race');
  await page.keyboard.type('ama');
  await expect(rows(page).nth(21)).toContainText('Enter your player\'s name');
  await page.keyboard.type('Bob');
  await page.keyboard.press('Enter');
  await expect(rows(page).nth(23)).toContainText('Press any key to continue');
  await page.keyboard.press('Space');
}
