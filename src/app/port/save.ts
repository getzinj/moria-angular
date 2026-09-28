// source/include/save.inc: saves as JSON with the source's fields, without its XOR coding.

import {
  cur_version,
  encrypt_seed1,
  inven_max,
  max_class,
  max_creatures,
  max_height,
  max_malloc,
  max_objects,
  max_owners,
  max_player_level,
  max_races,
  max_stores,
  max_talloc,
  max_width,
  store_inven_max,
} from './constants';
import { identify } from './desc';
import { clear, exit, get_string, msg_print, pause, prt, put_qio } from './io';
import { get_seed, mlink, popm, popt, randint, tlink } from './misc';
import { store_maint } from './store1';
import type { cave_type, inven_record, monster_type, player_flags_type, player_misc_type, player_stat_type, spell_type, store_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, fmtFixed, real, uand } from '../runtime/pascal';
import { vmsFileName } from '../runtime/files';
import { rt } from '../runtime/runtime';

type misc_key = keyof player_misc_type;
type flag_key = keyof player_flags_type;

// The py.misc fields the source writes, in its order; chp and expfact lose all but one decimal.
const MISC_FIELDS: readonly misc_key[] = [
  'pclass', 'prace', 'age', 'ht', 'wt', 'sc', 'max_exp', 'exp', 'lev', 'max_lev', 'expfact',
  'srh', 'fos', 'stl', 'bth', 'bthb', 'mana', 'cmana', 'mhp', 'chp', 'au',
  'ptohit', 'ptodam', 'pac', 'ptoac', 'dis_th', 'dis_td', 'dis_ac', 'dis_tac', 'disarm', 'save', 'hitdie',
];

// The py.flags fields the source writes; the rest (rest, paralysis, ...) start afresh on restore.
const FLAG_FIELDS: readonly flag_key[] = [
  'status', 'blind', 'confused', 'food', 'food_digested', 'protection', 'speed', 'afraid', 'poisoned', 'see_inv',
  'fast', 'slow', 'protevil', 'teleport', 'free_act', 'slow_digest',
  'aggravate', 'sustain_str', 'sustain_int', 'sustain_wis', 'sustain_con', 'sustain_dex', 'sustain_chr',
  'fire_resist', 'cold_resist', 'acid_resist', 'regenerate', 'lght_resist', 'ffall', 'confuse_monster',
  'image', 'invuln', 'hero', 'shero', 'blessed', 'resist_heat', 'resist_cold', 'detect_inv', 'word_recall',
  'see_infra', 'tim_infra',
];

const STAT_FIELDS: readonly (keyof player_stat_type)[] = [ 'str', 'cstr', 'dex', 'cdex', 'con', 'ccon', 'int', 'cint', 'wis', 'cwis', 'chr', 'cchr' ];

type monster_key = 'fy' | 'fx' | 'mptr' | 'hp' | 'cspeed' | 'csleep' | 'cdis' | 'ml' | 'confused';

const MONSTER_FIELDS: readonly monster_key[] = [ 'fy', 'fx', 'mptr', 'hp', 'cspeed', 'csleep', 'cdis', 'ml', 'confused' ];

interface ISavedTreasure {
  y: number;
  x: number;
  item: treasure_type;
}

interface ISavedStore {
  items: inven_record[];
  owner: number;
  insult_cur: number;
  store_open: number;
}

interface ISaveFile {
  seed: number;
  id: string;
  version: number;
  name: string;
  race: string;
  sex: string;
  tclass: string;
  title: string;
  history: string[];
  char_row: number;
  char_col: number;
  misc: Record<string, number>;
  inven_ctr: number;
  inven_weight: number;
  equip_ctr: number;
  dun_level: number;
  missle_ctr: number;
  mon_tot_mult: number;
  turn: number;
  randes_seed: number;
  inventory: treasure_type[];
  equipment: treasure_type[];
  stat: Record<string, number>;
  flags: Record<string, number | boolean>;
  spells: { learned: boolean; sexp: number }[];
  cur_height: number;
  cur_width: number;
  max_panel_rows: number;
  max_panel_cols: number;
  floor: number[][];
  treasures: ISavedTreasure[];
  identified: string;
  monsters: Record<string, number | boolean>[];
  town_seed: number;
  stores: ISavedStore[];
}


