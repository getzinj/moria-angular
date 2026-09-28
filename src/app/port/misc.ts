// source/include/misc.inc. REAL arithmetic goes through real() at every step, as VAX single
// precision rounded it.

import {
  bth_lev_adj,
  bth_plus_adj,
  cost_adj,
  inven_max,
  inven_init_max,
  max_creatures,
  max_gold,
  max_malloc,
  max_mons_level,
  max_obj_level,
  max_player_level,
  max_objects,
  max_sight,
  max_talloc,
  max_trapa,
  max_trapb,
  mon$summon_adj,
  mon_nasty,
  obj_base_magic,
  obj_base_max,
  obj_div_cursed,
  obj_div_special,
  obj_great,
  obj_std_adj,
  obj_std_min,
  player_weight_cap,
  win_mon_tot,
} from './constants';
import { clear, erase_line, get_string, inkey, msg_print, print, prt, put_buffer } from './io';
import type { cave_type, class_type, creature_type, dtype, floor_type, monster_type, obj_set, player_flags_type, player_misc_type, player_stat_type, spell_type, spl_rec, spl_type, treasure_type } from './types';
import { g } from './variables';
import { get_seed as seed_from_time } from '../runtime/clock';
import * as macro from '../runtime/macro';
import type { IRef } from '../runtime/pascal';
import { Readv, box, clone, fmt, index, mod, oneBased, pad, real, ref, round, substr, uor, uxor } from '../runtime/pascal';
import type { Random } from '../runtime/random';
import { rt } from '../runtime/runtime';


// misc.inc:2 get_seed
export function get_seed(): number {
  return seed_from_time(rt().clock.now());
}


// misc.inc:24 day_num, 39 hour_num, 51 check_time: the opening hours, which this port does not
// keep. check_time always answers open.
export function check_time(): boolean {
  return true;
}


// misc.inc:62 randint (randint.mar)
export function randint(maxval: number): number {
  return rt().random.randint(maxval);
}


// misc.inc:67 rand_rep (randrep.mar)
export function rand_rep(num: number, die: number): number {
  return rt().random.rand_rep(num, die);
}


// misc.inc:75 randnor
export function randnor(mean: number, stand: number): number {
  const u1: number = real(randint(9999999) / real(10000000.0));
  const u2: number = real(randint(9999999) / real(10000000.0));
  const radius: number = real(Math.sqrt(real(real(-2.0) * real(Math.log(u1)))));
  const angle: number = real(Math.cos(real(real(6.283) * u2)));

  return Math.trunc(real(real(radius * angle) * stand)) + mean;
}


// misc.inc:83 bit_pos (bitpos.mar): clears the bit it finds, through the reference.
export function bit_pos(test: IRef<number>): number {
  const found: macro.IBitPosResult = macro.bit_pos(test.get());

  test.set(found.remaining);

  return found.position;
}


// misc.inc:90 in_bounds
export function in_bounds(y: number, x: number): boolean {
  return (y > 1) && (y < g.cur_height) && (x > 1) && (x < g.cur_width);
}


// misc.inc:101 distance (distance.mar)
export function distance(y1: number, x1: number, y2: number, x2: number): number {
  return macro.distance(y1, x1, y2, x2);
}


// misc.inc:111 next_to4
export function next_to4(y: number, x: number, group_set: obj_set): number {
  let i1: number = 0;

  if ((y > 1) && group_set.has(g.cave[y - 1][x].fval)) {
    i1++;
  }

  if ((y < g.cur_height) && group_set.has(g.cave[y + 1][x].fval)) {
    i1++;
  }

  if ((x > 1) && group_set.has(g.cave[y][x - 1].fval)) {
    i1++;
  }

  if ((x < g.cur_width) && group_set.has(g.cave[y][x + 1].fval)) {
    i1++;
  }

  return i1;
}


// misc.inc:136 next_to8
export function next_to8(y: number, x: number, group_set: obj_set): number {
  let i1: number = 0;

  for (let i2: number = y - 1; i2 <= y + 1; i2++) {
    for (let i3: number = x - 1; i3 <= x + 1; i3++) {
      if (in_bounds(i2, i3) && group_set.has(g.cave[i2][i3].fval)) {
        i1++;
      }
    }
  }

  return i1;
}


// misc.inc:154 tlink: chains the free treasure slots together through p1.
export function tlink(): void {
  for (let i1: number = 1; i1 <= max_talloc; i1++) {
    g.t_list[i1] = clone(g.blank_treasure);
    g.t_list[i1].p1 = i1 - 1;
  }

  g.tcptr = max_talloc;
}


// misc.inc:168 mlink: chains the free monster slots together through nptr.
export function mlink(): void {
  for (let i1: number = 1; i1 <= max_malloc; i1++) {
    g.m_list[i1] = clone(g.blank_monster);
    g.m_list[i1].nptr = i1 - 1;
  }

  g.m_list[2].nptr = 0;
  g.muptr = 0;
  g.mfptr = max_malloc;
}


// misc.inc:184 init_m_level
export function init_m_level(): void {
  let i1: number = 1;
  let i2: number = 0;
  const i3: number = max_creatures - win_mon_tot;

  do {
    g.m_level[i2] = 0;

    while ((i1 <= i3) && (g.c_list[i1].level === i2)) {
      g.m_level[i2]++;
      i1++;
    }

    i2++;
  } while (i2 <= max_mons_level);

  for (let i4: number = 2; i4 <= max_mons_level; i4++) {
    g.m_level[i4] += g.m_level[i4 - 1];
  }
}


// misc.inc:206 init_t_level
export function init_t_level(): void {
  let i1: number = 1;
  let i2: number = 0;

  do {
    while ((i1 <= max_objects) && (g.object_list[i1].level === i2)) {
      g.t_level[i2]++;
      i1++;
    }

    i2++;
  } while (!((i2 > max_obj_level) || (i1 > max_objects)));

  for (let i3: number = 1; i3 <= max_obj_level; i3++) {
    g.t_level[i3] += g.t_level[i3 - 1];
  }
}


// misc.inc:226 price_adjust. In single precision a large cost plus 0.99 can round up to the next
// whole number, which the trunc then keeps.
export function price_adjust(): void {
  for (let i1: number = 1; i1 <= max_objects; i1++) {
    g.object_list[i1].cost = Math.trunc(real(real(g.object_list[i1].cost * cost_adj) + real(0.99)));
  }

  for (let i1: number = 1; i1 <= inven_init_max; i1++) {
    g.inventory_init[i1].cost = Math.trunc(real(real(g.inventory_init[i1].cost * cost_adj) + real(0.99)));
  }
}


// misc.inc:241 damroll: '2d6' and the like. READV with error:=continue keeps whatever it read.
export function damroll(dice: dtype): number {
  const line: Readv = new Readv(dice.replace(/d/g, ' '));
  let num: number = 0;
  let sides: number = 0;

  try {
    num = line.integer();
    sides = line.integer();
  } catch {
    // error:=continue
  }

  return rand_rep(num, sides);
}


// misc.inc:256 los: no obstruction between the two points.
export function los(y1: number, x1: number, y2: number, x2: number): boolean {
  const ty: number = y1 - y2;
  const tx: number = x1 - x2;
  let y: number = y2;
  let x: number = x2;
  let flag: boolean = true;

  if ((ty !== 0) || (tx !== 0)) {
    const stepy: number = ty < 0 ? -1 : 1;
    const stepx: number = tx < 0 ? -1 : 1;

    if (ty === 0) {
      do {
        x += stepx;
        flag = g.cave[y][x].fopen;
      } while (!((x1 === x) || !flag));
    } else if (tx === 0) {
      do {
        y += stepy;
        flag = g.cave[y][x].fopen;
      } while (!((y1 === y) || !flag));
    } else if (Math.abs(ty) > Math.abs(tx)) {
      const slp: number = real(real(Math.abs(real(tx / ty))) * stepx);
      let tmp: number = real(x);

      do {
        y += stepy;
        tmp = real(tmp + slp);

        const p1: number = round(real(tmp - real(0.1)));
        const p2: number = round(real(tmp + real(0.1)));

        if (!(g.cave[y][p1].fopen || g.cave[y][p2].fopen)) {
          flag = false;
        }
      } while (!((y1 === y) || !flag));
    } else {
      const slp: number = real(real(Math.abs(real(ty / tx))) * stepy);
      let tmp: number = real(y);

      do {
        x += stepx;
        tmp = real(tmp + slp);

        const p1: number = round(real(tmp - real(0.1)));
        const p2: number = round(real(tmp + real(0.1)));

        if (!(g.cave[p1][x].fopen || g.cave[p2][x].fopen)) {
          flag = false;
        }
      } while (!((x1 === x) || !flag));
    }
  }

  return flag;
}


// misc.inc:317 loc_symbol
export function loc_symbol(y: number, x: number): string {
  const cell: cave_type = g.cave[y][x];
  let sym: string;

  if ((cell.cptr === 1) && !g.find_flag) {
    sym = '@';
  } else if (g.py.flags.blind > 0) {
    sym = ' ';
  } else if (cell.cptr > 1) {
    const monster: monster_type = g.m_list[cell.cptr];

    if (monster.ml && (((g.c_list[monster.mptr].cmove & 0x00010000) === 0) || g.py.flags.see_inv)) {
      sym = g.c_list[monster.mptr].cchar;
    } else {
      sym = floor_symbol(y, x);
    }
  } else {
    sym = floor_symbol(y, x);
  }

  return sym;
}


function floor_symbol(y: number, x: number): string {
  const cell: cave_type = g.cave[y][x];
  let sym: string;

  if (cell.tptr > 0) {
    sym = g.t_list[cell.tptr].tchar;
  } else if (cell.fval < 10) {
    sym = '.';
  } else {
    sym = '#';
  }

  return sym;
}


// misc.inc:351 test_light
export function test_light(y: number, x: number): boolean {
  const cell: cave_type = g.cave[y][x];

  return cell.pl || cell.fm || cell.tl;
}


// misc.inc:362 prt_map: redraws the panel, running characters together and skipping gaps of more
// than three blanks.
export function prt_map(): void {
  let i3: number = 1;
  const i4: number = 14;

  g.redraw = false;

  for (let i1: number = g.panel_row_min; i1 <= g.panel_row_max; i1++) {
    let floor_str: string = '';
    let xpos: number = 0;
    let flag: boolean = false;
    let isp: number = 0;

    i3++;

    if (g.used_line[i3]) {
      erase_line(i3, i4);
      g.used_line[i3] = false;
    }

    for (let i2: number = g.panel_col_min; i2 <= g.panel_col_max; i2++) {
      const cell: cave_type = g.cave[i1][i2];
      let tmp_char: string;

      if (test_light(i1, i2)) {
        tmp_char = loc_symbol(i1, i2);
      } else if ((cell.cptr === 1) && !g.find_flag) {
        tmp_char = '@';
      } else if ((cell.cptr > 1) && g.m_list[cell.cptr].ml) {
        tmp_char = loc_symbol(i1, i2);
      } else {
        tmp_char = ' ';
      }

      if (tmp_char === ' ') {
        if (flag) {
          isp++;

          if (isp > 3) {
            print(floor_str, i1, xpos);
            flag = false;
            isp = 0;
          }
        }
      } else if (flag) {
        floor_str += ' '.repeat(isp) + tmp_char;
        isp = 0;
      } else {
        xpos = i2;
        flag = true;
        floor_str = tmp_char;
      }
    }

    if (flag) {
      print(floor_str, i1, xpos);
    }
  }
}


