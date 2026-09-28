// source/include/spells.inc: the effects scrolls, potions, wands, staves, spells and monsters share.
//
// The source walks the monster list with repeat..until starting at muptr, which reads m_list[0]
// when the level has no monsters left; the port walks it only while there is a monster.

import { inven_max, max_mons_level, max_sight, max_trapa, obj$bolt_range, screen_height, screen_width } from './constants';
import { identify, known2, objdes } from './desc';
import { get_com, msg_print, print } from './io';
import {
  damroll,
  de_statp,
  draw_cave,
  insert_str,
  inven_destroy,
  distance,
  in_bounds,
  los,
  move,
  next_to4,
  place_monster,
  place_object,
  place_trap,
  popt,
  prt_charisma,
  prt_chp,
  prt_cmana,
  prt_constitution,
  prt_dexterity,
  prt_experience,
  prt_intelligence,
  prt_level,
  prt_map,
  prt_mhp,
  prt_strength,
  prt_title,
  prt_wisdom,
  randint,
  test_light,
} from './misc';
import {
  acid_dam,
  change_trap,
  cur_char2,
  get_item,
  cold_dam,
  delete_monster,
  delete_object,
  fire_dam,
  light_dam,
  light_room,
  lite_spot,
  mon_take_hit,
  monster_death,
  move_char,
  move_rec,
  multiply_monster,
  panel_contains,
  poison_gas,
  py_bonuses,
  take_hit,
  twall,
  unlite_spot,
} from './moria';
import { creatures } from './creature';
import type { cave_type, class_type, creature_type, monster_type, obj_set, player_misc_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, div, index, pascalSet, real, round, substr, uand } from '../runtime/pascal';


/** Each monster on the level in list order; next is read before the call, as the source does. */
async function each_monster(action: (i1: number, monster: monster_type) => Promise<void> | void): Promise<void> {
  let i1: number = g.muptr;

  while (i1 !== 0) {
    const i2: number = g.m_list[i1].nptr;

    await action(i1, g.m_list[i1]);
    i1 = i2;
  }
}


function name_of(monster: monster_type): string {
  return g.c_list[monster.mptr].name;
}


function resists(creature: creature_type): boolean {
  return (randint(max_mons_level) < creature.level) || (uand(0x1000, creature.cdefense) !== 0);
}


// spells.inc:7 sleep_monsters1: the creatures next to the player.
export async function sleep_monsters1(y: number, x: number): Promise<boolean> {
  let result: boolean = false;

  for (let i1: number = y - 1; i1 <= y + 1; i1++) {
    for (let i2: number = x - 1; i2 <= x + 1; i2++) {
      const cptr: number = g.cave[i1][i2].cptr;

      if (cptr > 1) {
        const monster: monster_type = g.m_list[cptr];
        const creature: creature_type = g.c_list[monster.mptr];

        result = true;

        if (resists(creature)) {
          await msg_print(`The ${ creature.name } is unaffected.`);
        } else {
          await msg_print(`The ${ creature.name } falls asleep.`);
          monster.csleep = 500;
        }
      }
    }
  }

  return result;
}


function detect_on_panel(wanted: (tval: number) => boolean): boolean {
  let result: boolean = false;

  for (let i1: number = g.panel_row_min; i1 <= g.panel_row_max; i1++) {
    for (let i2: number = g.panel_col_min; i2 <= g.panel_col_max; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if ((cell.tptr > 0) && wanted(g.t_list[cell.tptr].tval) && !test_light(i1, i2)) {
        lite_spot(i1, i2);
        cell.tl = true;
        result = true;
      }
    }
  }

  return result;
}


// spells.inc:32 detect_treasure
export function detect_treasure(): boolean {
  return detect_on_panel((tval: number): boolean => tval === 100);
}


// spells.inc:51 detect_object
export function detect_object(): boolean {
  return detect_on_panel((tval: number): boolean => tval < 100);
}


// spells.inc:70 detect_trap: traps on the panel, and which chests are trapped.
export function detect_trap(): boolean {
  let result: boolean = false;

  for (let i1: number = g.panel_row_min; i1 <= g.panel_row_max; i1++) {
    for (let i2: number = g.panel_col_min; i2 <= g.panel_col_max; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if (cell.tptr > 0) {
        if (g.t_list[cell.tptr].tval === 101) {
          change_trap(i1, i2);
          cell.fm = true;
          result = true;
        } else if (g.t_list[cell.tptr].tval === 2) {
          g.t_list[cell.tptr].name = known2(g.t_list[cell.tptr].name);
        }
      }
    }
  }

  return result;
}


// spells.inc:91 detect_sdoor: secret doors and stairs on the panel.
export function detect_sdoor(): boolean {
  let result: boolean = false;

  for (let i1: number = g.panel_row_min; i1 <= g.panel_row_max; i1++) {
    for (let i2: number = g.panel_col_min; i2 <= g.panel_col_max; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if (cell.tptr > 0) {
        if (g.t_list[cell.tptr].tval === 109) {
          cell.fval = g.corr_floor3.ftval;
          change_trap(i1, i2);
          cell.fm = true;
          result = true;
        } else if ([ 107, 108 ].includes(g.t_list[cell.tptr].tval) && !cell.fm) {
          cell.fm = true;
          lite_spot(i1, i2);
          result = true;
        }
      }
    }
  }

  return result;
}


async function detect_monsters_where(wanted: (creature: creature_type) => boolean, message: string): Promise<boolean> {
  let flag: boolean = false;

  await each_monster((_i1: number, monster: monster_type): void => {
    if (panel_contains(monster.fy, monster.fx) && wanted(g.c_list[monster.mptr])) {
      monster.ml = true;
      print(g.c_list[monster.mptr].cchar, monster.fy, monster.fx);
      flag = true;
    }
  });

  if (flag) {
    await msg_print(message);
    await msg_print(' ');
    g.msg_flag = false;
  }

  return flag;
}


// spells.inc:119 detect_invisible
export async function detect_invisible(): Promise<boolean> {
  return detect_monsters_where((creature: creature_type): boolean => uand(0x10000, creature.cmove) !== 0,
    'You sense the presence of invisible creatures!');
}


// spells.inc:149 light_area: a room lights entirely, a corridor round the player.
export async function light_area(y: number, x: number): Promise<boolean> {
  await msg_print('You are surrounded by a white light.');

  if ([ 1, 2 ].includes(g.cave[y][x].fval) && (g.dun_level > 0)) {
    light_room(y, x);
  } else {
    for (let i1: number = y - 1; i1 <= y + 1; i1++) {
      for (let i2: number = x - 1; i2 <= x + 1; i2++) {
        if (in_bounds(i1, i2)) {
          if (!test_light(i1, i2)) {
            lite_spot(i1, i2);
          }

          g.cave[i1][i2].pl = true;
        }
      }
    }
  }

  return true;
}


