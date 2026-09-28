// source/include/moria.inc: the dungeon loop and the routines nested inside it.

import {
  bth_lev_adj,
  bth_plus_adj,
  inven_max,
  max_sight,
  max_malloc_chance,
  obj$lamp_max,
  outpage_height,
  outpage_width,
  player$regen_faint,
  player$regen_hpbase,
  player$regen_mnbase,
  player$regen_normal,
  player$regen_weak,
  player_food_alert,
  player_food_faint,
  player_food_full,
  player_food_max,
  player_food_weak,
  screen_height,
  screen_width,
} from './constants';
import { known2, objdes } from './desc';
import { dl } from './dungeon-locals';
import { help, ident_char, moria_help, wizard_help } from './help';
import { clear, erase_line, exit, flush, get_com, get_string, inkey, inkey_delay, msg_print, pause, print, prt, put_buffer, put_qio, sleep } from './io';
import {
  alloc_monster,
  alloc_object,
  attack_blows,
  bit_pos,
  check_pswd,
  critical_blow,
  damroll,
  de_statp,
  inven_damage,
  los,
  place_gold,
  place_monster,
  place_rubble,
  prt_winner,
  pushm,
  con_adj,
  change_name,
  de_statt,
  distance,
  draw_cave,
  get_spell,
  in_bounds,
  in_statt,
  int_adj,
  inven_carry,
  inven_check_num,
  inven_check_weight,
  inven_destroy,
  inven_drop,
  loc_symbol,
  move,
  next_to4,
  place_object,
  place_trap,
  popt,
  prt_afraid,
  prt_blind,
  prt_charisma,
  prt_chp,
  prt_cmana,
  prt_confused,
  prt_constitution,
  prt_depth,
  prt_dexterity,
  prt_experience,
  prt_gold,
  prt_hunger,
  prt_intelligence,
  prt_level,
  prt_map,
  prt_mhp,
  prt_pac,
  prt_poisoned,
  prt_rest,
  prt_search,
  prt_strength,
  prt_title,
  prt_wisdom,
  pusht,
  randint,
  summon_monster,
  test_light,
  toac_adj,
  todam_adj,
  todis_adj,
  tohit_adj,
} from './misc';
import { creatures } from './creature';
import { eat } from './eat';
import { cast } from './magic';
import { quaff } from './potions';
import { pray } from './prayer';
import { read } from './scrolls';
import { cure_blindness, cure_confusion, cure_poison, ident_spell, mass_genocide, remove_curse, remove_fear } from './spells';
import { use } from './staffs';
import { aim } from './wands';
import { file_character, print_map, print_monsters, print_objects } from './files';
import { restore_char, save_char } from './save';
import { change_character, game_version, wizard_create, wizard_light } from './wizard';
import { enter_store } from './store2';
import type { cave_type, class_type, creature_type, monster_type, obj_set, player_flags_type, player_misc_type, player_stat_type, spell_type, spl_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, div, fmt, fmtBoolean, index, mod, pad, pascalSet, read_integer, real, ref, substr, uand, uor } from '../runtime/pascal';
import { maxmin, minmax } from '../runtime/macro';
import { NO_SUBPROCESS_MESSAGE } from '../runtime/vms';


// moria.inc:33 change_stat: a stat up or down by amount, for magic items.
function change_stat(stat: IRef<number>, amount: number, factor: number): void {
  const i2: number = amount * factor;
  const i3: number = Math.abs(amount);

  for (let i1: number = 1; i1 <= i3; i1++) {
    if (i2 < 0) {
      stat.set(de_statt(stat.get()));
    } else {
      stat.set(in_statt(stat.get()));
    }
  }
}


// moria.inc:51 change_speed: the player's speed changes by moving every monster's instead.
export function change_speed(num: number): void {
  let i1: number = g.muptr;

  g.py.flags.speed += num;

  while (i1 !== 0) {
    g.m_list[i1].cspeed += num;
    i1 = g.m_list[i1].nptr;
  }
}


// moria.inc:68 py_bonuses: recomputes the player's bonuses as an item goes on (factor 1) or off (-1).
export function py_bonuses(tobj: treasure_type, factor: number): void {
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;

  if (flags.slow_digest) {
    flags.food_digested++;
  }

  if (flags.regenerate) {
    flags.food_digested -= 3;
  }

  flags.see_inv = false;
  flags.teleport = false;
  flags.free_act = false;
  flags.slow_digest = false;
  flags.aggravate = false;
  flags.sustain_str = false;
  flags.sustain_int = false;
  flags.sustain_wis = false;
  flags.sustain_con = false;
  flags.sustain_dex = false;
  flags.sustain_chr = false;
  flags.fire_resist = false;
  flags.acid_resist = false;
  flags.cold_resist = false;
  flags.regenerate = false;
  flags.lght_resist = false;
  flags.ffall = false;

  stat_bonus(tobj, factor, 0x0001, 'cstr', 'str');
  stat_bonus(tobj, factor, 0x0002, 'cdex', 'dex');
  stat_bonus(tobj, factor, 0x0004, 'ccon', 'con');
  stat_bonus(tobj, factor, 0x0008, 'cint', 'int');
  stat_bonus(tobj, factor, 0x0010, 'cwis', 'wis');
  stat_bonus(tobj, factor, 0x0020, 'cchr', 'chr');

  if (uand(0x00000040, tobj.flags) !== 0) {
    misc.srh += tobj.p1 * factor;
    misc.fos -= tobj.p1 * factor;
  }

  if (uand(0x00000100, tobj.flags) !== 0) {
    misc.stl += 2 * factor;
  }

  if (uand(0x00001000, tobj.flags) !== 0) {
    change_speed(-(tobj.p1 * factor));
  }

  if ((uand(0x08000000, tobj.flags) !== 0) && (factor > 0)) {
    flags.blind += 1000;
  }

  if ((uand(0x10000000, tobj.flags) !== 0) && (factor > 0)) {
    flags.afraid += 50;
  }

  if (uand(0x40000000, tobj.flags) !== 0) {
    flags.see_infra += tobj.p1 * factor;
  }

  worn_bonuses();
}


function stat_bonus(tobj: treasure_type, factor: number, bit: number, current: 'cstr' | 'cdex' | 'ccon' | 'cint' | 'cwis' | 'cchr',
                    maximum: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'chr'): void {
  if (uand(bit, tobj.flags) !== 0) {
    change_stat(ref(g.py.stat, current), tobj.p1, factor);
    change_stat(ref(g.py.stat, maximum), tobj.p1, factor);
    g.print_stat = uor(bit, g.print_stat);
  }
}


// The second half of py_bonuses: armour class, to-hit and the flags of everything worn.
function worn_bonuses(): void {
  const misc: player_misc_type = g.py.misc;
  const flags: player_flags_type = g.py.flags;
  const old_dis_ac: number = misc.dis_ac;
  let item_flags: number = 0;

  misc.ptohit = tohit_adj();
  misc.ptodam = todam_adj();
  misc.ptoac = toac_adj();
  misc.pac = 0;
  misc.dis_th = misc.ptohit;
  misc.dis_td = misc.ptodam;
  misc.dis_ac = 0;
  misc.dis_tac = misc.ptoac;

  for (let i1: number = 23; i1 <= inven_max - 2; i1++) {
    const item: treasure_type = g.inventory[i1];

    if (item.tval > 0) {
      if (uand(0x80000000, item.flags) === 0) {
        misc.pac += item.ac;
        misc.dis_ac += item.ac;
      }

      misc.ptohit += item.tohit;
      misc.ptodam += item.todam;
      misc.ptoac += item.toac;

      if (index(item.name, '^') === 0) {
        misc.dis_th += item.tohit;
        misc.dis_td += item.todam;
        misc.dis_tac += item.toac;
      }
    }
  }

  misc.dis_ac += misc.dis_tac;

  if (flags.invuln > 0) {
    misc.pac += 100;
    misc.dis_ac += 100;
  }

  if (flags.blessed > 0) {
    misc.pac += 2;
    misc.dis_ac += 2;
  }

  if (flags.detect_inv > 0) {
    flags.see_inv = true;
  }

  if (old_dis_ac !== misc.dis_ac) {
    g.print_stat = uor(0x0040, g.print_stat);
  }

  for (let i1: number = 23; i1 <= inven_max - 2; i1++) {
    item_flags = uor(item_flags, g.inventory[i1].flags);
  }

  flags.slow_digest ||= uand(0x00000080, item_flags) !== 0;
  flags.aggravate ||= uand(0x00000200, item_flags) !== 0;
  flags.teleport ||= uand(0x00000400, item_flags) !== 0;
  flags.regenerate ||= uand(0x00000800, item_flags) !== 0;
  flags.fire_resist ||= uand(0x00080000, item_flags) !== 0;
  flags.acid_resist ||= uand(0x00100000, item_flags) !== 0;
  flags.cold_resist ||= uand(0x00200000, item_flags) !== 0;
  flags.free_act ||= uand(0x00800000, item_flags) !== 0;
  flags.see_inv ||= uand(0x01000000, item_flags) !== 0;
  flags.lght_resist ||= uand(0x02000000, item_flags) !== 0;
  flags.ffall ||= uand(0x04000000, item_flags) !== 0;

  for (let i1: number = 23; i1 <= inven_max - 2; i1++) {
    const item: treasure_type = g.inventory[i1];

    if (uand(0x00400000, item.flags) !== 0) {
      switch (item.p1) {
        case 1:
          flags.sustain_str = true;
          break;
        case 2:
          flags.sustain_int = true;
          break;
        case 3:
          flags.sustain_wis = true;
          break;
        case 4:
          flags.sustain_con = true;
          break;
        case 5:
          flags.sustain_dex = true;
          break;
        case 6:
          flags.sustain_chr = true;
          break;
      }
    }
  }

  if (flags.slow_digest) {
    flags.food_digested--;
  }

  if (flags.regenerate) {
    flags.food_digested += 3;
  }
}


// moria.inc:259 cur_char1: '*' for a cursed item once it is identified, ')' otherwise.
export function cur_char1(item_val: number): string {
  const item: treasure_type = g.inventory[item_val];
  let result: string;

  if (uand(0x80000000, item.flags) === 0) {
    result = ')';
  } else if (index(item.name, '^') > 0) {
    result = ')';
  } else {
    result = '*';
  }

  return result;
}


// moria.inc:272 cur_char2: '*' for a cursed item, ')' otherwise.
export function cur_char2(item_val: number): string {
  return uand(0x80000000, g.inventory[item_val].flags) === 0 ? ')' : '*';
}


// inven_command's locals, shared by its nested routines.
interface IInvenState {
  scr_state: number;
}


// moria.inc:293 show_inven: inventory items r1 to r2 (r1 = 0 is a dummy call).
function show_inven(state: IInvenState, r1: number, r2: number): void {
  if (r1 > 0) {
    for (let i1: number = r1; i1 <= r2; i1++) {
      prt(`${ String.fromCharCode(i1 + 96) }${ cur_char1(i1) } ${ objdes(i1, true) }`, i1 + 1, 1);
    }

    if (r2 < 22) {
      prt('', r2 + 2, 1);
    }

    state.scr_state = 1;
  }
}


const EQUIPMENT_PLACES: Readonly<Record<number, string>> = {
  23: ' You are wielding   : ',
  24: ' Worn on head       : ',
  25: ' Worn around neck   : ',
  26: ' Worn on body       : ',
  27: ' Worn on arm        : ',
  28: ' Worn on hands      : ',
  29: ' Worn on right hand : ',
  30: ' Worn on left hand  : ',
  31: ' Worn on feet       : ',
  32: ' Worn about body    : ',
  33: ' Light source       : ',
  34: ' Secondary weapon   : ',
};


// moria.inc:312 show_equip: equipment from the r1th piece on.
function show_equip(state: IInvenState, r1: number): void {
  if (r1 > g.equip_ctr) {
    prt('', g.equip_ctr + 3, 1);
  } else if (r1 > 0) {
    let i2: number = 0;

    for (let i1: number = 23; i1 <= inven_max - 1; i1++) {
      if (g.inventory[i1].tval > 0) {
        i2++;

        if (i2 >= r1) {
          const place: string = EQUIPMENT_PLACES[i1] ?? ' Unknown value      : ';

          prt(`${ String.fromCharCode(i2 + 96) }${ cur_char2(i1) }${ place }${ objdes(i1, true) }`, i2 + 2, 1);
        }
      }
    }

    prt('', i2 + 3, 1);
    state.scr_state = 2;
  }
}


// moria.inc:358 remove: a piece of equipment back into the pack, in its sorted place; returns the
// pack slot. Callers make sure the pack has room.
async function remove(item_val: number): Promise<number> {
  const typ: number = g.inventory[item_val].tval;
  let i1: number = 0;
  let flag: boolean = false;
  let prt1: string;

  do {
    i1++;

    if (typ > g.inventory[i1].tval) {
      for (let i2: number = g.inven_ctr; i2 >= i1; i2--) {
        g.inventory[i2 + 1] = g.inventory[i2];
      }

      g.inventory[i1] = clone(g.inventory[item_val]);
      g.inven_ctr++;
      g.equip_ctr--;
      flag = true;
    }
  } while (!flag);

  if ([ 10, 11, 12, 20, 21, 22, 23, 25 ].includes(typ)) {
    prt1 = 'Was wielding ';
  } else if (typ === 15) {
    prt1 = 'Light source was ';
  } else {
    prt1 = 'Was wearing ';
  }

  await msg_print(`${ prt1 }${ objdes(i1, true) } (${ String.fromCharCode(i1 + 96) })`);
  g.inventory[item_val] = clone(g.blank_treasure);

  if (item_val !== inven_max - 1) {
    py_bonuses(g.inventory[i1], -1);
  }

  return i1;
}


const ABORT_KEYS: readonly number[] = [ 0, 3, 25, 26, 27 ];


/** A letter from a to the last, or * to list again; null on ^Z, ESC and the like. */
async function pick_letter(last: number, relist: () => void): Promise<number | null> {
  const key: IRef<string> = box('');
  let result: number | null = null;
  let test_flag: boolean = false;

  do {
    await inkey(key);

    const com_val: number = key.get().charCodeAt(0);

    if (ABORT_KEYS.includes(com_val)) {
      test_flag = true;
    } else if (com_val === 42) {
      relist();
    } else if (((com_val - 96) >= 1) && ((com_val - 96) <= last)) {
      result = com_val - 96;
      test_flag = true;
    }
  } while (!test_flag);

  return result;
}


// moria.inc:395 unwear: take off a piece of equipment.
async function unwear(state: IInvenState): Promise<void> {
  let exit_flag: boolean = false;

  if (state.scr_state === 1) {
    clear(1, 1);
    show_equip(state, 1);
  }

  do {
    let com_val: number = 0;

    await msg_print(`(a-${ String.fromCharCode(g.equip_ctr + 96) }, * for equipment list, ^Z to exit) Take off which one ?`);

    const picked: number | null = await pick_letter(g.equip_ctr, (): void => {
      clear(2, 1);
      show_equip(state, 1);
    });

    if (picked == null) {
      exit_flag = true;
    } else {
      let i1: number = 0;
      let i2: number = 22;

      com_val = picked;
      dl.reset_flag = false;

      do {
        i2++;

        if (g.inventory[i2].tval > 0) {
          i1++;
        }
      } while (i1 !== com_val);

      if (uand(0x80000000, g.inventory[i2].flags) !== 0) {
        await msg_print('Hmmm, it seems to be cursed...');
        com_val = 0;
      } else {
        await remove(i2);
      }
    }

    if ((state.scr_state === 0) || (g.equip_ctr === 0) || (g.inven_ctr > 21)) {
      exit_flag = true;
    } else if (!exit_flag) {
      show_equip(state, com_val);
    }
  } while (!exit_flag);

  if (state.scr_state !== 0) {
    if (g.equip_ctr === 0) {
      clear(1, 1);
    } else {
      prt('You are currently using -', 1, 1);
    }
  }
}