// misc.inc:439 compact_monsters: removes monsters at random, nearest last, until one goes.
export function compact_monsters(): void {
  let cur_dis: number = 66;
  let delete_any: boolean = false;

  do {
    let i1: number = g.muptr;
    let i2: number = 0;

    do {
      const i3: number = g.m_list[i1].nptr;
      let delete_1: boolean = false;
      const monster: monster_type = g.m_list[i1];

      if ((cur_dis > monster.cdis) && (randint(3) === 1)) {
        if (i2 === 0) {
          g.muptr = i3;
        } else {
          g.m_list[i2].nptr = i3;
        }

        g.cave[monster.fy][monster.fx].cptr = 0;
        g.m_list[i1] = clone(g.blank_monster);
        g.m_list[i1].nptr = g.mfptr;
        g.mfptr = i1;
        delete_1 = true;
        delete_any = true;
      }

      if (!delete_1) {
        i2 = i1;
      }

      i1 = i3;
    } while (i1 !== 0);

    if (!delete_any) {
      cur_dis -= 6;
    }
  } while (!delete_any);

  if (cur_dis < 66) {
    prt_map();
  }
}


// misc.inc:478 popm
export function popm(x: IRef<number>): void {
  if (g.mfptr < 1) {
    compact_monsters();
  }

  x.set(g.mfptr);
  g.mfptr = g.m_list[x.get()].nptr;
}


// misc.inc:487 pushm
export function pushm(x: number): void {
  g.m_list[x] = clone(g.blank_monster);
  g.m_list[x].nptr = g.mfptr;
  g.mfptr = x;
}


// misc.inc:496 max_hp
export function max_hp(hp_str: dtype): number {
  const line: Readv = new Readv(hp_str.replace(/d/g, ' '));
  const num: number = line.integer();

  return num * line.integer();
}


// misc.inc:509 place_monster
export function place_monster(y: number, x: number, z: number, slp: boolean): void {
  const cur_pos: IRef<number> = box(0);

  popm(cur_pos);

  const monster: monster_type = g.m_list[cur_pos.get()];
  const creature: creature_type = g.c_list[z];

  monster.fy = y;
  monster.fx = x;
  monster.mptr = z;
  monster.nptr = g.muptr;
  g.muptr = cur_pos.get();
  monster.hp = (creature.cdefense & 0x4000) !== 0 ? max_hp(creature.hd) : damroll(creature.hd);
  monster.cspeed = creature.speed + g.py.flags.speed;
  monster.stuned = 0;
  monster.cdis = distance(g.char_row, g.char_col, y, x);
  g.cave[y][x].cptr = cur_pos.get();

  if (slp) {
    monster.csleep = Math.trunc(real(creature.sleep / real(5.0))) + randint(creature.sleep);
  } else {
    monster.csleep = 0;
  }
}


// misc.inc:540 place_win_monster
export function place_win_monster(): void {
  if (!g.total_winner) {
    const cur_pos: IRef<number> = box(0);
    let y: number;
    let x: number;

    popm(cur_pos);

    const monster: monster_type = g.m_list[cur_pos.get()];

    do {
      y = randint(g.cur_height - 2) + 1;
      x = randint(g.cur_width - 2) + 1;
    } while (!([ 1, 2, 4 ].includes(g.cave[y][x].fval) &&
               (g.cave[y][x].cptr === 0) &&
               (g.cave[y][x].tptr === 0) &&
               (distance(y, x, g.char_row, g.char_col) > max_sight)));

    monster.fy = y;
    monster.fx = x;
    monster.mptr = randint(win_mon_tot) + g.m_level[max_mons_level] + g.m_level[0];
    monster.nptr = g.muptr;
    g.muptr = cur_pos.get();

    const creature: creature_type = g.c_list[monster.mptr];

    monster.hp = (creature.cdefense & 0x4000) !== 0 ? max_hp(creature.hd) : damroll(creature.hd);
    monster.cspeed = creature.speed + g.py.flags.speed;
    monster.stuned = 0;
    monster.cdis = distance(g.char_row, g.char_col, y, x);
    g.cave[y][x].cptr = cur_pos.get();
    monster.csleep = 0;
  }
}


// misc.inc:578 alloc_monster
export function alloc_monster(alloc_set: obj_set, num: number, dis: number, slp: boolean): void {
  for (let i1: number = 1; i1 <= num; i1++) {
    let y: number;
    let x: number;
    let i2: number;

    do {
      y = randint(g.cur_height - 2) + 1;
      x = randint(g.cur_width - 2) + 1;
    } while (!(alloc_set.has(g.cave[y][x].fval) &&
               (g.cave[y][x].cptr === 0) &&
               g.cave[y][x].fopen &&
               (distance(y, x, g.char_row, g.char_col) > dis)));

    if (g.dun_level === 0) {
      i2 = randint(g.m_level[0]);
    } else if (g.dun_level > max_mons_level) {
      i2 = randint(g.m_level[max_mons_level]) + g.m_level[0];
    } else if (randint(mon_nasty) === 1) {
      i2 = g.dun_level + Math.abs(randnor(0, 4)) + 1;

      if (i2 > max_mons_level) {
        i2 = max_mons_level;
      }

      const i3: number = g.m_level[i2] - g.m_level[i2 - 1];

      i2 = randint(i3) + g.m_level[i2 - 1];
    } else {
      i2 = randint(g.m_level[g.dun_level]) + g.m_level[0];
    }

    place_monster(y, x, i2, slp);
  }
}


// misc.inc:612 summon_monster
export function summon_monster(y: IRef<number>, x: IRef<number>, slp: boolean): boolean {
  let i1: number = 0;
  const i5: number = g.dun_level + mon$summon_adj;
  let i4: number = i5 > max_mons_level ? max_mons_level : i5;
  let summoned: boolean = false;

  if (g.dun_level === 0) {
    i4 = randint(g.m_level[0]);
  } else {
    i4 = randint(g.m_level[i4]) + g.m_level[0];
  }

  do {
    const i2: number = y.get() - 2 + randint(3);
    const i3: number = x.get() - 2 + randint(3);

    if (in_bounds(i2, i3)) {
      const cell: cave_type = g.cave[i2][i3];

      if ([ 1, 2, 4, 5 ].includes(cell.fval) && (cell.cptr === 0) && cell.fopen) {
        place_monster(i2, i3, i4, slp);
        summoned = true;
        i1 = 9;
        y.set(i2);
        x.set(i3);
      }
    }

    i1++;
  } while (i1 <= 9);

  return summoned;
}


// misc.inc:651 summon_undead
export function summon_undead(y: IRef<number>, x: IRef<number>): boolean {
  let i1: number = 0;
  let i4: number = g.m_level[max_mons_level] + g.m_level[0];
  let i5: number;
  let summoned: boolean = false;

  do {
    let ctr: number = 0;

    i5 = randint(i4);

    do {
      if ((g.c_list[i5].cdefense & 0x0008) !== 0) {
        ctr = 20;
        i4 = 0;
      } else {
        i5++;

        if (i5 > i4) {
          ctr = 20;
        } else {
          ctr++;
        }
      }
    } while (ctr <= 19);
  } while (i4 !== 0);

  do {
    const i2: number = y.get() - 2 + randint(3);
    const i3: number = x.get() - 2 + randint(3);

    if (in_bounds(i2, i3)) {
      const cell: cave_type = g.cave[i2][i3];

      if ([ 1, 2, 4, 5 ].includes(cell.fval) && (cell.cptr === 0) && cell.fopen) {
        place_monster(i2, i3, i5, false);
        summoned = true;
        i1 = 9;
        y.set(i2);
        x.set(i3);
      }
    }

    i1++;
  } while (i1 <= 9);

  return summoned;
}


// misc.inc:697 compact_objects: removes floor objects, nearest last, until one goes.
export function compact_objects(): void {
  let ctr: number = 0;
  let cur_dis: number = 66;

  do {
    for (let i1: number = 1; i1 <= g.cur_height; i1++) {
      for (let i2: number = 1; i2 <= g.cur_width; i2++) {
        const cell: cave_type = g.cave[i1][i2];

        if ((cell.tptr > 0) && (distance(i1, i2, g.char_row, g.char_col) > cur_dis)) {
          const item: treasure_type = g.t_list[cell.tptr];
          let flag: boolean = false;

          if (item.tval === 102) {
            flag = [ 1, 6, 9 ].includes(item.subval) || (randint(4) === 1);
          } else if (item.tval === 103) {
            flag = true;
          } else if ((item.tval === 104) || (item.tval === 105)) {
            flag = randint(4) === 1;
          } else if ((item.tval === 107) || (item.tval === 108)) {
            flag = false;
          } else {
            flag = randint(8) === 1;
          }

          if (flag) {
            cell.fopen = true;
            g.t_list[cell.tptr] = clone(g.blank_treasure);
            g.t_list[cell.tptr].p1 = g.tcptr;
            g.tcptr = cell.tptr;
            cell.tptr = 0;
            ctr++;
          }
        }
      }
    }

    if (ctr === 0) {
      cur_dis -= 6;
    }
  } while (ctr <= 0);

  if (cur_dis < 66) {
    prt_map();
  }
}


// misc.inc:740 popt
export function popt(x: IRef<number>): void {
  if (g.tcptr < 1) {
    compact_objects();
  }

  x.set(g.tcptr);
  g.tcptr = g.t_list[x.get()].p1;
}


// misc.inc:751 pusht
export function pusht(x: number): void {
  g.t_list[x] = clone(g.blank_treasure);
  g.t_list[x].p1 = g.tcptr;
  g.tcptr = x;
}


// misc.inc:760 sort_objects: a shell sort by level. It is not stable, and saved item indices
// depend on exactly the order it leaves, so it is reproduced step for step.
export function sort_objects(): void {
  let gap: number = Math.trunc(max_objects / 2);

  while (gap > 0) {
    for (let i1: number = gap + 1; i1 <= max_objects; i1++) {
      let i2: number = i1 - gap;

      while (i2 > 0) {
        const i3: number = i2 + gap;

        if (g.object_list[i2].level > g.object_list[i3].level) {
          const tmp: treasure_type = g.object_list[i2];

          g.object_list[i2] = g.object_list[i3];
          g.object_list[i3] = tmp;
        } else {
          i2 = 0;
        }

        i2 -= gap;
      }
    }

    gap = Math.trunc(gap / 2);
  }
}


