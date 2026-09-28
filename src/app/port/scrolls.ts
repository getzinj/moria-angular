// source/include/scrolls.inc: reading scrolls.

import { inven_max } from './constants';
import { identify, objdes } from './desc';
import { dl } from './dungeon-locals';
import { msg_print } from './io';
import { bit_pos, draw_cave, inven_destroy, prt_experience, randint, summon_monster, summon_undead } from './misc';
import { desc_remain, find_range, get_item, no_light, py_bonuses, teleport } from './moria';
import {
  aggravate_monster,
  bless,
  create_food,
  destroy_area,
  detect_invisible,
  detect_object,
  detect_sdoor,
  detect_trap,
  detect_treasure,
  dispell_creature,
  door_creation,
  enchant,
  genocide,
  ident_spell,
  light_area,
  map_area,
  mass_genocide,
  protect_evil,
  recharge,
  remove_curse,
  sleep_monsters1,
  td_destroy,
  trap_creation,
  unlight_area,
  warding_glyph,
} from './spells';
import type { treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, pascalSet, real, ref, round, uand } from '../runtime/pascal';

// Whether the scroll still vanishes: identify and recharge only do if they worked.
interface IReading {
  item_val: number;
  first: boolean;
  ident: boolean;
}

const ARMOUR_SLOTS: readonly number[] = [ 26, 27, 32, 28, 24 ];
const CURSED_ARMOUR_ORDER: readonly number[] = [ 26, 27, 32, 24, 28 ];


function cursed(slot: number): boolean {
  return uand(0x80000000, g.inventory[slot].flags) !== 0;
}


function uncurse(item: treasure_type): void {
  item.flags = uand(0x7FFFFFFF, item.flags);
  py_bonuses(g.blank_treasure, 0);
}


async function enchant_weapon(field: 'tohit' | 'todam'): Promise<void> {
  const weapon: treasure_type = g.inventory[23];

  if (weapon.tval > 0) {
    await msg_print(`Your ${ objdes(23, false) } glows faintly!`);

    if (enchant(ref(weapon, field))) {
      uncurse(weapon);
    } else {
      await msg_print('The enchantment fails...');
    }
  }
}


// Scroll 3: a random piece of armour, or the cursed one if any is.
async function enchant_armour(): Promise<void> {
  const tmp: number[] = [];
  let i4: number = 0;

  for (const slot of ARMOUR_SLOTS) {
    if (g.inventory[slot].tval > 0) {
      tmp.push(slot);
    }
  }

  if (tmp.length > 0) {
    i4 = tmp[randint(tmp.length) - 1];
  }

  i4 = CURSED_ARMOUR_ORDER.find((slot: number): boolean => cursed(slot)) ?? i4;

  if (i4 > 0) {
    const armour: treasure_type = g.inventory[i4];

    await msg_print(`Your ${ objdes(i4, false) } glows faintly!`);

    if (enchant(ref(armour, 'toac'))) {
      uncurse(armour);
    } else {
      await msg_print('The enchantment fails...');
    }
  }
}


// Scroll 32: *Enchant Weapon*.
async function great_enchant_weapon(): Promise<void> {
  const weapon: treasure_type = g.inventory[23];

  if (weapon.tval > 0) {
    let flag: boolean = false;

    await msg_print(`Your ${ objdes(23, false) } glows brightly!`);

    const hits: number = randint(2);

    for (let i3: number = 1; i3 <= hits; i3++) {
      flag = enchant(ref(weapon, 'tohit')) || flag;
    }

    const dams: number = randint(2);

    for (let i3: number = 1; i3 <= dams; i3++) {
      flag = enchant(ref(weapon, 'todam')) || flag;
    }

    if (flag) {
      uncurse(weapon);
    } else {
      await msg_print('The enchantment fails...');
    }
  }
}


// Scroll 33: Curse Weapon.
async function curse_weapon(): Promise<boolean> {
  const weapon: treasure_type = g.inventory[23];
  let ident: boolean = false;

  if (weapon.tval > 0) {
    g.inventory[inven_max] = clone(weapon);
    await msg_print(`Your ${ objdes(23, false) } glows black, then fades.`);
    weapon.tohit = -randint(5) - randint(5);
    weapon.todam = -randint(5) - randint(5);
    weapon.flags = 0x80000000;
    py_bonuses(g.inventory[inven_max], -1);
    ident = true;
  }

  return ident;
}


