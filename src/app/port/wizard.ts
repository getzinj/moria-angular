// source/include/wizard.inc: the version screen and the wizard's tools.

import { cur_version, inven_max } from './constants';
import { dl } from './dungeon-locals';
import { clear, erase_line, get_com, get_hex_value, get_string, msg_print, pause, prt, put_buffer } from './io';
import {
  draw_cave,
  popt,
  prt_charisma,
  prt_chp,
  prt_cmana,
  prt_constitution,
  prt_dexterity,
  prt_gold,
  prt_intelligence,
  prt_map,
  prt_mhp,
  prt_strength,
  prt_wisdom,
} from './misc';
import { delete_object, py_bonuses } from './moria';
import type { cave_type, player_misc_type, player_stat_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, fmt, fmtFixed, read_integer, ref } from '../runtime/pascal';

const CREDITS: readonly string[] = [
  'Version 0.1  : 03/25/83',
  'Version 1.0  : 05/01/84',
  'Version 2.0  : 07/10/84',
  'Version 3.0  : 11/20/84',
  'Version 4.0  : 01/20/85',
];

const MODULES: readonly string[] = [
  'Modules :',
  '     V1.0  Dungeon Generator      - RAK',
  '           Character Generator    - RAK & JWT',
  '           Moria Module           - RAK',
  '           Miscellaneous          - RAK & JWT',
  '     V2.0  Town Level & Misc      - RAK',
  '     V3.0  Internal Help & Misc   - RAK',
  '     V4.0  Source Release Version - RAK',
];

const AUTHORS: readonly string[] = [
  'Robert Alan Koeneke               Jimmey Wayne Todd Jr.',
  'Student/University of Oklahoma    Student/University of Oklahoma',
  '119 Crystal Bend                  1912 Tiffany Dr.',
  'Norman, OK 73069                  Norman, OK  73071',
  '(405)-321-2925                    (405) 360-6792',
];


// wizard.inc:2 game_version: the credits.
export async function game_version(): Promise<void> {
  clear(1, 1);
  put_buffer(`               Moria Version ${ fmtFixed(cur_version, 3, 2) }`, 1, 1);
  CREDITS.forEach((line: string, i: number): void => put_buffer(line, i + 2, 1));
  MODULES.forEach((line: string, i: number): void => put_buffer(line, i + 8, 1));
  AUTHORS.forEach((line: string, i: number): void => put_buffer(line, i + 17, 1));
  await pause(24);
  draw_cave();
}


// wizard.inc:33 wizard_light: lights the level, or darkens it if the player's square was lit.
export function wizard_light(): void {
  const flag: boolean = !g.cave[g.char_row][g.char_col].pl;

  for (let i1: number = 1; i1 <= g.cur_height; i1++) {
    for (let i2: number = 1; i2 <= g.cur_width; i2++) {
      if (g.floor_set.has(g.cave[i1][i2].fval)) {
        light_around(i1, i2, flag);
      }
    }
  }

  prt_map();
}


function light_around(i1: number, i2: number, flag: boolean): void {
  for (let i3: number = i1 - 1; i3 <= i1 + 1; i3++) {
    for (let i4: number = i2 - 1; i4 <= i2 + 1; i4++) {
      const cell: cave_type = g.cave[i3][i4];

      cell.pl = flag;

      if (!flag) {
        cell.fm = false;
      }
    }
  }
}


/** Asks at row 1, column col, and reads one integer; fallback when it will not read. */
async function ask_number(prompt: string, col: number, fallback: number): Promise<number> {
  const tmp_str: IRef<string> = box('');

  prt(prompt, 1, 1);
  await get_string(tmp_str, 1, col, 10);

  return read_integer(tmp_str.get(), fallback);
}


type stat_name = 'str' | 'int' | 'wis' | 'dex' | 'con' | 'chr';

const STAT_PROMPTS: readonly (readonly [ stat_name, string, () => void ])[] = [
  [ 'str', '(3 - 118) Strength     = ', prt_strength ],
  [ 'int', '(3 - 118) Intelligence = ', prt_intelligence ],
  [ 'wis', '(3 - 118) Wisdom       = ', prt_wisdom ],
  [ 'dex', '(3 - 118) Dexterity    = ', prt_dexterity ],
  [ 'con', '(3 - 118) Constitution = ', prt_constitution ],
  [ 'chr', '(3 - 118) Charisma     = ', prt_charisma ],
];

type skill_name = 'srh' | 'stl' | 'disarm' | 'save' | 'bth' | 'bthb';

// The last number is one past the highest value taken.
const SKILL_PROMPTS: readonly (readonly [ skill_name, string, number ])[] = [
  [ 'srh', '  (0-200) Searching = ', 201 ],
  [ 'stl', '  (0-10) Stealth = ', 11 ],
  [ 'disarm', '  (0-200) Disarming = ', 201 ],
  [ 'save', '  (0-100) Save = ', 201 ],
  [ 'bth', '  (0-200) Base to hit = ', 201 ],
  [ 'bthb', '  (0-200) Bows/Throwing = ', 201 ],
];


