// source/include/creature.inc: every monster's turn, its moves, attacks and spells.

import { inven_max, max_mon_mult, max_mons_level, max_sight, max_spell_dis, mon$drain_life, mon_mult_adj, obj$rune_prot } from './constants';
import { objdes } from './desc';
import { dl } from './dungeon-locals';
import { flush, msg_print, print } from './io';
import {
  bit_pos,
  con_adj,
  damroll,
  de_statp,
  distance,
  in_bounds,
  inven_destroy,
  los,
  move,
  player_saves,
  prt_chp,
  prt_constitution,
  prt_dexterity,
  prt_gold,
  prt_intelligence,
  prt_strength,
  prt_wisdom,
  randint,
  summon_monster,
  summon_undead,
  test_light,
  wis_adj,
} from './misc';
import {
  acid_dam,
  check_mon_lite,
  cold_dam,
  corrode_gas,
  delete_monster,
  delete_object,
  find_range,
  fire_dam,
  light_dam,
  lite_spot,
  move_char,
  move_rec,
  movement_rate,
  multiply_monster,
  panel_contains,
  py_bonuses,
  rest_off,
  search_off,
  take_hit,
  test_hit,
  unlite_spot,
} from './moria';
import { aggravate_monster, breath, lose_exp, teleport_away, teleport_to } from './spells';
import type { cave_type, creature_type, monster_type, player_flags_type, player_misc_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { Readv, box, clone, div, index, mod, pascalSet, real, round, substr, uand } from '../runtime/pascal';

type mm_type = number[];


// creature.inc:8 update_mon: shows or hides a monster as the player's sight of it changes.
async function update_mon(monptr: number): Promise<void> {
  const monster: monster_type = g.m_list[monptr];
  const cell: cave_type = g.cave[monster.fy][monster.fx];
  let flag: boolean = false;

  if ((monster.cdis <= max_sight) && (g.py.flags.blind < 1) && panel_contains(monster.fy, monster.fx)) {
    if (g.wizard2) {
      flag = true;
    } else if (los(g.char_row, g.char_col, monster.fy, monster.fx)) {
      flag = sees(monster, cell);
    }
  }

  if (flag) {
    if (!monster.ml) {
      print(g.c_list[monster.mptr].cchar, monster.fy, monster.fx);
      monster.ml = true;

      if (dl.search_flag) {
        await search_off();
      }

      if (g.py.flags.rest > 0) {
        rest_off();
      }

      flush();

      if (g.find_flag) {
        g.find_flag = false;
        await move_char(5);
      }
    }
  } else if (monster.ml) {
    monster.ml = false;

    if (cell.tl || cell.pl) {
      lite_spot(monster.fy, monster.fx);
    } else {
      unlite_spot(monster.fy, monster.fx);
    }
  }
}


// By light unless it is invisible, or by infravision if it is warm.
function sees(monster: monster_type, cell: cave_type): boolean {
  const creature: creature_type = g.c_list[monster.mptr];
  const flags: player_flags_type = g.py.flags;
  let flag: boolean = false;

  if (cell.pl || cell.tl) {
    flag = flags.see_inv || (uand(0x10000, creature.cmove) === 0);
  } else if ((flags.see_infra > 0) && (monster.cdis <= flags.see_infra) && (uand(0x2000, creature.cdefense) !== 0)) {
    flag = true;
  }

  return flag;
}


const MOVES: Readonly<Record<number, readonly [ number, readonly number[], readonly number[] ]>> = {
  0: [ 9, [ 8, 6, 7, 3 ], [ 6, 8, 3, 7 ] ],
  1: [ 6, [ 3, 9, 2, 8 ], [ 9, 3, 8, 2 ] ],
  2: [ 8, [ 9, 7, 6, 4 ], [ 7, 9, 4, 6 ] ],
  4: [ 7, [ 8, 4, 9, 1 ], [ 4, 8, 1, 9 ] ],
  5: [ 4, [ 1, 7, 8, 2 ], [ 7, 1, 2, 8 ] ],
  8: [ 3, [ 2, 6, 1, 9 ], [ 6, 2, 9, 1 ] ],
  10: [ 2, [ 1, 3, 4, 6 ], [ 3, 1, 6, 4 ] ],
  12: [ 1, [ 2, 4, 3, 7 ], [ 4, 2, 7, 3 ] ],
};


// The source's case labels 1,9 / 2,6 / 5,13 / 10,14 share their moves.
const SAME_MOVES: Readonly<Record<number, number>> = { 9: 1, 6: 2, 13: 5, 14: 10 };


// creature.inc:82 get_moves: the five directions to try, best first, toward the player.
function get_moves(monptr: number): mm_type {
  const y: number = g.m_list[monptr].fy - g.char_row;
  const x: number = g.m_list[monptr].fx - g.char_col;
  const ay: number = Math.abs(y);
  const ax: number = Math.abs(x);
  let move_val: number = y < 0 ? 8 : 0;
  let first: boolean;

  if (x > 0) {
    move_val += 4;
  }

  if (ay > real(ax * real(1.7321))) {
    move_val += 2;
  } else if (ax > real(ay * real(1.7321))) {
    move_val += 1;
  }

  switch (move_val) {
    case 1:
    case 9:
    case 5:
    case 13:
      first = y < 0;
      break;
    case 2:
    case 6:
    case 10:
    case 14:
      first = x < 0;
      break;
    default:
      first = ay > ax;
      break;
  }

  const row: readonly [ number, readonly number[], readonly number[] ] = MOVES[SAME_MOVES[move_val] ?? move_val];

  return [ 0, row[0], ...(first ? row[1] : row[2]) ];
}


function random_moves(): mm_type {
  return [ 0, randint(9), randint(9), randint(9), randint(9), randint(9) ];
}


// The attack's name for the tombstone: 'The Balrog', or 'a Kobold' through objdes.
function died_from_name(creature: creature_type): string {
  const ddesc: string = uand(0x80000000, creature.cmove) !== 0 ? `The ${ creature.name }` : `& ${ creature.name }`;

  g.inventory[inven_max].name = ddesc;
  g.inventory[inven_max].number = 1;

  return objdes(inven_max, true);
}


const TO_HIT: Readonly<Record<number, number>> = {
  1: 60, 2: -3, 3: 10, 4: 10, 5: 10, 6: 0, 7: 10, 8: 10, 9: 0, 10: 2, 11: 2, 14: 5, 15: 0, 16: 0, 17: 2, 18: 0, 19: 5, 21: 20, 22: 5,
  23: 5, 24: 15,
};

const HOW: Readonly<Record<number, string>> = {
  1: 'hits you.', 2: 'bites you.', 3: 'claws you.', 4: 'stings you.', 5: 'touches you.', 6: 'kicks you.', 7: 'gazes at you.',
  8: 'breathes on you.', 9: 'spits on you.', 10: 'makes a horrible wail.', 11: 'embraces you.', 12: 'crawls on you.',
  13: 'releases a cloud of spores.', 14: 'begs you for money.', 16: 'crushes you.', 17: 'tramples you.', 18: 'drools on you.',
  99: 'is repelled.',
};

const INSULTS: readonly string[] = [
  'insults you!', 'insults your mother!', 'gives you the finger!', 'humiliates you!', 'wets on your leg!', 'defiles you!',
  'dances around you!', 'makes obscene gestures!', 'moons you!!!',
];


async function attack_lands(atype: number, level: number): Promise<boolean> {
  const misc: player_misc_type = g.py.misc;
  let flag: boolean = false;

  if (TO_HIT[atype] != null) {
    flag = await test_hit(TO_HIT[atype], level, 0, misc.pac + misc.ptoac);
  } else if (atype === 12) {
    flag = (await test_hit(5, level, 0, misc.lev)) && (misc.au > 0);
  } else if (atype === 13) {
    flag = (await test_hit(2, level, 0, misc.lev)) && (g.inven_ctr > 0);
  } else if ((atype === 20) || (atype === 99)) {
    flag = true;
  }

  return flag;
}


async function describe_attack(adesc: number, cdesc: string): Promise<void> {
  if (adesc === 15) {
    await msg_print('You\'ve been slimed!');
  } else if (adesc === 19) {
    await msg_print(cdesc + INSULTS[randint(9) - 1]);
  } else if (HOW[adesc] != null) {
    await msg_print(cdesc + HOW[adesc]);
  }
}


// creature.inc:242 make_attack: each of the creature's attacks, from its '|'-separated damage string.
async function make_attack(monptr: number): Promise<void> {
  const monster: monster_type = g.m_list[monptr];
  const creature: creature_type = g.c_list[monster.mptr];
  let attstr: string = creature.damage;
  let cdesc: string;

  if ((uand(0x10000, creature.cmove) !== 0) && !g.py.flags.see_inv) {
    cdesc = 'It ';
  } else if (g.py.flags.blind > 0) {
    cdesc = 'It ';
  } else if (!monster.ml) {
    cdesc = 'It ';
  } else {
    cdesc = `The ${ creature.name } `;
  }

  const ddesc: string = died_from_name(creature);

  while (attstr.length > 0) {
    const xpos: number = index(attstr, '|');
    let attx: string;

    if (xpos > 0) {
      attx = substr(attstr, 1, xpos - 1);
      attstr = substr(attstr, xpos + 1, attstr.length - xpos);
    } else {
      attx = attstr;
      attstr = '';
    }

    const line: Readv = new Readv(attx);
    let atype: number = line.integer();
    let adesc: number = line.integer();
    // damstr is varying [5]: READV fills it and stops, so '5 1 10d12' rolls ' 10d1'.
    const damstr: string = line.rest().substring(0, 5);

    if ((g.py.flags.protevil > 0) && (uand(creature.cdefense, 0x0004) !== 0) && ((g.py.misc.lev + 1) > creature.level)) {
      atype = 99;
      adesc = 99;
    }

    if (await attack_lands(atype, creature.level)) {
      await describe_attack(adesc, cdesc);
      await attack_effect(atype, monptr, damstr, ddesc);
    } else if ([ 1, 2, 3, 6 ].includes(adesc)) {
      await msg_print(`${ cdesc }misses you.`);
    }
  }
}


async function attack_effect(atype: number, monptr: number, damstr: string, ddesc: string): Promise<void> {
  const monster: monster_type = g.m_list[monptr];
  const level: number = g.c_list[monster.mptr].level;
  const flags: player_flags_type = g.py.flags;
  const misc: player_misc_type = g.py.misc;

  switch (atype) {
    case 1: {
      let dam: number = damroll(damstr);

      dam -= round(real(real((misc.pac + misc.ptoac) / 200.0) * dam));
      await take_hit(dam, ddesc);
      prt_chp();
      break;
    }
    case 2:
      await take_hit(damroll(damstr), ddesc);

      if (flags.sustain_str) {
        await msg_print('You feel weaker for a moment, then it passes.');
      } else if (randint(2) === 1) {
        await msg_print('You feel weaker.');
        g.py.stat.cstr = de_statp(g.py.stat.cstr);
        prt_strength();
      }

      prt_chp();
      break;
    case 3:
      await take_hit(damroll(damstr), ddesc);

      if (randint(2) === 1) {
        if (flags.confused < 1) {
          await msg_print('You feel confused.');
          flags.confused += randint(level);
        }

        flags.confused += 3;
      }

      prt_chp();
      break;
    case 4:
      await take_hit(damroll(damstr), ddesc);

      if (player_saves(wis_adj())) {
        await msg_print('You resist the effects!');
      } else if (flags.afraid < 1) {
        await msg_print('You are suddenly afraid!');
        flags.afraid += 3 + randint(level);
      } else {
        flags.afraid += 3;
      }

      prt_chp();
      break;
    case 5:
      await msg_print('You are enveloped in flames!');
      await fire_dam(damroll(damstr), ddesc);
      break;
    case 6:
      await msg_print('You are covered in acid!');
      await acid_dam(damroll(damstr), ddesc);
      break;
    case 7:
      await msg_print('You are covered with frost!');
      await cold_dam(damroll(damstr), ddesc);
      break;
    case 8:
      await msg_print('Lightning strikes you!');
      await light_dam(damroll(damstr), ddesc);
      break;
    case 9:
      await msg_print('A stinging red gas swirls about you.');
      await corrode_gas(ddesc);
      await take_hit(damroll(damstr), ddesc);
      prt_chp();
      break;
    default:
      await later_effect(atype, monptr, damstr, ddesc);
      break;
  }
}


async function later_effect(atype: number, monptr: number, damstr: string, ddesc: string): Promise<void> {
  const level: number = g.c_list[g.m_list[monptr].mptr].level;
  const flags: player_flags_type = g.py.flags;

  switch (atype) {
    case 10:
      await take_hit(damroll(damstr), ddesc);

      if (flags.blind < 1) {
        flags.blind += 10 + randint(level);
        await msg_print('Your eyes begin to sting.');
        await msg_print(' ');
      }

      flags.blind += 5;
      prt_chp();
      break;
    case 11:
      await take_hit(damroll(damstr), ddesc);

      if (player_saves(con_adj())) {
        await msg_print('You resist the effects!');
      } else if (flags.paralysis < 1) {
        if (flags.free_act) {
          await msg_print('You are unaffected.');
        } else {
          flags.paralysis = randint(level) + 3;
          await msg_print('You are paralyzed.');
        }
      }

      prt_chp();
      break;
    case 12:
      await steal_money(monptr);
      break;
    case 13:
      await steal_object(monptr);
      break;
    case 14:
      await take_hit(damroll(damstr), ddesc);
      prt_chp();
      await msg_print('You feel very sick.');
      flags.poisoned = flags.poisoned + randint(level) + 5;
      break;
    default:
      await drain_effect(atype, monptr, damstr, ddesc);
      break;
  }
}


async function steal_money(monptr: number): Promise<void> {
  const misc: player_misc_type = g.py.misc;

  if ((randint(124) < g.py.stat.cdex) && (g.py.flags.paralysis < 1)) {
    await msg_print('You quickly protect your money pouch!');
  } else {
    const i1: number = Math.trunc(real(misc.au / 10)) + randint(25);

    misc.au = i1 > misc.au ? 0 : misc.au - i1;
    await msg_print('Your purse feels lighter.');
    prt_gold();
  }

  if (randint(2) === 1) {
    await msg_print('There is a puff of smoke!');
    teleport_away(monptr, max_sight);
  }
}


async function steal_object(monptr: number): Promise<void> {
  if ((randint(124) < g.py.stat.cdex) && (g.py.flags.paralysis < 1)) {
    await msg_print('You grab hold of your backpack!');
  } else {
    inven_destroy(randint(g.inven_ctr));
    await msg_print('Your backpack feels lighter.');
  }

  if (randint(2) === 1) {
    await msg_print('There is a puff of smoke!');
    teleport_away(monptr, max_sight);
  }
}


async function lose_stat(damstr: string, ddesc: string, sustained: boolean, resisted: readonly string[], lost: string,
                         stat: 'cdex' | 'ccon' | 'cint' | 'cwis', show: () => void): Promise<void> {
  await take_hit(damroll(damstr), ddesc);

  if (sustained) {
    for (let i1: number = 0; i1 < resisted.length; i1++) {
      await msg_print(resisted[i1]);
    }
  } else {
    await msg_print(lost);
    g.py.stat[stat] = de_statp(g.py.stat[stat]);
    show();
  }

  prt_chp();
}


async function drain_effect(atype: number, monptr: number, damstr: string, ddesc: string): Promise<void> {
  const flags: player_flags_type = g.py.flags;

  switch (atype) {
    case 15:
      await lose_stat(damstr, ddesc, flags.sustain_dex, [ 'You feel clumsy for a moment, then it passes.' ], 'You feel more clumsy.',
        'cdex', prt_dexterity);
      break;
    case 16:
      await lose_stat(damstr, ddesc, flags.sustain_con, [ 'Your body resists the effects of the disease.' ], 'Your health is damaged!',
        'ccon', prt_constitution);
      break;
    case 17:
      await lose_stat(damstr, ddesc, flags.sustain_int, [ 'You feel your memories fading...', 'Your memories are suddenly restored!' ],
        'You feel your memories fading...', 'cint', prt_intelligence);
      break;
    case 18:
      await lose_stat(damstr, ddesc, flags.sustain_wis, [ 'Your wisdom is sustained.' ], 'Your wisdom is drained.', 'cwis', prt_wisdom);
      break;
    case 19:
      await msg_print('You feel your life draining away!');
      await lose_exp(damroll(damstr) + div(g.py.misc.exp, 100) * mon$drain_life);
      break;
    case 20:
      aggravate_monster(5);
      break;
    case 21:
      await disenchant();
      break;
    default:
      await eat_effect(atype, monptr);
      break;
  }
}


async function disenchant(): Promise<void> {
  const i1: number = [ 23, 26, 27, 32, 28, 24 ][randint(6) - 1];
  const item: treasure_type = g.inventory[i1];
  let flag: boolean = false;

  if (item.tohit > 0) {
    item.tohit -= randint(2);
    flag = true;
  }

  if (item.todam > 0) {
    item.todam -= randint(2);
    flag = true;
  }

  if (item.toac > 0) {
    item.toac -= randint(2);
    flag = true;
  }

  if (flag) {
    await msg_print('There is a static feeling in the air...');
    py_bonuses(g.blank_treasure, 1);
  }
}


// Eat food, light or charges. Charges eaten feed the monster's hit points.
async function eat_effect(atype: number, monptr: number): Promise<void> {
  if (atype === 22) {
    const i1: IRef<number> = box(0);

    if (find_range(pascalSet(80), i1, box(0))) {
      inven_destroy(i1.get());
    }
  } else if (atype === 23) {
    const light: treasure_type = g.inventory[33];

    if (light.p1 > 0) {
      light.p1 = Math.max(light.p1 - 250 - randint(250), 1);
      await msg_print('Your light dims...');
    }
  } else if ((atype === 24) && (g.inven_ctr > 0)) {
    const item: treasure_type = g.inventory[randint(g.inven_ctr)];

    if ([ 55, 60, 65 ].includes(item.tval) && (item.p1 > 0)) {
      g.m_list[monptr].hp += g.c_list[g.m_list[monptr].mptr].level * item.p1;
      item.p1 = 0;
      await msg_print('Energy drains from your pack!');
    }
  }
}


// A door in the way: those that can open doors do, the rest must bash them. `level` in the
// source's lock test is the door's own (0), since the monster's record has none.
function door_in_way(monptr: number, cell: cave_type, newy: number, newx: number, movebits: number): boolean {
  const door: treasure_type = g.t_list[cell.tptr];
  const monster: monster_type = g.m_list[monptr];
  let tflag: boolean = false;

  if (uand(movebits, 0x20000) !== 0) {
    if (door.tval === 105) {
      if (door.p1 === 0) {
        tflag = !open_seen_door(cell, newy, newx, false);
      } else if (door.p1 > 0) {
        if (randint(100 - door.level) < 5) {
          door.p1 = 0;
        }
      } else if (randint(monster.hp) > (10 + Math.abs(door.p1))) {
        door.p1 = 0;
      }
    } else if (door.tval === 109) {
      tflag = !open_seen_door(cell, newy, newx, false);
    }
  } else if ((door.tval === 105) && (randint(monster.hp) > (Math.abs(door.p1) + 20))) {
    tflag = !open_seen_door(cell, newy, newx, true);
  }

  return tflag;
}


// A door the player can see opens in front of them, and the monster waits a turn.
function open_seen_door(cell: cave_type, newy: number, newx: number, bashed: boolean): boolean {
  let opened: boolean = false;

  if (cell.fm && los(g.char_row, g.char_col, newy, newx)) {
    g.t_list[cell.tptr] = clone(g.door_list[1]);

    if (bashed) {
      g.t_list[cell.tptr].p1 = randint(2) - 1;
    }

    cell.fopen = true;
    lite_spot(newy, newx);
    opened = true;
  }

  return opened;
}


// creature.inc:665 make_move: tries up to five directions.
async function make_move(monptr: number, mm: mm_type): Promise<boolean> {
  const movebits: number = g.c_list[g.m_list[monptr].mptr].cmove;
  let i1: number = 1;
  let flag: boolean = false;
  let result: boolean = false;

  do {
    const newy: IRef<number> = box(g.m_list[monptr].fy);
    const newx: IRef<number> = box(g.m_list[monptr].fx);

    move(mm[i1], newy, newx);

    const cell: cave_type = g.cave[newy.get()][newx.get()];

    if (cell.fval !== 15) {
      let tflag: boolean = false;

      if (cell.fopen) {
        tflag = true;
      } else if (uand(movebits, 0x40000) !== 0) {
        tflag = true;
      } else if (cell.tptr > 0) {
        tflag = door_in_way(monptr, cell, newy.get(), newx.get(), movebits);
      }

      if (tflag) {
        tflag = await past_rune(monptr, cell, newy.get(), newx.get());
      }

      if (tflag) {
        if (cell.cptr === 1) {
          await attack_player(monptr);
          tflag = false;
          flag = true;
        } else if ((cell.cptr > 1) && ((newy.get() !== g.m_list[monptr].fy) || (newx.get() !== g.m_list[monptr].fx))) {
          if (uand(movebits, 0x80000) !== 0) {
            delete_monster(cell.cptr);
          } else {
            tflag = false;
          }
        }
      }

      if (tflag) {
        const monster: monster_type = g.m_list[monptr];

        if ((uand(movebits, 0x100000) !== 0) && (cell.tptr > 0) && (g.t_list[cell.tptr].tval < 100)) {
          delete_object(newy.get(), newx.get());
        }

        move_rec(monster.fy, monster.fx, newy.get(), newx.get());
        monster.fy = newy.get();
        monster.fx = newx.get();
        flag = true;
        result = true;
      }
    }

    i1++;
  } while (!(flag || (i1 > 5)));

  return result;
}


// A rune of protection holds the monster back unless it breaks it.
async function past_rune(monptr: number, cell: cave_type, newy: number, newx: number): Promise<boolean> {
  let tflag: boolean = true;

  if ((cell.tptr > 0) && (g.t_list[cell.tptr].tval === 102) && (g.t_list[cell.tptr].subval === 99)) {
    if (randint(obj$rune_prot) < g.c_list[g.m_list[monptr].mptr].level) {
      if ((newy === g.char_row) && (newx === g.char_col)) {
        await msg_print('The rune of protection is broken!');
      }

      delete_object(newy, newx);
    } else {
      tflag = false;
    }
  }

  return tflag;
}


async function attack_player(monptr: number): Promise<void> {
  if (!g.m_list[monptr].ml) {
    await update_mon(monptr);
  }

  if (g.find_flag) {
    g.find_flag = false;
    await move_char(5);
  }

  await make_attack(monptr);

  if (g.py.flags.confuse_monster) {
    const monster: monster_type = g.m_list[monptr];
    const creature: creature_type = g.c_list[monster.mptr];

    await msg_print('Your hands stop glowing.');
    g.py.flags.confuse_monster = false;

    if ((randint(max_mons_level) < creature.level) || (uand(0x1000, creature.cdefense) !== 0)) {
      await msg_print(`The ${ creature.name } is unaffected.`);
    } else {
      await msg_print(`The ${ creature.name } appears confused.`);
      monster.confused = true;
    }
  }
}


// creature.inc:845 cast_spell: true when the creature moved; took_turn when it cast.
async function cast_spell(monptr: number, took_turn: IRef<boolean>): Promise<boolean> {
  const monster: monster_type = g.m_list[monptr];
  const creature: creature_type = g.c_list[monster.mptr];
  const chance: number = uand(creature.spells, 0x0000000F);

  if (randint(chance) !== 1) {
    took_turn.set(false);
  } else if (monster.cdis > max_spell_dis) {
    took_turn.set(false);
  } else if (!los(g.char_row, g.char_col, monster.fy, monster.fx)) {
    took_turn.set(false);
  } else {
    let seen: boolean = monster.ml;

    if ((uand(0x10000, creature.cmove) !== 0) && !g.py.flags.see_inv) {
      seen = false;
    } else if (g.py.flags.blind > 0) {
      seen = false;
    }

    took_turn.set(true);
    await throw_spell(monptr, seen ? `The ${ creature.name } ` : 'It ', died_from_name(creature));
  }

  return false;
}


function choose_spell(spells: number): number {
  const i1: IRef<number> = box(uand(spells, 0xFFFFFFF0));
  const spell_choice: number[] = [];

  while (i1.get() !== 0) {
    spell_choice.push(bit_pos(i1));
  }

  return spell_choice[randint(spell_choice.length) - 1];
}


async function resisted_spell(cdesc: string): Promise<boolean> {
  await msg_print(`${ cdesc }casts a spell.`);

  const resisted: boolean = player_saves(wis_adj() + g.py.misc.lev);

  if (resisted) {
    await msg_print('You resist the affects of the spell.');
  }

  return resisted;
}


async function throw_spell(monptr: number, cdesc: string, ddesc: string): Promise<void> {
  const monster: monster_type = g.m_list[monptr];
  const flags: player_flags_type = g.py.flags;
  const thrown_spell: number = choose_spell(g.c_list[monster.mptr].spells);

  switch (thrown_spell) {
    case 5:
      teleport_away(monptr, 5);
      break;
    case 6:
      teleport_away(monptr, max_sight);
      break;
    case 7:
      await msg_print(`${ cdesc }casts a spell.`);
      await msg_print(' ');
      await teleport_to(monster.fy, monster.fx);
      break;
    case 8:
      if (!(await resisted_spell(cdesc))) {
        await take_hit(damroll('3d8'), ddesc);
      }

      break;
    case 9:
      if (!(await resisted_spell(cdesc))) {
        await take_hit(damroll('8d8'), ddesc);
      }

      break;
    case 10:
      await msg_print(`${ cdesc }casts a spell.`);

      if (flags.free_act) {
        await msg_print('You are unaffected...');
      } else if (player_saves(wis_adj() + g.py.misc.lev)) {
        await msg_print('You resist the affects of the spell.');
      } else if (flags.paralysis > 0) {
        flags.paralysis += 2;
      } else {
        flags.paralysis = randint(5) + 4;
      }

      break;
    case 11:
      if (!(await resisted_spell(cdesc))) {
        if (flags.blind > 0) {
          flags.blind += 6;
        } else {
          flags.blind = flags.blind + 12 + randint(3);
          await msg_print(' ');
        }
      }

      break;
    default:
      await more_spells(thrown_spell, monptr, cdesc, ddesc);
      break;
  }
}


async function more_spells(thrown_spell: number, monptr: number, cdesc: string, ddesc: string): Promise<void> {
  const monster: monster_type = g.m_list[monptr];
  const flags: player_flags_type = g.py.flags;

  switch (thrown_spell) {
    case 12:
      if (!(await resisted_spell(cdesc))) {
        flags.confused = flags.confused > 0 ? flags.confused + 2 : randint(5) + 3;
      }

      break;
    case 13:
      if (!(await resisted_spell(cdesc))) {
        flags.afraid = flags.afraid > 0 ? flags.afraid + 2 : randint(5) + 3;
      }

      break;
    case 14: {
      const y: IRef<number> = box(g.char_row);
      const x: IRef<number> = box(g.char_col);

      await msg_print(`${ cdesc }magically summons a monster!`);
      summon_monster(y, x, false);
      check_mon_lite(y.get(), x.get());
      break;
    }
    case 15: {
      const y: IRef<number> = box(g.char_row);
      const x: IRef<number> = box(g.char_col);

      await msg_print(`${ cdesc }magically summons an undead!`);
      summon_undead(y, x);
      check_mon_lite(y.get(), x.get());
      break;
    }
    case 16:
      await msg_print(`${ cdesc }casts a spell.`);

      if (flags.free_act) {
        await msg_print('You are unaffected...');
      } else if (player_saves(wis_adj() + g.py.misc.lev)) {
        await msg_print('You resist the affects of the spell.');
      } else {
        flags.slow = flags.slow > 0 ? flags.slow + 2 : randint(5) + 3;
      }

      break;
    case 17:
      await drain_mana(monptr, cdesc);
      break;
    default:
      await breathe(thrown_spell, monster, cdesc, ddesc);
      break;
  }
}


async function drain_mana(monptr: number, cdesc: string): Promise<void> {
  const monster: monster_type = g.m_list[monptr];
  const misc: player_misc_type = g.py.misc;

  if (Math.trunc(misc.cmana) > 0) {
    await msg_print(`${ cdesc }draws psychic energy from you!`);
    await msg_print(`${ cdesc }appears healthier...`);

    let r1: number = div(randint(g.c_list[monster.mptr].level), 2) + 1;

    if (r1 > misc.cmana) {
      r1 = misc.cmana;
    }

    misc.cmana = real(misc.cmana - r1);
    monster.hp += 6 * Math.trunc(r1);
  }
}


const BREATHS: Readonly<Record<number, readonly [ number, number, string ]>> = {
  20: [ 1, 4.0, 'breathes lightning.' ],
  21: [ 2, 3.0, 'breathes gas.' ],
  22: [ 3, 3.0, 'breathes acid.' ],
  23: [ 4, 3.0, 'breathes frost.' ],
  24: [ 5, 3.0, 'breathes fire.' ],
};


async function breathe(thrown_spell: number, monster: monster_type, cdesc: string, ddesc: string): Promise<void> {
  const kind: readonly [ number, number, string ] | undefined = BREATHS[thrown_spell];

  if (kind != null) {
    await msg_print(cdesc + kind[2]);
    await breath(kind[0], g.char_row, g.char_col, Math.trunc(real(monster.hp / kind[1])), ddesc);
  } else {
    await msg_print('Creature cast unknown spell.');
  }
}


// creature.inc:72 mon_move: breeding, confusion, spells, then movement by the creature's kind.
async function mon_move(monptr: number): Promise<boolean> {
  const creature: creature_type = g.c_list[g.m_list[monptr].mptr];
  const move_test: IRef<boolean> = box(false);
  let result: boolean = false;

  breed(monptr, creature);

  if (g.m_list[monptr].confused) {
    result = await make_move(monptr, random_moves());

    if (randint(8) === 1) {
      g.m_list[monptr].confused = false;
    }

    move_test.set(true);
  } else if (creature.spells > 0) {
    result = await cast_spell(monptr, move_test);
  }

  if (!move_test.get()) {
    result = await wander(monptr, creature, result);
  }

  return result;
}


function breed(monptr: number, creature: creature_type): void {
  if ((uand(creature.cmove, 0x00200000) !== 0) && (max_mon_mult >= g.mon_tot_mult) && (mod(g.py.flags.rest, mon_mult_adj) === 0)) {
    const monster: monster_type = g.m_list[monptr];
    let i3: number = 0;

    for (let i1: number = monster.fy - 1; i1 <= monster.fy + 1; i1++) {
      for (let i2: number = monster.fx - 1; i2 <= monster.fx + 1; i2++) {
        if (in_bounds(i1, i2) && (g.cave[i1][i2].cptr > 1)) {
          i3++;
        }
      }
    }

    if ((i3 < 4) && (randint(i3 * mon_mult_adj) === 1)) {
      multiply_monster(monster.fy, monster.fx, monster.mptr, false);
    }
  }
}


async function wander(monptr: number, creature: creature_type, moved: boolean): Promise<boolean> {
  let result: boolean = moved;

  if ((randint(100) < 75) && (uand(creature.cmove, 0x00000020) !== 0)) {
    result = await make_move(monptr, random_moves());
  } else if ((randint(100) < 40) && (uand(creature.cmove, 0x00000010) !== 0)) {
    result = await make_move(monptr, random_moves());
  } else if ((randint(100) < 20) && (uand(creature.cmove, 0x00000008) !== 0)) {
    result = await make_move(monptr, random_moves());
  } else if (uand(creature.cmove, 0x00000002) !== 0) {
    result = await make_move(monptr, randint(200) === 1 ? random_moves() : get_moves(monptr));
  } else if ((uand(creature.cmove, 0x00000001) !== 0) && (g.m_list[monptr].cdis < 2)) {
    result = await make_move(monptr, get_moves(monptr));
  }

  return result;
}


// The source works on `with m_list[i1]`, the slot rather than the record: a creature that breeds
// onto its own square and eats itself hands the slot straight to its newborn, which the rest of
// its turn then sees. So the slot is read afresh each time.
async function one_monster(i1: number, attack: boolean): Promise<void> {
  const monster: () => monster_type = (): monster_type => g.m_list[i1];

  monster().cdis = distance(g.char_row, g.char_col, monster().fy, monster().fx);

  if (attack && (movement_rate(monster().cspeed) > 0)) {
    const moves: number = movement_rate(monster().cspeed);

    for (let i2: number = 1; i2 <= moves; i2++) {
      await monster_step(i1);
      await update_mon(i1);
    }
  } else {
    await update_mon(i1);
  }
}


async function monster_step(i1: number): Promise<void> {
  const monster: () => monster_type = (): monster_type => g.m_list[i1];

  if ((monster().cdis <= g.c_list[monster().mptr].aaf) || monster().ml) {
    if (monster().csleep > 0) {
      if (g.py.flags.aggravate) {
        monster().csleep = 0;
      } else if ((g.py.flags.rest < 1) && (randint(10) > g.py.misc.stl)) {
        monster().csleep -= Math.trunc(real(75.0 / monster().cdis));
      }
    }

    if (monster().stuned > 0) {
      monster().stuned--;
    }

    if ((monster().csleep <= 0) && (monster().stuned <= 0)) {
      const moldy: number = monster().fy;
      const moldx: number = monster().fx;

      if ((await mon_move(i1)) && monster().ml) {
        monster().ml = false;

        if (test_light(moldy, moldx)) {
          lite_spot(moldy, moldx);
        } else {
          unlite_spot(moldy, moldx);
        }
      }
    }
  }
}


// creature.inc:2 creatures: each monster in turn; with attack false they only show or hide.
export async function creatures(attack: boolean): Promise<void> {
  if (g.muptr > 0) {
    let i1: number = g.muptr;

    do {
      await one_monster(i1, attack);
      i1 = g.m_list[i1].nptr;
    } while (!((i1 === 0) || dl.moria_flag));
  }
}