// save.inc:7 data_exception: a save file that was tampered with, or already restored.
function data_exception(): never {
  clear(1, 1);
  prt('Data Corruption Error.', 1, 1);
  prt('', 2, 1);

  return exit();
}


// save.inc:17 coder: the XOR coding's draws, one per character.
function coder(length: number): void {
  for (let i1: number = 1; i1 <= length; i1++) {
    randint(256);
  }
}


// MASTER's ids, or null when it is not a list of them.
function master(): string[] | null {
  const stored: string = rt().files.read(g.moria_mas) ?? '';
  let ids: unknown = [];

  if (stored !== '') {
    try {
      ids = JSON.parse(stored);
    } catch {
      ids = null;
    }
  }

  return Array.isArray(ids) && ids.every((id: unknown): boolean => typeof id === 'string') ? ids as string[] : null;
}


// The game's own files, which VMS kept apart from the player's directory.
function game_file(fnam: string): boolean {
  return [ g.moria_hou, g.moria_mor, g.moria_mas, g.moria_top, g.moria_hlp ]
    .some((name: string): boolean => vmsFileName(name) === vmsFileName(fnam));
}


function write_master(ids: readonly string[]): void {
  rt().files.write(g.moria_mas, JSON.stringify(ids));
}


// save.inc:69 save_char: saves and ends the game; false when the player gave up on the name.
export async function save_char(): Promise<boolean> {
  const fnam: IRef<string> = box('');
  let flag: boolean = false;

  prt('Enter Filename:', 1, 1);

  if (await get_string(fnam, 1, 17, 60)) {
    if (fnam.get().length === 0) {
      fnam.set('MORIACHR.SAV');
    }

    if (game_file(fnam.get())) {
      await msg_print(`Error creating> ${ fnam.get() }`);
    } else {
      flag = true;
    }
  }

  const temp: string | null = flag ? await register() : null;

  if (temp == null) {
    rt().random.seed = get_seed();
  } else {
    const save_seed: number = get_seed();

    rt().random.seed = save_seed;
    clear(1, 1);
    prt('Saving character...', 1, 1);
    put_qio();
    rt().files.write(fnam.get(), JSON.stringify(save_record(save_seed, temp)));
    prt(`Character saved. [Moria Version ${ fmtFixed(cur_version, 5, 2) }]`, 1, 1);
    exit();
  }

  return false;
}


// A new id for MASTER: up to six tries at one not already there.
async function register(): Promise<string | null> {
  const ids: string[] | null = master();
  let result: string | null = null;

  if (ids == null) {
    await msg_print('Error saving character, contact MORIA Wizard.');
  } else {
    result = await unique_id(ids);
  }

  return result;
}


async function unique_id(ids: string[]): Promise<string | null> {
  let result: string | null = null;
  let trys: number = 0;

  do {
    let temp: string = '';

    for (let i1: number = 1; i1 <= 70; i1++) {
      temp += String.fromCharCode(31 + randint(95));
    }

    rt().random.seed = encrypt_seed1;
    coder(70);

    if (ids.includes(temp)) {
      trys++;
    } else {
      result = temp;
    }
  } while ((result == null) && (trys <= 5));

  if (result == null) {
    await msg_print('Error in writing to MASTER.');
  } else {
    write_master([ ...ids, result ]);
  }

  return result;
}


function save_record(save_seed: number, temp: string): ISaveFile {
  const misc: player_misc_type = g.py.misc;

  return {
    seed: save_seed,
    id: temp,
    version: cur_version,
    name: misc.name,
    race: misc.race,
    sex: misc.sex,
    tclass: misc.tclass,
    title: misc.title,
    history: [ 1, 2, 3, 4, 5 ].map((i1: number): string => misc.history[i1]),
    char_row: g.char_row,
    char_col: g.char_col,
    misc: saved_misc(misc),
    inven_ctr: g.inven_ctr,
    inven_weight: g.inven_weight,
    equip_ctr: g.equip_ctr,
    dun_level: g.dun_level,
    missle_ctr: g.missle_ctr,
    mon_tot_mult: g.mon_tot_mult,
    turn: uand(0xF, g.turn),
    randes_seed: g.randes_seed,
    inventory: slots(1, g.inven_ctr),
    equipment: slots(23, inven_max - 1),
    stat: Object.fromEntries(STAT_FIELDS.map((key: keyof player_stat_type): [ string, number ] => [ key, g.py.stat[key] ])),
    flags: Object.fromEntries(FLAG_FIELDS.map((key: flag_key): [ string, number | boolean ] => [ key, g.py.flags[key] ])),
    spells: spells_of(misc.pclass).map((spell: spell_type): { learned: boolean; sexp: number } => ({ learned: spell.learned, sexp: spell.sexp })),
    cur_height: g.cur_height,
    cur_width: g.cur_width,
    max_panel_rows: g.max_panel_rows,
    max_panel_cols: g.max_panel_cols,
    ...saved_level(),
    town_seed: g.town_seed,
    stores: saved_stores(),
  };
}