// misc.inc:793 magic_treasure. The chance of magic rises with the level. Kept as the original
// had it, including ring 23 and 24 pricing by todam and cloaks adding toac + 100.
export function magic_treasure(x: number, level: number): void {
  const magik: (chance: number) => boolean = (chance: number): boolean => randint(100) <= chance;
  const m_bonus: (base: number, max_std: number, level: number) => number = (base: number, max_std: number, lev: number): number => {
    let stand_dev: number = Math.trunc(real(obj_std_adj * lev)) + obj_std_min;

    if (stand_dev > max_std) {
      stand_dev = max_std;
    }

    const bonus: number = Math.trunc(real(Math.abs(randnor(0, stand_dev)) / real(10.0))) + base;

    return bonus < base ? base : bonus;
  };
  let chance: number = obj_base_magic + level;

  if (chance > obj_base_max) {
    chance = obj_base_max;
  }

  const special: number = Math.trunc(real(chance / obj_div_special));
  const cursed: number = Math.trunc(real(chance / obj_div_cursed));
  const t: treasure_type = g.t_list[x];
  const add_flags: (flags: number) => void = (flags: number): void => {
    t.flags = uor(flags, t.flags);
  };

  switch (t.tval) {
    case 34: case 35: case 36:
      if (magik(chance)) {
        t.toac = m_bonus(1, 30, level);

        if (magik(special)) {
          switch (randint(9)) {
            case 1:
              add_flags(0x02380000);
              t.name += ' (R)';
              t.toac += 5;
              t.cost += 2500;
              break;
            case 2:
              add_flags(0x00100000);
              t.name += ' (RA)';
              t.cost += 1000;
              break;
            case 3: case 4:
              add_flags(0x00080000);
              t.name += ' (RF)';
              t.cost += 600;
              break;
            case 5: case 6:
              add_flags(0x00200000);
              t.name += ' (RC)';
              t.cost += 600;
              break;
            case 7: case 8: case 9:
              add_flags(0x02000000);
              t.name += ' (RL)';
              t.cost += 500;
              break;
          }
        }
      } else if (magik(cursed)) {
        t.toac = -m_bonus(1, 40, level);
        t.cost = 0;
        add_flags(0x80000000);
      }
      break;

    case 21: case 22: case 23:
      if (magik(chance)) {
        t.tohit = m_bonus(0, 40, level);
        t.todam = m_bonus(0, 40, level);

        if (magik(special)) {
          switch (randint(16)) {
            case 1:
              add_flags(0x01418001);
              t.tohit += 5;
              t.todam += 5;
              t.toac = randint(4);
              t.p1 = randint(4) - 1;
              t.name += ' (HA)';
              t.cost += t.p1 * 500;
              t.cost += 10000;
              break;
            case 2:
              add_flags(0x07B80900);
              t.tohit += 3;
              t.todam += 3;
              t.toac = 5 + randint(5);
              t.name += ' [%P4] (DF)';
              t.p1 = randint(3);
              t.cost += t.p1 * 500;
              t.cost += 7500;
              break;
            case 3: case 4:
              add_flags(0x01004000);
              t.tohit += 3;
              t.todam += 3;
              t.name += ' (SM)';
              t.cost += 5000;
              break;
            case 5: case 6:
              add_flags(0x00002000);
              t.tohit += 3;
              t.todam += 3;
              t.name += ' (SD)';
              t.cost += 4000;
              break;
            case 7: case 8:
              add_flags(0x00008000);
              t.tohit += 3;
              t.todam += 3;
              t.name += ' (SE)';
              t.cost += 4000;
              break;
            case 9: case 10:
              add_flags(0x00010000);
              t.tohit += 2;
              t.todam += 2;
              t.name += ' (SU)';
              t.cost += 3000;
              break;
            case 11: case 12: case 13:
              add_flags(0x00040000);
              t.tohit += 1;
              t.todam += 3;
              t.name += ' (FT)';
              t.cost += 2000;
              break;
            case 14: case 15: case 16:
              add_flags(0x00020000);
              t.tohit += 1;
              t.todam += 1;
              t.name += ' (FB)';
              t.cost += 1200;
              break;
          }
        }
      } else if (magik(cursed)) {
        t.tohit = -m_bonus(1, 55, level);
        t.todam = -m_bonus(1, 55, level);
        add_flags(0x80000000);
        t.cost = 0;
      }
      break;

    case 20:
      if (magik(chance)) {
        t.tohit = m_bonus(1, 30, level);
      } else if (magik(cursed)) {
        t.tohit = -m_bonus(1, 50, level);
        add_flags(0x80000000);
        t.cost = 0;
      }
      break;

    case 25:
      if (magik(chance)) {
        switch (randint(3)) {
          case 1: case 2:
            t.p1 = m_bonus(2, 25, level);
            t.cost += t.p1 * 100;
            break;
          case 3:
            t.p1 = -m_bonus(1, 30, level);
            t.cost = 0;
            add_flags(0x80000000);
            break;
        }
      }
      break;

    case 31:
      if (magik(chance)) {
        t.toac = m_bonus(1, 20, level);

        if (magik(special)) {
          switch (randint(2)) {
            case 1:
              add_flags(0x00800000);
              t.name += ' of Free Action';
              t.cost += 1000;
              break;
            case 2:
              t.tohit = 1 + randint(3);
              t.todam = 1 + randint(3);
              t.name += ' of Slaying';
              t.cost += (t.tohit + t.todam) * 250;
              break;
          }
        }
      } else if (magik(cursed)) {
        if (magik(special)) {
          switch (randint(2)) {
            case 1:
              add_flags(0x80000002);
              t.name += ' of Clumsiness';
              t.p1 = 1;
              break;
            case 2:
              add_flags(0x80000001);
              t.name += ' of Weakness';
              t.p1 = 1;
              break;
          }
        }

        t.toac = -m_bonus(1, 40, level);
        t.p1 = -m_bonus(1, 10, level);
        add_flags(0x80000000);
        t.cost = 0;
      }
      break;

    case 30:
      if (magik(chance)) {
        t.toac = m_bonus(1, 20, level);

        if (magik(special)) {
          const roll: number = randint(12);

          if (roll === 1) {
            add_flags(0x00001000);
            t.name += ' of Speed';
            t.p1 = 1;
            t.cost += 5000;
          } else if ((roll >= 2) && (roll <= 5)) {
            add_flags(0x00000100);
            t.name += ' of Stealth';
            t.cost += 500;
          } else {
            add_flags(0x04000000);
            t.name += ' of Slow descent';
            t.cost += 250;
          }
        }
      } else if (magik(cursed)) {
        switch (randint(3)) {
          case 1:
            add_flags(0x80001000);
            t.name += ' of Slowness';
            t.p1 = -1;
            break;
          case 2:
            add_flags(0x80000200);
            t.name += ' of Noise';
            break;
          case 3:
            add_flags(0x80000000);
            t.name += ' of Great Mass';
            t.weight *= 5;
            break;
        }

        t.cost = 0;
        t.ac = -m_bonus(2, 45, level);
      }
      break;

    case 33:
      if (magik(chance)) {
        t.toac = m_bonus(1, 20, level);

        if (magik(special)) {
          if ((t.subval >= 1) && (t.subval <= 5)) {
            switch (randint(3)) {
              case 1:
                t.p1 = randint(2);
                add_flags(0x00000008);
                t.name += ' of Intelligence';
                t.cost += t.p1 * 500;
                break;
              case 2:
                t.p1 = randint(2);
                add_flags(0x00000010);
                t.name += ' of Wisdom';
                t.cost += t.p1 * 500;
                break;
              case 3:
                t.p1 = 1 + randint(4);
                add_flags(0x40000000);
                t.name += ' of Infra-Vision';
                t.cost += t.p1 * 250;
                break;
            }
          } else if ((t.subval >= 6) && (t.subval <= 8)) {
            switch (randint(6)) {
              case 1:
                t.p1 = randint(3);
                add_flags(0x00800007);
                t.name += ' of Might';
                t.cost += 1000 + t.p1 * 500;
                break;
              case 2:
                t.p1 = randint(3);
                add_flags(0x00000030);
                t.name += ' of Lordliness';
                t.cost += 1000 + t.p1 * 500;
                break;
              case 3:
                t.p1 = randint(3);
                add_flags(0x01380008);
                t.name += ' of the Magi';
                t.cost += 3000 + t.p1 * 500;
                break;
              case 4:
                t.p1 = randint(3);
                add_flags(0x00000020);
                t.name += ' of Beauty';
                t.cost += 750;
                break;
              case 5:
                t.p1 = 1 + randint(4);
                add_flags(0x01000040);
                t.name += ' of Seeing';
                t.cost += 1000 + t.p1 * 100;
                break;
              case 6:
                add_flags(0x00000800);
                t.name += ' of Regeneration';
                t.cost += 1500;
                break;
            }
          }
        }
      } else if (magik(cursed)) {
        t.toac = -m_bonus(1, 45, level);
        add_flags(0x80000000);
        t.cost = 0;

        if (magik(special)) {
          switch (randint(7)) {
            case 1:
              t.p1 = -1;
              add_flags(0x00000008);
              t.name += ' of Stupidity';
              break;
            case 2:
              t.p1 = -1;
              add_flags(0x00000010);
              t.name += ' of Dullness';
              break;
            case 3:
              add_flags(0x08000000);
              t.name += ' of Blindness';
              break;
            case 4:
              add_flags(0x10000000);
              t.name += ' of Timidness';
              break;
            case 5:
              t.p1 = -1;
              add_flags(0x00000001);
              t.name += ' of Weakness';
              break;
            case 6:
              add_flags(0x00000400);
              t.name += ' of Teleportation';
              break;
            case 7:
              t.p1 = -1;
              add_flags(0x00000020);
              t.name += ' of Ugliness';
              break;
          }
        }

        t.p1 *= randint(5);
      }
      break;

    case 45:
      if ((t.subval >= 1) && (t.subval <= 6)) {
        if (magik(cursed)) {
          t.p1 = -m_bonus(1, 20, level);
          add_flags(0x80000000);
          t.cost = -t.cost;
        } else {
          t.p1 = m_bonus(1, 10, level);
          t.cost += t.p1 * 100;
        }
      } else if (t.subval === 7) {
        if (magik(cursed)) {
          t.p1 = -randint(3);
          add_flags(0x80000000);
          t.cost = -t.cost;
        } else {
          t.p1 = 1;
        }
      } else if (t.subval === 8) {
        t.p1 = 5 * m_bonus(1, 20, level);
        t.cost += t.p1 * 100;
      } else if (t.subval === 22) {
        t.todam = m_bonus(1, 20, level);
        t.cost += t.todam * 100;

        if (magik(cursed)) {
          t.todam = -t.todam;
          add_flags(0x80000000);
          t.cost = -t.cost;
        }
      } else if (t.subval === 23) {
        t.tohit = m_bonus(1, 20, level);
        t.cost += t.todam * 100;

        if (magik(cursed)) {
          t.tohit = -t.tohit;
          add_flags(0x80000000);
          t.cost = -t.cost;
        }
      } else if (t.subval === 24) {
        t.toac = m_bonus(1, 20, level);
        t.cost += t.todam * 100;

        if (magik(cursed)) {
          t.toac = -t.toac;
          add_flags(0x80000000);
          t.cost = -t.cost;
        }
      } else if (t.subval === 33) {
        t.todam = m_bonus(1, 25, level);
        t.tohit = m_bonus(1, 25, level);
        t.cost += (t.tohit + t.todam) * 100;

        if (magik(cursed)) {
          t.tohit = -t.tohit;
          t.todam = -t.todam;
          add_flags(0x80000000);
          t.cost = -t.cost;
        }
      }
      break;

    case 40:
      if ((t.subval >= 1) && (t.subval <= 6)) {
        if (magik(cursed)) {
          t.p1 = -m_bonus(1, 20, level);
          add_flags(0x80000000);
          t.cost = -t.cost;
        } else {
          t.p1 = m_bonus(1, 10, level);
          t.cost += t.p1 * 100;
        }
      } else if (t.subval === 7) {
        t.p1 = 5 * m_bonus(1, 25, level);

        if (magik(cursed)) {
          t.p1 = -t.p1;
          t.cost = -t.cost;
          add_flags(0x80000000);
        } else {
          t.cost += 100 * t.p1;
        }
      }
      break;

    case 15:
      // Subval is even for the store's, odd for the dungeon's, which are partly charged.
      if (mod(t.subval, 2) === 1) {
        t.p1 = randint(t.p1);
      }
      break;

    case 65:
      if ((t.subval >= 1) && (t.subval < WAND_CHARGES.length)) {
        t.p1 = randint(WAND_CHARGES[t.subval][0]) + WAND_CHARGES[t.subval][1];
      }
      break;

    case 55:
      if ((t.subval >= 1) && (t.subval < STAFF_CHARGES.length)) {
        t.p1 = randint(STAFF_CHARGES[t.subval][0]) + STAFF_CHARGES[t.subval][1];
      }
      break;

    case 32:
      if (magik(chance)) {
        if (magik(special)) {
          switch (randint(2)) {
            case 1:
              t.name += ' of Protection';
              t.toac = m_bonus(2, 40, level);
              t.cost += 250 + t.toac * 100;
              break;
            case 2:
              t.toac = m_bonus(1, 20, level);
              t.p1 = randint(3);
              add_flags(0x00000100);
              t.name += ' of Stealth (%P1)';
              t.cost += t.p1 * 500 + t.toac * 100;
              break;
          }
        } else {
          t.toac = m_bonus(1, 20, level);
          t.cost += t.toac + 100;
        }
      } else if (magik(cursed)) {
        switch (randint(3)) {
          case 1:
            add_flags(0x80000200);
            t.name += ' of Irritation';
            t.ac = 0;
            t.toac = -m_bonus(1, 10, level);
            t.tohit = -m_bonus(1, 10, level);
            t.todam = -m_bonus(1, 10, level);
            t.cost = 0;
            break;
          case 2:
            add_flags(0x80000000);
            t.name += ' of Vulnerability';
            t.ac = 0;
            t.toac = -m_bonus(10, 100, level + 50);
            t.cost = 0;
            break;
          case 3:
            add_flags(0x80000000);
            t.name += ' of Enveloping';
            t.toac = -m_bonus(1, 10, level);
            t.tohit = -m_bonus(2, 40, level + 10);
            t.todam = -m_bonus(2, 40, level + 10);
            t.cost = 0;
            break;
        }
      }
      break;

    case 2: {
      const roll: number = randint(level) + 4;

      if (roll === 1) {
        t.name += '^ (Empty)';
      } else if (roll === 2) {
        add_flags(0x00000001);
        t.name += '^ (Locked)';
      } else if ((roll === 3) || (roll === 4)) {
        add_flags(0x00000011);
        t.name += '^ (Poison Needle)';
      } else if ((roll === 5) || (roll === 6)) {
        add_flags(0x00000021);
        t.name += '^ (Poison Needle)';
      } else if ((roll >= 7) && (roll <= 9)) {
        add_flags(0x00000041);
        t.name += '^ (Gas Trap)';
      } else if ((roll === 10) || (roll === 11)) {
        add_flags(0x00000081);
        t.name += '^ (Explosion Device)';
      } else if ((roll >= 12) && (roll <= 14)) {
        add_flags(0x00000101);
        t.name += '^ (Summoning Runes)';
      } else if ((roll >= 15) && (roll <= 17)) {
        add_flags(0x00000071);
        t.name += '^ (Multiple Traps)';
      } else {
        add_flags(0x00000181);
        t.name += '^ (Multiple Traps)';
      }
      break;
    }

    case 10: case 11: case 12: case 13:
      if ((t.tval === 11) || (t.tval === 12)) {
        if (magik(chance)) {
          t.tohit = m_bonus(1, 35, level);
          t.todam = m_bonus(1, 35, level);

          if (magik(special)) {
            switch (randint(10)) {
              case 1: case 2: case 3:
                t.name += ' of Slaying';
                t.tohit += 5;
                t.todam += 5;
                t.cost += 20;
                break;
              case 4: case 5:
                add_flags(0x00040000);
                t.tohit += 2;
                t.todam += 4;
                t.name += ' of Fire';
                t.cost += 25;
                break;
              case 6: case 7:
                add_flags(0x00008000);
                t.tohit += 3;
                t.todam += 3;
                t.name += ' of Slay Evil';
                t.cost += 25;
                break;
              case 8: case 9:
                add_flags(0x01004000);
                t.tohit += 2;
                t.todam += 2;
                t.name += ' of Slay Monster';
                t.cost += 30;
                break;
              case 10:
                add_flags(0x00002000);
                t.tohit += 10;
                t.todam += 10;
                t.name += ' of Dragon Slaying';
                t.cost += 35;
                break;
            }
          }
        } else if (magik(cursed)) {
          t.tohit = -m_bonus(5, 55, level);
          t.todam = -m_bonus(5, 55, level);
          add_flags(0x80000000);
          t.cost = 0;
        }
      }

      t.number = 0;

      for (let i1: number = 1; i1 <= 7; i1++) {
        t.number += randint(6);
      }

      g.missle_ctr++;

      if (g.missle_ctr > 65534) {
        g.missle_ctr = 1;
      }

      t.subval = g.missle_ctr + 512;
      break;
  }
}


