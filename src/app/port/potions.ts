// source/include/potions.inc: quaffing potions.

import { identify } from './desc';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import {
  bit_pos,
  damroll,
  draw_cave,
  in_statp,
  inven_destroy,
  learn_prayer,
  learn_spell,
  prt_charisma,
  prt_chp,
  prt_constitution,
  prt_dexterity,
  prt_experience,
  prt_intelligence,
  prt_mhp,
  prt_strength,
  prt_wisdom,
  randint,
} from './misc';
import { add_food, desc_remain, find_range, get_item } from './moria';
import {
  cure_blindness,
  cure_confusion,
  cure_poison,
  detect_inv2,
  detect_monsters,
  hp_player,
  lose_chr,
  lose_exp,
  lose_int,
  lose_str,
  lose_wis,
  remove_fear,
  restore_level,
  slow_poison,
} from './spells';
import type { class_type, player_flags_type, player_misc_type, player_stat_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, div, pascalSet, real, round } from '../runtime/pascal';

type stat_name = 'str' | 'int' | 'wis' | 'dex' | 'con' | 'chr';


// Raises the current stat, and the maximum with it if it passes it.
async function gain(stat: stat_name, message: string, show: () => void): Promise<boolean> {
  const stats: player_stat_type = g.py.stat;
  const current: `c${ stat_name }` = `c${ stat }`;

  stats[current] = in_statp(stats[current]);

  if (stats[current] > stats[stat]) {
    stats[stat] = stats[current];
  }

  await msg_print(message);
  show();

  return true;
}


// Brings the current stat back up to its maximum; null when it already was, leaving ident alone.
async function restore(stat: stat_name, message: string, show: () => void, only_if_lower: boolean): Promise<boolean | null> {
  const stats: player_stat_type = g.py.stat;
  const current: `c${ stat_name }` = `c${ stat }`;
  let ident: boolean | null = null;

  if (!only_if_lower || (stats[current] < stats[stat])) {
    stats[current] = stats[stat];
    await msg_print(message);
    show();
    ident = true;
  }

  return ident;
}


async function potion(i2: number, redraw: IRef<boolean>): Promise<boolean | null> {
  switch (i2) {
    case 1:
      return gain('str', 'Wow!  What bulging muscles!', prt_strength);
    case 2:
      return lose_str();
    case 3:
      return restore('str', 'You feel warm all over.', prt_strength, false);
    case 4:
      return gain('int', 'Aren\'t you brilliant!', prt_intelligence);
    case 5:
      await msg_print('This potion tastes very dull.');

      return lose_int();
    case 6:
      return restore('int', 'You have have a warm feeling.', prt_intelligence, false);
    case 7:
      return gain('wis', 'You suddenly have a profound thought!', prt_wisdom);
    case 8:
      return lose_wis();
    case 9:
      return restore('wis', 'You feel your wisdom returning.', prt_wisdom, true);
    case 10:
      return gain('chr', 'Gee, ain\'t you cute!', prt_charisma);
    case 11:
      return lose_chr();
    case 12:
      return restore('chr', 'You feel your looks returning.', prt_charisma, true);
    case 13:
      return hp_player(damroll('2d7'), 'a potion.');
    case 14:
      return hp_player(damroll('4d7'), 'a potion.');
    case 15:
      return hp_player(damroll('6d7'), 'a potion.');
    case 16:
      return hp_player(1000, 'a potion.');
    default:
      return potion_17_to_31(i2, redraw);
  }
}


async function potion_17_to_31(i2: number, redraw: IRef<boolean>): Promise<boolean | null> {
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;

  switch (i2) {
    case 17:
      return toughness();
    case 18: {
      const i5: number = Math.min(div(misc.exp, 2) + 10, 100000);

      misc.exp += i5;
      await msg_print('You feel more experienced.');
      await prt_experience();

      return true;
    }
    case 19:
      return fall_asleep();
    case 20:
      await msg_print('You are covered by a veil of darkness.');
      flags.blind = flags.blind + randint(100) + 100;

      return true;
    case 21:
      await msg_print('Hey!  This is good stuff!  * Hick! *');
      flags.confused = flags.confused + randint(20) + 12;

      return true;
    case 22:
      await msg_print('You feel very sick.');
      flags.poisoned = flags.poisoned + randint(15) + 10;

      return true;
    case 23:
      flags.fast = flags.fast + randint(25) + 15;

      return true;
    case 24:
      flags.slow = flags.slow + randint(25) + 15;

      return true;
    case 25:
      return detect_monsters();
    case 26:
      return gain('dex', 'You feel more limber!', prt_dexterity);
    case 27:
      return restore('dex', 'You feel less clumsy.', prt_dexterity, true);
    case 28:
      return restore('con', 'You feel your health returning!', prt_constitution, true);
    case 29:
      cure_blindness();

      return null;
    case 30:
      cure_confusion();

      return null;
    case 31:
      cure_poison();

      return null;
    default:
      return potion_32_on(i2, redraw);
  }
}