// spells.inc:169 unlight_area
export async function unlight_area(y: number, x: number): Promise<boolean> {
  let flag: boolean = false;

  if ([ 1, 2 ].includes(g.cave[y][x].fval) && (g.dun_level > 0)) {
    flag = unlight_room(y, x);
  } else {
    for (let i1: number = y - 1; i1 <= y + 1; i1++) {
      for (let i2: number = x - 1; i2 <= x + 1; i2++) {
        if (in_bounds(i1, i2)) {
          const cell: cave_type = g.cave[i1][i2];

          if ([ 4, 5, 6 ].includes(cell.fval) && cell.pl) {
            cell.pl = false;
            flag = true;
          }
        }
      }
    }
  }

  if (flag) {
    await msg_print('Darkness surrounds you...');
  }

  return flag;
}


function unlight_room(y: number, x: number): boolean {
  const tmp1: number = Math.trunc(real(screen_height / 2));
  const tmp2: number = Math.trunc(real(screen_width / 2));
  const start_row: number = Math.trunc(real(y / tmp1)) * tmp1 + 1;
  const start_col: number = Math.trunc(real(x / tmp2)) * tmp2 + 1;
  let flag: boolean = false;

  for (let i1: number = start_row; i1 <= start_row + tmp1 - 1; i1++) {
    let out_val: string = '';
    let i3: number = 0;
    const flush_out: () => void = (): void => {
      flag = true;
      print(out_val, i1, i3);
      out_val = '';
      i3 = 0;
    };

    for (let i2: number = start_col; i2 <= start_col + tmp2 - 1; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if ([ 1, 2 ].includes(cell.fval)) {
        cell.pl = false;
        cell.fval = 1;

        if (!test_light(i1, i2)) {
          if (i3 === 0) {
            i3 = i2;
          }

          out_val += ' ';
        } else if (i3 > 0) {
          flush_out();
        }
      } else if (i3 > 0) {
        flush_out();
      }
    }

    if (i3 > 0) {
      flag = true;
      print(out_val, i1, i3);
    }
  }

  return flag;
}


// spells.inc:244 map_area: the walls and objects round the panel, and a little beyond.
export function map_area(): boolean {
  const i1: number = g.panel_row_min - randint(10);
  const i2: number = g.panel_row_max + randint(10);
  const i3: number = g.panel_col_min - randint(20);
  const i4: number = g.panel_col_max + randint(20);

  for (let i5: number = i1; i5 <= i2; i5++) {
    for (let i6: number = i3; i6 <= i4; i6++) {
      if (in_bounds(i5, i6) && g.floor_set.has(g.cave[i5][i6].fval)) {
        for (let i7: number = i5 - 1; i7 <= i5 + 1; i7++) {
          for (let i8: number = i6 - 1; i8 <= i6 + 1; i8++) {
            const cell: cave_type = g.cave[i7][i8];

            if (g.pwall_set.has(cell.fval)) {
              cell.pl = true;
            } else if ((cell.tptr > 0) && g.light_set.has(g.t_list[cell.tptr].tval)) {
              cell.fm = true;
            }
          }
        }
      }
    }
  }

  prt_map();

  return true;
}


// spells.inc:269 ident_spell
export async function ident_spell(): Promise<boolean> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);
  let result: boolean = false;

  if (await get_item(item_val, 'Item you wish identified?', redraw, 1, g.inven_ctr)) {
    const item: treasure_type = g.inventory[item_val.get()];

    result = true;
    identify(item);
    item.name = known2(item.name);
    await msg_print(`${ String.fromCharCode(item_val.get() + 96) }${ cur_char2(item_val.get()) } ${ objdes(item_val.get(), true) }`);
  }

  if (redraw.get()) {
    await msg_print(' ');
    draw_cave();
  }

  return result;
}


// spells.inc:824 recharge: a wand, staff or rod; one in eight is destroyed instead.
export async function recharge(amount: number): Promise<boolean> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);
  let result: boolean = false;

  if (await get_item(item_val, 'Recharge which item?', redraw, 1, g.inven_ctr)) {
    const item: treasure_type = g.inventory[item_val.get()];

    if ([ 55, 60, 65 ].includes(item.tval)) {
      result = true;

      if (randint(8) === 1) {
        await msg_print('There is a bright flash of light...');
        inven_destroy(item_val.get());
      } else {
        const num: number = Math.trunc(real(amount / (item.level + 2)));

        item.p1 = item.p1 + 2 + randint(num);

        if (index(item.name, '^') === 0) {
          item.name = insert_str(item.name, ' (%P1', '^ (%P1');
        }
      }
    }
  }

  if (redraw.get()) {
    await msg_print(' ');
    draw_cave();
  }

  return result;
}


// spells.inc:295 aggravate_monster: wakes every monster; the near ones speed up.
export function aggravate_monster(dis_affect: number): boolean {
  let i1: number = g.muptr;

  while (i1 !== 0) {
    const monster: monster_type = g.m_list[i1];

    monster.csleep = 0;

    if ((monster.cdis <= dis_affect) && (monster.cspeed < 2)) {
      monster.cspeed++;
    }

    i1 = monster.nptr;
  }

  return true;
}


// spells.inc:316 trap_creation
export function trap_creation(): boolean {
  for (let i1: number = g.char_row - 1; i1 <= g.char_row + 1; i1++) {
    for (let i2: number = g.char_col - 1; i2 <= g.char_col + 1; i2++) {
      if (g.floor_set.has(g.cave[i1][i2].fval)) {
        if (g.cave[i1][i2].tptr > 0) {
          delete_object(i1, i2);
        }

        place_trap(i1, i2, 1, randint(max_trapa));
      }
    }
  }

  return true;
}


// spells.inc:333 door_creation
export function door_creation(): boolean {
  for (let i1: number = g.char_row - 1; i1 <= g.char_row + 1; i1++) {
    for (let i2: number = g.char_col - 1; i2 <= g.char_col + 1; i2++) {
      if (((i1 !== g.char_row) || (i2 !== g.char_col)) && g.floor_set.has(g.cave[i1][i2].fval)) {
        const cell: cave_type = g.cave[i1][i2];
        const i3: IRef<number> = box(0);

        popt(i3);

        if (cell.tptr > 0) {
          delete_object(i1, i2);
        }

        cell.fopen = false;
        cell.tptr = i3.get();
        g.t_list[i3.get()] = clone(g.door_list[2]);

        if (test_light(i1, i2)) {
          lite_spot(i1, i2);
        }
      }
    }
  }

  return true;
}