function saved_misc(misc: player_misc_type): Record<string, number> {
  const result: Record<string, number> = {};

  for (const key of MISC_FIELDS) {
    result[key] = misc[key] as number;
  }

  result['expfact'] = one_decimal(misc.expfact, 2);
  result['chp'] = one_decimal(misc.chp, 1);

  return result;
}


// A real written with :width:1 and read back.
function one_decimal(value: number, width: number): number {
  return real(Number(fmtFixed(value, width, 1)));
}


function slots(from: number, to: number): treasure_type[] {
  const result: treasure_type[] = [];

  for (let i1: number = from; i1 <= to; i1++) {
    result.push(clone(g.inventory[i1]));
  }

  return result;
}


function spells_of(pclass: number): spell_type[] {
  const result: spell_type[] = [];

  for (let i1: number = 1; i1 <= 31; i1++) {
    result.push(g.magic_spell[pclass][i1]);
  }

  return result;
}


function saved_level(): Pick<ISaveFile, 'floor' | 'treasures' | 'identified' | 'monsters'> {
  const floor: number[][] = [];
  const treasures: ISavedTreasure[] = [];
  const monsters: Record<string, number | boolean>[] = [];
  let identified: string = '';

  for (let i1: number = 1; i1 <= g.cur_height; i1++) {
    const row: number[] = [];

    for (let i2: number = 1; i2 <= g.cur_width; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      row.push(cell.fval | (cell.fopen ? 0x10 : 0) | (cell.pl ? 0x20 : 0) | (cell.fm ? 0x40 : 0));

      if (cell.tptr > 0) {
        treasures.push({ y: i1, x: i2, item: clone(g.t_list[cell.tptr]) });
      }
    }

    floor.push(row);
  }

  for (let i1: number = 1; i1 <= max_objects; i1++) {
    identified += g.object_ident[i1] ? 'T' : 'F';
  }

  for (let i1: number = g.muptr; i1 !== 0; i1 = g.m_list[i1].nptr) {
    const monster: monster_type = g.m_list[i1];

    monsters.push(Object.fromEntries(MONSTER_FIELDS.map((key: monster_key): [ string, number | boolean ] => [ key, monster[key] ])));
  }

  return { floor, treasures, identified, monsters };
}


// The stores; a shop's opening turn is kept as turns from now, plus 15.
function saved_stores(): ISavedStore[] {
  const result: ISavedStore[] = [];

  for (let i1: number = 1; i1 <= max_stores; i1++) {
    const shop: store_type = g.store[i1];
    const items: inven_record[] = [];

    for (let i2: number = 1; i2 <= shop.store_ctr; i2++) {
      items.push({ scost: shop.store_inven[i2].scost, sitem: clone(shop.store_inven[i2].sitem) });
    }

    shop.store_open = shop.store_open > g.turn ? shop.store_open - g.turn + 15 : 0;
    result.push({ items, owner: shop.owner, insult_cur: shop.insult_cur, store_open: shop.store_open });
  }

  return result;
}


type kind = 'number' | 'string' | 'boolean' | 'array' | 'object';

// Every field of a save, so adding one to ISaveFile without listing it here fails to compile.
const SAVE_SHAPE: Readonly<Record<keyof ISaveFile, kind>> = {
  seed: 'number', id: 'string', version: 'number', name: 'string', race: 'string', sex: 'string', tclass: 'string',
  title: 'string', history: 'array', char_row: 'number', char_col: 'number', misc: 'object', inven_ctr: 'number',
  inven_weight: 'number', equip_ctr: 'number', dun_level: 'number', missle_ctr: 'number', mon_tot_mult: 'number',
  turn: 'number', randes_seed: 'number', inventory: 'array', equipment: 'array', stat: 'object', flags: 'object',
  spells: 'array', cur_height: 'number', cur_width: 'number', max_panel_rows: 'number', max_panel_cols: 'number',
  floor: 'array', treasures: 'array', identified: 'string', monsters: 'array', town_seed: 'number', stores: 'array',
};


