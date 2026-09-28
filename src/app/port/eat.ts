// source/include/eat.inc: eating food.

import { identify } from './desc';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import {
  bit_pos,
  damroll,
  draw_cave,
  inven_destroy,
  prt_charisma,
  prt_chp,
  prt_constitution,
  prt_dexterity,
  prt_experience,
  prt_hunger,
  prt_intelligence,
  prt_mhp,
  prt_strength,
  prt_wisdom,
  randint,
} from './misc';
import { add_food, desc_remain, find_range, get_item, take_hit } from './moria';
import {
  cure_blindness,
  cure_confusion,
  cure_poison,
  hp_player,
  lose_chr,
  lose_con,
  lose_dex,
  lose_int,
  lose_str,
  lose_wis,
} from './spells';
import type { player_flags_type, player_misc_type, player_stat_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, pascalSet, real, round, uand } from '../runtime/pascal';

type stat_name = 'str' | 'int' | 'wis' | 'dex' | 'con' | 'chr';


async function restore(stat: stat_name, message: string, show: () => void): Promise<boolean | null> {
  const stats: player_stat_type = g.py.stat;
  const current: `c${ stat_name }` = `c${ stat }`;
  let ident: boolean | null = null;

  if (stats[stat] > stats[current]) {
    stats[current] = stats[stat];
    await msg_print(message);
    show();
    ident = true;
  }

  return ident;
}


function calm(): boolean {
  g.py.flags.afraid = 1;

  return true;
}


// A null leaves ident as the earlier effects set it.
async function food(i2: number, level: number): Promise<boolean | null> {
  const flags: player_flags_type = g.py.flags;

  switch (i2) {
    case 1:
      flags.poisoned = flags.poisoned + randint(10) + level;

      return true;
    case 2:
      flags.blind = flags.blind + randint(250) + 10 * level + 100;
      draw_cave();
      await msg_print('A veil of darkness surrounds you.');

      return true;
    case 3:
      flags.afraid = flags.afraid + randint(10) + level;
      await msg_print('You feel terrified!');

      return true;
    case 4:
      flags.confused = flags.confused + randint(10) + level;
      await msg_print('You feel drugged.');

      return null;
    case 5:
      flags.image = flags.image + randint(200) + 25 * level + 200;

      return null;
    case 6:
      return cure_poison();
    case 7:
      return cure_blindness();
    case 8:
      return (flags.afraid > 1) ? calm() : null;
    case 9:
      return cure_confusion();
    default:
      return food_10_on(i2);
  }
}


async function food_10_on(i2: number): Promise<boolean | null> {
  switch (i2) {
    case 10:
      return lose_str();
    case 11:
      return lose_con();
    case 12:
      return lose_int();
    case 13:
      return lose_wis();
    case 14:
      return lose_dex();
    case 15:
      return lose_chr();
    case 16:
      return restore('str', 'You feel your strength returning.', prt_strength);
    case 17:
      return restore('con', 'You feel your health returning.', prt_constitution);
    case 18:
      return restore('int', 'Your head spins a moment.', prt_intelligence);
    case 19:
      return restore('wis', 'You feel your wisdom returning.', prt_wisdom);
    case 20:
      return restore('dex', 'You more dexteritous.', prt_dexterity);
    case 21:
      return restore('chr', 'Your skins starts itching.', prt_charisma);
    default:
      return food_22_on(i2);
  }
}


async function food_22_on(i2: number): Promise<boolean | null> {
  const misc: player_misc_type = g.py.misc;

  switch (i2) {
    case 22:
      return hp_player(randint(3), 'poisoness food.');
    case 23:
      return hp_player(randint(6), 'poisoness food.');
    case 24:
      return hp_player(randint(12), 'poisoness food.');
    case 25:
      return hp_player(damroll('3d6'), 'poisoness food.');
    case 26:
      return hp_player(damroll('3d12'), 'poisoness food.');
    case 27:
      return hp_player(-randint(4), 'poisoness food.');
    case 28:
      return hp_player(-randint(8), 'poisoness food.');
    case 29:
      return hp_player(-damroll('2d8'), 'poisoness food.');
    case 30:
      return hp_player(-damroll('3d8'), 'poisoness food.');
    case 31:
      misc.mhp--;

      if (misc.mhp < misc.chp) {
        misc.chp = misc.mhp;
      }

      await take_hit(1, 'poisoness food.');
      prt_mhp();
      prt_chp();

      return true;
    default:
      return null;
  }
}


// eat.inc:2 eat
export async function eat(): Promise<void> {
  const i2: IRef<number> = box(0);
  const i3: IRef<number> = box(0);

  dl.reset_flag = true;

  if (g.inven_ctr > 0) {
    if (find_range(pascalSet(80), i2, i3)) {
      await eat_one(i2.get(), i3.get());
    } else {
      await msg_print('You are not carrying any food.');
    }
  } else {
    await msg_print('But you are not carrying anything.');
  }
}


async function eat_one(first_food: number, last_food: number): Promise<void> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  if (await get_item(item_val, 'Eat what?', redraw, first_food, last_food)) {
    const item: treasure_type = g.inventory[item_val.get()];
    const i1: IRef<number> = box(item.flags);
    let ident: boolean = false;

    if (redraw.get()) {
      draw_cave();
    }

    dl.reset_flag = false;

    while (i1.get() > 0) {
      const effect: boolean | null = await food(bit_pos(i1), item.level);

      if (effect != null) {
        ident = effect;
      }
    }

    if (ident) {
      identify(item);
    }

    if (item.flags !== 0) {
      g.py.misc.exp += round(real(item.level / g.py.misc.lev));
      await prt_experience();
    }

    await add_food(item.p1);
    g.py.flags.status = uand(0xFFFFFFFC, g.py.flags.status);
    prt_hunger();
    await desc_remain(item_val.get());
    inven_destroy(item_val.get());
  } else if (redraw.get()) {
    draw_cave();
  }
}