// spells.inc:356 td_destroy: the doors and traps next to the player.
export function td_destroy(): boolean {
  let result: boolean = false;

  for (let i1: number = g.char_row - 1; i1 <= g.char_row + 1; i1++) {
    for (let i2: number = g.char_col - 1; i2 <= g.char_col + 1; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if ((cell.tptr > 0) && [ 101, 102, 104, 105, 109 ].includes(g.t_list[cell.tptr].tval) && delete_object(i1, i2)) {
        result = true;
      }
    }
  }

  return result;
}


// spells.inc:373 detect_monsters
export async function detect_monsters(): Promise<boolean> {
  return detect_monsters_where((creature: creature_type): boolean => uand(0x10000, creature.cmove) === 0,
    'You sense the presense of monsters!');
}


// spells.inc:404 light_line: blue light, which hurts creatures that fear light.
export async function light_line(dir: number, start_y: number, start_x: number): Promise<boolean> {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);

  while (g.cave[y.get()][x.get()].fopen) {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if (panel_contains(y.get(), x.get())) {
      if (!(cell.tl || cell.pl)) {
        if (cell.fval === 2) {
          light_room(y.get(), x.get());
        } else {
          lite_spot(y.get(), x.get());
        }
      }

      if (cell.cptr > 1) {
        const creature: creature_type = g.c_list[g.m_list[cell.cptr].mptr];

        if (uand(0x0100, creature.cdefense) !== 0) {
          await msg_print(`The ${ creature.name } wails out in pain!`);

          if ((await mon_take_hit(cell.cptr, damroll('2d8'))) > 0) {
            await msg_print(`The ${ creature.name } dies in a fit of agony.`);
          }
        }
      }
    }

    cell.pl = true;
    move(dir, y, x);
  }

  return true;
}


// spells.inc:438 starlite
export async function starlite(y: number, x: number): Promise<boolean> {
  await msg_print('The end of the staff bursts into a blue shimmering light.');

  for (let i1: number = 1; i1 <= 9; i1++) {
    if (i1 !== 5) {
      await light_line(i1, y, x);
    }
  }

  return true;
}


// spells.inc:451 disarm_all: traps, locks and secret doors along a line.
export async function disarm_all(dir: number, start_y: number, start_x: number): Promise<boolean> {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;
  let oldy: number;
  let oldx: number;

  do {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if (cell.tptr > 0) {
      result = (await disarm_one(cell, y.get(), x.get())) || result;
    }

    oldy = y.get();
    oldx = x.get();
    move(dir, y, x);
  } while (g.cave[oldy][oldx].fopen);

  return result;
}


async function disarm_one(cell: cave_type, y: number, x: number): Promise<boolean> {
  const item: treasure_type = g.t_list[cell.tptr];
  let result: boolean = false;

  if ([ 101, 102 ].includes(item.tval)) {
    result = delete_object(y, x);
  } else if (item.tval === 105) {
    item.p1 = 0;
  } else if (item.tval === 109) {
    cell.fval = g.corr_floor3.ftval;
    change_trap(y, x);
    cell.fm = true;
    result = true;
  } else if ((item.tval === 2) && (item.flags > 0)) {
    const at: number = index(item.name, ' (');

    await msg_print('Click!');
    item.flags = 0;
    result = true;

    if (at > 0) {
      item.name = substr(item.name, 1, at - 1);
    }

    item.name = known2(`${ item.name } (Unlocked)`);
  }

  return result;
}


interface IFlags {
  weapon_type: number;
  harm_type: number;
  destroy: obj_set;
}


// spells.inc:497 get_flags: what an area attack is, what it hurts, and what it destroys.
function get_flags(typ: number): IFlags {
  let result: IFlags;

  switch (typ) {
    case 1:
      result = { weapon_type: 0x00080000, harm_type: 0x0100, destroy: pascalSet(45, 60, 65) };
      break;
    case 2:
      result = { weapon_type: 0x00100000, harm_type: 0x0040, destroy: pascalSet() };
      break;
    case 3:
      result = { weapon_type: 0x00200000, harm_type: 0x0080, destroy: pascalSet(12, 20, 21, 22, 30, 31, 32, 33, 34, 35, 36, 55, 70, 71, 80, 104, 105) };
      break;
    case 4:
      result = { weapon_type: 0x00400000, harm_type: 0x0010, destroy: pascalSet(75, 76) };
      break;
    case 5:
      result = { weapon_type: 0x00800000, harm_type: 0x0020, destroy: pascalSet(12, 20, 21, 22, 30, 31, 32, 36, 55, 70, 71, 75, 76, 80, 104, 105) };
      break;
    case 6:
      result = { weapon_type: 0x00000000, harm_type: 0x0004, destroy: pascalSet() };
      break;
    default:
      result = { weapon_type: 0, harm_type: 0, destroy: pascalSet() };
      break;
  }

  return result;
}


function redraw_spot(oldy: number, oldx: number): void {
  if (test_light(oldy, oldx)) {
    lite_spot(oldy, oldx);
  } else {
    unlite_spot(oldy, oldx);
  }
}


// spells.inc:546 fire_bolt: stops at the first creature or wall.
export async function fire_bolt(typ: number, dir: number, start_y: number, start_x: number, damage: number, bolt_typ: string): Promise<boolean> {
  const kind: IFlags = get_flags(typ);
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let oldy: number = start_y;
  let oldx: number = start_x;
  let dist: number = 0;
  let flag: boolean = false;
  let dam: number = damage;

  do {
    move(dir, y, x);
    redraw_spot(oldy, oldx);
    dist++;

    if (dist > obj$bolt_range) {
      flag = true;
    } else {
      const cell: cave_type = g.cave[y.get()][x.get()];

      if (cell.fopen) {
        if (cell.cptr > 1) {
          const monster: monster_type = g.m_list[cell.cptr];
          const creature: creature_type = g.c_list[monster.mptr];

          flag = true;
          await msg_print(`The ${ bolt_typ } strikes the ${ creature.name }.`);

          if (uand(kind.harm_type, creature.cdefense) !== 0) {
            dam *= 2;
          } else if (uand(kind.weapon_type, creature.spells) !== 0) {
            dam = Math.trunc(real(dam / 4.0));
          }

          const i1: number = await mon_take_hit(cell.cptr, dam);

          if (i1 > 0) {
            await msg_print(`The ${ g.c_list[i1].name } dies in a fit of agony.`);
          } else if (panel_contains(y.get(), x.get())) {
            print(creature.cchar, y.get(), x.get());
            g.m_list[cell.cptr].ml = true;
          }
        } else if (panel_contains(y.get(), x.get())) {
          print('*', y.get(), x.get());
        }
      } else {
        flag = true;
      }

      oldy = y.get();
      oldx = x.get();
    }
  } while (!flag);

  return true;
}


