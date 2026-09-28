// source/include/magic.inc: casting spells.

import { inven_max } from './constants';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import { damroll, de_statp, draw_cave, prt_cmana, prt_constitution, prt_experience, randint } from './misc';
import { cast_spell, find_range, get_dir, get_item, no_light, teleport } from './moria';
import {
  confuse_monster,
  create_food,
  cure_poison,
  destroy_area,
  detect_monsters,
  detect_sdoor,
  detect_trap,
  fire_ball,
  fire_bolt,
  genocide,
  hp_player,
  ident_spell,
  light_area,
  poly_monster,
  recharge,
  sleep_monster,
  sleep_monsters1,
  sleep_monsters2,
  speed_monster,
  td_destroy,
  teleport_monster,
  wall_to_mud,
} from './spells';
import type { player_misc_type, spell_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, pascalSet, real, uand } from '../runtime/pascal';


// Asks for a direction the way every aimed spell and prayer does.
export async function aimed(): Promise<number | null> {
  const dir: IRef<number> = box(0);
  const dumy: IRef<number> = box(0);
  let result: number | null = null;

  if (await get_dir('Which direction?', dir, dumy, box(g.char_row), box(g.char_col))) {
    result = dir.get();
  }

  return result;
}


async function spell(choice: number): Promise<void> {
  const row: number = g.char_row;
  const col: number = g.char_col;
  let dir: number | null;

  switch (choice) {
    case 1:
      dir = await aimed();

      if (dir != null) {
        await fire_bolt(0, dir, row, col, damroll('2d6') + 1, 'Magic Missile');
      }

      break;
    case 2:
      await detect_monsters();
      break;
    case 3:
      await teleport(10);
      break;
    case 4:
      await light_area(row, col);
      break;
    case 5:
      await hp_player(damroll('4d4'), 'a magic spell.');
      break;
    case 6:
      detect_sdoor();
      detect_trap();
      break;
    case 7:
      dir = await aimed();

      if (dir != null) {
        await fire_ball(2, dir, row, col, 9, 'Stinking Cloud');
      }

      break;
    case 8:
      dir = await aimed();

      if (dir != null) {
        await confuse_monster(dir, row, col);
      }

      break;
    case 9:
      dir = await aimed();

      if (dir != null) {
        await fire_bolt(1, dir, row, col, damroll('3d8') + 1, 'Lightning Bolt');
      }

      break;
    case 10:
      td_destroy();
      break;
    default:
      await spell_11_on(choice);
  }
}


async function spell_11_on(choice: number): Promise<void> {
  const row: number = g.char_row;
  const col: number = g.char_col;
  let dir: number | null;

  switch (choice) {
    case 11:
      dir = await aimed();

      if (dir != null) {
        await sleep_monster(dir, row, col);
      }

      break;
    case 12:
      cure_poison();
      break;
    case 13:
      await teleport(g.py.misc.lev * 5);
      break;
    case 14:
      for (let i1: number = 23; i1 <= inven_max - 1; i1++) {
        g.inventory[i1].flags = uand(g.inventory[i1].flags, 0x7FFFFFFF);
      }

      break;
    case 15:
      dir = await aimed();

      if (dir != null) {
        await fire_bolt(4, dir, row, col, damroll('4d8') + 1, 'Frost Bolt');
      }

      break;
    case 16:
      dir = await aimed();

      if (dir != null) {
        await wall_to_mud(dir, row, col);
      }

      break;
    case 17:
      create_food();
      break;
    case 18:
      await recharge(20);
      break;
    case 19:
      await sleep_monsters1(row, col);
      break;
    case 20:
      dir = await aimed();

      if (dir != null) {
        await poly_monster(dir, row, col);
      }

      break;
    default:
      await spell_21_on(choice);
  }
}


