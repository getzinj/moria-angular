// source/include/prayer.inc: reciting prayers.

import { inven_max } from './constants';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import { damroll, draw_cave, randint } from './misc';
import { aimed, gain_spell_exp, spend_mana } from './magic';
import { cast_spell, find_range, get_item, no_light, teleport } from './moria';
import {
  bless,
  confuse_monster,
  create_food,
  cure_blindness,
  cure_confusion,
  cure_poison,
  detect_evil,
  detect_inv2,
  detect_sdoor,
  detect_trap,
  dispell_creature,
  earthquake,
  fire_ball,
  hp_player,
  light_area,
  map_area,
  protect_evil,
  remove_fear,
  sleep_monsters1,
  slow_poison,
  turn_undead,
  warding_glyph,
} from './spells';
import type { spell_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, pascalSet, uand } from '../runtime/pascal';



async function prayer(choice: number): Promise<void> {
  const row: number = g.char_row;
  const col: number = g.char_col;
  let dir: number | null;

  switch (choice) {
    case 1:
      await detect_evil();
      break;
    case 2:
      await hp_player(damroll('3d3'), 'a prayer.');
      break;
    case 3:
      bless(randint(12) + 12);
      break;
    case 4:
      remove_fear();
      break;
    case 5:
      await light_area(row, col);
      break;
    case 6:
      detect_trap();
      break;
    case 7:
      detect_sdoor();
      break;
    case 8:
      await slow_poison();
      break;
    case 9:
      dir = await aimed();

      if (dir != null) {
        await confuse_monster(dir, row, col);
      }

      break;
    case 10:
      await teleport(g.py.misc.lev * 3);
      break;
    case 11:
      await hp_player(damroll('4d4'), 'a prayer.');
      break;
    case 12:
      bless(randint(24) + 24);
      break;
    case 13:
      await sleep_monsters1(row, col);
      break;
    case 14:
      create_food();
      break;
    case 15:
      for (let i1: number = 1; i1 <= inven_max - 1; i1++) {
        g.inventory[i1].flags = uand(g.inventory[i1].flags, 0x7FFFFFFF);
      }

      break;
    default:
      await prayer_16_on(choice);
  }
}


async function prayer_16_on(choice: number): Promise<void> {
  const row: number = g.char_row;
  const col: number = g.char_col;
  const lev: number = g.py.misc.lev;
  let dir: number | null;

  switch (choice) {
    case 16:
      g.py.flags.resist_heat = g.py.flags.resist_heat + randint(10) + 10;
      g.py.flags.resist_cold = g.py.flags.resist_cold + randint(10) + 10;
      break;
    case 17:
      cure_poison();
      break;
    case 18:
      dir = await aimed();

      if (dir != null) {
        await fire_ball(6, dir, row, col, damroll('3d6') + g.py.misc.lev, 'Black Sphere');
      }

      break;
    case 19:
      await hp_player(damroll('8d4'), 'a prayer.');
      break;
    case 20:
      detect_inv2(randint(24) + 24);
      break;
    case 21:
      protect_evil();
      break;
    case 22:
      await earthquake();
      break;
    case 23:
      map_area();
      break;
    case 24:
      await hp_player(damroll('16d4'), 'a prayer.');
      break;
    case 25:
      await turn_undead();
      break;
    case 26:
      bless(randint(48) + 48);
      break;
    case 27:
      await dispell_creature(0x0008, 3 * lev);
      break;
    case 28:
      await hp_player(200, 'a prayer.');
      break;
    case 29:
      await dispell_creature(0x0004, 3 * lev);
      break;
    case 30:
      warding_glyph();
      break;
    case 31:
      await dispell_creature(0x0004, 4 * lev);
      cure_confusion();
      remove_fear();
      cure_poison();
      cure_blindness();
      await hp_player(1000, 'a prayer.');
      break;
    default:
      break;
  }
}


// prayer.inc:2 pray
export async function pray(): Promise<void> {
  dl.reset_flag = true;

  if (g.py.flags.blind > 0) {
    await msg_print('You can\'t see to read your prayer!');
  } else if (no_light()) {
    await msg_print('You have no light to read by.');
  } else if (g.py.flags.confused > 0) {
    await msg_print('You are too confused...');
  } else if (g.class[g.py.misc.pclass].pspell) {
    await pray_from_book();
  } else {
    await msg_print('Pray hard enough and your prayers may be answered.');
  }
}


async function pray_from_book(): Promise<void> {
  const i1: IRef<number> = box(0);
  const i2: IRef<number> = box(0);

  if ((g.inven_ctr > 0) && find_range(pascalSet(91), i1, i2)) {
    const item_val: IRef<number> = box(0);
    const redraw: IRef<boolean> = box(false);

    if (await get_item(item_val, 'Use which Holy Book?', redraw, i1.get(), i2.get())) {
      const choice: IRef<number> = box(0);
      const chance: IRef<number> = box(0);

      if (await cast_spell('Recite which prayer?', item_val.get(), choice, chance, redraw)) {
        const chosen: spell_type = g.magic_spell[g.py.misc.pclass][choice.get()];

        dl.reset_flag = false;

        if (randint(100) < chance.get()) {
          await msg_print('You lost your concentration!');
        } else {
          await prayer(choice.get());
          await gain_spell_exp(chosen);
        }

        await spend_mana(chosen, 'You faint from fatigue!');
      }
    } else if (redraw.get()) {
      draw_cave();
    }
  } else {
    await msg_print('But you are not carrying any Holy Books!');
  }
}