function kind_of(value: unknown): kind | null {
  let result: kind | null = null;

  if (Array.isArray(value)) {
    result = 'array';
  } else if ((typeof value === 'object') && (value != null)) {
    result = 'object';
  } else if ([ 'number', 'string', 'boolean' ].includes(typeof value)) {
    result = typeof value as kind;
  }

  return result;
}


function as_record(value: unknown): Record<string, unknown> | null {
  return kind_of(value) === 'object' ? value as Record<string, unknown> : null;
}


// Every key of like present in value, holding the same kind of thing.
function shaped_like(value: unknown, like: object): boolean {
  const candidate: Record<string, unknown> | null = as_record(value);

  return (candidate != null) && Object.entries(like).every(([ key, sample ]: [ string, unknown ]): boolean => kind_of(candidate[key]) === kind_of(sample));
}


function in_range(value: unknown, low: number, high: number): boolean {
  return Number.isInteger(value) && ((value as number) >= low) && ((value as number) <= high);
}


function is_item(value: unknown): boolean {
  return shaped_like(value, g.blank_treasure);
}


function is_save(record: unknown): record is ISaveFile {
  const candidate: Record<string, unknown> | null = as_record(record);

  const shaped: boolean = (candidate != null)
    && Object.entries(SAVE_SHAPE).every(([ key, expected ]: [ string, kind ]): boolean => kind_of(candidate[key]) === expected);
  const save: ISaveFile = candidate as unknown as ISaveFile;

  return shaped && player_ok(save) && level_ok(save) && stores_ok(save);
}


function player_ok(record: ISaveFile): boolean {
  const misc_like: Record<string, number> = Object.fromEntries(MISC_FIELDS.map((key: misc_key): [ string, number ] => [ key, 0 ]));
  const stat_like: Record<string, number> = Object.fromEntries(STAT_FIELDS.map((key: keyof player_stat_type): [ string, number ] => [ key, 0 ]));
  const flag_like: Record<string, number | boolean> = Object.fromEntries(FLAG_FIELDS.map((key: flag_key): [ string, number | boolean ] => [ key, g.py.flags[key] ]));

  return (record.history.length === 5) && record.history.every((line: unknown): boolean => typeof line === 'string')
    && shaped_like(record.misc, misc_like) && in_range(record.misc['pclass'], 1, max_class)
    && in_range(record.misc['prace'], 1, max_races) && in_range(record.misc['lev'], 1, max_player_level)
    && shaped_like(record.stat, stat_like) && shaped_like(record.flags, flag_like)
    && in_range(record.inven_ctr, 0, 22) && (record.inventory.length === record.inven_ctr) && record.inventory.every(is_item)
    && (record.equipment.length === inven_max - 23) && record.equipment.every(is_item)
    && (record.spells.length === 31) && record.spells.every((spell: unknown): boolean => shaped_like(spell, { learned: false, sexp: 0 }));
}


function level_ok(record: ISaveFile): boolean {
  const on_map: (y: unknown, x: unknown) => boolean = (y: unknown, x: unknown): boolean =>
    in_range(y, 1, record.cur_height) && in_range(x, 1, record.cur_width);
  const monster_like: Record<string, number | boolean> = Object.fromEntries(MONSTER_FIELDS.map((key: monster_key): [ string, number | boolean ] => [ key, g.blank_monster[key] ]));

  return in_range(record.cur_height, 1, max_height) && in_range(record.cur_width, 1, max_width)
    && in_range(record.dun_level, 0, 1200)
    && (((record.char_row === -1) && (record.char_col === -1)) || on_map(record.char_row, record.char_col))
    && in_range(record.max_panel_rows, 0, record.cur_height) && in_range(record.max_panel_cols, 0, record.cur_width)
    && (record.floor.length === record.cur_height)
    && record.floor.every((row: unknown): boolean => Array.isArray(row) && (row.length === record.cur_width) && row.every((cell: unknown): boolean => in_range(cell, 0, 0x7F)))
    && (record.treasures.length <= max_talloc)
    && record.treasures.every((saved: ISavedTreasure): boolean => (as_record(saved) != null) && on_map(saved.y, saved.x) && is_item(saved.item))
    && (record.monsters.length < max_malloc)
    && record.monsters.every((saved: Record<string, number | boolean>): boolean => shaped_like(saved, monster_like)
      && on_map(saved['fy'], saved['fx']) && in_range(saved['mptr'], 1, max_creatures))
    && (record.identified.length === max_objects) && /^[TF]*$/.test(record.identified);
}