// Wand and staff charges by subval: randint(first) + second.
const WAND_CHARGES: readonly (readonly [ number, number ])[] = oneBased([
  [ 10, 6 ], [ 8, 6 ], [ 5, 6 ], [ 8, 6 ], [ 4, 3 ], [ 8, 6 ], [ 20, 12 ], [ 20, 12 ], [ 10, 6 ], [ 12, 6 ],
  [ 10, 12 ], [ 3, 3 ], [ 8, 6 ], [ 10, 6 ], [ 5, 3 ], [ 5, 3 ], [ 5, 6 ], [ 5, 4 ], [ 8, 4 ], [ 6, 2 ],
  [ 4, 2 ], [ 8, 6 ], [ 5, 2 ], [ 12, 12 ],
]);

const STAFF_CHARGES: readonly (readonly [ number, number ])[] = oneBased([
  [ 20, 12 ], [ 8, 6 ], [ 5, 6 ], [ 20, 12 ], [ 15, 6 ], [ 4, 5 ], [ 5, 3 ], [ 3, 1 ], [ 3, 1 ], [ 3, 1 ],
  [ 5, 6 ], [ 10, 12 ], [ 5, 6 ], [ 5, 6 ], [ 5, 6 ], [ 10, 12 ], [ 3, 4 ], [ 5, 6 ], [ 5, 6 ], [ 3, 4 ],
  [ 10, 12 ], [ 3, 4 ], [ 3, 4 ], [ 3, 1 ], [ 10, 6 ],
]);


// misc.inc:1486 place_trap
export function place_trap(y: number, x: number, typ: number, subval: number): void {
  const cur_trap: treasure_type = typ === 1 ? g.trap_lista[subval] : g.trap_listb[subval];
  const cur_pos: IRef<number> = box(0);

  popt(cur_pos);
  g.cave[y][x].tptr = cur_pos.get();
  g.t_list[cur_pos.get()] = clone(cur_trap);
}


// misc.inc:1502 place_rubble
export function place_rubble(y: number, x: number): void {
  const cur_pos: IRef<number> = box(0);

  popt(cur_pos);
  g.cave[y][x].tptr = cur_pos.get();
  g.cave[y][x].fopen = false;
  g.t_list[cur_pos.get()] = clone(g.rubble);
}


function place_door_record(y: number, x: number, door: number, floor: floor_type, fopen: boolean): number {
  const cur_pos: IRef<number> = box(0);

  popt(cur_pos);

  const cell: cave_type = g.cave[y][x];

  cell.tptr = cur_pos.get();
  g.t_list[cur_pos.get()] = clone(g.door_list[door]);
  cell.fval = floor.ftval;
  cell.fopen = fopen;

  return cur_pos.get();
}


// misc.inc:1516 place_open_door
export function place_open_door(y: number, x: number): void {
  place_door_record(y, x, 1, g.corr_floor3, true);
}


// misc.inc:1531 place_broken_door
export function place_broken_door(y: number, x: number): void {
  g.t_list[place_door_record(y, x, 1, g.corr_floor3, true)].p1 = 1;
}


// misc.inc:1547 place_closed_door
export function place_closed_door(y: number, x: number): void {
  place_door_record(y, x, 2, g.corr_floor3, false);
}


// misc.inc:1562 place_locked_door
export function place_locked_door(y: number, x: number): void {
  const cur_pos: number = place_door_record(y, x, 2, g.corr_floor3, false);

  g.t_list[cur_pos].p1 = randint(10) + 10;
}


// misc.inc:1578 place_stuck_door
export function place_stuck_door(y: number, x: number): void {
  const cur_pos: number = place_door_record(y, x, 2, g.corr_floor3, false);

  g.t_list[cur_pos].p1 = -randint(10) - 10;
}


