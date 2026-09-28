// source/include/create.inc: character creation.

import { max_class, max_races, player_exit_pause } from './constants';
import { moria_help } from './help';
import { clear, inkey_flush, pause_exit, prt, put_buffer } from './io';
import {
  con_adj,
  de_statp,
  get_name,
  in_statp,
  put_character,
  put_misc1,
  put_misc2,
  put_misc3,
  put_stats,
  randint,
  randnor,
  toac_adj,
  todam_adj,
  todis_adj,
  tohit_adj,
} from './misc';
import type { class_type, player_misc_type, player_stat_type, race_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, index, real, substr, uand } from '../runtime/pascal';

const LETTERS: string = 'abcdefghijklmnopqrstuvwxyz';


// create.inc:5 get_stat
function get_stat(): number {
  return randint(4) + randint(4) + randint(4) + 5;
}


// create.inc:15 change_stat
function change_stat(cur_stat: number, amount: number): number {
  let stat: number = cur_stat;

  if (amount < 0) {
    for (let i: number = -1; i >= amount; i--) {
      stat = de_statp(stat);
    }
  } else {
    for (let i: number = 1; i <= amount; i++) {
      stat = in_statp(stat);
    }
  }

  return stat;
}


// create.inc:30 choose_race: false when the player asked for help instead.
async function choose_race(): Promise<boolean> {
  const s: IRef<string> = box('');
  let i3: number = 1;
  let i4: number = 3;
  let i5: number = 22;
  let chosen: boolean = false;
  let exit_flag: boolean = false;

  clear(21, 1);
  prt('Choose a race (? for Help):', 21, 3);

  for (let i2: number = 1; i2 <= max_races; i2++) {
    put_buffer(`${ String.fromCharCode(i3 + 96) }) ${ g.race[i2].trace }`, i5, i4);
    i3++;
    i4 += 15;

    if (i4 > 70) {
      i4 = 3;
      i5++;
    }
  }

  g.py.misc.race = '';
  put_buffer('', 21, 30);

  do {
    await inkey_flush(s);

    const i2: number = index(LETTERS, s.get());

    if ((i2 <= max_races) && (i2 >= 1)) {
      apply_race(i2);
      exit_flag = true;
      chosen = true;
      put_buffer(g.py.misc.race, 4, 15);
    } else if (s.get() === '?') {
      await moria_help('Character Races');
      exit_flag = true;
      chosen = false;
    }
  } while (!exit_flag);

  return chosen;
}


// The `with py do with race[i2] do` block of choose_race. Inside it the race's str_adj..chr_adj
// shadow the functions of those names; todam_adj, tohit_adj and toac_adj are still the functions.
function apply_race(i2: number): void {
  const race: race_type = g.race[i2];
  const misc: player_misc_type = g.py.misc;
  const stat: player_stat_type = g.py.stat;

  misc.prace = i2;
  misc.race = race.trace;
  stat.str = get_stat();
  stat.int = get_stat();
  stat.wis = get_stat();
  stat.dex = get_stat();
  stat.con = get_stat();
  stat.chr = get_stat();
  stat.str = change_stat(stat.str, race.str_adj);
  stat.int = change_stat(stat.int, race.int_adj);
  stat.wis = change_stat(stat.wis, race.wis_adj);
  stat.dex = change_stat(stat.dex, race.dex_adj);
  stat.con = change_stat(stat.con, race.con_adj);
  stat.chr = change_stat(stat.chr, race.chr_adj);
  copy_stats_to_current(stat);
  misc.srh = race.srh;
  misc.bth = race.bth;
  misc.bthb = race.bthb;
  misc.fos = race.fos;
  misc.stl = race.stl;
  misc.save = race.bsav;
  misc.hitdie = race.bhitdie;
  misc.lev = 1;
  misc.ptodam = todam_adj();
  misc.ptohit = tohit_adj();
  misc.ptoac = 0;
  misc.pac = toac_adj();
  misc.expfact = race.b_exp;
  g.py.flags.see_infra = race.infra;
}


function copy_stats_to_current(stat: player_stat_type): void {
  stat.cstr = stat.str;
  stat.cint = stat.int;
  stat.cwis = stat.wis;
  stat.cdex = stat.dex;
  stat.ccon = stat.con;
  stat.cchr = stat.chr;
}