// Scroll 34: *Enchant Armor*, the cursed piece first.
async function great_enchant_armour(): Promise<void> {
  let i3: number = CURSED_ARMOUR_ORDER.find((slot: number): boolean => cursed(slot)) ?? 0;

  if (i3 === 0) {
    i3 = [ 26, 27, 24, 28 ].find((slot: number): boolean => g.inventory[slot].tval > 0) ?? 0;
  }

  if (i3 > 0) {
    const armour: treasure_type = g.inventory[i3];
    const times: number = randint(2) + 1;
    let flag: boolean = false;

    await msg_print(`Your ${ objdes(i3, false) } glows brightly!`);

    for (let i: number = 1; i <= times; i++) {
      flag = enchant(ref(armour, 'toac')) || flag;
    }

    if (flag) {
      uncurse(armour);
    } else {
      await msg_print('The enchantment fails...');
    }
  }
}


// Scroll 35: Curse Armor. The chance tests draw only for slots that hold something.
async function curse_armour(): Promise<boolean> {
  const chances: readonly [ number, number ][] = [ [ 26, 4 ], [ 27, 3 ], [ 32, 3 ], [ 24, 3 ], [ 28, 3 ] ];
  let i3: number = 0;
  let ident: boolean = false;

  for (let i: number = 0; (i < chances.length) && (i3 === 0); i++) {
    if ((g.inventory[chances[i][0]].tval > 0) && (randint(chances[i][1]) === 1)) {
      i3 = chances[i][0];
    }
  }

  if (i3 === 0) {
    i3 = CURSED_ARMOUR_ORDER.find((slot: number): boolean => g.inventory[slot].tval > 0) ?? 0;
  }

  if (i3 > 0) {
    const armour: treasure_type = g.inventory[i3];

    g.inventory[inven_max] = clone(armour);
    await msg_print(`Your ${ objdes(i3, false) } glows black, then fades.`);
    armour.flags = 0x80000000;
    armour.toac = -randint(5) - randint(5);
    py_bonuses(g.inventory[inven_max], -1);
    ident = true;
  }

  return ident;
}


function summon_around(count: number, summon: (y: IRef<number>, x: IRef<number>) => void): void {
  for (let i3: number = 1; i3 <= count; i3++) {
    summon(box(g.char_row), box(g.char_col));
  }
}


async function scroll(i2: number, reading: IReading): Promise<void> {
  switch (i2) {
    case 1:
      await enchant_weapon('tohit');
      reading.ident = true;
      break;
    case 2:
      await enchant_weapon('todam');
      reading.ident = true;
      break;
    case 3:
      await enchant_armour();
      reading.ident = true;
      break;
    case 4:
      identify(g.inventory[reading.item_val]);
      await msg_print('This is an identify scroll');
      await msg_print(' ');

      if (await ident_spell()) {
        reading.first = false;
      }

      break;
    case 5:
      if (remove_curse()) {
        await msg_print('You feel as if someone is watching over you.');
        reading.ident = true;
      }

      break;
    case 6:
      reading.ident = await light_area(g.char_row, g.char_col);
      break;
    case 7:
      summon_around(randint(3), (y: IRef<number>, x: IRef<number>): void => {
        summon_monster(y, x, false);
      });
      reading.ident = true;
      break;
    case 8:
      await teleport(10);
      reading.ident = true;
      break;
    case 9:
      await teleport(100);
      reading.ident = true;
      break;
    case 10:
      g.dun_level = Math.max(g.dun_level - 3 + 2 * randint(2), 1);
      dl.moria_flag = true;
      reading.ident = true;
      break;
    case 11:
      await msg_print('Your hands begin to glow.');
      g.py.flags.confuse_monster = true;
      reading.ident = true;
      break;
    default:
      await scroll_12_to_27(i2, reading);
      break;
  }
}


async function scroll_12_to_27(i2: number, reading: IReading): Promise<void> {
  switch (i2) {
    case 12:
      reading.ident = map_area();
      break;
    case 13:
      reading.ident = await sleep_monsters1(g.char_row, g.char_col);
      break;
    case 14:
      reading.ident = warding_glyph();
      break;
    case 15:
      reading.ident = detect_treasure();
      break;
    case 16:
      reading.ident = detect_object();
      break;
    case 17:
      reading.ident = detect_trap();
      break;
    case 18:
      reading.ident = detect_sdoor();
      break;
    case 19:
      await msg_print('This is a mass genocide scroll.');
      await msg_print(' ');
      reading.ident = await mass_genocide();
      break;
    case 20:
      reading.ident = await detect_invisible();
      break;
    case 21:
      reading.ident = aggravate_monster(20);
      await msg_print('There is a high pitched humming noise');
      break;
    case 22:
      reading.ident = trap_creation();
      break;
    case 23:
      reading.ident = td_destroy();
      break;
    case 24:
      reading.ident = door_creation();
      break;
    case 25:
      identify(g.inventory[reading.item_val]);
      await msg_print('This is a Recharge-Item scroll.');
      await msg_print(' ');

      if (await recharge(60)) {
        reading.first = false;
      }

      break;
    case 26:
      await msg_print('This is a genocide scroll.');
      await msg_print(' ');
      reading.ident = await genocide();
      break;
    case 27:
      reading.ident = await unlight_area(g.char_row, g.char_col);
      break;
    default:
      await scroll_28_to_41(i2, reading);
      break;
  }
}