const WEAR_SLOTS: Readonly<Record<number, number>> = {
  10: 23, 11: 23, 12: 23, 15: 33, 20: 23, 21: 23, 22: 23, 23: 23, 25: 23, 30: 31, 31: 28, 32: 32, 33: 24, 34: 27, 35: 26, 36: 26, 40: 25,
};


// moria.inc:468 wear: wear or wield an item from the pack.
async function wear(state: IInvenState): Promise<void> {
  let exit_flag: boolean = false;

  if (state.scr_state === 2) {
    clear(1, 1);
    show_inven(state, 1, g.inven_ctr);
  }

  do {
    let com_val: number = 0;

    await msg_print(`(a-${ String.fromCharCode(g.inven_ctr + 96) }, * for equipment list, ^Z to exit) Wear/Wield which one ?`);

    const picked: number | null = await pick_letter(g.inven_ctr, (): void => {
      clear(2, 1);
      show_inven(state, 1, g.inven_ctr);
    });

    if (picked == null) {
      exit_flag = true;
    } else {
      com_val = await wear_item(picked);
    }

    if ((state.scr_state === 0) || (g.inven_ctr === 0)) {
      exit_flag = true;
    } else if (!exit_flag) {
      show_inven(state, com_val, g.inven_ctr);
    }
  } while (!exit_flag);

  if (state.scr_state !== 0) {
    prt('You are currently carrying -', 1, 1);
  }
}


// The body of wear's main logic: returns com_val, 0 when nothing was worn.
async function wear_item(picked: number): Promise<number> {
  let com_val: number = picked;
  let test_flag: boolean = true;
  let i1: number = WEAR_SLOTS[g.inventory[com_val].tval] ?? 0;

  dl.reset_flag = false;

  if (g.inventory[com_val].tval === 45) {
    i1 = g.inventory[29].tval === 0 ? 29 : 30;
  } else if (i1 === 0) {
    await msg_print('I don\'t see how you can use that.');
    test_flag = false;
    com_val = 0;
  }

  if (test_flag && (g.inventory[i1].tval > 0)) {
    if (uand(0x80000000, g.inventory[i1].flags) !== 0) {
      await msg_print(`The ${ objdes(i1, false) } you are ${ i1 === 23 ? 'wielding ' : 'wearing ' }appears to be cursed.`);
      test_flag = false;
      com_val = 0;
    } else if ((g.inven_ctr > 21) && (g.inventory[com_val].number > 1) && (g.inventory[com_val].subval < 512)) {
      await msg_print('You will have to drop something first.');
      test_flag = false;
      com_val = 0;
    }
  }

  if (test_flag) {
    com_val = await put_on(com_val, i1);
  }

  return com_val;
}


async function put_on(from: number, i1: number): Promise<number> {
  const unwear_obj: treasure_type = clone(g.inventory[i1]);
  let com_val: number = from;
  let prt1: string;

  g.inventory[i1] = clone(g.inventory[com_val]);

  const worn: treasure_type = g.inventory[i1];

  if ((worn.subval > 255) && (worn.subval < 512)) {
    worn.number = 1;
    worn.subval -= 255;
  }

  g.inven_weight += worn.weight * worn.number;
  inven_destroy(com_val);
  g.equip_ctr++;
  py_bonuses(g.inventory[i1], 1);

  if (unwear_obj.tval > 0) {
    g.inventory[inven_max] = unwear_obj;

    const tmp: number = await remove(inven_max);

    if (tmp < com_val) {
      com_val = tmp;
    }
  }

  if (i1 === 23) {
    prt1 = 'You are wielding ';
  } else if (i1 === 33) {
    prt1 = 'Your light source is ';
  } else {
    prt1 = 'You are wearing ';
  }

  const prt2: string = objdes(i1, true);
  let i2: number = 0;
  let i3: number = 22;

  do {
    i3++;

    if (g.inventory[i3].tval > 0) {
      i2++;
    }
  } while (i3 !== i1);

  await msg_print(`${ prt1 }${ prt2 } (${ String.fromCharCode(i2 + 96) }${ cur_char2(i1) }`);

  return com_val;
}


// moria.inc:616 switch_weapon: the primary and secondary weapons change places.
async function switch_weapon(state: IInvenState): Promise<void> {
  if (uand(0x80000000, g.inventory[23].flags) !== 0) {
    await msg_print(`The ${ objdes(23, false) } you are wielding appears to be cursed.`);
  } else {
    const tmp_obj: treasure_type = g.inventory[34];

    dl.reset_flag = false;
    g.inventory[34] = g.inventory[23];
    g.inventory[23] = tmp_obj;
    py_bonuses(g.inventory[34], -1);
    py_bonuses(g.inventory[23], 1);

    if (g.inventory[23].tval > 0) {
      await msg_print(`Primary weapon   : ${ objdes(23, true) }`);
    }

    if (g.inventory[34].tval > 0) {
      await msg_print(`Secondary weapon : ${ objdes(34, true) }`);
    }
  }

  if (state.scr_state !== 0) {
    await msg_print('');
    clear(1, 1);
    prt('You are currently using -', 1, 1);
    show_equip(state, 1);
  }
}


async function inven_step(state: IInvenState, command: string, r1: number, r2: number): Promise<void> {
  switch (command) {
    case 'i':
      if (g.inven_ctr === 0) {
        await msg_print('You are not carrying anything.');
      } else if (state.scr_state !== 1) {
        clear(1, 1);
        prt('You are currently carrying -', 1, 1);
        show_inven(state, 1, g.inven_ctr);
      }

      break;
    case 'e':
      if (g.equip_ctr === 0) {
        await msg_print('You are not using any equipment.');
      } else if (state.scr_state !== 2) {
        clear(1, 1);
        prt('You are currently using -', 1, 1);
        show_equip(state, 1);
      }

      break;
    case 't':
      if (g.equip_ctr === 0) {
        await msg_print('You are not using any equipment.');
      } else if (g.inven_ctr > 21) {
        await msg_print('You will have to drop something first.');
      } else {
        await unwear(state);
      }

      break;
    case 'w':
      if (g.inven_ctr === 0) {
        await msg_print('You are not carrying anything.');
      } else {
        await wear(state);
      }

      break;
    case 'x':
      if ((g.inventory[23].tval !== 0) || (g.inventory[34].tval !== 0)) {
        await switch_weapon(state);
      } else {
        await msg_print('But you are wielding no weapons.');
      }

      break;
    case '?':
      show_inven(state, r1, r2);
      state.scr_state = 0;
      break;
  }
}


// moria.inc:286 inven_command: the inventory and equipment screens; true when the caller must redraw.
export async function inven_command(first: string, r1: number, r2: number): Promise<boolean> {
  const state: IInvenState = { scr_state: 0 };
  const key: IRef<string> = box(first);
  let exit_flag: boolean = false;

  do {
    await inven_step(state, key.get(), r1, r2);

    if (state.scr_state > 0) {
      let test_flag: boolean = false;

      prt('<e>quip, <i>inven, <t>ake-off, <w>ear/wield, e<x>change, or ^Z to exit.', 24, 2);

      do {
        await inkey(key);

        const com_val: number = key.get().charCodeAt(0);

        if ([ 0, 3, 25, 26, 27, 32 ].includes(com_val)) {
          exit_flag = true;
          test_flag = true;
        } else if ([ 'e', 'i', 't', 'w', 'x' ].includes(key.get())) {
          test_flag = true;
        }
      } while (!test_flag);

      prt('', 24, 1);
    } else {
      exit_flag = true;
    }
  } while (!exit_flag);

  return state.scr_state > 0;
}


// moria.inc:749 get_item: an item from the pack between i1 and i2.
export async function get_item(com_val: IRef<number>, pmt: string, redraw: IRef<boolean>, i1: number, i2: number): Promise<boolean> {
  let result: boolean = false;

  com_val.set(0);

  if (g.inven_ctr > 0) {
    const key: IRef<string> = box('');
    let test_flag: boolean = false;

    prt(`(Items ${ String.fromCharCode(i1 + 96) }-${ String.fromCharCode(i2 + 96) }, * for inventory list, ^Z to exit) ${ pmt }`, 1, 1);

    do {
      await inkey(key);
      com_val.set(key.get().charCodeAt(0));

      if (ABORT_KEYS.includes(com_val.get())) {
        test_flag = true;
        dl.reset_flag = true;
      } else if (com_val.get() === 42) {
        clear(2, 1);
        await inven_command('?', i1, i2);
        redraw.set(true);
      } else {
        com_val.set(com_val.get() - 96);

        if ((com_val.get() >= i1) && (com_val.get() <= i2)) {
          test_flag = true;
          result = true;
        }
      }
    } while (!test_flag);

    erase_line(g.msg_line, g.msg_line);
  } else {
    await msg_print('You are not carrying anything.');
  }

  return result;
}


// moria.inc:1959 cast_spell: the spells of the book the player may cast, and the one chosen.
export async function cast_spell(prompt: string, item_val: number, sn: IRef<number>, sc: IRef<number>, redraw: IRef<boolean>): Promise<boolean> {
  const i2: IRef<number> = box(g.inventory[item_val].flags);
  const spell: spl_type = [];
  let i1: number = 0;
  let result: boolean = false;

  do {
    const i3: number = bit_pos(i2);

    if (i3 > 0) {
      const known: spell_type = g.magic_spell[g.py.misc.pclass][i3];

      if ((known.slevel <= g.py.misc.lev) && known.learned) {
        i1++;
        spell[i1] = { splnum: i3, splchn: 0 };
      }
    }
  } while (i2.get() !== 0);

  if (i1 > 0) {
    result = await get_spell(spell, i1, sn, sc, prompt, redraw);
  }

  if (redraw.get()) {
    draw_cave();
  }

  return result;
}


function understands(item: treasure_type): boolean {
  const player_class: class_type = g.class[g.py.misc.pclass];
  let result: boolean;

  if (player_class.mspell) {
    result = item.tval === 90;
  } else if (player_class.pspell) {
    result = item.tval === 91;
  } else {
    result = false;
  }

  return result;
}


// moria.inc:2017 examine_book: the spells in a book, and which the player knows.
async function examine_book(): Promise<void> {
  const i1: IRef<number> = box(0);
  const i3: IRef<number> = box(0);
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  if (find_range(pascalSet(90, 91), i1, i3)) {
    if (await get_item(item_val, 'Which Book?', redraw, i1.get(), i3.get())) {
      if (understands(g.inventory[item_val.get()])) {
        await list_book(item_val.get());
        redraw.set(true);
      } else {
        await msg_print('You do not understand the language.');
      }
    }
  } else {
    await msg_print('You are not carrying any books.');
  }

  if (redraw.get()) {
    draw_cave();
  }
}


async function list_book(item_val: number): Promise<void> {
  const i2: IRef<number> = box(g.inventory[item_val].flags);
  let i1: number = 0;

  clear(1, 1);
  prt('   Name                         Level  Mana   Known', 1, 1);

  do {
    const i3: number = bit_pos(i2);

    if (i3 > 0) {
      const known: spell_type = g.magic_spell[g.py.misc.pclass][i3];

      i1++;

      if (known.slevel < 99) {
        prt(`${ String.fromCharCode(96 + i1) }) ${ pad(known.sname, ' ', 30) }${ fmt(known.slevel, 2) }     ${ fmt(known.smana, 2) }   ${
          fmtBoolean(known.learned, 6) }`, i1 + 1, 1);
      } else {
        prt('', i1 + 1, 1);
      }
    }
  } while (i2.get() !== 0);

  prt('[Press any key to continue]', 24, 20);
  await inkey(box(''));
}


// moria.inc:2140 drop: only one object to a spot.
async function drop(): Promise<void> {
  if (g.inven_ctr > 0) {
    const com_val: IRef<number> = box(0);
    const redraw: IRef<boolean> = box(false);

    if (await get_item(com_val, 'Which one? ', redraw, 1, g.inven_ctr)) {
      if (redraw.get()) {
        draw_cave();
      }

      if (g.cave[g.char_row][g.char_col].tptr > 0) {
        await msg_print('There is something there already.');
      } else {
        inven_drop(com_val.get(), g.char_row, g.char_col);
        await msg_print(`Dropped ${ objdes(inven_max, true) }`);
      }
    } else if (redraw.get()) {
      draw_cave();
    }
  } else {
    await msg_print('You are not carrying anything.');
  }
}


// moria.inc:803 panel_bounds
export function panel_bounds(): void {
  g.panel_row_min = Math.trunc(real(g.panel_row * real(screen_height / 2))) + 1;
  g.panel_row_max = g.panel_row_min + screen_height - 1;
  g.panel_row_prt = g.panel_row_min - 2;
  g.panel_col_min = Math.trunc(real(g.panel_col * real(screen_width / 2))) + 1;
  g.panel_col_max = g.panel_col_min + screen_width - 1;
  g.panel_col_prt = g.panel_col_min - 15;
}


// moria.inc:816 get_panel: true when y,x is off the screen and the panel has moved.
export function get_panel(y: number, x: number): boolean {
  let prow: number = g.panel_row;
  let pcol: number = g.panel_col;
  let changed: boolean = false;

  if ((y < g.panel_row_min + 2) || (y > g.panel_row_max - 2)) {
    prow = Math.min(Math.trunc(real((y - 2) / real(screen_height / 2))), g.max_panel_rows);
  }

  if ((x < g.panel_col_min + 3) || (x > g.panel_col_max - 3)) {
    pcol = Math.min(Math.trunc(real((x - 3) / real(screen_width / 2))), g.max_panel_cols);
  }

  if ((prow !== g.panel_row) || (pcol !== g.panel_col) || !g.cave_flag) {
    g.panel_row = prow;
    g.panel_col = pcol;
    panel_bounds();
    changed = true;
    g.cave_flag = true;
  }

  return changed;
}


// moria.inc:849 panel_contains
export function panel_contains(y: number, x: number): boolean {
  return (y >= g.panel_row_min) && (y <= g.panel_row_max) && (x >= g.panel_col_min) && (x <= g.panel_col_max);
}


// moria.inc:862 no_light
export function no_light(): boolean {
  const cell: cave_type = g.cave[g.char_row][g.char_col];

  return !cell.tl && !cell.pl;
}