// misc.inc:1594 place_secret_door
export function place_secret_door(y: number, x: number): void {
  place_door_record(y, x, 3, g.corr_floor4, false);
}


// misc.inc:1609 place_door
export function place_door(y: number, x: number): void {
  switch (randint(3)) {
    case 1:
      if (randint(4) === 1) {
        place_broken_door(y, x);
      } else {
        place_open_door(y, x);
      }
      break;
    case 2: {
      const roll: number = randint(12);

      if ((roll === 1) || (roll === 2)) {
        place_locked_door(y, x);
      } else if (roll === 3) {
        place_stuck_door(y, x);
      } else {
        place_closed_door(y, x);
      }
      break;
    }
    case 3:
      place_secret_door(y, x);
      break;
  }
}


function place_stair_record(y: number, x: number, stair: treasure_type): void {
  const cell: cave_type = g.cave[y][x];
  const cur_pos: IRef<number> = box(0);

  if (cell.tptr !== 0) {
    pusht(cell.tptr);
    cell.tptr = 0;
    cell.fopen = true;
  }

  popt(cur_pos);
  g.cave[y][x].tptr = cur_pos.get();
  g.t_list[cur_pos.get()] = clone(stair);
}


// misc.inc:1629 place_up_stairs
export function place_up_stairs(y: number, x: number): void {
  place_stair_record(y, x, g.up_stair);
}


// misc.inc:1646 place_down_stairs
export function place_down_stairs(y: number, x: number): void {
  place_stair_record(y, x, g.down_stair);
}


// misc.inc:1663 place_stairs: 1 is up, 2 is down.
export function place_stairs(typ: number, num: number, walls: number): void {
  let wall_count: number = walls;

  for (let i1: number = 1; i1 <= num; i1++) {
    let flag: boolean = false;

    do {
      let i2: number = 0;

      do {
        let y1: number = randint(g.cur_height - 12);
        let x1: number = randint(g.cur_width - 12);
        const y2: number = y1 + 12;
        const x2: number = x1 + 12;

        do {
          do {
            const cell: cave_type = g.cave[y1][x1];

            if ([ 1, 2, 4 ].includes(cell.fval) && (cell.tptr === 0) && (next_to4(y1, x1, g.wall_set) >= wall_count)) {
              flag = true;

              if (typ === 1) {
                place_up_stairs(y1, x1);
              } else if (typ === 2) {
                place_down_stairs(y1, x1);
              }
            }

            x1++;
          } while (!((x1 === x2) || flag));

          x1 = x2 - 12;
          y1++;
        } while (!((y1 === y2) || flag));

        i2++;
      } while (!(flag || (i2 > 30)));

      wall_count--;
    } while (!flag);
  }
}


// misc.inc:1705 place_gold
export function place_gold(y: number, x: number): void {
  const cur_pos: IRef<number> = box(0);

  popt(cur_pos);

  let i1: number = Math.trunc(real((randint(g.dun_level + 2) + 2) / real(2.0)));

  if (randint(obj_great) === 1) {
    i1 += randint(g.dun_level);
  }

  if (i1 > max_gold) {
    i1 = max_gold;
  }

  g.cave[y][x].tptr = cur_pos.get();
  g.t_list[cur_pos.get()] = clone(g.gold_list[i1]);

  const gold: treasure_type = g.t_list[cur_pos.get()];

  gold.cost = randint(8 * gold.cost) + gold.cost;
}


// misc.inc:1723 get_obj_num
export function get_obj_num(level: number): number {
  let lev: number = level > max_obj_level ? max_obj_level : level;

  if (randint(obj_great) === 1) {
    lev = max_obj_level;
  }

  return lev === 0 ? randint(g.t_level[0]) : randint(g.t_level[lev]);
}


// misc.inc:1739 place_object
export function place_object(y: number, x: number): void {
  const cur_pos: IRef<number> = box(0);

  popt(cur_pos);
  g.cave[y][x].tptr = cur_pos.get();
  g.t_list[cur_pos.get()] = clone(g.object_list[get_obj_num(g.dun_level)]);
  magic_treasure(cur_pos.get(), g.dun_level);
}


// misc.inc:1752 alloc_object: 1 and 2 traps, 3 rubble, 4 gold, 5 an object.
export function alloc_object(alloc_set: obj_set, typ: number, num: number): void {
  for (let i3: number = 1; i3 <= num; i3++) {
    let i1: number;
    let i2: number;

    do {
      i1 = randint(g.cur_height);
      i2 = randint(g.cur_width);
    } while (!(alloc_set.has(g.cave[i1][i2].fval) && (g.cave[i1][i2].tptr === 0)));

    switch (typ) {
      case 1:
        place_trap(i1, i2, 1, randint(max_trapa));
        break;
      case 2:
        place_trap(i1, i2, 2, randint(max_trapb));
        break;
      case 3:
        place_rubble(i1, i2);
        break;
      case 4:
        place_gold(i1, i2);
        break;
      case 5:
        place_object(i1, i2);
        break;
    }
  }
}


// misc.inc:1778 random_object: objects scattered near the given point.
export function random_object(y: number, x: number, num: number): void {
  let remaining: number = num;

  do {
    let i1: number = 0;

    do {
      const i2: number = y - 3 + randint(5);
      const i3: number = x - 4 + randint(7);
      const cell: cave_type = g.cave[i2][i3];

      if (g.floor_set.has(cell.fval) && (cell.tptr === 0)) {
        if (randint(100) < 75) {
          place_object(i2, i3);
        } else {
          place_gold(i2, i3);
        }

        i1 = 9;
      }

      i1++;
    } while (i1 <= 10);

    remaining--;
  } while (remaining !== 0);
}


// misc.inc:1805 cnv_stat: 18/xx is shown without a leading zero, so 18/5 rather than 18/05.
export function cnv_stat(stat: number): string {
  let tmp_str: string;

  if (stat > 18) {
    tmp_str = `${ fmt(18, 2) }/${ fmt(stat - 18, 1) }`;
  } else {
    tmp_str = fmt(stat, 2);
  }

  return pad(tmp_str, ' ', 6);
}


// misc.inc:1827 prt_stat
export function prt_stat(stat_name: string, stat: number, row: number, column: number): void {
  put_buffer(stat_name + cnv_stat(stat), row, column);
}


// misc.inc:1843 prt_field
export function prt_field(info: string, row: number, column: number): void {
  put_buffer(pad(info, ' ', 14), row, column);
}


// misc.inc:1852 prt_num
export function prt_num(header: string, num: number, row: number, column: number): void {
  put_buffer(`${ header }${ fmt(num, 1) } `, row, column);
}


function stat_adjustment(stat: number, steps: readonly (readonly [ number, number ])[], otherwise: number): number {
  const step: readonly [ number, number ] | undefined = steps.find((candidate: readonly [ number, number ]): boolean => stat > candidate[0]);

  return step != null ? step[1] : otherwise;
}


// misc.inc:1865 wis_adj
export function wis_adj(): number {
  return stat_adjustment(g.py.stat.cwis, [ [ 117, 7 ], [ 107, 6 ], [ 87, 5 ], [ 67, 4 ], [ 17, 3 ], [ 14, 2 ], [ 7, 1 ] ], 0);
}


// misc.inc:1887 int_adj
export function int_adj(): number {
  return stat_adjustment(g.py.stat.cint, [ [ 117, 7 ], [ 107, 6 ], [ 87, 5 ], [ 67, 4 ], [ 17, 3 ], [ 14, 2 ], [ 7, 1 ] ], 0);
}


const LOW_CHARISMA_ADJ: Readonly<Record<number, number>> = {
  18: 0.00, 17: 0.01, 16: 0.02, 15: 0.03, 14: 0.04, 13: 0.06, 12: 0.08, 11: 0.10,
  10: 0.12, 9: 0.14, 8: 0.16, 7: 0.18, 6: 0.20, 5: 0.22, 4: 0.24, 3: 0.25,
};


// misc.inc:1910 chr_adj: the percentage change in prices.
export function chr_adj(): number {
  const cchr: number = g.py.stat.cchr;
  let adj: number;

  if (cchr > 18) {
    adj = stat_adjustment(cchr, [ [ 117, -0.10 ], [ 107, -0.08 ], [ 87, -0.06 ], [ 67, -0.04 ] ], -0.02);
  } else {
    adj = LOW_CHARISMA_ADJ[cchr] ?? 0.00;
  }

  return real(adj);
}


// misc.inc:1946 con_adj
export function con_adj(): number {
  const ccon: number = g.py.stat.ccon;
  let adj: number;

  if (ccon === 3) {
    adj = -4;
  } else if (ccon === 4) {
    adj = -3;
  } else if (ccon === 5) {
    adj = -2;
  } else if (ccon === 6) {
    adj = -1;
  } else if (ccon < 17) {
    adj = 0;
  } else if (ccon === 17) {
    adj = 1;
  } else if (ccon < 94) {
    adj = 2;
  } else if (ccon < 117) {
    adj = 3;
  } else {
    adj = 4;
  }

  return adj;
}


// misc.inc:1962 get_hitdie
export function get_hitdie(): number {
  return randint(g.py.misc.hitdie) + con_adj();
}


// misc.inc:1971-2063 the stat block, one field at a time.
export function prt_title(): void {
  prt_field(g.py.misc.title, 5, g.stat_column);
}


export function prt_strength(): void {
  prt_stat('', g.py.stat.cstr, 7, g.stat_column + 6);
}


export function prt_intelligence(): void {
  prt_stat('', g.py.stat.cint, 8, g.stat_column + 6);
}


export function prt_wisdom(): void {
  prt_stat('', g.py.stat.cwis, 9, g.stat_column + 6);
}


export function prt_dexterity(): void {
  prt_stat('', g.py.stat.cdex, 10, g.stat_column + 6);
}


export function prt_constitution(): void {
  prt_stat('', g.py.stat.ccon, 11, g.stat_column + 6);
}


export function prt_charisma(): void {
  prt_stat('', g.py.stat.cchr, 12, g.stat_column + 6);
}


export function prt_level(): void {
  prt_num('', g.py.misc.lev, 14, g.stat_column + 6);
}


export function prt_cmana(): void {
  prt_num('', Math.trunc(g.py.misc.cmana), 16, g.stat_column + 6);
}


export function prt_mhp(): void {
  prt_num('', g.py.misc.mhp, 17, g.stat_column + 6);
}


export function prt_chp(): void {
  prt_num('', Math.trunc(g.py.misc.chp), 18, g.stat_column + 6);
}


export function prt_pac(): void {
  prt_num('', g.py.misc.dis_ac, 20, g.stat_column + 6);
}


export function prt_gold(): void {
  prt_num('', g.py.misc.au, 21, g.stat_column + 6);
}


