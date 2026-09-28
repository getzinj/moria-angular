import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { new_character, rows, screen } from './moria-page';

// A seeded game from start to a second restore. The clock is frozen, so every seed the game
// takes from the time is the same on each run, and so is the town.

const FROZEN: Date = new Date('2026-01-01T12:00:00Z');
const MAP_TOP: number = 2;
const MAP_LEFT: number = 15;
const STEPS: Readonly<Record<string, string>> = {
  '-1,-1': '7', '-1,0': '8', '-1,1': '9', '0,-1': '4', '0,1': '6', '1,-1': '1', '1,0': '2', '1,1': '3',
};

interface ICell {
  y: number;
  x: number;
}

interface IShelfItem {
  letter: string;
  price: number;
}


/** Presses a key, then waits for the screen to change (or a short while, if it does not). */
async function press(page: Page, key: string): Promise<void> {
  const before: string = (await screen(page)).join('\n');

  await page.keyboard.press(key);
  await expect.poll(async (): Promise<string> => (await screen(page)).join('\n'), { timeout: 2_000 }).not.toBe(before).catch((): void => undefined);
}


/** Answers any -more- until the message line is clear of it. */
async function settle(page: Page): Promise<void> {
  for (let i: number = 0; (i < 20) && (await screen(page))[0].includes('-more-'); i++) {
    await press(page, 'Space');
  }
}


function find(rows: readonly string[], symbol: string): ICell | null {
  let result: ICell | null = null;

  rows.forEach((row: string, i: number): void => {
    const x: number = row.indexOf(symbol, MAP_LEFT - 1);

    if ((result == null) && (i >= MAP_TOP - 1) && (i <= 22) && (x >= 0)) {
      result = { y: i, x };
    }
  });

  return result;
}


/** The first step of a shortest path over the town's floor to the target; null if there is none. */
function first_step(rows: readonly string[], from: ICell, to: ICell): string | null {
  const key: (c: ICell) => string = (c: ICell): string => `${ c.y },${ c.x }`;
  const came: Map<string, ICell> = new Map<string, ICell>([ [ key(from), from ] ]);
  const queue: ICell[] = [ from ];
  let step: string | null = null;

  while ((queue.length > 0) && !came.has(key(to))) {
    const at: ICell = queue.shift() as ICell;

    for (const [ dy, dx ] of [ [ -1, -1 ], [ -1, 0 ], [ -1, 1 ], [ 0, -1 ], [ 0, 1 ], [ 1, -1 ], [ 1, 0 ], [ 1, 1 ] ]) {
      const next: ICell = { y: at.y + dy, x: at.x + dx };
      const cell: string = rows[next.y]?.charAt(next.x) ?? '#';
      const on_map: boolean = (next.y >= MAP_TOP - 1) && (next.y <= 22) && (next.x >= MAP_LEFT - 1);
      const open: boolean = on_map && ((cell === '.') || ((next.y === to.y) && (next.x === to.x)));

      if (open && !came.has(key(next))) {
        came.set(key(next), at);
        queue.push(next);
      }
    }
  }

  if (came.has(key(to)) && (key(to) !== key(from))) {
    let at: ICell = to;

    while (key(came.get(key(at)) as ICell) !== key(from)) {
      at = came.get(key(at)) as ICell;
    }

    step = STEPS[`${ at.y - from.y },${ at.x - from.x }`] ?? null;
  }

  return step;
}


/** Walks the player onto the first square showing the symbol, until `arrived` holds. */
async function walk_to(page: Page, symbol: string, arrived: (rows: readonly string[], on_target: boolean) => boolean): Promise<void> {
  let goal: ICell | null = null;
  let done: boolean = false;

  for (let moves: number = 0; (moves < 200) && !done; moves++) {
    await settle(page);

    const shown: string[] = await screen(page);
    const player: ICell | null = find(shown, '@');
    const on_target: boolean = (goal != null) && (player != null) && (player.y === goal.y) && (player.x === goal.x);

    if (arrived(shown, on_target)) {
      done = true;
    } else {
      goal = find(shown, symbol) ?? goal;

      const step: string | null = (player != null) && (goal != null) ? first_step(shown, player, goal) : null;

      expect(step, `a path from @ to ${ symbol }`).not.toBeNull();
      await press(page, step as string);
    }
  }

  expect(done, `reached ${ symbol }`).toBe(true);
}


function gold(rows: readonly string[]): number {
  return Number(/Gold Remaining : (\d+)/.exec(rows[18])?.[1]);
}


/** Buys the cheapest thing on the shelf, offering the asking price. */
async function buy_cheapest(page: Page): Promise<void> {
  const shelf: IShelfItem[] = (await screen(page)).slice(5, 17)
    .map((row: string): IShelfItem => ({ letter: row.charAt(0), price: Number(row.substring(59, 65)) }))
    .filter((item: IShelfItem): boolean => /[a-l]/.test(item.letter) && (item.price > 0));

  expect(shelf.length, 'priced items on the shelf').toBeGreaterThan(0);

  const cheapest: IShelfItem = shelf.reduce((a: IShelfItem, b: IShelfItem): IShelfItem => (b.price < a.price ? b : a));

  await press(page, 'p');
  await press(page, cheapest.letter);
  await expect(rows(page).nth(1)).toContainText('Asking : ');
  await page.keyboard.type(String(/Asking : (\d+)/.exec((await screen(page))[1])?.[1]));
  await press(page, 'Enter');
  await settle(page);
}


test('a seeded game buys, goes down, saves and restores once', async ({ page }: { page: Page }) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(FROZEN);
  await new_character(page);
  await expect(rows(page).nth(23)).toContainText('Town level');

  await walk_to(page, '1', (rows: readonly string[]): boolean => rows[20].startsWith('You may:'));

  const before: number = gold(await screen(page));

  await buy_cheapest(page);
  expect(gold(await screen(page))).toBeLessThan(before);

  await press(page, 'Escape');
  await expect(rows(page).nth(23)).toContainText('Town level');
  await walk_to(page, '>', (_: readonly string[], on_target: boolean): boolean => on_target);
  await press(page, '>');
  await settle(page);
  await expect(rows(page).nth(23)).toContainText('Depth: 50 (feet)');

  await page.keyboard.press('Control+z');
  await expect(rows(page).nth(0)).toContainText('Enter Filename:');
  await page.keyboard.type('E2E.SAV');
  await page.keyboard.press('Enter');
  await expect(rows(page).nth(0)).toContainText('Character saved.');

  const save: string | null = await page.evaluate((): string | null => localStorage.getItem('moria:file:E2E.SAV'));

  expect(save).not.toBeNull();

  await expect(rows(page).nth(23)).toContainText('Moria has exited');
  await page.keyboard.press('Space');
  await expect(rows(page).nth(0)).toContainText('Restore file (RETURN for new character):');
  await page.keyboard.type('E2E.SAV');
  await page.keyboard.press('Enter');
  await expect(rows(page).nth(1)).toContainText('Moria 4.80');
  await page.keyboard.press('Space');
  await expect(rows(page).nth(21)).toContainText('<c>hange character name.');
  await page.keyboard.press('Escape');
  await expect(rows(page).nth(23)).toContainText('Depth: 50 (feet)');

  await page.evaluate((copy: string): void => localStorage.setItem('moria:file:E2E.SAV', copy), save as string);
  await page.goto('/?E2E.SAV');
  await expect(rows(page).nth(1)).toContainText('Moria 4.80');
  await page.keyboard.press('Space');

  await expect(rows(page).nth(0)).toContainText('Data Corruption Error.');
});