async function scroll_28_to_41(i2: number, reading: IReading): Promise<void> {
  switch (i2) {
    case 28:
      reading.ident = protect_evil();
      break;
    case 29:
      reading.ident = create_food();
      break;
    case 30:
      reading.ident = await dispell_creature(0x0008, 60);
      break;
    case 31:
      await msg_print('That scroll appeared to be blank.');
      reading.ident = true;
      break;
    case 32:
      await great_enchant_weapon();
      reading.ident = true;
      break;
    case 33:
      reading.ident = (await curse_weapon()) || reading.ident;
      break;
    case 34:
      await great_enchant_armour();
      reading.ident = true;
      break;
    case 35:
      reading.ident = (await curse_armour()) || reading.ident;
      break;
    case 36:
      summon_around(randint(3), (y: IRef<number>, x: IRef<number>): void => {
        summon_undead(y, x);
      });
      reading.ident = true;
      break;
    case 37:
      reading.ident = bless(randint(12) + 6);
      break;
    case 38:
      reading.ident = bless(randint(24) + 12);
      break;
    case 39:
      reading.ident = bless(randint(48) + 24);
      break;
    case 40:
      reading.ident = true;
      g.py.flags.word_recall = 25 + randint(30);
      await msg_print('The air about you becomes charged...');
      break;
    case 41:
      reading.ident = await destroy_area(g.char_row, g.char_col);
      break;
  }
}


// scrolls.inc:2 read. The source reads the scroll's flags and level through its `with` on the
// pack slot after inven_destroy, so when the last scroll is gone they are the next item's.
export async function read(): Promise<void> {
  const i2: IRef<number> = box(0);
  const i3: IRef<number> = box(0);

  dl.reset_flag = true;

  if (g.inven_ctr > 0) {
    if (find_range(pascalSet(70, 71), i2, i3)) {
      if (g.py.flags.blind > 0) {
        await msg_print('You can\'t see to read the scroll.');
      } else if (no_light()) {
        await msg_print('You have no light to read by.');
      } else if (g.py.flags.confused > 0) {
        await msg_print('The text seems to swim about the page!');
        await msg_print('You are too confused to read...');
      } else {
        await read_one(i2.get(), i3.get());
      }
    } else {
      await msg_print('You are not carrying any scrolls.');
    }
  } else {
    await msg_print('But you are not carrying anything.');
  }
}


async function read_one(first_scroll: number, last_scroll: number): Promise<void> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  if (await get_item(item_val, 'Read which scroll?', redraw, first_scroll, last_scroll)) {
    const reading: IReading = { item_val: item_val.get(), first: true, ident: false };
    const i1: IRef<number> = box(g.inventory[item_val.get()].flags);

    if (redraw.get()) {
      draw_cave();
    }

    dl.reset_flag = false;

    while (i1.get() > 0) {
      let i2: number = bit_pos(i1);

      if (g.inventory[reading.item_val].tval === 71) {
        i2 += 31;
      }

      if (reading.first && ![ 4, 25 ].includes(i2)) {
        await msg_print('As you read the scroll it vanishes.');
        reading.first = false;
      }

      await scroll(i2, reading);
    }

    if (!dl.reset_flag) {
      await used_up(reading);
    }
  } else if (redraw.get()) {
    draw_cave();
  }
}


async function used_up(reading: IReading): Promise<void> {
  if (reading.ident) {
    identify(g.inventory[reading.item_val]);
  }

  if (!reading.first) {
    await desc_remain(reading.item_val);
    inven_destroy(reading.item_val);

    const slot: treasure_type = g.inventory[reading.item_val];

    if (slot.flags !== 0) {
      g.py.misc.exp += round(real(slot.level / g.py.misc.lev));
      await prt_experience();
    }
  }
}