// misc.inc:2063 prt_depth
export function prt_depth(): void {
  const depth: number = g.dun_level * 50;

  prt(depth === 0 ? 'Town level' : `Depth: ${ fmt(depth, 1) } (feet)`, 24, 61);
}


function prt_status(bit: number, text: string, column: number): void {
  put_buffer((g.py.flags.status & bit) !== 0 ? text : ' '.repeat(text.length), 24, column);
}


// misc.inc:2078-2150 the status line.
export function prt_hunger(): void {
  if ((g.py.flags.status & 0x000002) !== 0) {
    put_buffer('Weak    ', 24, 1);
  } else if ((g.py.flags.status & 0x000001) !== 0) {
    put_buffer('Hungry  ', 24, 1);
  } else {
    put_buffer('        ', 24, 1);
  }
}


export function prt_blind(): void {
  prt_status(0x000004, 'Blind  ', 9);
}


export function prt_confused(): void {
  prt_status(0x000008, 'Confused  ', 16);
}


export function prt_afraid(): void {
  prt_status(0x000010, 'Afraid  ', 26);
}


export function prt_poisoned(): void {
  prt_status(0x000020, 'Poisoned  ', 34);
}


export function prt_search(): void {
  prt_status(0x000100, 'Searching  ', 44);
}


export function prt_rest(): void {
  prt_status(0x000200, 'Resting    ', 44);
}


export function prt_winner(): void {
  put_buffer('*Winner*', 23, 1);
}


// misc.inc:2160 in_statp: up one randomised level.
export function in_statp(stat: number): number {
  let value: number = stat;

  if (value < 18) {
    value++;
  } else if (value < 88) {
    value += randint(25);
  } else if (value < 108) {
    value += randint(10);
  } else {
    value++;
  }

  return Math.min(value, 118);
}


// misc.inc:2177 de_statp: down one randomised level.
export function de_statp(stat: number): number {
  let value: number = stat;

  if (value < 19) {
    value--;
  } else if (value < 109) {
    value = Math.max(value - randint(10) - 5, 18);
  } else {
    value -= randint(3);
  }

  return Math.max(value, 3);
}


// misc.inc:2194 in_statt: up one true level.
export function in_statt(stat: number): number {
  return stat < 18 ? stat + 1 : Math.min(stat + 10, 118);
}


// misc.inc:2209 de_statt: down one true level.
export function de_statt(stat: number): number {
  let value: number;

  if (stat > 27) {
    value = stat - 10;
  } else if (stat > 18) {
    value = 18;
  } else {
    value = Math.max(stat - 1, 3);
  }

  return value;
}


// misc.inc:2225 tohit_adj
export function tohit_adj(): number {
  const cdex: number = g.py.stat.cdex;
  const cstr: number = g.py.stat.cstr;
  let total: number = stat_below(cdex, [ [ 4, -3 ], [ 6, -2 ], [ 8, -1 ], [ 16, 0 ], [ 17, 1 ], [ 18, 2 ], [ 69, 3 ], [ 118, 4 ] ], 5);

  total += stat_below(cstr, [ [ 4, -3 ], [ 5, -2 ], [ 7, -1 ], [ 18, 0 ], [ 94, 1 ], [ 109, 2 ], [ 117, 3 ] ], 4);

  return total;
}


function stat_below(stat: number, steps: readonly (readonly [ number, number ])[], otherwise: number): number {
  const step: readonly [ number, number ] | undefined = steps.find((candidate: readonly [ number, number ]): boolean => stat < candidate[0]);

  return step != null ? step[1] : otherwise;
}


// misc.inc:2254 toac_adj
export function toac_adj(): number {
  const cdex: number = g.py.stat.cdex;
  let adj: number;

  if (cdex < 4) {
    adj = -4;
  } else if (cdex === 4) {
    adj = -3;
  } else if (cdex === 5) {
    adj = -2;
  } else if (cdex === 6) {
    adj = -1;
  } else {
    adj = stat_below(cdex, [ [ 15, 0 ], [ 18, 1 ], [ 59, 2 ], [ 94, 3 ], [ 117, 4 ] ], 5);
  }

  return adj;
}


// misc.inc:2271 todis_adj
export function todis_adj(): number {
  const cdex: number = g.py.stat.cdex;
  const exact: Readonly<Record<number, number>> = { 3: -8, 4: -6, 5: -4, 6: -2, 7: -1 };

  return exact[cdex] ?? stat_below(cdex, [ [ 13, 0 ], [ 16, 1 ], [ 18, 2 ], [ 59, 4 ], [ 94, 5 ], [ 117, 6 ] ], 8);
}


// misc.inc:2290 todam_adj
export function todam_adj(): number {
  return stat_below(g.py.stat.cstr, [ [ 4, -2 ], [ 5, -1 ], [ 16, 0 ], [ 17, 1 ], [ 18, 2 ], [ 94, 3 ], [ 109, 4 ], [ 117, 5 ] ], 6);
}


// misc.inc:2311 prt_stat_block
export function prt_stat_block(): void {
  const misc: player_misc_type = g.py.misc;
  const stat: player_stat_type = g.py.stat;
  const flags: player_flags_type = g.py.flags;

  prt_field(misc.race, 3, g.stat_column);
  prt_field(misc.tclass, 4, g.stat_column);
  prt_field(misc.title, 5, g.stat_column);
  prt_stat('STR : ', stat.cstr, 7, g.stat_column);
  prt_stat('INT : ', stat.cint, 8, g.stat_column);
  prt_stat('WIS : ', stat.cwis, 9, g.stat_column);
  prt_stat('DEX : ', stat.cdex, 10, g.stat_column);
  prt_stat('CON : ', stat.ccon, 11, g.stat_column);
  prt_stat('CHR : ', stat.cchr, 12, g.stat_column);
  prt_num('LEV : ', misc.lev, 14, g.stat_column);
  prt_num('EXP : ', misc.exp, 15, g.stat_column);
  prt_num('MANA: ', Math.trunc(misc.cmana), 16, g.stat_column);
  prt_num('MHP : ', misc.mhp, 17, g.stat_column);
  prt_num('CHP : ', Math.trunc(misc.chp), 18, g.stat_column);
  prt_num('AC  : ', misc.dis_ac, 20, g.stat_column);
  prt_num('GOLD: ', misc.au, 21, g.stat_column);

  if (g.total_winner) {
    prt_winner();
  }

  if ((flags.status & 0x000003) !== 0) {
    prt_hunger();
  }

  if ((flags.status & 0x000004) !== 0) {
    prt_blind();
  }

  if ((flags.status & 0x000008) !== 0) {
    prt_confused();
  }

  if ((flags.status & 0x000010) !== 0) {
    prt_afraid();
  }

  if ((flags.status & 0x000020) !== 0) {
    prt_poisoned();
  }

  if ((flags.status & 0x000100) !== 0) {
    prt_search();
  }

  if ((flags.status & 0x000200) !== 0) {
    prt_rest();
  }
}


// misc.inc:2348 draw_cave
export function draw_cave(): void {
  clear(1, 1);
  prt_stat_block();
  prt_map();
  prt_depth();
}


// misc.inc:2358 put_character
export function put_character(): void {
  const misc: player_misc_type = g.py.misc;

  clear(1, 1);
  prt(`Name      : ${ misc.name }`, 3, 3);
  prt(`Race      : ${ misc.race }`, 4, 3);
  prt(`Sex       : ${ misc.sex }`, 5, 3);
  prt(`Class     : ${ misc.tclass }`, 6, 3);
}


// misc.inc:2372 put_stats
export function put_stats(): void {
  const misc: player_misc_type = g.py.misc;
  const stat: player_stat_type = g.py.stat;

  prt_stat('STR : ', stat.cstr, 3, 65);
  prt_stat('INT : ', stat.cint, 4, 65);
  prt_stat('WIS : ', stat.cwis, 5, 65);
  prt_stat('DEX : ', stat.cdex, 6, 65);
  prt_stat('CON : ', stat.ccon, 7, 65);
  prt_stat('CHR : ', stat.cchr, 8, 65);
  prt_num('+ To Hit   : ', misc.dis_th, 10, 4);
  prt_num('+ To Damage: ', misc.dis_td, 11, 4);
  prt_num('+ To AC    : ', misc.dis_tac, 12, 4);
  prt_num('  Total AC : ', misc.dis_ac, 13, 4);
}


// misc.inc:2391 likert. Anything below -3 falls to the case's otherwise and reads Excellent.
export function likert(x: number, y: number): string {
  const rating: number = Math.trunc(real(x / y));
  let text: string;

  if ((rating >= -3) && (rating <= -1)) {
    text = 'Very Bad';
  } else if ((rating === 0) || (rating === 1)) {
    text = 'Bad';
  } else if (rating === 2) {
    text = 'Poor';
  } else if ((rating === 3) || (rating === 4)) {
    text = 'Fair';
  } else if (rating === 5) {
    text = 'Good';
  } else if (rating === 6) {
    text = 'Very Good';
  } else if ((rating === 7) || (rating === 8)) {
    text = 'Superb';
  } else {
    text = 'Excellent';
  }

  return text;
}


// misc.inc:2407 put_misc1
export function put_misc1(): void {
  const misc: player_misc_type = g.py.misc;

  prt_num('Age          : ', misc.age, 3, 40);
  prt_num('Height       : ', misc.ht, 4, 40);
  prt_num('Weight       : ', misc.wt, 5, 40);
  prt_num('Social Class : ', misc.sc, 6, 40);
}


// misc.inc:2420 put_misc2
export function put_misc2(): void {
  const misc: player_misc_type = g.py.misc;

  prt_num('Level      : ', misc.lev, 10, 31);
  prt_num('Experience : ', misc.exp, 11, 31);
  prt_num('Gold       : ', misc.au, 12, 31);
  prt_num('Max Hit Points : ', misc.mhp, 10, 54);
  prt_num('Cur Hit Points : ', Math.trunc(misc.chp), 11, 54);
  prt_num('Max Mana       : ', misc.mana, 12, 54);
  prt_num('Cur Mana       : ', Math.trunc(misc.cmana), 13, 54);
}