// moria.inc:873 get_dir: '5' is not a direction.
export async function get_dir(prompt: string, dir: IRef<number>, com_val: IRef<number>, y: IRef<number>, x: IRef<number>): Promise<boolean> {
  const temp_prompt: string = `(1 2 3 4 6 7 8 9) ${ prompt }`;
  const command: IRef<string> = box('');
  let current_prompt: string = '';
  let flag: boolean = false;
  let result: boolean = false;

  do {
    if (await get_com(current_prompt, command)) {
      com_val.set(command.get().charCodeAt(0));
      dir.set(com_val.get() - 48);

      if ([ 1, 2, 3, 4, 6, 7, 8, 9 ].includes(dir.get())) {
        move(dir.get(), y, x);
        flag = true;
        result = true;
      } else {
        current_prompt = temp_prompt;
      }
    } else {
      dl.reset_flag = true;
      flag = true;
    }
  } while (!flag);

  return result;
}


// moria.inc:910 move_rec: moves the creature record from one spot to another.
export function move_rec(y1: number, x1: number, y2: number, x2: number): void {
  if ((y1 !== y2) || (x1 !== x2)) {
    g.cave[y2][x2].cptr = g.cave[y1][x1].cptr;
    g.cave[y1][x1].cptr = 0;
  }
}


// moria.inc:932 find_light
function find_light(y1: number, x1: number, y2: number, x2: number): void {
  for (let i1: number = y1; i1 <= y2; i1++) {
    for (let i2: number = x1; i2 <= x2; i2++) {
      if ([ 1, 2 ].includes(g.cave[i1][i2].fval)) {
        for (let i3: number = i1 - 1; i3 <= i1 + 1; i3++) {
          for (let i4: number = i2 - 1; i4 <= i2 + 1; i4++) {
            g.cave[i3][i4].pl = true;
          }
        }

        g.cave[i1][i2].fval = 2;
      }
    }
  }
}


// moria.inc:921 light_room: a lit room appears.
export function light_room(y: number, x: number): void {
  const tmp1: number = Math.trunc(real(screen_height / 2));
  const tmp2: number = Math.trunc(real(screen_width / 2));
  const start_row: number = Math.trunc(real(y / tmp1)) * tmp1 + 1;
  const start_col: number = Math.trunc(real(x / tmp2)) * tmp2 + 1;
  const end_row: number = start_row + tmp1 - 1;
  const end_col: number = start_col + tmp2 - 1;
  let xpos: number = 0;

  find_light(start_row, start_col, end_row, end_col);

  for (let i1: number = start_row; i1 <= end_row; i1++) {
    let floor_str: string = '';

    for (let i2: number = start_col; i2 <= end_col; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if (cell.pl || cell.fm) {
        if (floor_str.length === 0) {
          xpos = i2;
        }

        floor_str += loc_symbol(i1, i2);
      } else if (floor_str.length > 0) {
        print(floor_str, i1, xpos);
        floor_str = '';
      }
    }

    if (floor_str.length > 0) {
      print(floor_str, i1, xpos);
    }
  }
}


// moria.inc:983 lite_spot
export function lite_spot(y: number, x: number): void {
  if (panel_contains(y, x)) {
    print(loc_symbol(y, x), y, x);
  }
}


// moria.inc:998 unlite_spot
export function unlite_spot(y: number, x: number): void {
  if (panel_contains(y, x)) {
    print(' ', y, x);
  }
}


/** A screen row assembled from the flagged spots, with the unflagged ones between them kept. */
class RowPrinter {
  private floor_str: string = '';
  private save_str: string = '';
  private xpos: number = 0;


  public add(flag: boolean, tmp_char: string, column: number): void {
    if (flag) {
      if (this.xpos === 0) {
        this.xpos = column;
      }

      this.floor_str += this.save_str + tmp_char;
      this.save_str = '';
    } else if (this.xpos > 0) {
      this.save_str += tmp_char;
    }
  }


  public print(row: number): void {
    if (this.xpos > 0) {
      print(this.floor_str, row, this.xpos);
    }
  }

}


// moria.inc:1028 draw_block: redraws the block between two points.
function draw_block(y1: number, x1: number, y2: number, x2: number): void {
  const topp: number = maxmin(y1, y2, g.panel_row_min);
  const bott: number = minmax(y1, y2, g.panel_row_max);
  const left: number = maxmin(x1, x2, g.panel_col_min);
  const righ: number = minmax(x1, x2, g.panel_col_max);
  const new_topp: number = y2 - 1;
  const new_bott: number = y2 + 1;
  const new_left: number = x2 - 1;
  const new_righ: number = x2 + 1;

  for (let i1: number = topp; i1 <= bott; i1++) {
    const row: RowPrinter = new RowPrinter();

    for (let i2: number = left; i2 <= righ; i2++) {
      const cell: cave_type = g.cave[i1][i2];
      let flag: boolean;
      let tmp_char: string;

      if (cell.pl || cell.fm) {
        flag = ((i1 === y1) && (i2 === x1)) || ((i1 === y2) && (i2 === x2));
      } else {
        flag = true;

        if ((i1 >= new_topp) && (i1 <= new_bott) && (i2 >= new_left) && (i2 <= new_righ) && cell.tl) {
          if (g.pwall_set.has(cell.fval)) {
            cell.pl = true;
          } else if ((cell.tptr > 0) && g.light_set.has(g.t_list[cell.tptr].tval) && !cell.fm) {
            cell.fm = true;
          }
        }
      }

      if (cell.pl || cell.tl || cell.fm) {
        tmp_char = loc_symbol(i1, i2);
      } else {
        tmp_char = ' ';
      }

      if ((g.py.flags.image > 0) && (randint(12) === 1)) {
        tmp_char = String.fromCharCode(randint(95) + 31);
      }

      row.add(flag, tmp_char, i2);
    }

    row.print(i1);
  }
}


function set_lamp(y: number, x: number, lit: boolean): void {
  for (let i1: number = y - 1; i1 <= y + 1; i1++) {
    for (let i2: number = x - 1; i2 <= x + 1; i2++) {
      g.cave[i1][i2].tl = lit;
    }
  }
}


// moria.inc:1107 sub1_move_light: normal movement.
function sub1_move_light(y1: number, x1: number, y2: number, x2: number): void {
  g.light_flag = true;
  set_lamp(y1, x1, false);
  set_lamp(y2, x2, true);
  draw_block(y1, x1, y2, x2);
}


// moria.inc:1122 sub2_move_light: while running, only permanent features light.
function sub2_move_light(y1: number, x1: number, y2: number, x2: number): void {
  if (g.light_flag) {
    set_lamp(y1, x1, false);
    draw_block(y1, x1, y1, x1);
    g.light_flag = false;
  }

  for (let i1: number = y2 - 1; i1 <= y2 + 1; i1++) {
    const row: RowPrinter = new RowPrinter();

    for (let i2: number = x2 - 1; i2 <= x2 + 1; i2++) {
      const cell: cave_type = g.cave[i1][i2];
      let flag: boolean = false;
      let tmp_char: string = ' ';

      if (!(cell.fm || cell.pl)) {
        if (dl.player_light) {
          if (g.pwall_set.has(cell.fval)) {
            cell.pl = true;
            tmp_char = loc_symbol(i1, i2);
            flag = true;
          } else if ((cell.tptr > 0) && g.light_set.has(g.t_list[cell.tptr].tval)) {
            cell.fm = true;
            tmp_char = loc_symbol(i1, i2);
            flag = true;
          }
        }
      } else {
        tmp_char = loc_symbol(i1, i2);
      }

      row.add(flag, tmp_char, i2);
    }

    row.print(i1);
  }
}


// moria.inc:1189 sub3_move_light: when blind, only the player's symbol moves.
function sub3_move_light(y1: number, x1: number, y2: number, x2: number): void {
  if (g.light_flag) {
    set_lamp(y1, x1, false);
    g.light_flag = false;
  }

  print(' ', y1, x1);
  print('@', y2, x2);
}


// moria.inc:1205 sub4_move_light: moving with no light.
function sub4_move_light(y1: number, x1: number, y2: number, x2: number): void {
  g.light_flag = true;

  if (g.cave[y1][x1].tl) {
    for (let i1: number = y1 - 1; i1 <= y1 + 1; i1++) {
      for (let i2: number = x1 - 1; i2 <= x1 + 1; i2++) {
        g.cave[i1][i2].tl = false;

        if (test_light(i1, i2)) {
          lite_spot(i1, i2);
        } else {
          unlite_spot(i1, i2);
        }
      }
    }
  } else if (test_light(y1, x1)) {
    lite_spot(y1, x1);
  } else {
    unlite_spot(y1, x1);
  }

  print('@', y2, x2);
}


// moria.inc:1007 move_light: the character's light, normal, running, blind or with none.
export function move_light(y1: number, x1: number, y2: number, x2: number): void {
  if (g.py.flags.blind > 0) {
    sub3_move_light(y1, x1, y2, x2);
  } else if (g.find_flag) {
    sub2_move_light(y1, x1, y2, x2);
  } else if (!dl.player_light) {
    sub4_move_light(y1, x1, y2, x2);
  } else {
    sub1_move_light(y1, x1, y2, x2);
  }
}


// moria.inc:1243 new_spot: random open, empty co-ordinates.
function new_spot(y: IRef<number>, x: IRef<number>): void {
  do {
    y.set(randint(g.cur_height));
    x.set(randint(g.cur_width));
  } while (!(g.cave[y.get()][x.get()].fopen && (g.cave[y.get()][x.get()].cptr === 0) && (g.cave[y.get()][x.get()].tptr === 0)));
}


// moria.inc:1255 search_on
export function search_on(): void {
  dl.search_flag = true;
  change_speed(1);
  g.py.flags.status = uor(g.py.flags.status, 0x00000100);
  prt_search();
  g.py.flags.food_digested++;
}


// moria.inc:1265 search_off
export async function search_off(): Promise<void> {
  dl.search_flag = false;
  g.find_flag = false;
  await move_char(5);
  change_speed(-1);
  g.py.flags.status = uand(g.py.flags.status, 0xFFFFFEFF);
  prt_search();
  g.py.flags.food_digested--;
}


// moria.inc:1279 rest
async function rest(): Promise<void> {
  const rest_str: IRef<string> = box('');
  let rest_num: number = 0;

  prt('Rest for how long? ', 1, 1);
  await get_string(rest_str, 1, 20, 10);

  rest_num = read_integer(rest_str.get(), rest_num);

  if (rest_num > 0) {
    if (dl.search_flag) {
      await search_off();
    }

    g.py.flags.rest = rest_num;
    g.py.flags.status = uor(g.py.flags.status, 0x00000200);
    prt_rest();
    g.py.flags.food_digested--;
    await msg_print('Press any key to wake up...');
    put_qio();
  } else {
    erase_line(g.msg_line, g.msg_line);
  }
}


// moria.inc:1304 rest_off
export function rest_off(): void {
  g.py.flags.rest = 0;
  g.py.flags.status = uand(g.py.flags.status, 0xFFFFFDFF);
  erase_line(1, 1);
  prt_rest();
  g.py.flags.food_digested++;
}


// moria.inc:1316 test_hit: attacker's level and pluses against the defender's AC.
export async function test_hit(bth: number, level: number, pth: number, ac: number): Promise<boolean> {
  if (dl.search_flag) {
    await search_off();
  }

  if (g.py.flags.rest > 0) {
    rest_off();
  }

  const i1: number = bth + level * bth_lev_adj + pth * bth_plus_adj;

  return (randint(i1) > ac) || (randint(20) === 1);
}


// moria.inc:1336 take_hit: hit points down, and death when they run out.
export async function take_hit(damage: number, hit_from: string): Promise<void> {
  const taken: number = g.py.flags.invuln > 0 ? 0 : damage;

  g.py.misc.chp = real(g.py.misc.chp - taken);

  if (dl.search_flag) {
    await search_off();
  }

  if (g.py.flags.rest > 0) {
    rest_off();
  }

  flush();

  if (g.py.misc.chp <= -1) {
    if (!g.death) {
      g.death = true;
      g.died_from = hit_from;
      g.total_winner = false;
    }

    dl.moria_flag = true;
  } else {
    prt_chp();
  }
}


// moria.inc:1361 movement_rate: moves this turn; the player always moves at least once, and a
// slowed player is handled by speeding the monsters up.
export function movement_rate(speed: number): number {
  let result: number;

  if (speed > 0) {
    result = g.py.flags.rest > 0 ? 1 : speed;
  } else {
    result = mod(g.turn, Math.abs(speed) + 2) === 0 ? 1 : 0;
  }

  return result;
}


// moria.inc:1379 regenhp
function regenhp(percent: number): void {
  const misc: player_misc_type = g.py.misc;

  misc.chp = real(real(misc.chp + real(misc.mhp * percent)) + player$regen_hpbase);
}


// moria.inc:1387 regenmana
function regenmana(percent: number): void {
  const misc: player_misc_type = g.py.misc;

  misc.cmana = real(real(misc.cmana + real(misc.mana * percent)) + player$regen_mnbase);
}


// moria.inc:1396 change_trap: an invisible trap or secret door becomes visible.
export function change_trap(y: number, x: number): void {
  const cell: cave_type = g.cave[y][x];

  if ([ 101, 109 ].includes(g.t_list[cell.tptr].tval)) {
    const i3: number = cell.tptr;

    place_trap(y, x, 2, g.t_list[i3].subval);
    pusht(i3);
    lite_spot(y, x);
  }
}


// moria.inc:1412 search: for hidden traps, secret doors and trapped chests.
export async function search(y: number, x: number, base_chance: number): Promise<void> {
  const flags: player_flags_type = g.py.flags;
  let chance: number = base_chance;

  if (flags.confused + flags.blind > 0) {
    chance = Math.trunc(real(chance / 10.0));
  } else if (no_light()) {
    chance = Math.trunc(real(chance / 5.0));
  }

  for (let i1: number = y - 1; i1 <= y + 1; i1++) {
    for (let i2: number = x - 1; i2 <= x + 1; i2++) {
      if (in_bounds(i1, i2) && ((i1 !== y) || (i2 !== x)) && (randint(100) < chance)) {
        const cell: cave_type = g.cave[i1][i2];

        if (cell.tptr > 0) {
          const item: treasure_type = g.t_list[cell.tptr];

          if (item.tval === 101) {
            await msg_print(`You have found ${ item.name }.`);
            change_trap(i1, i2);
            g.find_flag = false;
          } else if (item.tval === 109) {
            await msg_print('You have found a secret door.');
            cell.fval = g.corr_floor2.ftval;
            change_trap(i1, i2);
            g.find_flag = false;
          } else if (item.tval === 2) {
            if ((item.flags > 1) && (index(item.name, '^') > 0)) {
              item.name = known2(item.name);
              await msg_print('You have discovered a trap on the chest!');
            }
          }
        }
      }
    }
  }
}


const AREA_DIRECTIONS: Readonly<Record<number, readonly number[]>> = {
  1: [ 4, 1, 3 ],
  2: [ 4, 2, 6 ],
  3: [ 2, 3, 6 ],
  4: [ 8, 4, 2 ],
  6: [ 2, 6, 8 ],
  7: [ 8, 7, 4 ],
  8: [ 4, 8, 6 ],
  9: [ 8, 9, 6 ],
};