// create.inc:112 print_history
function print_history(): void {
  put_buffer('Character Background', 14, 28);

  for (let i1: number = 1; i1 <= 5; i1++) {
    put_buffer(g.py.misc.history[i1], i1 + 14, 5);
  }
}


// create.inc:126 get_history: the racial background, which sets social class. Each race's
// history starts at chart (race-1)*3+1, and the parts run in ascending order.
function get_history(): void {
  let hist_ptr: number = (g.py.misc.prace - 1) * 3 + 1;
  let history_block: string = '';
  let social_class: number = randint(4);
  let cur_ptr: number = 0;

  do {
    let flag: boolean = false;

    do {
      cur_ptr++;

      if (g.background[cur_ptr].chart === hist_ptr) {
        const test_roll: number = randint(100);

        while (test_roll > g.background[cur_ptr].roll) {
          cur_ptr++;
        }

        const part: typeof g.background[number] = g.background[cur_ptr];

        history_block += part.info;
        social_class += part.bonus;

        if (hist_ptr > part.next) {
          cur_ptr = 0;
        }

        hist_ptr = part.next;
        flag = true;
      }
    } while (!flag);
  } while (hist_ptr >= 1);

  wrap_history(history_block);
  g.py.misc.sc = Math.min(Math.max(social_class, 1), 100);
}


// The second half of get_history: the block cut into lines of at most 70 at word breaks.
function wrap_history(history_block: string): void {
  const at: (position: number) => string = (position: number): string => history_block.charAt(position - 1);
  let start_pos: number = 1;
  let end_pos: number = history_block.length;
  let line_ctr: number = 1;
  let new_start: number = 0;
  let flag: boolean = false;

  while (at(end_pos) === ' ') {
    end_pos--;
  }

  do {
    while (at(start_pos) === ' ') {
      start_pos++;
    }

    let cur_len: number = end_pos - start_pos + 1;

    if (cur_len > 70) {
      cur_len = 70;

      while (at(start_pos + cur_len - 1) !== ' ') {
        cur_len--;
      }

      new_start = start_pos + cur_len;

      while (at(start_pos + cur_len - 1) === ' ') {
        cur_len--;
      }
    } else {
      flag = true;
    }

    g.py.misc.history[line_ctr] = substr(history_block, start_pos, cur_len);
    line_ctr++;
    start_pos = new_start;
  } while (!flag);
}


// create.inc:195 get_sex: false when the player asked for help instead.
async function get_sex(): Promise<boolean> {
  const s: IRef<string> = box('');
  let chosen: boolean = false;
  let exit_flag: boolean = false;

  g.py.misc.sex = '';
  clear(21, 1);
  prt('Choose a sex (? for Help):', 21, 3);
  prt('m) Male       f) Female', 22, 3);
  prt('', 21, 29);

  do {
    await inkey_flush(s);

    if ((s.get() === 'f') || (s.get() === 'm')) {
      g.py.misc.sex = s.get() === 'f' ? 'Female' : 'Male';
      prt(g.py.misc.sex, 5, 15);
      exit_flag = true;
      chosen = true;
    } else if (s.get() === '?') {
      await moria_help('Character Sex');
      exit_flag = true;
      chosen = false;
    }
  } while (!exit_flag);

  return chosen;
}


// create.inc:232 get_ahw: age, height and weight. sex_type is 'FemaleMale  ', so the sex's
// position in it picks the table: 1 for female, 2 for male.
function get_ahw(): void {
  const race: race_type = g.race[g.py.misc.prace];
  const misc: player_misc_type = g.py.misc;

  misc.age = race.b_age + randint(race.m_age);

  switch (Math.trunc(real((index(g.sex_type, misc.sex) + 5) / 6))) {
    case 1:
      misc.ht = randnor(race.f_b_ht, race.f_m_ht);
      misc.wt = randnor(race.f_b_wt, race.f_m_wt);
      break;
    case 2:
      misc.ht = randnor(race.m_b_ht, race.m_m_ht);
      misc.wt = randnor(race.m_b_wt, race.m_m_wt);
      break;
  }

  misc.disarm = race.b_dis + todis_adj();
}