// misc.inc:2436 put_misc3: ratings of the character's abilities.
export function put_misc3(): void {
  const misc: player_misc_type = g.py.misc;
  const xbth: number = misc.bth + misc.lev * bth_lev_adj + misc.ptohit * bth_plus_adj;
  const xbthb: number = misc.bthb + misc.lev * bth_lev_adj + misc.ptohit * bth_plus_adj;
  const xfos: number = Math.max(27 - misc.fos, 0);
  const xsrh: number = misc.srh + int_adj();
  const xstl: number = misc.stl;
  const xdis: number = misc.disarm + misc.lev + 2 * todis_adj() + int_adj();
  const xsave: number = misc.save + misc.lev + wis_adj();
  const xdev: number = misc.save + misc.lev + int_adj();
  const xinfra: string = `${ fmt(g.py.flags.see_infra * 10, 1) } feet`;

  clear(14, 1);
  prt('(Miscellaneous Abilities)', 16, 24);
  put_buffer(`Fighting    : ${ likert(xbth, 12) }`, 17, 2);
  put_buffer(`Bows/Throw  : ${ likert(xbthb, 12) }`, 18, 2);
  put_buffer(`Saving Throw: ${ likert(xsave, 6) }`, 19, 2);
  put_buffer(`Stealth     : ${ likert(xstl, 1) }`, 17, 27);
  put_buffer(`Disarming   : ${ likert(xdis, 8) }`, 18, 27);
  put_buffer(`Magic Device: ${ likert(xdev, 7) }`, 19, 27);
  put_buffer(`Perception  : ${ likert(xfos, 3) }`, 17, 52);
  put_buffer(`Searching   : ${ likert(xsrh, 6) }`, 18, 52);
  put_buffer(`Infra-Vision: ${ xinfra }`, 19, 52);
}


// misc.inc:2469 display_char
export function display_char(): void {
  put_character();
  put_misc1();
  put_stats();
  put_misc2();
  put_misc3();
}


// misc.inc:2482 get_name
export async function get_name(): Promise<void> {
  prt('Enter your player\'s name  [press <RETURN> when finished]', 22, 3);
  await get_string(ref(g.py.misc, 'name'), 3, 15, 24);
  clear(21, 1);
}


// misc.inc:2491 change_name
export async function change_name(): Promise<void> {
  const c: IRef<string> = box('');
  let flag: boolean = false;

  display_char();

  do {
    prt('<c>hange character name.     <ESCAPE> to continue.', 22, 3);
    await inkey(c);

    const code: number = c.get().charCodeAt(0);

    if (code === 99) {
      await get_name();
    } else if ([ 0, 3, 25, 26, 27 ].includes(code)) {
      flag = true;
    }
  } while (!flag);
}


// misc.inc:2511 bpswd: the wizard and god passwords, decoded from wdata with the generator.
export function bpswd(): void {
  const random: Random = rt().random;
  let password1: string = '';
  let password2: string = '';

  random.seed = g.wdata[1][0];

  for (let i1: number = 1; i1 <= 12; i1++) {
    password1 += String.fromCharCode(uxor(g.wdata[1][i1], randint(255)) & 0xFF);
  }

  random.seed = g.wdata[2][0];

  for (let i1: number = 1; i1 <= 12; i1++) {
    password2 += String.fromCharCode(uxor(g.wdata[2][i1], randint(255)) & 0xFF);
  }

  g.password1 = password1;
  g.password2 = password2;
  random.seed = get_seed();
}


// misc.inc:2526 inven_destroy: one of a stack, or the whole item. A copy is left in inven_max.
export function inven_destroy(item_val: number): void {
  g.inventory[inven_max] = clone(g.inventory[item_val]);

  const item: treasure_type = g.inventory[item_val];

  if ((item.number > 1) && (item.subval < 512)) {
    item.number--;
    g.inven_weight -= item.weight;
    g.inventory[inven_max].number = 1;
  } else {
    g.inven_weight -= item.weight * item.number;

    for (let i2: number = item_val; i2 <= g.inven_ctr - 1; i2++) {
      g.inventory[i2] = g.inventory[i2 + 1];
    }

    g.inventory[g.inven_ctr] = clone(g.blank_treasure);
    g.inven_ctr--;
  }
}


// misc.inc:2552 inven_drop
export function inven_drop(item_val: number, y: number, x: number): void {
  const cell: cave_type = g.cave[y][x];
  const i1: IRef<number> = box(0);

  if (cell.tptr > 0) {
    pusht(cell.tptr);
  }

  inven_destroy(item_val);
  popt(i1);
  g.t_list[i1.get()] = clone(g.inventory[inven_max]);
  cell.tptr = i1.get();
}


// misc.inc:2568 inven_damage: destroys items of the given types, each on a percent chance.
export function inven_damage(typ: obj_set, perc: number): number {
  let i2: number = 0;

  for (let i1: number = 1; i1 <= g.inven_ctr; i1++) {
    if (typ.has(g.inventory[i1].tval) && (randint(100) < perc)) {
      inven_destroy(i1);
      i2++;
    }
  }

  return i2;
}


// misc.inc:2589 weight_limit
export function weight_limit(): number {
  return Math.min(g.py.stat.cstr * player_weight_cap + g.py.misc.wt, 3000);
}


// misc.inc:2600 inven_check_weight
export function inven_check_weight(): boolean {
  const item: treasure_type = g.inventory[inven_max];

  return g.inven_weight + item.number * item.weight <= weight_limit();
}


// misc.inc:2615 inven_check_num
export function inven_check_num(): boolean {
  const incoming: treasure_type = g.inventory[inven_max];
  let fits: boolean = false;

  if (g.inven_ctr < 22) {
    fits = true;
  } else if (incoming.subval > 255) {
    for (let i1: number = 1; i1 <= g.inven_ctr; i1++) {
      if ((g.inventory[i1].tval === incoming.tval) && (g.inventory[i1].subval === incoming.subval)) {
        fits = true;
      }
    }
  }

  return fits;
}


// misc.inc:2634 inven_carry: adds inven_max to the pack, sorted by tval; the slot it lands in
// comes back through item_val.
export function inven_carry(item_val: IRef<number>): void {
  const incoming: treasure_type = g.inventory[inven_max];
  const item_num: number = incoming.number;
  const typ: number = incoming.tval;
  const subt: number = incoming.subval;
  const wgt: number = incoming.number * incoming.weight;
  const insert: (pos: number) => void = (pos: number): void => {
    for (let i1: number = g.inven_ctr; i1 >= pos; i1--) {
      g.inventory[i1 + 1] = g.inventory[i1];
    }

    g.inventory[pos] = clone(g.inventory[inven_max]);
    g.inven_ctr++;
    g.inven_weight += wgt;
  };
  let at: number = 0;
  let flag: boolean = false;

  do {
    at++;

    const item: treasure_type = g.inventory[at];

    if (typ === item.tval) {
      if ((subt === item.subval) && (subt > 255)) {
        item.number += item_num;
        g.inven_weight += wgt;
        flag = true;
      }
    } else if (typ > item.tval) {
      insert(at);
      flag = true;
    }
  } while (!((at >= g.inven_ctr) || flag));

  if (!flag) {
    insert(g.inven_ctr + 1);
    at = g.inven_ctr;
  }

  item_val.set(at);
}


// misc.inc:2692 spell_chance
export function spell_chance(spell: spl_rec): void {
  const known: spell_type = g.magic_spell[g.py.misc.pclass][spell.splnum];

  spell.splchn = known.sfail - 3 * (g.py.misc.lev - known.slevel);

  if (g.class[g.py.misc.pclass].mspell) {
    spell.splchn -= 3 * (int_adj() - 1);
  } else {
    spell.splchn -= 3 * (wis_adj() - 1);
  }

  if (known.smana > g.py.misc.cmana) {
    spell.splchn += 5 * Math.trunc(real(known.smana - g.py.misc.cmana));
  }

  if (spell.splchn > 95) {
    spell.splchn = 95;
  } else if (spell.splchn < 5) {
    spell.splchn = 5;
  }
}


// misc.inc:2713 print_new_spells
export function print_new_spells(spell: spl_type, num: number, redraw: IRef<boolean>): void {
  redraw.set(true);
  clear(1, 1);
  prt('   Name                          Level  Mana  %Failure', 2, 1);

  for (let i1: number = 1; i1 <= num; i1++) {
    const known: spell_type = g.magic_spell[g.py.misc.pclass][spell[i1].splnum];

    spell_chance(spell[i1]);
    prt(`${ String.fromCharCode(96 + i1) }) ${ pad(known.sname, ' ', 30) }${ fmt(known.slevel, 3) }    ${ fmt(known.smana, 3) }      ${ fmt(spell[i1].splchn, 2) }`, 2 + i1, 1);
  }
}


// misc.inc:2738 get_spell: sn comes back as the spell number and sc as its chance of failure.
export async function get_spell(spell: spl_type, num: number, sn: IRef<number>, sc: IRef<number>,
                                prompt: string, redraw: IRef<boolean>): Promise<boolean> {
  const out_val1: string = `(Spells a-${ String.fromCharCode(num + 96) }, *=List, <ESCAPE>=exit) ${ prompt }`;
  const choice: IRef<string> = box('');
  let flag: boolean = true;

  sn.set(0);

  while (((sn.get() < 1) || (sn.get() > num)) && flag) {
    prt(out_val1, 1, 1);
    await inkey(choice);
    sn.set(choice.get().charCodeAt(0));

    if ([ 0, 3, 25, 26, 27 ].includes(sn.get())) {
      flag = false;
      g.reset_flag = true;
    } else if (sn.get() === 42) {
      print_new_spells(spell, num, redraw);
    } else {
      sn.set(sn.get() - 96);
    }
  }

  g.msg_flag = false;

  if (flag) {
    spell_chance(spell[sn.get()]);
    sc.set(spell[sn.get()].splchn);
    sn.set(spell[sn.get()].splnum);
  }

  return flag;
}


function new_spell_list(): spl_type {
  return oneBased(Array.from({ length: 22 }, (): spl_rec => ({ splnum: 0, splchn: 0 })));
}


// misc.inc:2777 learn_spell (mages)
export async function learn_spell(redraw: IRef<boolean>): Promise<boolean> {
  const spell: spl_type = new_spell_list();
  let learned: boolean = false;
  let new_spells: number;
  let spell_flag: number = 0;
  let i1: number = 0;

  switch (int_adj()) {
    case 1: case 2: case 3:
      new_spells = 1;
      break;
    case 4: case 5:
      new_spells = randint(2);
      break;
    case 6:
      new_spells = randint(3);
      break;
    case 7:
      new_spells = randint(2) + 1;
      break;
    default:
      new_spells = 0;
      break;
  }

  do {
    i1++;

    if (g.inventory[i1].tval === 90) {
      spell_flag = uor(spell_flag, g.inventory[i1].flags);
    }
  } while (i1 < g.inven_ctr);

  while ((new_spells > 0) && (spell_flag > 0)) {
    const i2: IRef<number> = box(spell_flag);

    i1 = 0;

    do {
      const i3: number = bit_pos(i2);
      const known: spell_type = g.magic_spell[g.py.misc.pclass][i3];

      if ((known.slevel <= g.py.misc.lev) && !known.learned) {
        i1++;
        spell[i1].splnum = i3;
      }
    } while (i2.get() !== 0);

    if (i1 > 0) {
      const sn: IRef<number> = box(0);
      const sc: IRef<number> = box(0);

      print_new_spells(spell, i1, redraw);

      if (await get_spell(spell, i1, sn, sc, 'Learn which spell?', redraw)) {
        g.magic_spell[g.py.misc.pclass][sn.get()].learned = true;
        learned = true;

        if (g.py.misc.mana === 0) {
          g.py.misc.mana = 1;
          g.py.misc.cmana = 1;
        }
      } else {
        new_spells = 0;
      }
    } else {
      new_spells = 0;
    }

    new_spells--;
  }

  return learned;
}