// wizard.inc:59 change_character: sets the stats, hit points, mana, skills and gold.
export async function change_character(): Promise<void> {
  const stat: player_stat_type = g.py.stat;
  const misc: player_misc_type = g.py.misc;

  for (const [ name, prompt, show ] of STAT_PROMPTS) {
    const tmp_val: number = await ask_number(prompt, 26, -999);

    if ((tmp_val > 2) && (tmp_val < 119)) {
      stat[name] = tmp_val;
      stat[`c${ name }`] = tmp_val;
      show();
    }
  }

  await change_points(misc);

  for (const [ name, label, limit ] of SKILL_PROMPTS) {
    await change_skill(misc, name, label, limit);
  }

  const gold_prompt: string = `Current=${ fmt(misc.au, 1) }  Gold = `;
  const gold: number = await ask_number(gold_prompt, gold_prompt.length + 1, -999);

  if (gold > -1) {
    misc.au = gold;
    prt_gold();
  }

  erase_line(g.msg_line, g.msg_line);
  py_bonuses(g.blank_treasure, 0);
}


async function change_points(misc: player_misc_type): Promise<void> {
  const hp: number = await ask_number('(1 - 32767) Hit points = ', 26, -1);

  if ((hp > 0) && (hp < 32768)) {
    misc.mhp = hp;
    misc.chp = hp;
    prt_mhp();
    prt_chp();
  }

  const mana: number = await ask_number('(0 - 32767) Mana       = ', 26, -999);

  if ((mana > -1) && (mana < 32768)) {
    misc.mana = mana;
    misc.cmana = mana;
    prt_cmana();
  }
}


// The Save prompt says 0-100 but takes up to 200, as the source does.
async function change_skill(misc: player_misc_type, name: skill_name, label: string, limit: number): Promise<void> {
  const prompt: string = `Current=${ fmt(misc[name], 1) }${ label }`;
  const tmp_val: number = await ask_number(prompt, prompt.length + 1, -999);

  if ((tmp_val > -1) && (tmp_val < limit)) {
    misc[name] = tmp_val;
  }
}


const TCHARS: Readonly<Record<number, string>> = {
  1: '~', 13: '~', 15: '~', 2: '&', 10: '{', 11: '{', 12: '{', 20: '}', 21: '/', 22: '\\', 23: '|', 25: '\\',
  30: ']', 31: ']', 32: '(', 33: ']', 34: ')', 35: '[', 36: '(', 40: '"', 45: '=', 55: '_', 60: '-', 65: '-',
  70: '?', 71: '?', 75: '!', 76: '!', 77: '!', 80: ',', 90: '?', 91: '?',
};


// wizard.inc:215 wizard_create: an object made to order, dropped at the player's feet.
export async function wizard_create(): Promise<void> {
  const tmp_str: IRef<string> = box('');

  await msg_print('Warning: This routine can cause fatal error.');
  await msg_print(' ');
  g.msg_flag = false;

  const made: treasure_type = g.inventory[inven_max];

  prt('Name   : ', 1, 1);
  made.name = await get_string(tmp_str, 1, 10, 40) ? tmp_str.get() : '& Wizard Object!';

  let tval: number;

  do {
    tval = await ask_number('Tval   : ', 10, 0);
  } while (TCHARS[tval] == null);

  made.tchar = TCHARS[tval];
  made.tval = tval;
  made.subval = await ask_number('Subval : ', 10, 1);
  made.weight = await ask_number('Weight : ', 10, 1);
  made.number = await ask_number('Number : ', 10, 1);
  prt('Damage : ', 1, 1);
  await get_string(tmp_str, 1, 10, 5);
  made.damage = tmp_str.get();
  made.tohit = await ask_number('+To hit: ', 10, 0);
  made.todam = await ask_number('+To dam: ', 10, 0);
  made.ac = await ask_number('AC     : ', 10, 0);
  made.toac = await ask_number('+To AC : ', 10, 0);
  made.p1 = await ask_number('P1     : ', 10, 0);
  prt('Flags (In HEX): ', 1, 1);
  made.flags = await get_hex_value(1, 17, 8);
  made.cost = await ask_number('Cost : ', 10, 0);
  await allocate(made);
  g.inventory[inven_max] = clone(g.blank_treasure);
}


async function allocate(made: treasure_type): Promise<void> {
  const command: IRef<string> = ref(dl, 'command');

  if (await get_com('Allocate? (Y/N)', command)) {
    if ([ 'y', 'Y' ].includes(command.get())) {
      const tmp_val: IRef<number> = box(0);

      popt(tmp_val);
      g.t_list[tmp_val.get()] = clone(made);

      if (g.cave[g.char_row][g.char_col].tptr > 0) {
        delete_object(g.char_row, g.char_col);
      }

      g.cave[g.char_row][g.char_col].tptr = tmp_val.get();
      await msg_print('Allocated...');
    } else {
      await msg_print('Aborted...');
    }
  }
}