// moria.inc:1461 area_affect: running stops when something interesting appears. The source admits
// it misses corridor and room corners.
function area_affect(dir: number, y: number, x: number): void {
  if ((g.cave[y][x].fval === 4) && (next_to4(y, x, pascalSet(4, 5, 6)) > 2)) {
    g.find_flag = false;
  }

  if (g.find_flag && (g.py.flags.blind < 1)) {
    const z: readonly number[] = AREA_DIRECTIONS[dir] ?? [];

    for (let i1: number = 0; i1 < z.length; i1++) {
      const row: IRef<number> = box(y);
      const col: IRef<number> = box(x);

      if (move(z[i1], row, col)) {
        stop_for(g.cave[row.get()][col.get()]);
      }
    }
  }
}


function stop_for(cell: cave_type): void {
  if (cell.fval === 5) {
    g.find_flag = false;
  }

  if (g.find_flag && (dl.player_light || cell.tl || cell.pl || cell.fm)) {
    if ((cell.tptr > 0) && ![ 101, 109 ].includes(g.t_list[cell.tptr].tval)) {
      g.find_flag = false;
    }
  }

  if (g.find_flag && (cell.tl || cell.pl || dl.player_light) && (cell.cptr > 1) && g.m_list[cell.cptr].ml) {
    g.find_flag = false;
  }
}


const PICK_DIRECTIONS: Readonly<Record<number, readonly number[]>> = {
  1: [ 2, 4 ],
  2: [ 4, 6 ],
  3: [ 2, 6 ],
  4: [ 2, 8 ],
  6: [ 2, 8 ],
  7: [ 4, 8 ],
  8: [ 4, 6 ],
  9: [ 6, 8 ],
};


// moria.inc:1553 pick_dir: a new direction for running round a corridor bend.
function pick_dir(dir: number): boolean {
  let result: boolean = false;

  if (g.find_flag && (next_to4(g.char_row, g.char_col, g.corr_set) === 2)) {
    const z: readonly number[] = PICK_DIRECTIONS[dir] ?? [];

    for (let i1: number = 0; i1 < z.length; i1++) {
      const y: IRef<number> = box(g.char_row);
      const x: IRef<number> = box(g.char_col);

      if (move(z[i1], y, x) && g.cave[y.get()][x.get()].fopen) {
        result = true;
        g.com_val = z[i1] + 48;
      }
    }
  }

  return result;
}


// moria.inc:1753 teleport
export async function teleport(dis: number): Promise<void> {
  let y: number;
  let x: number;

  do {
    y = randint(g.cur_height);
    x = randint(g.cur_width);

    while (distance(y, x, g.char_row, g.char_col) > dis) {
      y += Math.trunc(real((g.char_row - y) / 2));
      x += Math.trunc(real((g.char_col - x) / 2));
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
  dl.teleport_flag = false;
}


// moria.inc:1617 minus_ac: a random piece of worn armour loses a point of AC, unless it resists.
async function minus_ac(typ_dam: number): Promise<boolean> {
  const tmp: number[] = [];
  let result: boolean = false;

  for (const slot of [ 26, 27, 32, 28, 24 ]) {
    if (g.inventory[slot].tval > 0) {
      tmp.push(slot);
    }
  }

  if (tmp.length > 0) {
    const i2: number = tmp[randint(tmp.length) - 1];
    const item: treasure_type = g.inventory[i2];

    if (uand(item.flags, typ_dam) !== 0) {
      await msg_print(`Your ${ objdes(i2, false) } resists damage!`);
      result = true;
    } else if ((item.ac + item.toac) > 0) {
      await msg_print(`Your ${ objdes(i2, false) } is damaged!`);
      item.toac--;
      py_bonuses(g.blank_treasure, 0);
      result = true;
    }
  }

  return result;
}


// moria.inc:1672 corrode_gas
export async function corrode_gas(kb_str: string): Promise<void> {
  if (!(await minus_ac(0x00100000))) {
    await take_hit(randint(8), kb_str);
  }

  g.print_stat = uor(0x0040, g.print_stat);

  if (inven_damage(pascalSet(23, 33, 34, 35, 65), 5) > 0) {
    await msg_print('There is an acrid smell coming from your pack.');
  }
}


// moria.inc:1683 poison_gas
export async function poison_gas(dam: number, kb_str: string): Promise<void> {
  await take_hit(dam, kb_str);
  g.print_stat = uor(0x0040, g.print_stat);
  g.py.flags.poisoned += 12 + randint(dam);
}


// moria.inc:1692 fire_dam
export async function fire_dam(damage: number, kb_str: string): Promise<void> {
  let dam: number = damage;

  if (g.py.flags.fire_resist) {
    dam = div(dam, 3);
  }

  if (g.py.flags.resist_heat > 0) {
    dam = div(dam, 3);
  }

  await take_hit(dam, kb_str);
  g.print_stat = uor(0x0080, g.print_stat);

  if (inven_damage(pascalSet(12, 20, 21, 22, 30, 31, 32, 36, 55, 70, 71), 3) > 0) {
    await msg_print('There is smoke coming from your pack!');
  }
}


// moria.inc:1706 cold_dam
export async function cold_dam(damage: number, kb_str: string): Promise<void> {
  let dam: number = damage;

  if (g.py.flags.cold_resist) {
    dam = div(dam, 3);
  }

  if (g.py.flags.resist_cold > 0) {
    dam = div(dam, 3);
  }

  await take_hit(dam, kb_str);
  g.print_stat = uor(0x0080, g.print_stat);

  if (inven_damage(pascalSet(75, 76), 5) > 0) {
    await msg_print('Something shatters inside your pack!');
  }
}


// moria.inc:1720 light_dam
export async function light_dam(dam: number, kb_str: string): Promise<void> {
  await take_hit(g.py.flags.lght_resist ? div(dam, 3) : dam, kb_str);
  g.print_stat = uor(0x0080, g.print_stat);
}


// moria.inc:1731 acid_dam
export async function acid_dam(dam: number, kb_str: string): Promise<void> {
  let flag: number = 0;

  if (await minus_ac(0x00100000)) {
    flag = 1;
  }

  if (g.py.flags.acid_resist) {
    flag += 2;
  }

  await take_hit(div(dam, [ 1, 2, 3, 4 ][flag]), kb_str);
  g.print_stat = uor(0x00C0, g.print_stat);

  if (inven_damage(pascalSet(1, 2, 11, 12, 20, 21, 22, 30, 31, 32, 36), 3) > 0) {
    await msg_print('There is an acrid smell coming from your pack!');
  }
}


async function dart(hit: () => Promise<void>): Promise<void> {
  const misc: player_misc_type = g.py.misc;

  if (await test_hit(125, 0, 0, misc.pac + misc.ptoac)) {
    await hit();
  } else {
    await msg_print('A small dart barely misses you.');
  }
}


async function stat_dart(dam: number, sustained: boolean, stat: 'cstr' | 'ccon', bit: number): Promise<void> {
  await dart(async (): Promise<void> => {
    if (!sustained) {
      g.py.stat[stat] = de_statp(g.py.stat[stat]);
      await take_hit(dam, 'a dart trap.');
      g.print_stat = uor(bit, g.print_stat);
      await msg_print('A small dart weakens you!');
    } else {
      await msg_print('A small dart hits you.');
    }
  });
}


// moria.inc:1786 hit_trap: town "traps" 101-106 are the shop doors.
export async function hit_trap(y: IRef<number>, x: IRef<number>): Promise<void> {
  const cell: cave_type = g.cave[y.get()][x.get()];
  const misc: player_misc_type = g.py.misc;
  const flags: player_flags_type = g.py.flags;

  change_trap(y.get(), x.get());
  lite_spot(g.char_row, g.char_col);
  g.find_flag = false;

  const dam: number = damroll(g.t_list[cell.tptr].damage);

  switch (g.t_list[cell.tptr].subval) {
    case 1:
      await msg_print('You fell into a pit!');

      if (flags.ffall) {
        await msg_print('You gently float down.');
      } else {
        await take_hit(dam, 'an open pit.');
      }

      break;
    case 2:
      if (await test_hit(125, 0, 0, misc.pac + misc.ptoac)) {
        await take_hit(dam, 'an arrow trap.');
        await msg_print('An arrow hits you.');
      } else {
        await msg_print('An arrow barely misses you.');
      }

      break;
    case 3:
      await msg_print('You fell into a covered pit.');

      if (flags.ffall) {
        await msg_print('You gently float down.');
      } else {
        await take_hit(dam, 'a covered pit.');
      }

      place_trap(y.get(), x.get(), 2, 1);
      break;
    case 4:
      await msg_print('You fell through a trap door!');
      await msg_print(' ');
      dl.moria_flag = true;
      g.dun_level++;

      if (flags.ffall) {
        await msg_print('You gently float down.');
      } else {
        await take_hit(dam, 'a trap door.');
      }

      break;
    case 5:
      if (flags.paralysis === 0) {
        await msg_print('A strange white mist surrounds you!');

        if (flags.free_act) {
          await msg_print('You are unaffected.');
        } else {
          await msg_print('You fall asleep.');
          flags.paralysis += randint(10) + 4;
        }
      }

      break;
    case 6:
      cell.fm = false;
      pusht(cell.tptr);
      place_object(y.get(), x.get());
      await msg_print('Hmmm, there was something under this rock.');
      break;
    case 7:
      await stat_dart(dam, flags.sustain_str, 'cstr', 0x0001);
      break;
    case 8:
      dl.teleport_flag = true;
      await msg_print('You hit a teleport trap!');
      break;
    case 9:
      await take_hit(dam, 'falling rock.');
      pusht(cell.tptr);
      place_rubble(y.get(), x.get());
      await msg_print('You are hit by falling rock');
      break;
    case 10:
      await corrode_gas('corrosion gas.');
      await msg_print('A strange red gas surrounds you.');
      break;
    case 11: {
      const count: number = 2 + randint(3);

      cell.fm = false;
      pusht(cell.tptr);
      cell.tptr = 0;

      for (let i1: number = 1; i1 <= count; i1++) {
        summon_monster(box(g.char_row), box(g.char_col), false);
      }

      break;
    }
    case 12:
      await fire_dam(dam, 'a fire trap.');
      await msg_print('You are enveloped in flames!');
      break;
    case 13:
      await acid_dam(dam, 'an acid trap.');
      await msg_print('You are splashed with acid!');
      break;
    case 14:
      await poison_gas(dam, 'a poison gas trap.');
      await msg_print('A pungent green gas surrounds you!');
      break;
    case 15:
      await msg_print('A black gas surrounds you!');
      flags.blind += randint(50) + 50;
      break;
    case 16:
      await msg_print('A gas of scintillating colors surrounds you!');
      flags.confused += randint(15) + 15;
      break;
    case 17:
      await dart(async (): Promise<void> => {
        await take_hit(dam, 'a dart trap.');
        await msg_print('A small dart hits you!');
        flags.slow += randint(20) + 10;
      });
      break;
    case 18:
      await stat_dart(dam, flags.sustain_con, 'ccon', 0x0004);
      break;
    case 19:
    case 99:
      break;
    case 101:
    case 102:
    case 103:
    case 104:
    case 105:
    case 106:
      await enter_store(g.t_list[cell.tptr].subval - 100);
      break;
    default:
      await msg_print('Unknown trap value');
      break;
  }
}


// moria.inc:1989 find_range: the first and last inventory slots holding one of the given kinds.
export function find_range(item_val: obj_set, i2: IRef<number>, i3: IRef<number>): boolean {
  let i1: number = 0;
  let flag: boolean = false;

  i2.set(0);
  i3.set(0);

  while (i1 < g.inven_ctr) {
    i1++;

    if (item_val.has(g.inventory[i1].tval) && !flag) {
      flag = true;
      i2.set(i1);
    }

    if (!item_val.has(g.inventory[i1].tval) && flag && (i3.get() === 0)) {
      i3.set(i1 - 1);
    }
  }

  if (flag && (i3.get() === 0)) {
    i3.set(g.inven_ctr);
  }

  return flag;
}


// moria.inc:2171 delete_monster
export function delete_monster(i2: number): void {
  let i1: number = g.muptr;
  const i3: number = g.m_list[i2].nptr;
  const monster: monster_type = g.m_list[i2];

  if (i1 === i2) {
    g.muptr = i3;
  } else {
    while (g.m_list[i1].nptr !== i2) {
      i1 = g.m_list[i1].nptr;
    }

    g.m_list[i1].nptr = i3;
  }

  g.cave[monster.fy][monster.fx].cptr = 0;

  if (monster.ml) {
    const cell: cave_type = g.cave[monster.fy][monster.fx];

    if (cell.pl || cell.tl) {
      lite_spot(monster.fy, monster.fx);
    } else {
      unlite_spot(monster.fy, monster.fx);
    }
  }

  pushm(i2);
  g.mon_tot_mult--;
}


// moria.inc:2201 check_mon_lite: a new creature in sight is shown.
export function check_mon_lite(y: number, x: number): void {
  const cell: cave_type = g.cave[y][x];

  if ((cell.cptr > 1) && !g.m_list[cell.cptr].ml && (cell.tl || cell.pl) && los(g.char_row, g.char_col, y, x)) {
    g.m_list[cell.cptr].ml = true;
    lite_spot(y, x);
  }
}


// moria.inc:2217 multiply_monster: a creature appears next to y,x; some eat what is there.
export function multiply_monster(y: number, x: number, z: number, slp: boolean): void {
  let i1: number = 0;

  do {
    const i2: number = y - 2 + randint(3);
    const i3: number = x - 2 + randint(3);

    if (in_bounds(i2, i3)) {
      const cell: cave_type = g.cave[i2][i3];

      if (g.floor_set.has(cell.fval) && (cell.tptr === 0) && (cell.cptr !== 1)) {
        if (cell.cptr > 1) {
          if (uand(g.c_list[z].cmove, 0x00080000) !== 0) {
            delete_monster(cell.cptr);
            place_monster(i2, i3, z, slp);
            check_mon_lite(i2, i3);
            g.mon_tot_mult++;
          }
        } else {
          place_monster(i2, i3, z, slp);
          check_mon_lite(i2, i3);
          g.mon_tot_mult++;
        }

        i1 = 18;
      }
    }

    i1++;
  } while (!(i1 > 18));
}


// moria.inc:2259 summon_object: objects near y,x. The source notes they can land out of reach.
function summon_object(y: number, x: number, count: number, typ: number): void {
  let num: number = count;

  do {
    let i1: number = 0;

    do {
      const i2: number = y - 3 + randint(5);
      const i3: number = x - 3 + randint(5);

      if (in_bounds(i2, i3) && g.floor_set.has(g.cave[i2][i3].fval) && (g.cave[i2][i3].tptr === 0)) {
        switch (typ) {
          case 1:
            place_object(i2, i3);
            break;
          case 2:
            place_gold(i2, i3);
            break;
          case 3:
            if (randint(100) < 50) {
              place_object(i2, i3);
            } else {
              place_gold(i2, i3);
            }

            break;
        }

        if (test_light(i2, i3)) {
          lite_spot(i2, i3);
        }

        i1 = 10;
      }

      i1++;
    } while (!(i1 > 10));

    num--;
  } while (num !== 0);
}


// moria.inc:2294 delete_object
export function delete_object(y: number, x: number): boolean {
  const cell: cave_type = g.cave[y][x];
  let result: boolean = false;

  if (g.t_list[cell.tptr].tval === 109) {
    cell.fval = g.corr_floor3.ftval;
  }

  cell.fopen = true;
  pusht(cell.tptr);
  cell.tptr = 0;
  cell.fm = false;

  if (test_light(y, x)) {
    lite_spot(y, x);
    result = true;
  } else {
    unlite_spot(y, x);
  }

  return result;
}


// moria.inc:2319 monster_death: what a creature drops, and the game's end for the Balrog.
export async function monster_death(y: number, x: number, flags: number): Promise<void> {
  let i1: number = uand(flags, 0x01000000) !== 0 ? 1 : 0;

  if (uand(flags, 0x02000000) !== 0) {
    i1 += 2;
  }

  if ((uand(flags, 0x04000000) !== 0) && (randint(100) < 60)) {
    summon_object(y, x, 1, i1);
  }

  if ((uand(flags, 0x08000000) !== 0) && (randint(100) < 90)) {
    summon_object(y, x, 1, i1);
  }

  if (uand(flags, 0x10000000) !== 0) {
    summon_object(y, x, randint(2), i1);
  }

  if (uand(flags, 0x20000000) !== 0) {
    summon_object(y, x, damroll('2d2'), i1);
  }

  if (uand(flags, 0x40000000) !== 0) {
    summon_object(y, x, damroll('4d3'), i1);
  }

  if (uand(flags, 0x80000000) !== 0) {
    g.total_winner = true;
    prt_winner();
    await msg_print('*** CONGRATULATIONS *** You have won the game...');
    await msg_print('Use <CONTROL>-Y when you are ready to quit.');
  }
}


// moria.inc:2353 mon_take_hit: the creature's kind when it dies of it, else 0. Experience keeps
// its fraction in acc_exp.
export async function mon_take_hit(monptr: number, dam: number): Promise<number> {
  const monster: monster_type = g.m_list[monptr];
  let result: number = 0;

  monster.hp -= dam;
  monster.csleep = 0;

  if (monster.hp < 0) {
    const creature: creature_type = g.c_list[monster.mptr];
    const misc: player_misc_type = g.py.misc;

    await monster_death(monster.fy, monster.fx, creature.cmove);

    const acc_tmp: number = real(creature.mexp * real(real(creature.level + real(0.1)) / misc.lev));
    let i1: number = Math.trunc(acc_tmp);

    g.acc_exp = real(g.acc_exp + real(acc_tmp - i1));

    if (g.acc_exp > 1) {
      i1++;
      g.acc_exp = real(g.acc_exp - 1.0);
    }

    misc.exp += i1;

    if (i1 > 0) {
      await prt_experience();
    }

    result = monster.mptr;
    delete_monster(monptr);
  }

  return result;
}


// moria.inc:2388 tot_dam: slays and brands multiply a weapon's damage.
function tot_dam(item: treasure_type, damage: number, monster: creature_type): number {
  let tdam: number = damage;

  if ([ 10, 11, 12, 20, 21, 22, 23, 77 ].includes(item.tval)) {
    if ((uand(monster.cdefense, 0x0001) !== 0) && (uand(item.flags, 0x00002000) !== 0)) {
      tdam *= 4;
    } else if ((uand(monster.cdefense, 0x0008) !== 0) && (uand(item.flags, 0x00010000) !== 0)) {
      tdam *= 3;
    } else if ((uand(monster.cdefense, 0x0002) !== 0) && (uand(item.flags, 0x00004000) !== 0)) {
      tdam *= 2;
    } else if ((uand(monster.cdefense, 0x0004) !== 0) && (uand(item.flags, 0x00008000) !== 0)) {
      tdam *= 2;
    } else if ((uand(monster.cdefense, 0x0010) !== 0) && (uand(item.flags, 0x00020000) !== 0)) {
      tdam = Math.trunc(real(tdam * 1.5));
    } else if ((uand(monster.cdefense, 0x0020) !== 0) && (uand(item.flags, 0x00040000) !== 0)) {
      tdam = Math.trunc(real(tdam * 1.5));
    }
  }

  return tdam;
}


// moria.inc:2425 py_attack: the player's blows against the creature at y,x.
export async function py_attack(y: number, x: number): Promise<boolean> {
  const i1: number = g.cave[y][x].cptr;
  const i2: number = g.m_list[i1].mptr;
  const tot_tohit: IRef<number> = box(0);
  const misc: player_misc_type = g.py.misc;
  let m_name: string;
  let blows: number;
  let result: boolean = false;

  g.m_list[i1].csleep = 0;

  if ((uand(0x10000, g.c_list[i2].cmove) !== 0) && !g.py.flags.see_inv) {
    m_name = 'it';
  } else if (g.py.flags.blind > 0) {
    m_name = 'it';
  } else if (!g.m_list[i1].ml) {
    m_name = 'it';
  } else {
    m_name = `the ${ g.c_list[i2].name }`;
  }

  if (g.inventory[23].tval > 0) {
    blows = attack_blows(g.inventory[23].weight, tot_tohit);
  } else {
    blows = 2;
    tot_tohit.set(-3);
  }

  if ([ 10, 11, 12 ].includes(g.inventory[23].tval)) {
    blows = 1;
  }

  tot_tohit.set(tot_tohit.get() + misc.ptohit);

  do {
    if (await test_hit(misc.bth, misc.lev, tot_tohit.get(), g.c_list[i2].ac)) {
      const weapon: treasure_type = g.inventory[23];
      let i3: number;

      await msg_print(`You hit ${ m_name }.`);

      if (weapon.tval > 0) {
        i3 = damroll(weapon.damage);
        i3 = tot_dam(weapon, i3, g.c_list[i2]);
        i3 = await critical_blow(weapon.weight, tot_tohit.get(), i3);
      } else {
        i3 = damroll(g.bare_hands);
        i3 = await critical_blow(1, 0, i3);
      }

      i3 = Math.max(i3 + misc.ptodam, 0);

      if ((await mon_take_hit(i1, i3)) > 0) {
        await msg_print(`You have slain ${ m_name }.`);
        blows = 0;
        result = false;
      } else {
        result = true;
      }

      use_missile();
    } else {
      await msg_print(`You miss ${ m_name }.`);
    }

    blows--;
  } while (!(blows < 1));

  return result;
}


// Arrows, bolts and shot wielded as a weapon are used up by hitting with them.
function use_missile(): void {
  const weapon: treasure_type = g.inventory[23];

  if ([ 10, 11, 12 ].includes(weapon.tval)) {
    weapon.number--;

    if (weapon.number <= 0) {
      g.inven_weight -= weapon.weight;
      g.equip_ctr--;
      g.inventory[inven_max] = clone(g.inventory[23]);
      g.inventory[23] = clone(g.blank_treasure);
      py_bonuses(g.inventory[inven_max], -1);
    }
  }
}


// moria.inc:2613 chest_trap: a chest's traps are its flags. The source reads them through a
// `with` on the chest's slot, so once the explosion has freed the slot no later trap fires.
export async function chest_trap(y: number, x: number): Promise<void> {
  const slot: number = g.cave[y][x].tptr;
  const chest: () => treasure_type = (): treasure_type => g.t_list[slot];

  if (uand(0x00000010, chest().flags) !== 0) {
    await msg_print('A small needle has pricked you!');

    if (!g.py.flags.sustain_str) {
      g.py.stat.cstr = de_statp(g.py.stat.cstr);
      await take_hit(damroll('1d4'), 'a poison needle.');
      g.print_stat = uor(0x0001, g.print_stat);
      await msg_print('You feel weakened!');
    } else {
      await msg_print('You are unaffected.');
    }
  }

  if (uand(0x00000020, chest().flags) !== 0) {
    await msg_print('A small needle has pricked you!');
    await take_hit(damroll('1d6'), 'a poison needle.');
    g.py.flags.poisoned += 10 + randint(20);
  }

  if (uand(0x00000040, chest().flags) !== 0) {
    await msg_print('A puff of yellow gas surrounds you!');

    if (g.py.flags.free_act) {
      await msg_print('You are unaffected.');
    } else {
      await msg_print('You choke and pass out.');
      g.py.flags.paralysis = 10 + randint(20);
    }
  }

  if (uand(0x00000080, chest().flags) !== 0) {
    await msg_print('There is a sudden explosion!');
    delete_object(y, x);
    await take_hit(damroll('5d8'), 'an exploding chest.');
  }

  if (uand(0x00000100, chest().flags) !== 0) {
    for (let i1: number = 1; i1 <= 3; i1++) {
      summon_monster(box(y), box(x), false);
    }
  }
}


// moria.inc:2089 carry: gold is taken, traps go off, and objects are picked up if they can be.
async function carry(y: number, x: number): Promise<void> {
  const cell: cave_type = g.cave[y][x];

  g.find_flag = false;
  g.inventory[inven_max] = clone(g.t_list[cell.tptr]);

  if (g.t_list[cell.tptr].tval === 100) {
    const gold: treasure_type = g.inventory[inven_max];

    pusht(cell.tptr);
    cell.tptr = 0;
    g.py.misc.au += gold.cost;
    prt_gold();
    await msg_print(`You have found ${ fmt(gold.cost, 1) } gold pieces worth of ${ gold.name }.`);
  } else if (g.trap_set.has(g.t_list[cell.tptr].tval)) {
    await hit_trap(box(y), box(x));
  } else if (g.t_list[cell.tptr].tval < 100) {
    if (!inven_check_weight()) {
      await msg_print('You can\'t carry that much weight.');
    } else if (!inven_check_num()) {
      await msg_print('You can\'t carry that many items.');
    } else {
      const item_val: IRef<number> = box(0);

      pusht(cell.tptr);
      cell.tptr = 0;
      inven_carry(item_val);
      await msg_print(`You have ${ objdes(item_val.get(), true) } (${ String.fromCharCode(item_val.get() + 96) }${ cur_char1(item_val.get()) }`);
    }
  }
}


// moria.inc:2514 move_char
export async function move_char(start_dir: number): Promise<void> {
  const test_row: IRef<number> = box(g.char_row);
  const test_col: IRef<number> = box(g.char_col);
  let dir: number = start_dir;

  if ((g.py.flags.confused > 0) && (randint(4) > 1) && (dir !== 5)) {
    dir = randint(9);
    g.find_flag = false;
  }

  if (move(dir, test_row, test_col)) {
    const cell: cave_type = g.cave[test_row.get()][test_col.get()];

    if (cell.cptr < 2) {
      if (cell.fopen) {
        await step_onto(dir, test_row.get(), test_col.get(), cell);
      } else if (!pick_dir(dir)) {
        await blocked(cell);
      }
    } else {
      if (g.find_flag) {
        g.find_flag = false;
        move_light(g.char_row, g.char_col, g.char_row, g.char_col);
      }

      if (g.py.flags.afraid < 1) {
        await py_attack(test_row.get(), test_col.get());
      } else {
        await msg_print('You are too afraid!');
      }
    }
  }
}


async function step_onto(dir: number, test_row: number, test_col: number, cell: cave_type): Promise<void> {
  move_rec(g.char_row, g.char_col, test_row, test_col);

  if (get_panel(test_row, test_col)) {
    prt_map();
  }

  if (g.find_flag) {
    area_affect(dir, test_row, test_col);
  }

  if ((g.py.flags.blind < 1) && ((randint(g.py.misc.fos) === 1) || dl.search_flag)) {
    await search(test_row, test_col, g.py.misc.srh);
  }

  if (cell.tptr > 0) {
    await carry(test_row, test_col);
  }

  move_light(g.char_row, g.char_col, test_row, test_col);

  if (cell.fval === g.lopen_floor.ftval) {
    if ((g.py.flags.blind < 1) && !cell.pl) {
      light_room(test_row, test_col);
    }
  } else if ([ 5, 6 ].includes(cell.fval) && (g.py.flags.blind < 1)) {
    for (let i1: number = test_row - 1; i1 <= test_row + 1; i1++) {
      for (let i2: number = test_col - 1; i2 <= test_col + 1; i2++) {
        if (in_bounds(i1, i2) && (g.cave[i1][i2].fval === g.lopen_floor.ftval) && !g.cave[i1][i2].pl) {
          light_room(i1, i2);
        }
      }
    }
  }

  g.char_row = test_row;
  g.char_col = test_col;
}


async function blocked(cell: cave_type): Promise<void> {
  if (g.find_flag) {
    g.find_flag = false;
    await move_char(5);
  } else if (cell.tptr > 0) {
    dl.reset_flag = true;

    if (g.t_list[cell.tptr].tval === 103) {
      await msg_print('There is rubble blocking your way.');
    } else if (g.t_list[cell.tptr].tval === 105) {
      await msg_print('There is a closed door blocking your way.');
    }
  } else {
    dl.reset_flag = true;
  }
}


function disarm_skill(): number {
  const misc: player_misc_type = g.py.misc;

  return misc.disarm + misc.lev + 2 * todis_adj() + int_adj();
}


// moria.inc:2669 openobject: a closed door or chest.
async function openobject(): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  const tmp: IRef<number> = box(0);

  if (await get_dir('Which direction?', tmp, tmp, y, x)) {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 105)) {
      await open_door(cell, y.get(), x.get());
    } else if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 2)) {
      await open_chest(cell, y.get(), x.get());
    } else {
      await msg_print('I do not see anything you can open there.');
    }
  }
}