// misc.inc:2842 learn_prayer (priests): the gods choose.
export async function learn_prayer(): Promise<boolean> {
  const test_array: number[] = oneBased(Array.from({ length: 32 }, (): number => 0));
  const spell_flag: IRef<number> = box(0);
  let i1: number = 0;
  let i2: number = 0;
  let new_spell: number = 0;

  do {
    i1++;

    if (g.inventory[i1].tval === 91) {
      spell_flag.set(uor(spell_flag.get(), g.inventory[i1].flags));
    }
  } while (i1 < g.inven_ctr);

  i1 = 0;

  while (spell_flag.get() > 0) {
    i2 = bit_pos(spell_flag);

    const known: spell_type = g.magic_spell[g.py.misc.pclass][i2];

    if ((known.slevel <= g.py.misc.lev) && !known.learned) {
      i1++;
      test_array[i1] = i2;
    }
  }

  // A case with no otherwise: a wis_adj outside 0..7 would leave i2 as it was.
  switch (wis_adj()) {
    case 0:
      i2 = 0;
      break;
    case 1: case 2: case 3:
      i2 = 1;
      break;
    case 4: case 5:
      i2 = randint(2);
      break;
    case 6:
      i2 = randint(3);
      break;
    case 7:
      i2 = randint(2) + 1;
      break;
  }

  while ((i1 > 0) && (i2 > 0)) {
    const i3: number = randint(i1);

    g.magic_spell[g.py.misc.pclass][test_array[i3]].learned = true;
    new_spell++;

    for (let i4: number = i3; i4 <= i1 - 1; i4++) {
      test_array[i4] = test_array[i4 + 1];
    }

    i1--;
    i2--;
  }

  if (new_spell > 0) {
    await msg_print(new_spell > 1 ? 'You learned new prayers!' : 'You learned a new prayer!');

    if (g.py.misc.exp === 0) {
      await msg_print(' ');
    }

    if (g.py.misc.mana === 0) {
      g.py.misc.mana = 1;
      g.py.misc.cmana = 1;
    }
  }

  return new_spell > 0;
}


const ODD_LEVEL_MANA: readonly number[] = [ 0, 1, 1, 1, 2, 2, 3, 4 ];
const EVEN_LEVEL_MANA: readonly number[] = [ 0, 1, 1, 2, 2, 3, 3, 4 ];


// misc.inc:2908 gain_mana: only for someone who knows at least one spell.
export function gain_mana(amount: number): void {
  let knows_spell: boolean = false;

  for (let i1: number = 1; i1 <= 31; i1++) {
    if (g.magic_spell[g.py.misc.pclass][i1].learned) {
      knows_spell = true;
    }
  }

  if (knows_spell) {
    const table: readonly number[] = (g.py.misc.lev % 2) === 1 ? ODD_LEVEL_MANA : EVEN_LEVEL_MANA;
    const new_mana: number = table[amount] ?? 0;

    g.py.misc.mana += new_mana;
    g.py.misc.cmana = real(g.py.misc.cmana + new_mana);
  }
}


// misc.inc:2950 gain_level
export async function gain_level(): Promise<void> {
  const misc: player_misc_type = g.py.misc;
  const nhp: number = get_hitdie();

  misc.mhp += nhp;
  misc.chp = real(misc.chp + nhp);
  misc.lev++;

  const need_exp: number = Math.trunc(real(g.player_exp[misc.lev] * misc.expfact));

  if (misc.exp > need_exp) {
    const dif_exp: number = misc.exp - need_exp;

    misc.exp = need_exp + Math.trunc(dif_exp / 2);
  }

  misc.title = g.player_title[misc.pclass][misc.lev];
  await msg_print(`Welcome to level ${ fmt(misc.lev, 1) }.`);
  await msg_print(' ');
  g.msg_flag = false;
  prt_mhp();
  prt_chp();
  prt_level();
  prt_title();

  const player_class: class_type = g.class[misc.pclass];

  if (player_class.mspell) {
    const redraw: IRef<boolean> = box(false);

    await learn_spell(redraw);

    if (redraw.get()) {
      draw_cave();
    }

    gain_mana(int_adj());
    prt_cmana();
  } else if (player_class.pspell) {
    await learn_prayer();
    gain_mana(wis_adj());
    prt_cmana();
  }
}


// misc.inc:2999 prt_experience
export async function prt_experience(): Promise<void> {
  const misc: player_misc_type = g.py.misc;

  if (misc.exp > g.player_max_exp) {
    misc.exp = g.player_max_exp;
  }

  if (misc.lev < max_player_level) {
    while (Math.trunc(real(g.player_exp[misc.lev] * misc.expfact)) <= misc.exp) {
      await gain_level();
    }

    if (misc.exp > misc.max_exp) {
      misc.max_exp = misc.exp;
    }
  }

  prt_num('', g.py.misc.exp, 15, g.stat_column + 6);
}


// misc.inc:3017 insert_str (insert.mar)
export function insert_str(object_str: string, mtc_str: string, replacement: string): string {
  return macro.insert_str(object_str, mtc_str, replacement);
}


// misc.inc:3026 insert_num: puts a number where mtc_str was, signed if show_sign.
export function insert_num(object_str: string, mtc_str: string, number: number, show_sign: boolean): string {
  const pos: number = index(object_str, mtc_str);
  let result: string = object_str;

  if (pos > 0) {
    const olen: number = object_str.length;
    const mlen: number = mtc_str.length;
    const padded: string = `${ object_str } `;
    const str1: string = substr(padded, 1, pos - 1);
    const str2: string = substr(padded, pos + mlen, olen - (pos + mlen - 1));

    result = ((number >= 0) && show_sign) ? `${ str1 }+${ fmt(number, 1) }${ str2 }` : `${ str1 }${ fmt(number, 1) }${ str2 }`;
  }

  return result;
}


// misc.inc:3053 check_pswd: up to twelve characters without echo, then RETURN.
export async function check_pswd(): Promise<boolean> {
  const x: IRef<string> = box('');
  const tpw: string[] = ' '.repeat(12).split('');
  let i1: number = 0;
  let valid: boolean = false;

  prt('Password : ', 1, 1);

  do {
    await inkey(x);

    if (x.get().charCodeAt(0) !== 13) {
      i1++;
      tpw[i1 - 1] = x.get();
    }
  } while (!((i1 === 12) || (x.get().charCodeAt(0) === 13)));

  const typed: string = tpw.join('');

  if (typed === g.password1) {
    g.wizard1 = true;
    valid = true;
  } else if (typed === g.password2) {
    g.wizard1 = true;
    g.wizard2 = true;
    valid = true;
  }

  g.msg_flag = false;
  erase_line(g.msg_line, g.msg_line);

  return valid;
}


// misc.inc:3090 attack_blows: blows per round for a weapon's weight; wtohit gets the penalty
// for one too heavy to swing.
export function attack_blows(weight: number, wtohit: IRef<number>): number {
  const cstr: number = g.py.stat.cstr;
  const cdex: number = g.py.stat.cdex;
  let blows: number = 1;

  wtohit.set(0);

  if ((cstr * 15) < weight) {
    wtohit.set(-weight);
  } else {
    blows = stat_below(cdex, [ [ 10, 1 ], [ 19, 2 ], [ 68, 3 ], [ 108, 4 ], [ 118, 4 ] ], 5);

    const adj_weight: number = Math.trunc(real((cstr * 10) / weight));

    if (adj_weight < 2) {
      blows = 1;
    } else if (adj_weight < 3) {
      blows = Math.trunc(real(blows / real(3.0)));
    } else if (adj_weight < 4) {
      blows = Math.trunc(real(blows / real(2.5)));
    } else if (adj_weight < 5) {
      blows = Math.trunc(real(blows / real(2.25)));
    } else if (adj_weight < 7) {
      blows = Math.trunc(real(blows / real(2.00)));
    } else if (adj_weight < 9) {
      blows = Math.trunc(real(blows / real(1.75)));
    } else {
      blows = Math.trunc(real(blows / real(1.50)));
    }
  }

  return blows;
}


// misc.inc:3126 critical_blow: weight, pluses to hit and level all raise the chance.
export async function critical_blow(weight: number, plus: number, dam: number): Promise<number> {
  let damage: number = dam;

  if (randint(5000) <= (weight + 5 * plus + 3 * g.py.misc.lev)) {
    const heft: number = weight + randint(650);

    if (heft < 400) {
      damage = 2 * dam + 5;
      await msg_print('It was a good hit! (x2 damage)');
    } else if (heft < 700) {
      damage = 3 * dam + 10;
      await msg_print('It was an excellent hit! (x3 damage)');
    } else if (heft < 900) {
      damage = 4 * dam + 15;
      await msg_print('It was a superb hit! (x4 damage)');
    } else {
      damage = 5 * dam + 20;
      await msg_print('It was a *GREAT* hit! (x5 damage)');
    }
  }

  return damage;
}


const MOVES: readonly (readonly [ number, number ])[] = [
  [ 0, 0 ], [ 1, -1 ], [ 1, 0 ], [ 1, 1 ], [ 0, -1 ], [ 0, 0 ], [ 0, 1 ], [ -1, -1 ], [ -1, 0 ], [ -1, 1 ],
];


// misc.inc:3162 move: the keypad direction from y, x, if it stays on the map.
export function move(dir: number, y: IRef<number>, x: IRef<number>): boolean {
  let moved: boolean = false;

  if ((dir >= 1) && (dir <= 9)) {
    const new_row: number = y.get() + MOVES[dir][0];
    const new_col: number = x.get() + MOVES[dir][1];

    if ((new_row >= 1) && (new_row <= g.cur_height) && (new_col >= 1) && (new_col <= g.cur_width)) {
      y.set(new_row);
      x.set(new_col);
      moved = true;
    }
  }

  return moved;
}


// misc.inc:3216 player_saves
export function player_saves(adjust: number): boolean {
  return randint(100) <= (g.py.misc.save + adjust);
}


// misc.inc:3226 char_inven_init: the class's starting kit.
export function char_inven_init(): void {
  for (let i1: number = 1; i1 <= 5; i1++) {
    const i2: number = g.player_init[g.py.misc.pclass][i1];

    g.inventory[inven_max] = clone(g.inventory_init[i2]);
    inven_carry(box(0));
  }
}