// Potion 19: Sleep, unless the player has free action.
async function fall_asleep(): Promise<boolean | null> {
  const flags: player_flags_type = g.py.flags;
  let result: boolean | null = null;

  if (!flags.free_act) {
    await msg_print('You fall asleep.');
    flags.paralysis = flags.paralysis + randint(4) + 4;
    result = true;
  }

  return result;
}


// Potion 45: Restore Mana.
async function restore_mana(): Promise<boolean | null> {
  const misc: player_misc_type = g.py.misc;
  let result: boolean | null = null;

  if (misc.cmana < misc.mana) {
    misc.cmana = misc.mana;
    await msg_print('Your feel your head clear...');
    result = true;
  }

  return result;
}


// Potion 17: Constitution, which also heals by the new maximum.
async function toughness(): Promise<boolean> {
  const misc: player_misc_type = g.py.misc;
  const stats: player_stat_type = g.py.stat;

  stats.ccon = in_statp(stats.ccon);

  if (stats.ccon > stats.con) {
    stats.con = stats.ccon;
  }

  misc.mhp++;
  misc.chp = real(misc.chp + misc.mhp);
  await msg_print('You feel tingly for a moment.');
  prt_mhp();
  prt_chp();
  prt_constitution();

  return true;
}


async function potion_32_on(i2: number, redraw: IRef<boolean>): Promise<boolean | null> {
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;

  switch (i2) {
    case 32:
      return learning(redraw);
    case 33: {
      await msg_print('You feel your memories fade...');
      await msg_print('');

      const i4: number = Math.trunc(real(misc.exp / 5.0));

      await lose_exp(randint(i4) + i4);

      return true;
    }
    case 34:
      flags.poisoned = 0;

      if (flags.food > 150) {
        flags.food = 150;
      }

      flags.paralysis = 4;
      await msg_print('The potion makes you vomit!');

      return true;
    case 35:
      flags.invuln = flags.invuln + randint(10) + 10;

      return true;
    case 36:
      flags.hero = flags.hero + randint(25) + 25;

      return true;
    case 37:
      flags.shero = flags.shero + randint(25) + 25;

      return true;
    case 38:
      return remove_fear();
    case 39:
      return restore_level();
    case 40:
      flags.resist_heat = flags.resist_heat + randint(10) + 10;

      return null;
    case 41:
      flags.resist_cold = flags.resist_cold + randint(10) + 10;

      return null;
    case 42:
      detect_inv2(randint(12) + 12);

      return null;
    case 43:
      return slow_poison();
    case 44:
      return cure_poison();
    case 45:
      return restore_mana();
    case 46:
      flags.tim_infra = flags.tim_infra + 100 + randint(100);
      await msg_print('Your eyes begin to tingle.');

      return true;
    default:
      return null;
  }
}


// Potion 32: Learning, a new spell or prayer. A class with neither leaves ident alone.
async function learning(redraw: IRef<boolean>): Promise<boolean | null> {
  const player_class: class_type = g.class[g.py.misc.pclass];
  let result: boolean | null = null;

  if (player_class.mspell) {
    result = await learn_spell(redraw);

    if (redraw.get()) {
      draw_cave();
    }
  } else if (player_class.pspell) {
    result = await learn_prayer();
  }

  return result;
}


// potions.inc:2 quaff. A null from a potion leaves what the earlier effects decided about ident.
export async function quaff(): Promise<void> {
  const i2: IRef<number> = box(0);
  const i3: IRef<number> = box(0);

  dl.reset_flag = true;

  if (g.inven_ctr > 0) {
    if (find_range(pascalSet(75, 76), i2, i3)) {
      await quaff_one(i2.get(), i3.get());
    } else {
      await msg_print('You are not carrying any potions.');
    }
  } else {
    await msg_print('But you are not carrying anything.');
  }
}


async function quaff_one(first_potion: number, last_potion: number): Promise<void> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  if (await get_item(item_val, 'Quaff which potion?', redraw, first_potion, last_potion)) {
    const item: treasure_type = g.inventory[item_val.get()];
    const i1: IRef<number> = box(item.flags);
    let ident: boolean = false;

    if (redraw.get()) {
      draw_cave();
    }

    dl.reset_flag = false;

    while (i1.get() > 0) {
      let i2: number = bit_pos(i1);

      if (item.tval === 76) {
        i2 += 31;
      }

      const effect: boolean | null = await potion(i2, redraw);

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
    await desc_remain(item_val.get());
    inven_destroy(item_val.get());
  } else if (redraw.get()) {
    draw_cave();
  }
}