async function open_door(cell: cave_type, y: number, x: number): Promise<void> {
  const door: treasure_type = g.t_list[cell.tptr];

  if (door.p1 > 0) {
    const tmp: number = disarm_skill();

    if (g.py.flags.confused > 0) {
      await msg_print('You are too confused to pick the lock.');
    } else if ((tmp - door.p1) > randint(100)) {
      await msg_print('You have picked the lock.');
      g.py.misc.exp++;
      await prt_experience();
      door.p1 = 0;
    } else {
      await msg_print('You failed to pick the lock.');
    }
  } else if (door.p1 < 0) {
    await msg_print('It appears to be stuck.');
  }

  if (door.p1 === 0) {
    g.t_list[cell.tptr] = clone(g.door_list[1]);
    cell.fopen = true;
    lite_spot(y, x);
  }
}


async function open_chest(cell: cave_type, y: number, x: number): Promise<void> {
  const tmp: number = disarm_skill();
  const chest: treasure_type = g.t_list[cell.tptr];
  let flag: boolean = false;

  if (uand(0x00000001, chest.flags) !== 0) {
    if (g.py.flags.confused > 0) {
      await msg_print('You are too confused to pick the lock.');
    } else if ((tmp - (2 * chest.level)) > randint(100)) {
      await msg_print('You have picked the lock.');
      flag = true;
      g.py.misc.exp += chest.level;
      await prt_experience();
    } else {
      await msg_print('You failed to pick the lock.');
    }
  } else {
    flag = true;
  }

  if (flag) {
    const at: number = index(chest.name, ' (');

    chest.flags = uand(0xFFFFFFFE, chest.flags);

    if (at > 0) {
      chest.name = substr(chest.name, 1, at - 1);
    }

    chest.name = known2(`${ chest.name } (Empty)`);
    chest.cost = 0;
  }

  flag = false;

  if (uand(0x00000001, chest.flags) === 0) {
    await chest_trap(y, x);

    if (cell.tptr > 0) {
      flag = true;
    }
  }

  if (flag) {
    await monster_death(y, x, g.t_list[cell.tptr].flags);
    g.t_list[cell.tptr].flags = 0;
  }
}


