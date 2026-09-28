// source/include/wands.inc: aiming wands.

import { use_device } from './constants';
import { identify } from './desc';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import { bit_pos, damroll, draw_cave, int_adj, prt_experience, randint } from './misc';
import { desc_charges, find_range, get_dir, get_item } from './moria';
import {
  build_wall,
  clone_monster,
  confuse_monster,
  disarm_all,
  drain_life,
  fire_ball,
  fire_bolt,
  hp_monster,
  light_line,
  poly_monster,
  sleep_monster,
  speed_monster,
  td_destroy2,
  teleport_monster,
  wall_to_mud,
} from './spells';
import type { player_misc_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, pascalSet, real, round } from '../runtime/pascal';


// A null leaves ident as the earlier effects set it; wand 24 picks the next bit at random.
async function wand(i2: number, dir: number, i1: IRef<number>): Promise<boolean | null> {
  const i3: number = g.char_row;
  const i4: number = g.char_col;

  switch (i2) {
    case 1:
      await msg_print('A line of blue shimmering light appears.');
      await light_line(dir, g.char_row, g.char_col);

      return true;
    case 2:
      await fire_bolt(1, dir, i3, i4, damroll('3d8'), 'Lightning Bolt');

      return true;
    case 3:
      await fire_bolt(4, dir, i3, i4, damroll('4d8'), 'Frost Bolt');

      return true;
    case 4:
      await fire_bolt(5, dir, i3, i4, damroll('6d8'), 'Fire Bolt');

      return true;
    case 5:
      return wall_to_mud(dir, i3, i4);
    case 6:
      return poly_monster(dir, i3, i4);
    case 7:
      return hp_monster(dir, i3, i4, -damroll('4d6'));
    case 8:
      return speed_monster(dir, i3, i4, 1);
    case 9:
      return speed_monster(dir, i3, i4, -1);
    case 10:
      return confuse_monster(dir, i3, i4);
    case 11:
      return sleep_monster(dir, i3, i4);
    case 12:
      return drain_life(dir, i3, i4);
    default:
      return wand_13_on(i2, dir, i1);
  }
}


async function wand_13_on(i2: number, dir: number, i1: IRef<number>): Promise<boolean | null> {
  const i3: number = g.char_row;
  const i4: number = g.char_col;

  switch (i2) {
    case 13:
      return td_destroy2(dir, i3, i4);
    case 14:
      await fire_bolt(0, dir, i3, i4, damroll('2d6'), 'Magic Missile');

      return true;
    case 15:
      return build_wall(dir, i3, i4);
    case 16:
      return clone_monster(dir, i3, i4);
    case 17:
      return teleport_monster(dir, i3, i4);
    case 18:
      return disarm_all(dir, i3, i4);
    case 19:
      await fire_ball(1, dir, i3, i4, 24, 'Lightning Ball');

      return true;
    case 20:
      await fire_ball(4, dir, i3, i4, 32, 'Cold Ball');

      return true;
    case 21:
      await fire_ball(5, dir, i3, i4, 48, 'Fire Ball');

      return true;
    case 22:
      await fire_ball(2, dir, i3, i4, 8, 'Stinking Cloud');

      return true;
    case 23:
      await fire_ball(3, dir, i3, i4, 40, 'Acid Ball');

      return true;
    case 24:
      i1.set(2 ** (randint(24) - 1));

      return null;
    default:
      return null;
  }
}


// wands.inc:2 aim
export async function aim(): Promise<void> {
  const i2: IRef<number> = box(0);
  const i3: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  dl.reset_flag = true;

  if (g.inven_ctr > 0) {
    if (find_range(pascalSet(65), i2, i3)) {
      await aim_one(i2.get(), i3.get(), redraw);
    } else {
      await msg_print('You are not carrying any wands.');
    }
  } else {
    await msg_print('But you are not carrying anything.');
  }

  if (redraw.get()) {
    draw_cave();
  }
}


async function aim_one(first_wand: number, last_wand: number, redraw: IRef<boolean>): Promise<void> {
  const item_val: IRef<number> = box(0);

  if (await get_item(item_val, 'Aim which wand?', redraw, first_wand, last_wand)) {
    const dir: IRef<number> = box(0);
    const dumy: IRef<number> = box(0);
    const y_dumy: IRef<number> = box(g.char_row);
    const x_dumy: IRef<number> = box(g.char_col);

    if (redraw.get()) {
      draw_cave();
    }

    dl.reset_flag = false;
    redraw.set(false);

    if (await get_dir('Which direction?', dir, dumy, y_dumy, x_dumy)) {
      await zap(item_val.get(), dir);
    }
  }
}


async function zap(item_val: number, dir: IRef<number>): Promise<void> {
  const item: treasure_type = g.inventory[item_val];
  const misc: player_misc_type = g.py.misc;
  const i1: IRef<number> = box(0);
  let ident: boolean = false;
  let chance: number;

  if (g.py.flags.confused > 0) {
    await msg_print('You are confused...');

    do {
      dir.set(randint(9));
    } while (dir.get() === 5);
  }

  i1.set(item.flags);
  chance = misc.save + misc.lev + int_adj() - item.level;

  if (g.py.flags.confused > 0) {
    chance = Math.trunc(real(chance / 2.0));
  }

  if (chance < 0) {
    chance = 0;
  }

  if (randint(chance) < use_device) {
    await msg_print('You failed to use the wand properly.');
  } else if (item.p1 > 0) {
    item.p1--;

    while (i1.get() > 0) {
      const effect: boolean | null = await wand(bit_pos(i1), dir.get(), i1);

      if (effect != null) {
        ident = effect;
      }
    }

    if (ident) {
      identify(item);
    }

    if (item.flags !== 0) {
      misc.exp += round(real(item.level / misc.lev));
      await prt_experience();
    }

    await desc_charges(item_val);
  }
}