// create.inc:253 get_class: false when the player asked for help instead.
async function get_class(): Promise<boolean> {
  const cl: number[] = Array.from({ length: max_class + 1 }, (): number => 0);
  const race: race_type = g.race[g.py.misc.prace];
  const s: IRef<string> = box('');
  let i3: number = 0;
  let i4: number = 3;
  let i5: number = 22;
  let chosen: boolean = false;
  let exit_flag: boolean = false;

  clear(21, 1);
  prt('Choose a class (? for Help):', 21, 3);

  for (let i2: number = 1; i2 <= max_class; i2++) {
    if (uand(race.tclass, g.bit_array[i2]) !== 0) {
      i3++;
      put_buffer(`${ String.fromCharCode(i3 + 96) }) ${ g.class[i2].title }`, i5, i4);
      cl[i3] = i2;
      i4 += 15;

      if (i4 > 70) {
        i4 = 3;
        i5++;
      }
    }
  }

  g.py.misc.pclass = 0;
  put_buffer('', 21, 31);

  do {
    await inkey_flush(s);

    const i2: number = index(LETTERS, s.get());

    if ((i2 <= i3) && (i2 >= 1)) {
      g.py.misc.tclass = g.class[cl[i2]].title;
      g.py.misc.pclass = cl[i2];
      exit_flag = true;
      chosen = true;
      clear(21, 1);
      put_buffer(g.py.misc.tclass, 6, 15);
      apply_class();
    } else if (s.get() === '?') {
      await moria_help('Character Classes');
      exit_flag = true;
      chosen = false;
    }
  } while (!exit_flag);

  return chosen;
}


function apply_class(): void {
  const misc: player_misc_type = g.py.misc;
  const stat: player_stat_type = g.py.stat;
  const player_class: class_type = g.class[misc.pclass];

  misc.hitdie += player_class.adj_hd;
  misc.mhp = con_adj() + misc.hitdie;
  misc.chp = real(misc.mhp);
  misc.bth += player_class.mbth;
  misc.bthb += player_class.mbthb;
  misc.srh += player_class.msrh;
  misc.disarm += player_class.mdis;
  misc.fos += player_class.mfos;
  misc.stl += player_class.mstl;
  misc.save += player_class.msav;
  misc.title = g.player_title[misc.pclass][1];
  misc.expfact = real(misc.expfact + player_class.m_exp);

  stat.str = change_stat(stat.str, player_class.madj_str);
  stat.int = change_stat(stat.int, player_class.madj_int);
  stat.wis = change_stat(stat.wis, player_class.madj_wis);
  stat.dex = change_stat(stat.dex, player_class.madj_dex);
  stat.con = change_stat(stat.con, player_class.madj_con);
  stat.chr = change_stat(stat.chr, player_class.madj_chr);
  copy_stats_to_current(stat);
  misc.ptodam = todam_adj();
  misc.ptohit = tohit_adj();
  misc.ptoac = toac_adj();
  misc.pac = 0;
  misc.dis_td = misc.ptodam;
  misc.dis_th = misc.ptohit;
  misc.dis_tac = misc.ptoac;
  misc.dis_ac = misc.pac;
}


// create.inc:347 get_money
function get_money(): void {
  const stat: player_stat_type = g.py.stat;
  const misc: player_misc_type = g.py.misc;
  const tmp: number = stat.cstr + stat.cint + stat.cwis + stat.cdex + stat.ccon + stat.cchr;

  misc.au = misc.sc * 6 + randint(25) + 325;
  misc.au -= tmp;
  misc.au += stat.cchr;

  if (misc.au < 80) {
    misc.au = 80;
  }
}


// create.inc:1 create_character. The pause at the end keeps players from rolling characters up
// endlessly, which was expensive on a shared VAX.
export async function create_character(): Promise<void> {
  do {
    put_character();
  } while (!(await choose_race()));

  while (!(await get_sex())) {
    put_character();
  }

  get_history();
  get_ahw();
  print_history();
  put_misc1();
  put_stats();

  while (!(await get_class())) {
    put_character();
    print_history();
    put_misc1();
    put_stats();
  }

  get_money();
  put_stats();
  put_misc2();
  put_misc3();
  await get_name();
  await pause_exit(24, player_exit_pause);
}