// The blast of a ball: every creature within two of y,x, in sight of it, is hit less the further it is.
async function explode(kind: IFlags, y: number, x: number, dam_hp: number, descrip: string): Promise<void> {
  const max_dis: number = 2;
  let thit: number = 0;
  let tkill: number = 0;

  for (let i1: number = y - max_dis; i1 <= y + max_dis; i1++) {
    for (let i2: number = x - max_dis; i2 <= x + max_dis; i2++) {
      if (in_bounds(i1, i2) && (distance(y, x, i1, i2) <= max_dis) && los(y, x, i1, i2)) {
        const cell: cave_type = g.cave[i1][i2];

        if ((cell.tptr > 0) && kind.destroy.has(g.t_list[cell.tptr].tval)) {
          delete_object(i1, i2);
        }

        if (cell.fopen) {
          if (panel_contains(i1, i2)) {
            print('*', i1, i2);
          }

          if (cell.cptr > 1) {
            const monster: monster_type = g.m_list[cell.cptr];
            const creature: creature_type = g.c_list[monster.mptr];
            let dam: number = dam_hp;

            thit++;

            if (uand(kind.harm_type, creature.cdefense) !== 0) {
              dam *= 2;
            } else if (uand(kind.weapon_type, creature.spells) !== 0) {
              dam = div(dam, 4);
            }

            dam = Math.trunc(real(dam / (distance(i1, i2, y, x) + 1)));

            if ((await mon_take_hit(cell.cptr, dam)) > 0) {
              tkill++;
            } else if (panel_contains(i1, i2)) {
              print(creature.cchar, i1, i2);
              monster.ml = true;
            }
          }
        }
      }
    }
  }

  redraw_blast(y, x, max_dis);

  if (thit === 1) {
    await msg_print(`The ${ descrip } envelopes a creature!`);
  } else if (thit > 1) {
    await msg_print(`The ${ descrip } envelopes several creatures!`);
  }

  if (tkill === 1) {
    await msg_print('There is a scream of agony!');
  } else if (tkill > 1) {
    await msg_print('There are several screams of agony!');
  }
}


function redraw_blast(y: number, x: number, max_dis: number): void {
  for (let i1: number = y - 2; i1 <= y + 2; i1++) {
    for (let i2: number = x - 2; i2 <= x + 2; i2++) {
      if (in_bounds(i1, i2) && panel_contains(i1, i2) && (distance(y, x, i1, i2) <= max_dis)) {
        const cell: cave_type = g.cave[i1][i2];

        if (test_light(i1, i2) || (cell.cptr === 1) || ((cell.cptr > 1) && g.m_list[cell.cptr].ml)) {
          lite_spot(i1, i2);
        } else {
          unlite_spot(i1, i2);
        }
      }
    }
  }
}


// spells.inc:618 fire_ball: flies to the first creature or wall, then bursts.
export async function fire_ball(typ: number, dir: number, start_y: number, start_x: number, dam_hp: number, descrip: string): Promise<boolean> {
  const kind: IFlags = get_flags(typ);
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let oldy: number = start_y;
  let oldx: number = start_x;
  let dist: number = 0;
  let flag: boolean = false;

  do {
    move(dir, y, x);
    dist++;
    redraw_spot(oldy, oldx);

    if (dist > obj$bolt_range) {
      flag = true;
    } else {
      const cell: cave_type = g.cave[y.get()][x.get()];

      if (!cell.fopen || (cell.cptr > 1)) {
        flag = true;

        if (!cell.fopen) {
          y.set(oldy);
          x.set(oldx);
        }

        await explode(kind, y.get(), x.get(), dam_hp, descrip);
      } else if (panel_contains(y.get(), x.get())) {
        print('*', y.get(), x.get());
      }

      oldy = y.get();
      oldx = x.get();
    }
  } while (!flag);

  return true;
}


// spells.inc:743 breath: a ball centred on y,x that also catches the player.
export async function breath(typ: number, y: number, x: number, dam_hp: number, ddesc: string): Promise<boolean> {
  const kind: IFlags = get_flags(typ);
  const max_dis: number = 2;

  for (let i1: number = y - 2; i1 <= y + 2; i1++) {
    for (let i2: number = x - 2; i2 <= x + 2; i2++) {
      if (in_bounds(i1, i2) && (distance(y, x, i1, i2) <= max_dis)) {
        const cell: cave_type = g.cave[i1][i2];

        if ((cell.tptr > 0) && kind.destroy.has(g.t_list[cell.tptr].tval)) {
          delete_object(i1, i2);
        }

        if (cell.fopen) {
          if (panel_contains(i1, i2)) {
            print('*', i1, i2);
          }

          if (cell.cptr > 1) {
            await breathe_on_monster(kind, cell.cptr, i1, i2, y, x, dam_hp);
          } else if (cell.cptr === 1) {
            await breathe_on_player(typ, Math.trunc(real(dam_hp / (distance(i1, i2, y, x) + 1))), ddesc);
          }
        }
      }
    }
  }

  redraw_blast(y, x, max_dis);

  return true;
}


async function breathe_on_monster(kind: IFlags, cptr: number, i1: number, i2: number, y: number, x: number, dam_hp: number): Promise<void> {
  const monster: monster_type = g.m_list[cptr];
  const creature: creature_type = g.c_list[monster.mptr];
  let dam: number = dam_hp;

  if (uand(kind.harm_type, creature.cdefense) !== 0) {
    dam *= 2;
  } else if (uand(kind.weapon_type, creature.spells) !== 0) {
    dam = Math.trunc(real(dam / 4.0));
  }

  dam = Math.trunc(real(dam / (distance(i1, i2, y, x) + 1)));
  monster.hp -= dam;
  monster.csleep = 0;

  if (monster.hp < 0) {
    await monster_death(monster.fy, monster.fx, creature.cmove);
    delete_monster(cptr);
  }
}


async function breathe_on_player(typ: number, dam: number, ddesc: string): Promise<void> {
  switch (typ) {
    case 1:
      await light_dam(dam, ddesc);
      break;
    case 2:
      await poison_gas(dam, ddesc);
      break;
    case 3:
      await acid_dam(dam, ddesc);
      break;
    case 4:
      await cold_dam(dam, ddesc);
      break;
    case 5:
      await fire_dam(dam, ddesc);
      break;
  }
}


/** The first creature along a line from y,x, stopping at a wall; the source's repeat..until. */
function creature_along(dir: number, y: IRef<number>, x: IRef<number>): number {
  let cptr: number = 0;
  let flag: boolean = false;

  do {
    move(dir, y, x);

    const cell: cave_type = g.cave[y.get()][x.get()];

    if (!cell.fopen) {
      flag = true;
    } else if (cell.cptr > 1) {
      flag = true;
      cptr = cell.cptr;
    }
  } while (!flag);

  return cptr;
}


