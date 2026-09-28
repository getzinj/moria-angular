// Stands a game up for tests: a runtime with a fixed seed, a clock that never waits, files in
// memory, and a way to hand keys over only once the game is waiting for one (flush() throws
// type-ahead away, as a player would find).

import { dl } from './dungeon-locals';
import { mlink, tlink } from './misc';
import { panel_bounds } from './moria';
import type { cave_type } from './types';
import { g, resetglobals } from './variables';
import { InstantClock } from '../runtime/clock';
import { MemoryFileStore } from '../runtime/files';
import { Keyboard } from '../runtime/keyboard';
import { clone } from '../runtime/pascal';
import { Random } from '../runtime/random';
import type { IRuntime } from '../runtime/runtime';
import { rt, setRuntime } from '../runtime/runtime';
import { ScreenGrid } from '../runtime/screen-grid';
import { Terminal } from '../runtime/terminal';


/** The files the game printed, by name. */
export const downloads: Map<string, string> = new Map<string, string>();


export function settle(): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
}


/** A fresh machine and fresh globals. */
export function boot(seed: number = 1): IRuntime {
  const runtime: IRuntime = {
    random: new Random(seed),
    terminal: new Terminal(new ScreenGrid(), new Keyboard()),
    clock: new InstantClock(),
    files: new MemoryFileStore(),
    username: 'PLAYER      ',
    download: (name: string, contents: string): void => {
      downloads.set(name, contents);
    },
  };

  downloads.clear();
  setRuntime(runtime);
  resetglobals();

  return runtime;
}


export function screen(): ScreenGrid {
  return rt().terminal.screen;
}


/** Runs a routine, handing over each key once it is waiting for one, and returns its result. */
export async function play<T>(routine: () => Promise<T>, keys: string = ''): Promise<T> {
  let finished: boolean = false;
  const running: Promise<T> = routine().finally((): void => {
    finished = true;
  });

  // Handled here so a routine that throws between keys is not an unhandled rejection; the
  // caller still sees the throw from the promise returned below.
  running.catch((): void => undefined);

  for (const key of keys) {
    while (!finished && !rt().terminal.keyboard.waiting) {
      await settle();
    }

    if (!finished) {
      rt().terminal.keyboard.push(key);
    }
  }

  return running;
}


/**
 * Starts a routine and waits until it asks for a key, so the screen can be read at that point.
 * The routine's promise comes back for a test that goes on to finish it.
 */
export async function waitAtPrompt<T>(routine: () => Promise<T>): Promise<{ running: Promise<T> }> {
  let finished: boolean = false;
  const running: Promise<T> = routine().finally((): void => {
    finished = true;
  });

  running.catch((): void => undefined);

  while (!finished && !rt().terminal.keyboard.waiting) {
    await settle();
  }

  return { running };
}


/** The screen once a routine has taken the keys and stopped again, at a prompt or finished. */
export async function screenAfter(routine: () => Promise<unknown>, keys: string): Promise<string> {
  let finished: boolean = false;
  const running: Promise<unknown> = routine().finally((): void => {
    finished = true;
  });

  running.catch((): void => undefined);

  for (const key of keys) {
    while (!finished && !rt().terminal.keyboard.waiting) {
      await settle();
    }

    if (!finished) {
      rt().terminal.keyboard.push(key);
    }
  }

  await settle();

  while (!finished && !rt().terminal.keyboard.waiting) {
    await settle();
  }

  return screen().toString();
}


export const ROW: number = 10;
export const COL: number = 30;


/** A lit, empty room filling a town-sized cave, the player in its middle at ROW, COL. */
export function lit_room(): void {
  tlink();
  mlink();
  g.cur_height = 22;
  g.cur_width = 66;

  for (let y: number = 1; y <= g.cur_height; y++) {
    for (let x: number = 1; x <= g.cur_width; x++) {
      const cell: cave_type = clone(g.blank_floor);
      const edge: boolean = (y === 1) || (x === 1) || (y === g.cur_height) || (x === g.cur_width);

      cell.fval = edge ? 15 : 1;
      cell.fopen = !edge;
      cell.pl = true;
      g.cave[y][x] = cell;
    }
  }

  g.max_panel_rows = 0;
  g.max_panel_cols = 0;
  g.panel_row = 0;
  g.panel_col = 0;
  panel_bounds();
  g.cave_flag = true;
  g.char_row = ROW;
  g.char_col = COL;
  g.cave[ROW][COL].cptr = 1;
  g.msg_line = 1;
  g.py.misc.fos = 50;
  g.py.misc.srh = 0;
  g.py.misc.lev = 1;
  g.py.misc.pclass = 1;
  g.py.misc.expfact = 1;
  g.player_max_exp = g.player_exp[39];
  dl.player_light = true;
}