// moria.inc:2767 closeobject
async function closeobject(): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  const tmp: IRef<number> = box(0);

  if (await get_dir('Which direction?', tmp, tmp, y, x)) {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 104)) {
      if (cell.cptr !== 0) {
        await msg_print(`The ${ g.c_list[g.m_list[cell.cptr].mptr].name } is in your way!`);
      } else if (g.t_list[cell.tptr].p1 === 0) {
        g.t_list[cell.tptr] = clone(g.door_list[2]);
        cell.fopen = false;
        lite_spot(y.get(), x.get());
      } else {
        await msg_print('The door appears to be broken.');
      }
    } else {
      await msg_print('I do not see anything you can close there.');
    }
  }
}


// moria.inc:2799 go_up
async function go_up(): Promise<void> {
  const cell: cave_type = g.cave[g.char_row][g.char_col];

  if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 107)) {
    g.dun_level--;
    dl.moria_flag = true;
    await msg_print('You enter a maze of up staircases.');
    await msg_print('You pass through a one-way door.');
  } else {
    await msg_print('I see no up staircase here.');
  }
}


// moria.inc:2818 go_down
async function go_down(): Promise<void> {
  const cell: cave_type = g.cave[g.char_row][g.char_col];

  if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 108)) {
    g.dun_level++;
    dl.moria_flag = true;
    await msg_print('You enter a maze of down staircases.');
    await msg_print('You pass through a one-way door.');
  } else {
    await msg_print('I see no down staircase here.');
  }
}


// moria.inc:2838 twall: tunnelling through real wall (10, 11, 12); wall_to_mud uses it too.
export async function twall(y: number, x: number, t1: number, t2: number): Promise<boolean> {
  const cell: cave_type = g.cave[y][x];
  let result: boolean = false;

  if (t1 > t2) {
    if (next_to4(y, x, pascalSet(1, 2)) > 0) {
      cell.fval = g.corr_floor2.ftval;
      cell.fopen = g.corr_floor2.ftopen;
    } else {
      cell.fval = g.corr_floor1.ftval;
      cell.fopen = g.corr_floor1.ftopen;
    }

    if (test_light(y, x) && panel_contains(y, x)) {
      if (cell.tptr > 0) {
        await msg_print('You have found something!');
      }

      lite_spot(y, x);
    }

    cell.fm = false;
    cell.pl = false;
    result = true;
  }

  return result;
}


const WALL_NAMES: Readonly<Record<number, readonly [ number, number, string ]>> = {
  10: [ 1200, 80, 'granite wall' ],
  11: [ 600, 10, 'magma intrusion' ],
  12: [ 400, 10, 'quartz vein' ],
};


// moria.inc:2870 tunnel: through rubble and walls; a digging tool helps.
async function tunnel(): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  const i1: IRef<number> = box(0);

  if (await get_dir('Which direction?', i1, i1, y, x)) {
    const cell: cave_type = g.cave[y.get()][x.get()];
    const wall: readonly [ number, number, string ] | undefined = WALL_NAMES[cell.fval];
    let tabil: number = g.py.stat.cstr;

    if ((g.inventory[23].tval > 0) && (uand(0x20000000, g.inventory[23].flags) !== 0)) {
      tabil += 25 + g.inventory[23].p1 * 50;
    }

    if (wall != null) {
      const hardness: number = randint(wall[0]) + wall[1];

      if (await twall(y.get(), x.get(), tabil, hardness)) {
        await msg_print('You have finished the tunnel.');
      } else {
        await msg_print(`You tunnel into the ${ wall[2] }.`);
      }
    } else if (cell.fval === 15) {
      await msg_print('This seems to be permanent rock.');
    } else if (cell.tptr > 0) {
      await tunnel_object(cell, y.get(), x.get(), tabil);
    } else {
      await msg_print('Tunnel through what?  Empty air???');
    }
  }
}


async function tunnel_object(cell: cave_type, y: number, x: number, tabil: number): Promise<void> {
  if (g.t_list[cell.tptr].tval === 103) {
    if (tabil > randint(180)) {
      pusht(cell.tptr);
      cell.tptr = 0;
      cell.fm = false;
      cell.fopen = true;
      await msg_print('You have removed the rubble.');

      if (randint(10) === 1) {
        place_object(y, x);

        if (test_light(y, x)) {
          await msg_print('You have found something!');
        }
      }

      lite_spot(y, x);
    } else {
      await msg_print('You dig in the rubble...');
    }
  } else if (g.t_list[cell.tptr].tval === 109) {
    await msg_print('You tunnel into the granite wall.');
    await search(g.char_row, g.char_col, g.py.misc.srh);
  } else {
    await msg_print('You can\'t tunnel through that.');
  }
}


const ROCK_SEEN: Readonly<Record<number, string>> = {
  10: 'You see a granite wall.',
  11: 'You see some dark rock.',
  12: 'You see a quartz vein.',
  15: 'You see a granite wall.',
};


// moria.inc:3046 look: at an object, trap or monster; a free move.
async function look(): Promise<void> {
  const dir: IRef<number> = box(0);
  const dummy: IRef<number> = box(0);
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  let flag: boolean = false;

  if (await get_dir('Look which direction?', dir, dummy, y, x)) {
    if (g.py.flags.blind < 1) {
      let i1: number = 0;

      y.set(g.char_row);
      x.set(g.char_col);

      do {
        move(dir.get(), y, x);
        flag = (await look_at(g.cave[y.get()][x.get()])) || flag;
        i1++;
      } while (!(!g.cave[y.get()][x.get()].fopen || (i1 > max_sight)));

      if (!flag) {
        await msg_print('You see nothing of interest in that direction.');
      }
    } else {
      await msg_print('You can\'t see a damn thing!');
    }
  }
}


async function look_at(cell: cave_type): Promise<boolean> {
  let flag: boolean = false;

  if ((cell.cptr > 1) && g.m_list[cell.cptr].ml) {
    const name: string = g.c_list[g.m_list[cell.cptr].mptr].name;

    await msg_print(g.vowel_set.has(name.charAt(0)) ? `You see an ${ name }.` : `You see a ${ name }.`);
    flag = true;
  }

  if (cell.tl || cell.pl || cell.fm) {
    if (cell.tptr > 0) {
      if (g.t_list[cell.tptr].tval === 109) {
        await msg_print('You see a granite wall.');
      } else if (g.t_list[cell.tptr].tval !== 101) {
        g.inventory[inven_max] = clone(g.t_list[cell.tptr]);
        await msg_print(`You see ${ objdes(inven_max, true) }`);
        flag = true;
      }
    }

    if (!cell.fopen) {
      flag = true;

      if (ROCK_SEEN[cell.fval] != null) {
        await msg_print(ROCK_SEEN[cell.fval]);
      }
    }
  }

  return flag;
}


// moria.inc:2954 disarm_trap: a floor trap or a chest's.
async function disarm_trap(): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  const tdir: IRef<number> = box(0);
  const i1: IRef<number> = box(0);

  if (await get_dir('Which direction?', tdir, i1, y, x)) {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if (cell.tptr > 0) {
      const misc: player_misc_type = g.py.misc;
      let tot: number = misc.disarm + misc.lev + 2 * todis_adj() + int_adj();

      if (g.py.flags.blind > 0) {
        tot = Math.trunc(real(tot / 5.0));
      } else if (no_light()) {
        tot = Math.trunc(real(tot / 2.0));
      }

      if (g.py.flags.confused > 0) {
        tot = Math.trunc(real(tot / 3.0));
      }

      const tval: number = g.t_list[cell.tptr].tval;
      const t5: number = g.t_list[cell.tptr].level;

      if (tval === 102) {
        await disarm_floor_trap(cell, tot, t5, tdir.get(), y.get(), x.get());
      } else if (tval === 2) {
        await disarm_chest(g.t_list[cell.tptr], tot, t5, y.get(), x.get());
      } else {
        await msg_print('I do not see anything to disarm there.');
      }
    } else {
      await msg_print('I do not see anything to disarm there.');
    }
  }
}


async function disarm_floor_trap(cell: cave_type, tot: number, t5: number, tdir: number, y: number, x: number): Promise<void> {
  if ((tot - t5) > randint(100)) {
    await msg_print('You have disarmed the trap.');
    g.py.misc.exp += g.t_list[cell.tptr].p1;
    cell.fm = false;
    pusht(cell.tptr);
    cell.tptr = 0;
    await move_char(tdir);
    lite_spot(y, x);
    await prt_experience();
  } else if (randint(tot) > 5) {
    await msg_print('You failed to disarm the trap.');
  } else {
    await msg_print('You set the trap off!');
    await move_char(tdir);
  }
}


async function disarm_chest(chest: treasure_type, tot: number, t5: number, y: number, x: number): Promise<void> {
  if (index(chest.name, '^') > 0) {
    await msg_print('I don\'t see a trap...');
  } else if (uand(0x000001F0, chest.flags) !== 0) {
    if ((tot - t5) > randint(100)) {
      const at: number = index(chest.name, ' (');

      chest.flags = uand(0xFFFFFE0F, chest.flags);

      if (at > 0) {
        chest.name = substr(chest.name, 1, at - 1);
      }

      chest.name += uand(0x00000001, chest.flags) !== 0 ? ' (Locked)' : ' (Disarmed)';
      await msg_print('You have disarmed the chest.');
      chest.name = known2(chest.name);
      g.py.misc.exp += t5;
      await prt_experience();
    } else if (randint(tot) > 5) {
      await msg_print('You failed to disarm the chest.');
    } else {
      await msg_print('You set a trap off!');
      chest.name = known2(chest.name);
      await chest_trap(y, x);
    }
  } else {
    await msg_print('The chest was not trapped.');
  }
}


// moria.inc:3114 add_food
export async function add_food(num: number): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags.food < 0) {
    flags.food = 0;
  }

  flags.food += num;

  if (flags.food > player_food_full) {
    await msg_print('You are full.');
  }

  if (flags.food > player_food_max) {
    await msg_print('You\'re getting fat from eating so much.');
    flags.food = player_food_max;
  }
}


// moria.inc:3131 desc_charges: only once the charges are known.
export async function desc_charges(item_val: number): Promise<void> {
  if (index(g.inventory[item_val].name, '^') === 0) {
    await msg_print(`You have ${ fmt(g.inventory[item_val].p1, 1) } charges remaining.`);
  }
}


// moria.inc:3146 desc_remain: how many are left once one is used.
export async function desc_remain(item_val: number): Promise<void> {
  g.inventory[inven_max] = clone(g.inventory[item_val]);
  g.inventory[inven_max].number--;

  const out_val: string = objdes(inven_max, true);

  await msg_print(`You have ${ substr(out_val, 1, out_val.length - 1) }.`);
}


// moria.inc:3171 inven_throw: one of the item into inventory[inven_max], to be thrown.
function inven_throw(item_val: number): void {
  const item: treasure_type = g.inventory[item_val];

  g.inventory[inven_max] = clone(item);
  g.inventory[inven_max].number = 1;

  if ((item.number > 1) && (item.subval > 511)) {
    item.number--;
    g.inven_weight -= item.weight;
  } else {
    inven_destroy(item_val);
  }
}


interface IThrow {
  tbth: number;
  tpth: number;
  tdam: number;
  tdis: number;
}

// Launchers: the bow's p1, the missile it fires, and what it adds to damage and range.
const LAUNCHERS: Readonly<Record<number, readonly [ number, number, number ]>> = {
  1: [ 10, 2, 20 ],
  2: [ 12, 2, 25 ],
  3: [ 12, 3, 30 ],
  4: [ 12, 4, 35 ],
  5: [ 11, 2, 25 ],
  6: [ 11, 4, 35 ],
};


// moria.inc:3187 facts: to-hit, damage and range of what is thrown, better from the right launcher.
function facts(): IThrow {
  const missile: treasure_type = g.inventory[inven_max];
  const tmp_weight: number = missile.weight < 1 ? 1 : missile.weight;
  const result: IThrow = {
    tdam: damroll(missile.damage) + missile.todam,
    tbth: Math.trunc(real(g.py.misc.bthb * real(0.75))),
    tpth: g.py.misc.ptohit + missile.tohit,
    tdis: Math.min(Math.trunc(real(((g.py.stat.cstr + 20) * 10) / tmp_weight)), 10),
  };

  if (g.inventory[23].tval === 20) {
    const launcher: readonly [ number, number, number ] | undefined = LAUNCHERS[g.inventory[23].p1];

    if ((launcher != null) && (missile.tval === launcher[0])) {
      result.tbth = g.py.misc.bthb;
      result.tpth += g.inventory[23].tohit;
      result.tdam += launcher[1];
      result.tdis = launcher[2];
    }
  }

  return result;
}


// moria.inc:3254 drop_throw: where a missed missile lands, if anywhere.
async function drop_throw(y: number, x: number): Promise<void> {
  let flag: boolean = false;
  let i1: number = y;
  let i2: number = x;
  let i3: number = 0;

  if (randint(10) > 1) {
    do {
      if (in_bounds(i1, i2) && g.cave[i1][i2].fopen && (g.cave[i1][i2].tptr === 0)) {
        flag = true;
      }

      if (!flag) {
        i1 = y + randint(3) - 2;
        i2 = x + randint(3) - 2;
        i3++;
      }
    } while (!(flag || (i3 > 9)));
  }

  if (flag) {
    const cur_pos: IRef<number> = box(0);

    popt(cur_pos);
    g.cave[i1][i2].tptr = cur_pos.get();
    g.t_list[cur_pos.get()] = clone(g.inventory[inven_max]);

    if (test_light(i1, i2)) {
      lite_spot(i1, i2);
    }
  } else {
    await msg_print(`The ${ objdes(inven_max, false) } dissapears.`);
  }
}


// moria.inc:3163 throw_object: a missile that hits is used up; one that misses drops near its target.
async function throw_object(): Promise<void> {
  const item_val: IRef<number> = box(0);
  const redraw: IRef<boolean> = box(false);

  if (g.inven_ctr === 0) {
    await msg_print('But you are not carrying anything.');
  } else if (await get_item(item_val, 'Fire/Throw which one?', redraw, 1, g.inven_ctr)) {
    const dir: IRef<number> = box(0);

    if (redraw.get()) {
      draw_cave();
    }

    if (await get_dir('Which direction?', dir, box(0), box(g.char_row), box(g.char_col))) {
      await desc_remain(item_val.get());

      if (g.py.flags.confused > 0) {
        await msg_print('You are confused...');

        do {
          dir.set(randint(9));
        } while (dir.get() === 5);
      }

      inven_throw(item_val.get());
      await fly(dir.get(), facts());
    }
  } else if (redraw.get()) {
    draw_cave();
  }
}


async function fly(dir: number, thrown: IThrow): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  let oldy: number = g.char_row;
  let oldx: number = g.char_col;
  let cur_dis: number = 0;
  let flag: boolean = false;

  do {
    move(dir, y, x);
    cur_dis++;

    if (test_light(oldy, oldx)) {
      lite_spot(oldy, oldx);
    }

    if (cur_dis > thrown.tdis) {
      flag = true;
    }

    const cell: cave_type = g.cave[y.get()][x.get()];

    if (cell.fopen && !flag) {
      if (cell.cptr > 1) {
        flag = true;
        await hit_with(cell.cptr, thrown, cur_dis, oldy, oldx);
      } else if (panel_contains(y.get(), x.get()) && test_light(y.get(), x.get())) {
        print(g.inventory[inven_max].tchar, y.get(), x.get());
      }
    } else {
      flag = true;
      await drop_throw(oldy, oldx);
    }

    oldy = y.get();
    oldx = x.get();
  } while (!flag);
}