// spells.inc:856 hp_monster
export async function hp_monster(dir: number, y: number, x: number, dam: number): Promise<boolean> {
  const cptr: number = creature_along(dir, box(y), box(x));
  let result: boolean = false;

  if (cptr > 0) {
    const name: string = name_of(g.m_list[cptr]);
    const i1: number = await mon_take_hit(cptr, dam);

    result = true;
    await msg_print(i1 > 0 ? `The ${ g.c_list[i1].name } dies in a fit of agony.` : `The ${ name } screams in agony.`);
  }

  return result;
}


// spells.inc:891 drain_life: only on the living.
export async function drain_life(dir: number, y: number, x: number): Promise<boolean> {
  const cptr: number = creature_along(dir, box(y), box(x));
  let result: boolean = false;

  if ((cptr > 0) && (uand(g.c_list[g.m_list[cptr].mptr].cdefense, 0x0008) === 0)) {
    const name: string = name_of(g.m_list[cptr]);
    const i1: number = await mon_take_hit(cptr, 50);

    result = true;
    await msg_print(i1 > 0 ? `The ${ g.c_list[i1].name } dies in a fit of agony.` : `The ${ name } screams in agony.`);
  }

  return result;
}


// spells.inc:928 speed_monster: slowing can be resisted; a Balrog's level always resists.
export async function speed_monster(dir: number, y: number, x: number, spd: number): Promise<boolean> {
  const cptr: number = creature_along(dir, box(y), box(x));
  let result: boolean = false;

  if (cptr > 0) {
    const monster: monster_type = g.m_list[cptr];
    const creature: creature_type = g.c_list[monster.mptr];

    if ((spd > 0) || (randint(max_mons_level) > creature.level)) {
      monster.cspeed += spd;
      monster.csleep = 0;
    } else {
      await msg_print(`The ${ creature.name } is unaffected.`);
    }

    result = true;
  }

  return result;
}


// spells.inc:967 confuse_monster
export async function confuse_monster(dir: number, y: number, x: number): Promise<boolean> {
  const cptr: number = creature_along(dir, box(y), box(x));
  let result: boolean = false;

  if (cptr > 0) {
    const monster: monster_type = g.m_list[cptr];
    const creature: creature_type = g.c_list[monster.mptr];

    result = true;

    if (resists(creature)) {
      await msg_print(`The ${ creature.name } is unaffected.`);
    } else {
      monster.confused = true;
      monster.csleep = 0;
      await msg_print(`The ${ creature.name } appears confused.`);
    }
  }

  return result;
}


// spells.inc:1001 sleep_monster
export async function sleep_monster(dir: number, y: number, x: number): Promise<boolean> {
  const cptr: number = creature_along(dir, box(y), box(x));
  let result: boolean = false;

  if (cptr > 0) {
    const monster: monster_type = g.m_list[cptr];
    const creature: creature_type = g.c_list[monster.mptr];

    result = true;

    if (resists(creature)) {
      await msg_print(`The ${ creature.name } is unaffected.`);
    } else {
      monster.csleep = 500;
      await msg_print(`The ${ creature.name } falls asleep.`);
    }
  }

  return result;
}


// spells.inc:1034 wall_to_mud
export async function wall_to_mud(dir: number, start_y: number, start_x: number): Promise<boolean> {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;
  let flag: boolean = false;

  do {
    move(dir, y, x);

    if (in_bounds(y.get(), x.get())) {
      const cell: cave_type = g.cave[y.get()][x.get()];

      if (g.wall_set.has(cell.fval)) {
        flag = true;
        await twall(y.get(), x.get(), 1, 0);

        if (test_light(y.get(), x.get())) {
          await msg_print('The wall turns into mud.');
          result = true;
        }
      } else if ((cell.tptr > 0) && !cell.fopen) {
        flag = true;

        if (panel_contains(y.get(), x.get()) && test_light(y.get(), x.get())) {
          g.inventory[inven_max] = clone(g.t_list[cell.tptr]);
          await msg_print(`The ${ objdes(inven_max, false) } turns into mud.`);
          result = true;
        }

        delete_object(y.get(), x.get());
      }

      if (cell.cptr > 1) {
        flag = (await mud_hurts(cell.cptr)) || flag;
      }
    } else {
      flag = true;
    }
  } while (!flag);

  return result;
}


// The source tests ml through its `with` on the monster's record after the hit; a kill has
// blanked that record by then, so the death message never shows.
async function mud_hurts(cptr: number): Promise<boolean> {
  const creature: creature_type = g.c_list[g.m_list[cptr].mptr];
  let hurt: boolean = false;

  if (uand(0x0200, creature.cdefense) !== 0) {
    const i1: number = await mon_take_hit(cptr, 100);

    hurt = true;

    if (g.m_list[cptr].ml) {
      await msg_print(i1 > 0 ? `The ${ creature.name } dies in a fit of agony.` : `The ${ creature.name } wails out in pain!`);
    }
  }

  return hurt;
}


// spells.inc:1091 td_destroy2: the traps, doors and chests along a line.
export async function td_destroy2(dir: number, start_y: number, start_x: number): Promise<boolean> {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;

  do {
    move(dir, y, x);

    const cell: cave_type = g.cave[y.get()][x.get()];

    if ((cell.tptr > 0) && [ 2, 101, 102, 105, 109 ].includes(g.t_list[cell.tptr].tval) && delete_object(y.get(), x.get())) {
      await msg_print('There is a bright flash of light!');
      cell.fopen = true;
      result = true;
    }
  } while (g.cave[y.get()][x.get()].fopen);

  return result;
}


function new_monster_kind(): number {
  return randint(g.m_level[max_mons_level]) + g.m_level[0];
}


// spells.inc:1113 poly_monster: the source's `dist <+ range` reads as dist < range.
export async function poly_monster(dir: number, start_y: number, start_x: number): Promise<boolean> {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;
  let flag: boolean = false;
  let dist: number = 0;

  do {
    move(dir, y, x);
    dist++;

    if (dist < obj$bolt_range) {
      const cell: cave_type = g.cave[y.get()][x.get()];

      if (!cell.fopen) {
        flag = true;
      } else if (cell.cptr > 1) {
        const creature: creature_type = g.c_list[g.m_list[cell.cptr].mptr];

        if (randint(max_mons_level) > creature.level) {
          flag = true;
          delete_monster(cell.cptr);
          place_monster(y.get(), x.get(), new_monster_kind(), false);
          result = panel_contains(y.get(), x.get()) && test_light(y.get(), x.get());
        } else {
          await msg_print(`The ${ creature.name } is unaffected.`);
        }
      }
    } else {
      flag = true;
    }
  } while (!flag);

  return result;
}