async function spell_21_on(choice: number): Promise<void> {
  const row: number = g.char_row;
  const col: number = g.char_col;
  let dir: number | null;

  switch (choice) {
    case 21:
      await ident_spell();
      break;
    case 22:
      await sleep_monsters2();
      break;
    case 23:
      dir = await aimed();

      if (dir != null) {
        await fire_bolt(5, dir, row, col, damroll('6d8') + 1, 'Fire Bolt');
      }

      break;
    case 24:
      dir = await aimed();

      if (dir != null) {
        await speed_monster(dir, row, col, -1);
      }

      break;
    case 25:
      dir = await aimed();

      if (dir != null) {
        await fire_ball(4, dir, row, col, 33, 'Frost Ball');
      }

      break;
    case 26:
      await recharge(50);
      break;
    case 27:
      dir = await aimed();

      if (dir != null) {
        teleport_monster(dir, row, col);
      }

      break;
    case 28:
      g.py.flags.fast = g.py.flags.fast + randint(20) + g.py.misc.lev;
      break;
    case 29:
      dir = await aimed();

      if (dir != null) {
        await fire_ball(5, dir, row, col, 49, 'Fire Ball');
      }

      break;
    case 30:
      await destroy_area(row, col);
      break;
    case 31:
      await genocide();
      break;
    default:
      break;
  }
}


// The first successful casting earns the spell's experience, once.
export async function gain_spell_exp(chosen: spell_type): Promise<void> {
  if (!dl.reset_flag) {
    g.py.misc.exp += chosen.sexp;
    await prt_experience();
    chosen.sexp = 0;
  }
}


// Pays the mana, fainting when there isn't enough. Shared with prayer.inc.
export async function spend_mana(chosen: spell_type, faint: string): Promise<void> {
  const misc: player_misc_type = g.py.misc;

  if (!dl.reset_flag) {
    if (chosen.smana > misc.cmana) {
      await msg_print(faint);
      g.py.flags.paralysis = randint(5 * Math.trunc(real(chosen.smana - misc.cmana)));
      misc.cmana = 0;

      if (randint(3) === 1) {
        await msg_print('You have damaged your health!');
        g.py.stat.ccon = de_statp(g.py.stat.ccon);
        prt_constitution();
      }
    } else {
      misc.cmana = real(misc.cmana - chosen.smana);
    }

    prt_cmana();
  }
}


// magic.inc:2 cast
export async function cast(): Promise<void> {
  dl.reset_flag = true;

  if (g.py.flags.blind > 0) {
    await msg_print('You can\'t see to read your spell book!');
  } else if (no_light()) {
    await msg_print('You have no light to read by.');
  } else if (g.py.flags.confused > 0) {
    await msg_print('You are too confused...');
  } else if (g.class[g.py.misc.pclass].mspell) {
    await cast_from_book();
  } else {
    await msg_print('You can\'t cast spells!');
  }
}


async function cast_from_book(): Promise<void> {
  const i1: IRef<number> = box(0);
  const i2: IRef<number> = box(0);

  if ((g.inven_ctr > 0) && find_range(pascalSet(90), i1, i2)) {
    const item_val: IRef<number> = box(0);
    const redraw: IRef<boolean> = box(false);

    if (await get_item(item_val, 'Use which spell-book?', redraw, i1.get(), i2.get())) {
      const choice: IRef<number> = box(0);
      const chance: IRef<number> = box(0);

      if (await cast_spell('Cast which spell?', item_val.get(), choice, chance, redraw)) {
        const chosen: spell_type = g.magic_spell[g.py.misc.pclass][choice.get()];

        dl.reset_flag = false;

        if (randint(100) < chance.get()) {
          await msg_print('You failed to get the spell off!');
        } else {
          await spell(choice.get());
          await gain_spell_exp(chosen);
        }

        await spend_mana(chosen, 'You faint from the effort!');
      }
    } else if (redraw.get()) {
      draw_cave();
    }
  } else {
    await msg_print('But you are not carrying any spell-books!');
  }
}