async function hit_with(cptr: number, thrown: IThrow, cur_dis: number, oldy: number, oldx: number): Promise<void> {
  const monster: monster_type = g.m_list[cptr];

  thrown.tbth -= cur_dis;

  if (await test_hit(thrown.tbth, g.py.misc.lev, thrown.tpth, g.c_list[monster.mptr].ac)) {
    const i1: number = monster.mptr;
    let tdam: number;

    await msg_print(`The ${ objdes(inven_max, false) } hits the ${ g.c_list[i1].name }.`);
    tdam = tot_dam(g.inventory[inven_max], thrown.tdam, g.c_list[i1]);
    tdam = await critical_blow(g.inventory[inven_max].weight, thrown.tpth, tdam);

    const killed: number = await mon_take_hit(cptr, tdam);

    if (killed > 0) {
      await msg_print(`You have killed the ${ g.c_list[killed].name }.`);
    }
  } else {
    await drop_throw(oldy, oldx);
  }
}


// moria.inc:3384 bash: a creature, a door or a chest; strength and weight tell.
async function bash(): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  const tmp: IRef<number> = box(0);

  if (await get_dir('Which direction?', tmp, tmp, y, x)) {
    const cell: cave_type = g.cave[y.get()][x.get()];

    if (cell.cptr > 1) {
      if (g.py.flags.afraid > 0) {
        await msg_print('You are afraid!');
      } else {
        await bash_creature(cell, y.get(), x.get());
      }
    } else if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 105)) {
      await bash_door(cell, y.get(), x.get());
    } else if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 2)) {
      await bash_chest(g.t_list[cell.tptr]);
    } else {
      await msg_print('I do not see anything you can bash there.');
    }
  }
}


// A shield bash: the attack uses the shield's damage and the player's weight.
async function bash_creature(cell: cave_type, y: number, x: number): Promise<void> {
  const misc: player_misc_type = g.py.misc;
  const old_ptohit: number = misc.ptohit;
  const old_ptodam: number = misc.ptodam;
  const old_bth: number = misc.bth;

  g.inventory[inven_max] = clone(g.inventory[23]);
  g.inventory[23] = clone(g.blank_treasure);
  g.inventory[23].damage = g.inventory[27].damage;
  g.inventory[23].weight = g.py.stat.cstr;
  g.inventory[23].tval = 1;
  misc.bth = Math.trunc(real((g.py.stat.cstr + misc.wt) / 6.0));
  misc.ptohit = 0;
  misc.ptodam = Math.trunc(real(misc.wt / 75.0)) + 1;

  if (await py_attack(y, x)) {
    const monster: monster_type = g.m_list[cell.cptr];

    monster.stuned = Math.min(randint(2) + 1, 24);
    await msg_print(`The ${ g.c_list[monster.mptr].name } appears stunned!`);
  }

  g.inventory[23] = clone(g.inventory[inven_max]);
  misc.ptohit = old_ptohit;
  misc.ptodam = old_ptodam;
  misc.bth = old_bth;

  if (randint(140) > g.py.stat.cdex) {
    await msg_print('You are off-balance.');
    g.py.flags.paralysis = randint(3);
  }
}


async function bash_door(cell: cave_type, y: number, x: number): Promise<void> {
  const door: treasure_type = g.t_list[cell.tptr];

  await msg_print('You smash into the door!');

  if (await test_hit(g.py.misc.wt + g.py.stat.cstr, 0, 0, Math.abs(door.p1) + 150)) {
    await msg_print('The door crashes open!');
    g.t_list[cell.tptr] = clone(g.door_list[1]);
    g.t_list[cell.tptr].p1 = 1;
    cell.fopen = true;
    lite_spot(y, x);
  } else {
    await msg_print('The door holds firm.');
    g.py.flags.paralysis = 2;
  }
}


async function bash_chest(chest: treasure_type): Promise<void> {
  if (randint(10) === 1) {
    await msg_print('You have destroyed the chest...');
    await msg_print('and it\'s contents!');
    chest.name = '& ruined chest';
    chest.flags = 0;
  } else if ((uand(0x00000001, chest.flags) !== 0) && (randint(10) === 1)) {
    await msg_print('The lock breaks open!');
    chest.flags = uand(0xFFFFFFFE, chest.flags);
  }
}


// moria.inc:3484 jamdoor: a spike keeps a closed door shut.
async function jamdoor(): Promise<void> {
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);
  const tmp: IRef<number> = box(0);

  if (await get_dir('Which direction?', tmp, tmp, y, x)) {
    const cell: cave_type = g.cave[y.get()][x.get()];
    const tval: number = cell.tptr > 0 ? g.t_list[cell.tptr].tval : 0;

    if (tval === 105) {
      if (cell.cptr === 0) {
        await spike(g.t_list[cell.tptr]);
      } else {
        await msg_print(`The ${ g.c_list[g.m_list[cell.cptr].mptr].name } is in your way!`);
      }
    } else if (tval === 104) {
      await msg_print('The door must be closed first.');
    } else {
      await msg_print('That isn\'t a door!');
    }
  }
}


async function spike(door: treasure_type): Promise<void> {
  const i1: IRef<number> = box(0);

  if (find_range(pascalSet(13), i1, box(0))) {
    await msg_print('You jam the door with a spike.');

    if (g.inventory[i1.get()].number > 1) {
      g.inventory[i1.get()].number--;
    } else {
      inven_destroy(i1.get());
    }

    door.p1 = -Math.abs(door.p1) - 20;
  } else {
    await msg_print('But you have no spikes...');
  }
}


// moria.inc:3525 refill_lamp: a flask of oil into a lamp, not a torch.
async function refill_lamp(): Promise<void> {
  const i3: number = g.inventory[33].subval;

  if ((i3 > 0) && (i3 < 10)) {
    const i1: IRef<number> = box(0);

    if (find_range(pascalSet(77), i1, box(0))) {
      await msg_print('Your lamp is full.');
      g.inventory[33].p1 = Math.min(g.inventory[33].p1 + g.inventory[i1.get()].p1, obj$lamp_max);
      await desc_remain(i1.get());
      inven_destroy(i1.get());
    } else {
      await msg_print('You have no oil.');
    }
  } else {
    await msg_print('But you are not using a lamp.');
  }
}


// dungeon's `if (find_flag) then begin find_flag := false; move_char(5); end`, which recurs
// after nearly every message in the turn.
async function stop_running(): Promise<void> {
  if (g.find_flag) {
    g.find_flag = false;
    await move_char(5);
  }
}


// The light check at the top of the turn: the lamp in inventory[33] burns down.
async function burn_light(): Promise<void> {
  const light: treasure_type = g.inventory[33];

  if (dl.player_light) {
    if (light.p1 > 0) {
      light.p1--;

      if (light.p1 === 0) {
        await msg_print('Your light has gone out!');
        dl.player_light = false;
        g.find_flag = false;
        move_light(g.char_row, g.char_col, g.char_row, g.char_col);
      } else if ((light.p1 < 40) && (randint(5) === 1)) {
        if (g.find_flag) {
          g.find_flag = false;
          move_light(g.char_row, g.char_col, g.char_row, g.char_col);
        }

        await msg_print('Your light is growing faint.');
      }
    } else {
      dl.player_light = false;
      g.find_flag = false;
      move_light(g.char_row, g.char_col, g.char_row, g.char_col);
    }
  } else if (light.p1 > 0) {
    light.p1--;
    dl.player_light = true;
    move_light(g.char_row, g.char_col, g.char_row, g.char_col);
  }
}


function print_stats(): void {
  const printers: readonly [ number, () => void ][] = [
    [ 0x0001, prt_strength ],
    [ 0x0002, prt_dexterity ],
    [ 0x0004, prt_constitution ],
    [ 0x0008, prt_intelligence ],
    [ 0x0010, prt_wisdom ],
    [ 0x0020, prt_charisma ],
    [ 0x0040, prt_pac ],
    [ 0x0100, prt_mhp ],
    [ 0x0200, prt_title ],
    [ 0x0400, prt_level ],
  ];

  if (g.print_stat > 0) {
    for (let i1: number = 0; i1 < printers.length; i1++) {
      if (uand(printers[i1][0], g.print_stat) !== 0) {
        printers[i1][1]();
      }
    }
  }
}


// Hunger: the regeneration rate, and the warnings as food runs low.
async function check_food(): Promise<number> {
  const flags: player_flags_type = g.py.flags;
  let regen_amount: number = player$regen_normal;

  if (flags.food < player_food_alert) {
    if (flags.food < player_food_weak) {
      if (flags.food < 0) {
        regen_amount = 0;
      } else if (flags.food < player_food_faint) {
        regen_amount = player$regen_faint;
      } else if (flags.food < player_food_weak) {
        regen_amount = player$regen_weak;
      }

      if (uand(0x00000002, flags.status) === 0) {
        flags.status = uor(0x00000003, flags.status);
        await msg_print('You are getting weak from hunger.');
        await stop_running();
        prt_hunger();
      }

      if ((flags.food < player_food_faint) && (randint(8) === 1)) {
        flags.paralysis += randint(5);
        await msg_print('You faint from the lack of food.');
        await stop_running();
      }
    } else if (uand(0x00000001, flags.status) === 0) {
      flags.status = uor(0x00000001, flags.status);
      await msg_print('You are getting hungry.');
      await stop_running();
      prt_hunger();
    }
  }

  if (flags.speed < 0) {
    flags.food = flags.food - (flags.speed * flags.speed) - flags.food_digested;
  } else {
    flags.food -= flags.food_digested;
  }

  return regen_amount;
}


function regenerate(base: number): void {
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;
  let regen_amount: number = base;

  if (flags.regenerate) {
    regen_amount = real(regen_amount * 1.5);
  }

  if (flags.rest > 0) {
    regen_amount = real(regen_amount * 2);
  }

  if ((flags.poisoned < 1) && (misc.chp < misc.mhp)) {
    regenhp(regen_amount);
  }

  if (misc.cmana < misc.mana) {
    regenmana(regen_amount);
  }
}


/** A status that counts down: its bit is set while it runs, and cleared with a message when it ends. */
async function timed(counter: 'blind' | 'confused' | 'poisoned', bit: number, begin: () => Promise<void> | void, end: () => void,
                     message: string, each: () => Promise<void>): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags[counter] > 0) {
    if (uand(bit, flags.status) === 0) {
      flags.status = uor(bit, flags.status);
      await begin();
    }

    flags[counter]--;

    if (flags[counter] === 0) {
      flags.status = uand(~bit >>> 0, flags.status);
      end();
      await msg_print(message);
      await stop_running();
    } else {
      await each();
    }
  }
}


async function poison_damage(): Promise<void> {
  switch (con_adj()) {
    case -4:
      await take_hit(4, 'poison.');
      break;
    case -3:
    case -2:
      await take_hit(3, 'poison.');
      break;
    case -1:
      await take_hit(2, 'poison.');
      break;
    case 0:
      await take_hit(1, 'poison.');
      break;
    case 1:
    case 2:
    case 3:
      if (mod(g.turn, 2) === 0) {
        await take_hit(1, 'poison.');
      }

      break;
    case 4:
    case 5:
      if (mod(g.turn, 3) === 0) {
        await take_hit(1, 'poison.');
      }

      break;
    case 6:
      if (mod(g.turn, 4) === 0) {
        await take_hit(1, 'poison.');
      }

      break;
  }
}


async function nothing(): Promise<void> {
  // Nothing happens while the count runs.
}


async function check_afraid(): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags.afraid > 0) {
    if (uand(0x00000010, flags.status) === 0) {
      if ((flags.shero + flags.hero) > 0) {
        flags.afraid = 0;
      } else {
        flags.status = uor(0x00000010, flags.status);
        prt_afraid();
      }
    } else if ((flags.shero + flags.hero) > 0) {
      flags.afraid = 1;
    }

    flags.afraid--;

    if (flags.afraid === 0) {
      flags.status = uand(0xFFFFFFEF, flags.status);
      prt_afraid();
      await msg_print('You feel bolder now.');
      await stop_running();
    }
  }
}


async function check_speed(counter: 'fast' | 'slow', bit: number, change: number, start: string, finish: string): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags[counter] > 0) {
    if (uand(bit, flags.status) === 0) {
      flags.status = uor(bit, flags.status);
      await msg_print(start);
      change_speed(change);
      await stop_running();
    }

    flags[counter]--;

    if (flags[counter] === 0) {
      flags.status = uand(~bit >>> 0, flags.status);
      await msg_print(finish);
      change_speed(-change);
      await stop_running();
    }
  }
}


async function check_rest(): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags.rest > 0) {
    const command: IRef<string> = box('');

    flags.rest--;
    await inkey_delay(command, 0);
    dl.command = command.get();

    if ((flags.rest === 0) || (command.get() !== '\0')) {
      rest_off();
    }
  }
}


async function check_image_and_paralysis(): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags.image > 0) {
    flags.image--;

    if (flags.image === 0) {
      draw_cave();
    }
  }

  if (flags.paralysis > 0) {
    flags.paralysis--;

    if (flags.rest > 0) {
      rest_off();
    }

    if (dl.search_flag) {
      await search_off();
    }
  }

  if (flags.protevil > 0) {
    flags.protevil--;
  }
}


async function check_invulnerable(): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags.invuln > 0) {
    if (uand(0x00001000, flags.status) === 0) {
      flags.status = uor(0x00001000, flags.status);
      await stop_running();
      await msg_print('Your skin turns into steel!');
      g.py.misc.pac += 100;
      g.py.misc.dis_ac += 100;
      prt_pac();
    }

    flags.invuln--;

    if (flags.invuln === 0) {
      flags.status = uand(0xFFFFEFFF, flags.status);
      await stop_running();
      await msg_print('Your skin returns to normal...');
      g.py.misc.pac -= 100;
      g.py.misc.dis_ac -= 100;
      prt_pac();
    }
  }
}


async function check_hero(counter: 'hero' | 'shero', bit: number, hp: number, bth: number, start: string, finish: string): Promise<void> {
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;

  if (flags[counter] > 0) {
    if (uand(bit, flags.status) === 0) {
      flags.status = uor(bit, flags.status);
      await stop_running();
      misc.mhp += hp;
      misc.chp = real(misc.chp + hp);
      misc.bth += bth;
      misc.bthb += bth;
      await msg_print(start);
      prt_mhp();
    }

    flags[counter]--;

    if (flags[counter] === 0) {
      flags.status = uand(~bit >>> 0, flags.status);
      await stop_running();
      misc.mhp -= hp;

      if (misc.chp > misc.mhp) {
        misc.chp = misc.mhp;
      }

      misc.bth -= bth;
      misc.bthb -= bth;
      await msg_print(finish);
      prt_mhp();
    }
  }
}