// spells.inc:1155 build_wall: up to ten spots of wall along a line.
export async function build_wall(dir: number, start_y: number, start_x: number): Promise<boolean> {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;
  let i1: number = 0;

  move(dir, y, x);

  while (g.cave[y.get()][x.get()].fopen && (i1 < 10)) {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if (cell.tptr > 0) {
      delete_object(y.get(), x.get());
    }

    if (cell.cptr > 1) {
      await mon_take_hit(cell.cptr, damroll('2d8'));
    }

    cell.fval = g.rock_wall2.ftval;
    cell.fopen = g.rock_wall2.ftopen;
    cell.fm = false;

    if (test_light(y.get(), x.get())) {
      lite_spot(y.get(), x.get());
    }

    i1++;
    result = true;
    move(dir, y, x);
  }

  return result;
}


// spells.inc:1181 clone_monster
export function clone_monster(dir: number, start_y: number, start_x: number): boolean {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;
  let flag: boolean = false;

  do {
    move(dir, y, x);

    const cell: cave_type = g.cave[y.get()][x.get()];

    if (cell.cptr > 1) {
      multiply_monster(y.get(), x.get(), g.m_list[cell.cptr].mptr, false);

      if (panel_contains(y.get(), x.get()) && g.m_list[cell.cptr].ml) {
        result = true;
      }

      flag = true;
    }
  } while (!(!g.cave[y.get()][x.get()].fopen || flag));

  return result;
}


// spells.inc:1202 teleport_away: the creature to a random open spot within dis, widening if need be.
export function teleport_away(monptr: number, distance_away: number): boolean {
  const monster: monster_type = g.m_list[monptr];
  let dis: number = distance_away;
  let ctr: number = 0;
  let yn: number;
  let xn: number;

  do {
    do {
      yn = monster.fy + (randint(2 * dis + 1) - (dis + 1));
      xn = monster.fx + (randint(2 * dis + 1) - (dis + 1));
    } while (!in_bounds(yn, xn));

    ctr++;

    if (ctr > 9) {
      ctr = 0;
      dis += 5;
    }
  } while (!(g.cave[yn][xn].fopen && (g.cave[yn][xn].cptr === 0)));

  move_rec(monster.fy, monster.fx, yn, xn);

  if (test_light(monster.fy, monster.fx)) {
    lite_spot(monster.fy, monster.fx);
  }

  monster.fy = yn;
  monster.fx = xn;
  monster.ml = false;

  return true;
}


// spells.inc:1232 teleport_to: the player to beside the casting creature.
export async function teleport_to(ny: number, nx: number): Promise<boolean> {
  let dis: number = 1;
  let ctr: number = 0;
  let y: number;
  let x: number;

  do {
    y = ny + (randint(2 * dis + 1) - (dis + 1));
    x = nx + (randint(2 * dis + 1) - (dis + 1));
    ctr++;

    if (ctr > 9) {
      ctr = 0;
      dis++;
    }
  } while (!(g.cave[y][x].fopen && (g.cave[y][x].cptr < 2)));

  move_rec(g.char_row, g.char_col, y, x);

  for (let i1: number = g.char_row - 1; i1 <= g.char_row + 1; i1++) {
    for (let i2: number = g.char_col - 1; i2 <= g.char_col + 1; i2++) {
      g.cave[i1][i2].tl = false;

      if (!test_light(i1, i2)) {
        unlite_spot(i1, i2);
      }
    }
  }

  if (test_light(g.char_row, g.char_col)) {
    lite_spot(g.char_row, g.char_col);
  }

  g.char_row = y;
  g.char_col = x;
  await move_char(5);
  await creatures(false);

  return true;
}


// spells.inc:1267 teleport_monster: every creature along a line.
export function teleport_monster(dir: number, start_y: number, start_x: number): boolean {
  const y: IRef<number> = box(start_y);
  const x: IRef<number> = box(start_x);
  let result: boolean = false;

  do {
    move(dir, y, x);

    const cptr: number = g.cave[y.get()][x.get()].cptr;

    if (cptr > 1) {
      teleport_away(cptr, max_sight);
      result = true;
    }
  } while (g.cave[y.get()][x.get()].fopen);

  return result;
}


function winning(creature: creature_type): boolean {
  return uand(creature.cdefense, 0x80000000) !== 0;
}


// spells.inc:1287 mass_genocide: all within sight but the winning creatures.
export async function mass_genocide(): Promise<boolean> {
  let result: boolean = false;

  await each_monster((i1: number, monster: monster_type): void => {
    if ((monster.cdis <= max_sight) && !winning(g.c_list[monster.mptr])) {
      delete_monster(i1);
      result = true;
    }
  });

  return result;
}


// spells.inc:1314 genocide: every creature of one symbol.
export async function genocide(): Promise<boolean> {
  const typ: IRef<string> = box('');

  if (await get_com('Which type of creature do wish exterminated?', typ)) {
    await each_monster(async (i1: number, monster: monster_type): Promise<void> => {
      const creature: creature_type = g.c_list[monster.mptr];

      if (typ.get() === creature.cchar) {
        if (!winning(creature)) {
          delete_monster(i1);
        } else {
          await msg_print(`The ${ creature.name } is unaffected.`);
        }
      }
    });
  }

  return true;
}


// spells.inc:1339 speed_monsters: every creature in sight.
export async function speed_monsters(spd: number): Promise<boolean> {
  let result: boolean = false;

  await each_monster(async (_i1: number, monster: monster_type): Promise<void> => {
    if (monster.ml) {
      const creature: creature_type = g.c_list[monster.mptr];

      if ((spd > 0) || (randint(max_mons_level) > creature.level)) {
        monster.cspeed += spd;
        monster.csleep = 0;
        result = true;
      } else {
        await msg_print(`The ${ creature.name } is unaffected.`);
      }
    }
  });

  return result;
}


// spells.inc:1371 sleep_monsters2: every creature in sight.
export async function sleep_monsters2(): Promise<boolean> {
  let result: boolean = false;

  await each_monster(async (_i1: number, monster: monster_type): Promise<void> => {
    const creature: creature_type = g.c_list[monster.mptr];

    result = true;

    if (monster.ml) {
      if (resists(creature)) {
        await msg_print(`The ${ creature.name } is unaffected.`);
      } else {
        monster.csleep = 500;
      }
    }
  });

  return result;
}


// spells.inc:1397 mass_poly: every creature within sight but the winning ones.
export async function mass_poly(): Promise<boolean> {
  let result: boolean = false;

  await each_monster((i1: number, monster: monster_type): void => {
    if ((monster.cdis < max_sight) && !winning(g.c_list[monster.mptr])) {
      const y: number = monster.fy;
      const x: number = monster.fx;

      delete_monster(i1);
      place_monster(y, x, new_monster_kind(), false);
      result = true;
    }
  });

  return result;
}


// spells.inc:1424 detect_evil
export async function detect_evil(): Promise<boolean> {
  return detect_monsters_where((creature: creature_type): boolean => uand(0x0004, creature.cdefense) !== 0,
    'You sense the presence of evil!');
}


