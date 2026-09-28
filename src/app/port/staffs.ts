// source/include/staffs.inc: using staffs.

import { use_device } from './constants';
import { identify } from './desc';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import { bit_pos, draw_cave, int_adj, prt_experience, randint, summon_monster } from './misc';
import { desc_charges, find_range, get_item, teleport } from './moria';
import {
  cure_blindness,
  cure_confusion,
  cure_poison,
  destroy_area,
  detect_evil,
  detect_invisible,
  detect_object,
  detect_sdoor,
  detect_trap,
  detect_treasure,
  dispell_creature,
  earthquake,
  genocide,
  hp_player,
  light_area,
  mass_genocide,
  mass_poly,
  remove_curse,
  sleep_monsters2,
  speed_monsters,
  starlite,
  unlight_area,
} from './spells';
import type { player_misc_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, pascalSet, real, round } from '../runtime/pascal';


// A null leaves ident as the earlier effects set it.
async function staff(i2: number): Promise<boolean | null> {
  switch (i2) {
    case 1:
      return light_area(g.char_row, g.char_col);
    case 2:
      return detect_sdoor();
    case 3:
      return detect_trap();
    case 4:
      return detect_treasure();
    case 5:
      return detect_object();
    case 6:
      await teleport(100);

      return true;
    case 7:
      return earthquake();
    case 8: {
      const count: number = randint(4);

      for (let i3: number = 1; i3 <= count; i3++) {
        summon_monster(box(g.char_row), box(g.char_col), false);
      }

      return true;
    }
    case 9:
      return genocide();
    case 10:
      return destroy_area(g.char_row, g.char_col);
    case 11:
      return starlite(g.char_row, g.char_col);
    case 12:
      return speed_monsters(+1);
    default:
      return staff_13_on(i2);
  }
}


async function staff_13_on(i2: number): Promise<boolean | null> {
  switch (i2) {
    case 13:
      return speed_monsters(-1);
    case 14:
      return sleep_monsters2();
    case 15:
      return hp_player(randint(8), 'a staff.');
    case 16:
      return detect_invisible();
    case 17:
      g.py.flags.fast = g.py.flags.fast + randint(30) + 15;

      return true;
    case 18:
      g.py.flags.slow = g.py.flags.slow + randint(30) + 15;

      return true;
    case 19:
      return mass_poly();
    case 20:
      return uncurse();
    case 21:
      return detect_evil();
    case 22:
      return (cure_blindness() || cure_poison() || cure_confusion()) ? true : null;
    case 23:
      return dispell_creature(0x0004, 60);
    case 24:
      return mass_genocide();
    case 25:
      return unlight_area(g.char_row, g.char_col);
    default:
      return null;
  }
}


// Staff 20: Remove Curse.
async function uncurse(): Promise<boolean | null> {
  let result: boolean | null = null;

  if (remove_curse()) {
    await msg_print('The staff glows blue for a moment...');
    result = true;
  }

  return result;
}


// staffs.inc:2 use
export async function use(): Promise<void> {
  const i2: IRef<number> = box(0);
  const i3: IRef<number> = box(0);

  dl.reset_flag = true;

  if (g.inven_ctr > 0) {
    if (find_range(pascalSet(55), i2, i3)) {
      await use_one(i2.get(), i3.get());
    } else {
      await msg_print('You are not carrying any staffs.');
    }
  } else {
    await msg_print('But you are not carrying anything.');
  }
}


async function use_one(first_staff: number, last_staff: number): Promise<void> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  if (await get_item(item_val, 'Use which staff?', redraw, first_staff, last_staff)) {
    if (redraw.get()) {
      draw_cave();
    }

    dl.reset_flag = false;
    await invoke(item_val.get());
  } else if (redraw.get()) {
    draw_cave();
  }
}


async function invoke(item_val: number): Promise<void> {
  const item: treasure_type = g.inventory[item_val];
  const misc: player_misc_type = g.py.misc;
  let chance: number = misc.save + misc.lev + int_adj() - item.level - 5;

  if (g.py.flags.confused > 0) {
    chance = Math.trunc(real(chance / 2.0));
  }

  if (chance < 0) {
    chance = 0;
  }

  if (randint(chance) < use_device) {
    await msg_print('You failed to use the staff properly.');
  } else if (item.p1 > 0) {
    const i1: IRef<number> = box(item.flags);
    let ident: boolean = false;

    item.p1--;

    while (i1.get() > 0) {
      const effect: boolean | null = await staff(bit_pos(i1));

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