async function check_blessed(): Promise<void> {
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;

  if (flags.blessed > 0) {
    if (uand(0x00008000, flags.status) === 0) {
      flags.status = uor(0x00008000, flags.status);
      await stop_running();
      misc.bth += 5;
      misc.bthb += 5;
      misc.pac += 2;
      misc.dis_ac += 2;
      await msg_print('You feel righteous!');
      prt_mhp();
      prt_pac();
    }

    flags.blessed--;

    if (flags.blessed === 0) {
      flags.status = uand(0xFFFF7FFF, flags.status);
      await stop_running();
      misc.bth -= 5;
      misc.bthb -= 5;
      misc.pac -= 2;
      misc.dis_ac -= 2;
      await msg_print('The prayer has expired.');
      prt_mhp();
      prt_pac();
    }
  }
}


function check_senses(): void {
  const flags: player_flags_type = g.py.flags;

  if (flags.resist_heat > 0) {
    flags.resist_heat--;
  }

  if (flags.resist_cold > 0) {
    flags.resist_cold--;
  }

  if (flags.detect_inv > 0) {
    if (uand(0x00010000, flags.status) === 0) {
      flags.status = uor(0x00010000, flags.status);
      flags.see_inv = true;
    }

    flags.detect_inv--;

    if (flags.detect_inv === 0) {
      flags.status = uand(0xFFFEFFFF, flags.status);
      flags.see_inv = false;
      py_bonuses(g.blank_treasure, 0);
    }
  }

  if (flags.tim_infra > 0) {
    if (uand(0x00020000, flags.status) === 0) {
      flags.status = uor(0x00020000, flags.status);
      flags.see_infra++;
    }

    flags.tim_infra--;

    if (flags.tim_infra === 0) {
      flags.status = uand(0xFFFDFFFF, flags.status);
      flags.see_infra--;
    }
  }
}


async function check_recall(): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  if (flags.word_recall > 0) {
    if (flags.word_recall === 1) {
      if (g.dun_level > 0) {
        await msg_print('You feel yourself yanked upwards!');
        g.dun_level = 0;
      } else if (g.py.misc.max_lev > 0) {
        await msg_print('You feel yourself yanked downwards!');
        g.dun_level = g.py.misc.max_lev;
      }

      dl.moria_flag = true;
      flags.paralysis++;
      flags.word_recall = 0;
    } else {
      flags.word_recall--;
    }
  }
}


interface IShown {
  chp: number;
  cmana: number;
}


function update_points(shown: IShown): void {
  const misc: player_misc_type = g.py.misc;

  if (!g.find_flag && (g.py.flags.rest < 1)) {
    if (shown.chp !== Math.trunc(misc.chp)) {
      if (misc.chp > misc.mhp) {
        misc.chp = misc.mhp;
      }

      prt_chp();
      shown.chp = Math.trunc(misc.chp);
    }

    if (shown.cmana !== Math.trunc(misc.cmana)) {
      if (misc.cmana > misc.mana) {
        misc.cmana = misc.mana;
      }

      prt_cmana();
      shown.cmana = Math.trunc(misc.cmana);
    }
  }
}


// The counters and messages of a turn, in the order the source runs them.
async function update_counters(shown: IShown): Promise<void> {
  regenerate(await check_food());
  await timed('blind', 0x00000004, async (): Promise<void> => {
    prt_map();
    prt_blind();

    if (dl.search_flag) {
      await search_off();
    }
  }, (): void => {
    prt_blind();
    prt_map();
  }, 'The veil of darkness lifts.', nothing);

  await timed('confused', 0x00000008, prt_confused, prt_confused, 'You feel less confused now.', nothing);
  await check_afraid();
  await timed('poisoned', 0x00000020, prt_poisoned, prt_poisoned, 'You feel better.', poison_damage);
  await check_speed('fast', 0x00000040, -1, 'You feel yourself moving faster.', 'You feel yourself slow down.');
  await check_speed('slow', 0x00000080, 1, 'You feel yourself moving slower.', 'You feel yourself speed up.');
  await check_rest();
  await check_image_and_paralysis();
  await check_invulnerable();
  await check_hero('hero', 0x00002000, 10, 12, 'You feel like a HERO!', 'The heroism wears off.');
  await check_hero('shero', 0x00004000, 20, 24, 'You feel like a SUPER HERO!', 'The super heroism wears off.');
  await check_blessed();
  check_senses();
  await check_recall();
  update_points(shown);
}


async function quit_command(): Promise<void> {
  const command: IRef<string> = box('');

  flush();

  if (await get_com('Enter \'Q\' to quit', command)) {
    if ([ 'q', 'Q' ].includes(command.get())) {
      if (g.total_winner) {
        dl.moria_flag = true;
        g.death = true;
      } else {
        clear(1, 1);
        exit();
      }
    }
  }

  dl.reset_flag = true;
}


async function password_command(): Promise<void> {
  if (g.wizard1) {
    await msg_print('Wizard mode off.');
    g.wizard1 = false;
    g.wizard2 = false;
  } else if (await check_pswd()) {
    await msg_print('Wizard mode on.');
  }

  dl.reset_flag = true;
}


async function save_command(): Promise<void> {
  if (g.total_winner) {
    await msg_print('You are a Total Winner, your character must be retired...');
    await msg_print('Use <Control>-Y to when you are ready to quit.');
  } else {
    if (dl.search_flag) {
      await search_off();
    }

    await save_char();
  }
}


// '$': LIB$SPAWN has no subprocess to give here.
async function shell_command(): Promise<void> {
  clear(1, 1);
  put_buffer('[Entering DCL shell, type "EOJ" to resume your game]', 1, 1);
  put_buffer(NO_SUBPROCESS_MESSAGE, 3, 1);
  await pause(24);
  clear(1, 1);
  draw_cave();
  dl.reset_flag = true;
}


async function find_command(): Promise<void> {
  const dir_val: IRef<number> = box(0);
  const y: IRef<number> = box(g.char_row);
  const x: IRef<number> = box(g.char_col);

  if (await get_dir('Which direction?', dir_val, ref(g, 'com_val'), y, x)) {
    g.find_flag = true;
    await move_char(dir_val.get());
  }
}


async function character_command(): Promise<void> {
  const command: IRef<string> = box('');

  if (await get_com('Print to file? (Y/N)', command)) {
    if ([ 'y', 'Y' ].includes(command.get())) {
      await file_character();
    } else if ([ 'n', 'N' ].includes(command.get())) {
      await change_name();
      draw_cave();
    }
  }

  dl.reset_flag = true;
}


async function location_command(): Promise<void> {
  dl.reset_flag = true;

  if ((g.py.flags.blind > 0) || no_light()) {
    await msg_print('You can\'t see your map.');
  } else {
    await msg_print(`Section [${ fmt(Math.trunc(real((g.char_row - 1) / outpage_height)) + 1, 1) },${
      fmt(Math.trunc(real((g.char_col - 1) / outpage_width)) + 1, 1) }]; Location = [${ fmt(g.char_row, 1) },${ fmt(g.char_col, 1) }]`);
  }
}


async function map_command(): Promise<void> {
  dl.reset_flag = true;

  if ((g.py.flags.blind > 0) || no_light()) {
    await msg_print('You can\'t see to draw a map.');
  } else {
    await print_map();
  }
}


async function search_mode_command(): Promise<void> {
  if (dl.search_flag) {
    await search_off();
    dl.reset_flag = true;
  } else if (g.py.flags.blind > 0) {
    await msg_print('You are incapable of searching while blind.');
  } else {
    search_on();
    dl.reset_flag = true;
  }
}


async function search_command(): Promise<void> {
  if (g.py.flags.blind > 0) {
    await msg_print('You are incapable of searching while blind.');
  } else {
    await search(g.char_row, g.char_col, g.py.misc.srh);
  }
}


async function free_move(action: () => Promise<void> | void): Promise<void> {
  await action();
  dl.reset_flag = true;
}


// The pack screens are free moves unless something is worn or taken off.
async function pack_command(which: string): Promise<void> {
  dl.reset_flag = true;

  if (await inven_command(which, 0, 0)) {
    draw_cave();
  }
}


// The item commands, by key.
const ITEM_COMMANDS: Readonly<Record<number, () => Promise<void>>> = {
  66: bash,
  68: disarm_trap,
  69: eat,
  70: refill_lamp,
  97: aim,
  98: examine_book,
  100: drop,
  101: (): Promise<void> => pack_command('e'),
  102: throw_object,
  105: (): Promise<void> => pack_command('i'),
  106: jamdoor,
  109: cast,
  112: pray,
  113: quaff,
  114: read,
  116: (): Promise<void> => pack_command('t'),
  117: use,
  119: (): Promise<void> => pack_command('w'),
  120: (): Promise<void> => pack_command('x'),
};


async function command(com_val: number): Promise<void> {
  if ([ 0, 3, 25 ].includes(com_val)) {
    await quit_command();
  } else if (com_val === 13) {
    await free_move((): Promise<void> => msg_print(g.old_msg));
  } else if (com_val === 16) {
    await password_command();
  } else if (com_val === 18) {
    await free_move(draw_cave);
  } else if (com_val === 26) {
    await save_command();
  } else if (com_val === 36) {
    await shell_command();
  } else if (com_val === 46) {
    await find_command();
  } else if (com_val === 47) {
    await free_move(ident_char);
  } else if ((com_val >= 49) && (com_val <= 57)) {
    await move_char(com_val - 48);

    if (com_val === 53) {
      await sleep(0);
      flush();
    }
  } else {
    await letter_command(com_val);
  }
}


async function letter_command(com_val: number): Promise<void> {
  if (com_val === 60) {
    await go_up();
  } else if (com_val === 62) {
    await go_down();
  } else if (com_val === 63) {
    await free_move(help);
  } else if (com_val === 67) {
    await character_command();
  } else if (com_val === 76) {
    await location_command();
  } else if (com_val === 80) {
    await map_command();
  } else if (com_val === 82) {
    await rest();
  } else if (com_val === 83) {
    await search_mode_command();
  } else if (com_val === 84) {
    await tunnel();
  } else if (com_val === 99) {
    await closeobject();
  } else if (com_val === 104) {
    await free_move(async (): Promise<void> => {
      await moria_help('');
      draw_cave();
    });
  } else if (com_val === 108) {
    await free_move(look);
  } else if (com_val === 111) {
    await openobject();
  } else if (com_val === 115) {
    await search_command();
  } else if (ITEM_COMMANDS[com_val] != null) {
    await ITEM_COMMANDS[com_val]();
  } else if (com_val === 118) {
    await game_version();
  } else if (g.wizard1) {
    dl.reset_flag = true;
    await wizard_command(com_val);
  } else {
    prt('Type \'?\' for help...', 1, 1);
    dl.reset_flag = true;
  }
}


async function wizard_command(com_val: number): Promise<void> {
  if (com_val === 4) {
    await level_command();
  } else if (com_val === 8) {
    await wizard_help();
  } else if (com_val === 20) {
    await teleport(100);
  } else if (com_val === 1) {
    cure_all();
  } else if (com_val === 9) {
    await ident_spell();
  } else if (com_val === 2) {
    await print_objects();
  } else if (com_val === 14) {
    await print_monsters();
  } else if (com_val === 12) {
    wizard_light();
  } else if (com_val === 22) {
    await restore_char();
  } else if (g.wizard2) {
    await god_command(com_val);
  } else {
    prt('Type \'?\' for help...', 1, 1);
  }
}


// ^A: remove curses, cure every malady and restore the stats.
function cure_all(): void {
  const stat: player_stat_type = g.py.stat;

  remove_curse();
  cure_blindness();
  cure_confusion();
  cure_poison();
  remove_fear();
  stat.cstr = stat.str;
  stat.cint = stat.int;
  stat.cwis = stat.wis;
  stat.cdex = stat.dex;
  stat.ccon = stat.con;
  stat.cchr = stat.chr;

  if (g.py.flags.slow > 1) {
    g.py.flags.slow = 1;
  }

  if (g.py.flags.image > 1) {
    g.py.flags.image = 1;
  }
}


async function level_command(): Promise<void> {
  const tmp_str: IRef<string> = box('');
  let i1: number = -1;

  prt('Go to which level (0 -1200) ? ', 1, 1);
  await get_string(tmp_str, 1, 31, 10);

  i1 = read_integer(tmp_str.get(), i1);

  if (i1 > -1) {
    g.dun_level = Math.min(i1, 1200);
    dl.moria_flag = true;
  } else {
    erase_line(g.msg_line, g.msg_line);
  }
}


async function god_command(com_val: number): Promise<void> {
  if (com_val === 10) {
    g.py.misc.exp = 2 * g.py.misc.exp;
    await prt_experience();
  } else if (com_val === 11) {
    summon_monster(box(g.char_row), box(g.char_col), true);
    await creatures(false);
  } else if (com_val === 6) {
    await mass_genocide();
  } else if (com_val === 7) {
    alloc_object(g.floor_set, 5, 10);
  } else if (com_val === 5) {
    await change_character();
  } else if (com_val === 23) {
    await wizard_create();
  } else {
    prt('Type \'?\' for help...', 1, 1);
  }
}


// moria.inc:3565 dungeon: one level, until the player leaves it, dies or quits.
export async function dungeon(): Promise<void> {
  const shown: IShown = { chp: Math.trunc(g.py.misc.chp), cmana: Math.trunc(g.py.misc.cmana) };

  dl.player_light = g.inventory[33].p1 > 0;

  if (g.dun_level > g.py.misc.max_lev) {
    g.py.misc.max_lev = g.dun_level;
  }

  if ((g.char_row === -1) || (g.char_col === -1)) {
    const y: IRef<number> = box(0);
    const x: IRef<number> = box(0);

    new_spot(y, x);
    g.char_row = y.get();
    g.char_col = x.get();
  }

  dl.moria_flag = false;
  g.cave_flag = false;
  g.find_flag = false;
  dl.search_flag = false;
  dl.teleport_flag = false;
  g.mon_tot_mult = 0;
  g.cave[g.char_row][g.char_col].cptr = 1;
  await move_char(5);
  await creatures(false);
  prt_depth();

  do {
    await one_turn(shown);
  } while (!dl.moria_flag);

  if (dl.search_flag) {
    await search_off();
  }
}


// One pass of dungeon's loop. The operating-hours check is not ported, as check_time is always true.
async function one_turn(shown: IShown): Promise<void> {
  g.turn++;

  if (randint(max_malloc_chance) === 1) {
    alloc_monster(g.floor_set, 1, max_sight, false);
  }

  print_stats();
  await burn_light();
  await update_counters(shown);

  if ((g.py.flags.paralysis < 1) && (g.py.flags.rest < 1) && !g.death) {
    do {
      await one_command();
    } while (!(!dl.reset_flag || dl.moria_flag));
  }

  if (dl.teleport_flag) {
    await teleport(100);
  }

  if (!dl.moria_flag) {
    await creatures(true);
  }
}


async function one_command(): Promise<void> {
  g.print_stat = 0;
  dl.reset_flag = false;

  if (g.py.flags.teleport && (randint(100) === 1)) {
    g.find_flag = false;
    await teleport(40);
  }

  if (!g.find_flag) {
    const key: IRef<string> = box('');

    print('', g.char_row, g.char_col);

    const save_msg_flag: boolean = g.msg_flag;

    await inkey(key);
    dl.command = key.get();

    if (save_msg_flag) {
      erase_line(g.msg_line, g.msg_line);
    }

    g.com_val = key.get().charCodeAt(0);
  }

  await command(g.com_val);
}