// spells.inc:1453 hp_player: a negative amount goes through take_hit, which subtracts it and so
// heals; the source does this.
export async function hp_player(num: number, kind: string): Promise<boolean> {
  const misc: player_misc_type = g.py.misc;
  let result: boolean = false;

  if (num < 0) {
    await take_hit(num, kind);

    if (misc.chp < 0) {
      await msg_print('You feel your life slipping away!');
    }

    result = true;
  } else if (misc.chp < misc.mhp) {
    misc.chp = Math.min(real(misc.chp + num), misc.mhp);
    prt_chp();

    const tier: number = Math.trunc(real(num / 5));

    if (tier === 0) {
      await msg_print('You feel a little better.');
    } else if (tier <= 2) {
      await msg_print('You feel better.');
    } else if (tier <= 6) {
      await msg_print('You feel much better.');
    } else {
      await msg_print('You feel very good.');
    }

    result = true;
  }

  return result;
}


function cure(counter: 'confused' | 'blind' | 'poisoned' | 'afraid'): boolean {
  let result: boolean = false;

  if (g.py.flags[counter] > 1) {
    g.py.flags[counter] = 1;
    result = true;
  }

  return result;
}


// spells.inc:1483 cure_confusion
export function cure_confusion(): boolean {
  return cure('confused');
}


// spells.inc:1495 cure_blindness
export function cure_blindness(): boolean {
  return cure('blind');
}


// spells.inc:1507 cure_poison
export function cure_poison(): boolean {
  return cure('poisoned');
}


// spells.inc:1519 remove_fear
export function remove_fear(): boolean {
  return cure('afraid');
}


// spells.inc:1533 earthquake: walls open and floors fill within eight of the player.
export async function earthquake(): Promise<boolean> {
  for (let i1: number = g.char_row - 8; i1 <= g.char_row + 8; i1++) {
    for (let i2: number = g.char_col - 8; i2 <= g.char_col + 8; i2++) {
      if (((i1 !== g.char_row) || (i2 !== g.char_col)) && in_bounds(i1, i2) && (randint(8) === 1)) {
        await quake_spot(i1, i2);

        if (test_light(i1, i2)) {
          lite_spot(i1, i2);
        }
      }
    }
  }

  return true;
}


async function quake_spot(i1: number, i2: number): Promise<void> {
  const cell: cave_type = g.cave[i1][i2];

  if (cell.tptr > 0) {
    delete_object(i1, i2);
  }

  if (cell.cptr > 1) {
    await mon_take_hit(cell.cptr, damroll('2d8'));
  }

  if (g.wall_set.has(cell.fval)) {
    const floor: { ftval: number; ftopen: boolean } = next_to4(i1, i2, pascalSet(1, 2)) > 0 ? g.corr_floor2 : g.corr_floor1;

    cell.fval = floor.ftval;
    cell.fopen = floor.ftopen;

    if (test_light(i1, i2)) {
      unlite_spot(i1, i2);
    }

    cell.pl = false;
    cell.fm = false;

    if (cell.tl) {
      lite_spot(i1, i2);
    }
  } else if (g.floor_set.has(cell.fval)) {
    const roll: number = randint(10);
    const wall: { ftval: number; ftopen: boolean } = roll <= 5 ? g.rock_wall3 : (roll <= 8 ? g.rock_wall2 : g.rock_wall1);

    cell.fval = wall.ftval;
    cell.fopen = wall.ftopen;
    cell.fm = false;
  }
}


// spells.inc:1592 protect_evil
export function protect_evil(): boolean {
  g.py.flags.protevil = g.py.flags.protevil + randint(25) + 3 * g.py.misc.lev;

  return true;
}


// spells.inc:1600 create_food: a ration where the player stands.
export function create_food(): boolean {
  const cell: cave_type = g.cave[g.char_row][g.char_col];

  if (cell.tptr > 0) {
    delete_object(g.char_row, g.char_col);
  }

  place_object(g.char_row, g.char_col);
  g.t_list[cell.tptr] = clone(g.mush);

  return true;
}


// spells.inc:1615 dispell_creature: hurts the visible creatures of one kind.
export async function dispell_creature(cflag: number, damage: number): Promise<boolean> {
  let result: boolean = false;

  await each_monster(async (i1: number, monster: monster_type): Promise<void> => {
    const creature: creature_type = g.c_list[monster.mptr];

    if (monster.ml && (uand(cflag, creature.cdefense) !== 0)) {
      monster.hp -= randint(damage);
      monster.csleep = 0;

      if (monster.hp < 0) {
        await msg_print(`The ${ creature.name } dissolves!`);
        await monster_death(monster.fy, monster.fx, creature.cmove);
        g.py.misc.exp += round(real(creature.mexp * real(creature.level / g.py.misc.lev)));
        delete_monster(i1);
      } else {
        await msg_print(`The ${ creature.name } shudders.`);
      }

      result = true;
    }
  });

  return result;
}


// spells.inc:1649 turn_undead
export async function turn_undead(): Promise<boolean> {
  let result: boolean = false;

  await each_monster(async (_i1: number, monster: monster_type): Promise<void> => {
    const creature: creature_type = g.c_list[monster.mptr];

    if (panel_contains(monster.fy, monster.fx) && monster.ml && (uand(0x0008, creature.cdefense) !== 0)) {
      if (((g.py.misc.lev + 1) > creature.level) || (randint(5) === 1)) {
        await msg_print(`The ${ creature.name } runs frantically!`);
        monster.confused = true;
      } else {
        await msg_print(`The ${ creature.name } is unaffected.`);
      }

      result = true;
    }
  });

  return result;
}


// spells.inc:1678 warding_glyph: monsters will not cross it.
export function warding_glyph(): boolean {
  const cell: cave_type = g.cave[g.char_row][g.char_col];

  if (cell.tptr === 0) {
    const i1: IRef<number> = box(0);

    popt(i1);
    cell.tptr = i1.get();
    g.t_list[i1.get()] = clone(g.scare_monster);
  }

  return true;
}


async function lose_stat(sustained: boolean, stat: 'cstr' | 'cint' | 'cwis' | 'cdex' | 'ccon' | 'cchr', lost: string, kept: string,
                         show: () => void): Promise<boolean> {
  if (!sustained) {
    g.py.stat[stat] = de_statp(g.py.stat[stat]);
    await msg_print(lost);
    show();
  } else {
    await msg_print(kept);
  }

  return true;
}


// spells.inc:1693 lose_str
export async function lose_str(): Promise<boolean> {
  return lose_stat(g.py.flags.sustain_str, 'cstr', 'You feel very sick.', 'You feel sick for a moment, then it passes.', prt_strength);
}


// spells.inc:1708 lose_int
export async function lose_int(): Promise<boolean> {
  return lose_stat(g.py.flags.sustain_int, 'cint', 'You become very dizzy.', 'You become dizzy for a moment, then it passes.',
    prt_intelligence);
}