function stores_ok(record: ISaveFile): boolean {
  return (record.stores.length === max_stores) && record.stores.every((saved: ISavedStore): boolean =>
    shaped_like(saved, { items: [], owner: 0, insult_cur: 0, store_open: 0 }) && in_range(saved.owner, 1, max_owners)
    && (saved.items.length <= store_inven_max)
    && saved.items.every((stocked: inven_record): boolean => shaped_like(stocked, { scost: 0 }) && is_item(stocked.sitem)));
}


/** Only the keys the game writes, so nothing else in the file reaches the game's records. */
function copy_keys<T extends object>(target: T, source: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of keys) {
    (target as Record<string, unknown>)[key] = source[key];
  }
}


function item_from(saved: treasure_type): treasure_type {
  const item: treasure_type = clone(g.blank_treasure);

  copy_keys(item, saved as unknown as Record<string, unknown>, Object.keys(g.blank_treasure));

  return item;
}


function read_save(fnam: string): ISaveFile {
  const stored: string | null = rt().files.read(fnam);
  let record: unknown = null;

  if (stored == null) {
    prt(`Error Opening> ${ fnam }`, 1, 1);
    prt('', 2, 1);
    exit();
  }

  try {
    record = JSON.parse(stored);
  } catch {
    data_exception();
  }

  if (!is_save(record)) {
    data_exception();
  }

  return record;
}


// save.inc:463 get_char: restores a saved game, striking it off MASTER and deleting the file.
// True when the save is from another version and the level must be made afresh.
export async function get_char(fnam: string): Promise<boolean> {
  let dun_flag: boolean = false;

  clear(1, 1);

  const record: ISaveFile = read_save(fnam);
  const ids: string[] | null = master();

  if (ids == null) {
    prt('ERROR opening file MASTER.', 1, 1);
    exit();
  }

  if (!ids.includes(record.id)) {
    data_exception();
  }

  write_master(ids.filter((id: string): boolean => id !== record.id));
  rt().random.seed = record.seed;
  prt('Restoring Character...', 1, 1);
  put_qio();

  if (record.version !== cur_version) {
    dun_flag = await other_version(record.version);
  }

  restore_player(record, dun_flag);

  if (!dun_flag) {
    restore_level(record);
    restore_stores(record);
    store_maint();
  }

  rt().files.delete(fnam);
  rt().random.seed = get_seed();

  return dun_flag;
}


async function other_version(save_version: number): Promise<boolean> {
  prt('Save file is incompatable with this version.', 2, 1);
  prt(`  [Save file version ${ fmtFixed(save_version, 5, 2) }]`, 3, 1);
  prt(`  [Moria version     ${ fmtFixed(cur_version, 5, 2) }]`, 4, 1);

  if (save_version > 4.0) {
    prt('Updating character for newer version...', 5, 1);
  } else {
    exit();
  }

  await pause(24);

  return true;
}


function restore_player(record: ISaveFile, dun_flag: boolean): void {
  const misc: player_misc_type = g.py.misc;

  misc.name = record.name;
  misc.race = record.race;
  misc.sex = record.sex;
  misc.tclass = record.tclass;
  misc.title = record.title;
  record.history.forEach((line: string, i: number): void => {
    misc.history[i + 1] = line;
  });
  g.char_row = record.char_row;
  g.char_col = record.char_col;
  copy_keys(misc, record.misc, MISC_FIELDS);
  g.inven_ctr = record.inven_ctr;
  g.inven_weight = record.inven_weight;
  g.equip_ctr = record.equip_ctr;
  g.dun_level = record.dun_level;
  g.missle_ctr = record.missle_ctr;
  g.mon_tot_mult = record.mon_tot_mult;
  g.turn = record.turn;
  g.randes_seed = record.randes_seed;
  record.inventory.forEach((item: treasure_type, i: number): void => {
    g.inventory[i + 1] = item_from(item);
  });
  record.equipment.forEach((item: treasure_type, i: number): void => {
    g.inventory[i + 23] = item_from(item);
  });
  copy_keys(g.py.stat, record.stat, STAT_FIELDS);
  copy_keys(g.py.flags, record.flags, FLAG_FIELDS);
  record.spells.forEach((saved: { learned: boolean; sexp: number }, i: number): void => {
    const spell: spell_type = g.magic_spell[misc.pclass][i + 1];

    spell.learned = saved.learned;

    if (!dun_flag) {
      spell.sexp = saved.sexp;
    }
  });
}