// spells.inc:1723 lose_wis
export async function lose_wis(): Promise<boolean> {
  return lose_stat(g.py.flags.sustain_wis, 'cwis', 'You feel very naive.', 'You feel naive for a moment, then it passes.', prt_wisdom);
}


// spells.inc:1738 lose_dex
export async function lose_dex(): Promise<boolean> {
  return lose_stat(g.py.flags.sustain_dex, 'cdex', 'You feel very sore.', 'You feel sore for a moment, then it passes.', prt_dexterity);
}


// spells.inc:1753 lose_con
export async function lose_con(): Promise<boolean> {
  return lose_stat(g.py.flags.sustain_con, 'ccon', 'You feel very sick.', 'You feel sick for a moment, then it passes.',
    prt_constitution);
}


// spells.inc:1768 lose_chr
export async function lose_chr(): Promise<boolean> {
  return lose_stat(g.py.flags.sustain_chr, 'cchr', 'Your skin starts to itch.', 'Your skin starts to itch, but feels better now.',
    prt_charisma);
}


// spells.inc:1783 lose_exp: levels drop with the experience, each taking hit points, mana and a spell.
export async function lose_exp(amount: number): Promise<void> {
  const misc: player_misc_type = g.py.misc;
  let i1: number = 1;

  misc.exp = amount > misc.exp ? 0 : misc.exp - amount;

  while (Math.trunc(real(g.player_exp[i1] * misc.expfact)) <= misc.exp) {
    i1++;
  }

  let i2: number = misc.lev - i1;

  while (i2 > 0) {
    const av_hp: number = Math.trunc(real(misc.mhp / misc.lev));
    const av_mn: number = Math.trunc(real(misc.mana / misc.lev));

    misc.lev--;
    i2--;
    misc.mhp = Math.max(misc.mhp - randint(av_hp * 2 - 1), 1);
    misc.mana = Math.max(misc.mana - randint(av_mn * 2 - 1), 0);
    await forget_spell();
  }

  if (misc.chp > misc.mhp) {
    misc.chp = misc.mhp;
  }

  if (misc.cmana > misc.mana) {
    misc.cmana = misc.mana;
  }

  misc.title = g.player_title[misc.pclass][misc.lev];
  await prt_experience();
  prt_mhp();
  prt_chp();
  prt_cmana();
  prt_level();
  prt_title();
}


async function forget_spell(): Promise<void> {
  const pclass: number = g.py.misc.pclass;
  const player_class: class_type = g.class[pclass];

  if (player_class.mspell || player_class.pspell) {
    let i1: number = 32;
    let flag: boolean = false;

    do {
      i1--;

      if (g.magic_spell[pclass][i1].learned) {
        flag = true;
      }
    } while (!(flag || (i1 < 2)));

    if (flag) {
      g.magic_spell[pclass][i1].learned = false;
      await msg_print(player_class.mspell ? 'You have forgotten a magic spell!' : 'You have forgotten a prayer!');
    }
  }
}


// spells.inc:1845 slow_poison
export async function slow_poison(): Promise<boolean> {
  let result: boolean = false;

  if (g.py.flags.poisoned > 0) {
    g.py.flags.poisoned = Math.max(Math.trunc(real(g.py.flags.poisoned / 2.0)), 1);
    result = true;
    await msg_print('The effects of the poison has been reduced.');
  }

  return result;
}


// spells.inc:1859 bless
export function bless(amount: number): boolean {
  g.py.flags.blessed += amount;

  return true;
}


// spells.inc:1867 detect_inv2
export function detect_inv2(amount: number): boolean {
  g.py.flags.detect_inv += amount;

  return true;
}


// spells.inc:1882 replace_spot
function replace_spot(y: number, x: number, typ: number): void {
  const cell: cave_type = g.cave[y][x];
  const floors: readonly { ftval: number; ftopen: boolean }[] = [ g.corr_floor1, g.rock_wall1, g.rock_wall2, g.rock_wall3 ];
  const floor: { ftval: number; ftopen: boolean } = typ <= 3 ? floors[0] : floors[mod3(typ)];

  cell.fval = floor.ftval;
  cell.fopen = floor.ftopen;
  cell.pl = false;
  cell.fm = false;

  if (cell.tptr > 0) {
    delete_object(y, x);
  }

  if (cell.cptr > 1) {
    delete_monster(cell.cptr);
  }
}


// 4,7,10 are granite, 5,8,11 magma, 6,9,12 quartz.
function mod3(typ: number): number {
  return ((typ - 4) % 3) + 1;
}


// spells.inc:1878 destroy_area: everything within fifteen of y,x; winning creatures only leave.
export async function destroy_area(y: number, x: number): Promise<boolean> {
  if (g.dun_level > 0) {
    for (let i1: number = y - 15; i1 <= y + 15; i1++) {
      for (let i2: number = x - 15; i2 <= x + 15; i2++) {
        if (in_bounds(i1, i2) && (g.cave[i1][i2].fval !== 15)) {
          const i3: number = distance(i1, i2, y, x);

          if (i3 < 13) {
            replace_spot(i1, i2, randint(6));
          } else if (i3 < 16) {
            replace_spot(i1, i2, randint(9));
          }
        }
      }
    }
  }

  await msg_print('There is a searing blast of light!');
  g.py.flags.blind = g.py.flags.blind + 10 + randint(10);

  return true;
}


const ENCHANT_CHANCE: readonly number[] = [ 0, 40, 100, 200, 400, 600, 700, 800, 900, 950 ];


// spells.inc:1935 enchant: the higher the pluses, the likelier it fails.
export function enchant(pluses: IRef<number>): boolean {
  let chance: number = 0;
  let result: boolean = false;

  if (pluses.get() > 0) {
    chance = pluses.get() <= 9 ? ENCHANT_CHANCE[pluses.get()] : 995;
  }

  if (randint(1000) > chance) {
    pluses.set(pluses.get() + 1);
    result = true;
  }

  return result;
}


// spells.inc:1963 remove_curse
export function remove_curse(): boolean {
  let result: boolean = false;

  for (let i1: number = 23; i1 <= 32; i1++) {
    const item: treasure_type = g.inventory[i1];

    if (uand(0x80000000, item.flags) !== 0) {
      item.flags = uand(0x7FFFFFFF, item.flags);
      py_bonuses(g.blank_treasure, 0);
      result = true;
    }
  }

  return result;
}


// spells.inc:1980 restore_level
export async function restore_level(): Promise<boolean> {
  const misc: player_misc_type = g.py.misc;
  let result: boolean = false;

  if (misc.max_exp > misc.exp) {
    result = true;
    await msg_print('You feel your life energies returning...');
    misc.exp = misc.max_exp;
    await prt_experience();
  }

  return result;
}