function restore_level(record: ISaveFile): void {
  g.cur_height = record.cur_height;
  g.cur_width = record.cur_width;
  g.max_panel_rows = record.max_panel_rows;
  g.max_panel_cols = record.max_panel_cols;
  record.floor.forEach((row: number[], i: number): void => {
    row.forEach((xfloor: number, j: number): void => {
      restore_cell(i + 1, j + 1, xfloor);
    });
  });
  tlink();

  for (const saved of record.treasures) {
    const i2: IRef<number> = box(0);

    popt(i2);
    g.cave[saved.y][saved.x].tptr = i2.get();
    g.t_list[i2.get()] = item_from(saved.item);
  }

  for (let i1: number = 1; i1 <= max_objects; i1++) {
    if (record.identified.charAt(i1 - 1) === 'T') {
      identify(g.object_list[i1]);
    } else {
      g.object_ident[i1] = false;
    }
  }

  restore_monsters(record);
}


// A flag already true stays so, as in the source.
function restore_cell(i1: number, i2: number, xfloor: number): void {
  const cell: cave_type = g.cave[i1][i2];

  cell.fval = uand(0x0F, xfloor);

  if (uand(0x10, xfloor) !== 0) {
    cell.fopen = true;
  }

  if (uand(0x20, xfloor) !== 0) {
    cell.pl = true;
  }

  if (uand(0x40, xfloor) !== 0) {
    cell.fm = true;
  }

  cell.tl = false;
  cell.tptr = 0;
  cell.cptr = 0;
}


function restore_monsters(record: ISaveFile): void {
  let i3: number = 0;

  mlink();

  for (const saved of record.monsters) {
    const i2: IRef<number> = box(0);

    popm(i2);

    const monster: monster_type = g.m_list[i2.get()];

    copy_keys(monster, saved, MONSTER_FIELDS);
    g.cave[monster.fy][monster.fx].cptr = i2.get();

    if (g.muptr === 0) {
      g.muptr = i2.get();
    } else {
      g.m_list[i3].nptr = i2.get();
    }

    monster.nptr = 0;
    i3 = i2.get();
  }
}


function restore_stores(record: ISaveFile): void {
  g.town_seed = record.town_seed;
  record.stores.forEach((saved: ISavedStore, i: number): void => {
    const shop: store_type = g.store[i + 1];

    shop.store_ctr = saved.items.length;
    saved.items.forEach((stocked: inven_record, j: number): void => {
      shop.store_inven[j + 1] = { scost: stocked.scost, sitem: item_from(stocked.sitem) };
    });
    shop.owner = saved.owner;
    shop.insult_cur = saved.insult_cur;
    shop.store_open = saved.store_open;
  });
}


// save.inc:823 restore_char: its lookup uses an id it never sets, so it only adds the id back.
export async function restore_char(): Promise<void> {
  const fnam: IRef<string> = box('');

  prt('Name of file to be restored: ', 1, 1);

  if (await get_string(fnam, 1, 30, 48)) {
    const stored: string | null = rt().files.read(fnam.get());

    if (stored == null) {
      await msg_print(`Error Opening> ${ fnam.get() }`);
    } else {
      await register_again(stored);
    }

    rt().random.seed = get_seed();
  }
}


async function register_again(stored: string): Promise<void> {
  const ids: string[] | null = master();
  let record: unknown = null;

  try {
    record = JSON.parse(stored);
  } catch {
    data_exception();
  }

  if (!is_save(record)) {
    data_exception();
  }

  if (ids == null) {
    await msg_print('MASTER could not be opened.');
  } else if (ids.includes(record.id)) {
    await msg_print('Could not write ID in MASTER.');
  } else {
    write_master([ ...ids, record.id ]);
    await msg_print('Character restored...');
  }
}
