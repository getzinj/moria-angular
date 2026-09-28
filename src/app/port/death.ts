// source/include/death.inc: the tombstone, the top twenty and the King's ending.

import { max_player_level } from './constants';
import { TextFile } from './files';
import { clear, exit, flush, get_com, get_string, pause, prt, put_buffer, put_qio } from './io';
import type { player_misc_type } from './types';
import { g } from './variables';
import { vmsDate } from '../runtime/clock';
import type { IRef } from '../runtime/pascal';
import { Readv, box, fmt, pad, substr } from '../runtime/pascal';
import { rt } from '../runtime/runtime';


// death.inc:58 fill_str: centres a string in 31 characters.
function fill_str(p1: string): string {
  const i1: number = Math.trunc(p1.length / 2);

  return substr(pad('', ' ', 15 - i1) + pad(p1, ' ', 31), 1, 31);
}


// death.inc:70 dprint: a line with its runs of more than five blanks skipped rather than written.
export function dprint(str: string, row: number): void {
  let prt_str: string = '';
  let nblanks: number = 0;
  let xpos: number = 0;

  for (let i1: number = 1; i1 <= str.length; i1++) {
    if (str.charAt(i1 - 1) === ' ') {
      if (xpos > 0) {
        nblanks++;

        if (nblanks > 5) {
          nblanks = 0;
          put_buffer(prt_str, row, xpos);
          prt_str = '';
          xpos = 0;
        }
      }
    } else {
      if (xpos === 0) {
        xpos = i1;
      }

      prt_str += ' '.repeat(nblanks) + str.charAt(i1 - 1);
      nblanks = 0;
    }
  }

  if (xpos > 0) {
    put_buffer(prt_str, row, xpos);
  }
}


function tombstone(): string[] {
  const misc: player_misc_type = g.py.misc;
  const day: string = vmsDate(rt().clock.now());
  const str1: string = fill_str(misc.name);
  const str2: string = fill_str(misc.title);
  const str3: string = fill_str(misc.tclass);
  const str4: string = fill_str(`Level : ${ fmt(misc.lev, 1) }`);
  const str5: string = fill_str(`${ fmt(misc.exp, 1) } Exp`);
  const str6: string = fill_str(`${ fmt(misc.au, 1) } Au`);
  const str7: string = fill_str(`Died on Level : ${ fmt(g.dun_level, 1) }`);
  const str8: string = fill_str(g.died_from);

  return [
    ' ',
    '               _______________________',
    '              /                       \\         ___',
    '             /                         \\ ___   /   \\      ___',
    '            /            RIP            \\   \\  :   :     /   \\',
    '           /                             \\  : _;,,,;_    :   :',
    `          /${ str1 }\\,;_          _;,,,;_`,
    '         |               the               |   ___',
    `         | ${ str2 } |  /   \\`,
    '         |                                 |  :   :',
    `         | ${ str3 } | _;,,,;_   ____`,
    `         | ${ str4 } |          /    \\`,
    `         | ${ str5 } |          :    :`,
    `         | ${ str6 } |          :    :`,
    `         | ${ str7 } |         _;,,,,;_`,
    '         |            killed by            |',
    `         | ${ str8 } |`,
    `         |           ${ day }           |`,
    '        *|   *     *     *    *   *     *  | *',
    '________)/\\\\_)_/___(\\/___(//_\\)/_\\//__\\\\(/_|_)_______',
  ];
}


// death.inc:112 print_tomb: the gravestone, and a copy to a file if the player wants one.
async function print_tomb(): Promise<void> {
  const dstr: string[] = tombstone();
  const command: IRef<string> = box('');

  clear(1, 1);
  dstr.forEach((line: string, i1: number): void => dprint(line, i1 + 1));
  flush();

  if (await get_com('Print to file? (Y/N)', command)) {
    if ([ 'y', 'Y' ].includes(command.get())) {
      await print_tomb_file(dstr);
    }
  }
}


async function print_tomb_file(dstr: readonly string[]): Promise<void> {
  const fnam: IRef<string> = box('');

  prt('Enter Filename:', 1, 1);

  if (await get_string(fnam, 1, 17, 60)) {
    const file1: TextFile = new TextFile();

    dstr.forEach((line: string): void => file1.writeln(line));
    file1.close(fnam.get().length === 0 ? 'MORIACHR.DIE' : fnam.get());
  }
}


// death.inc:191 total_points
export function total_points(): number {
  return g.py.misc.max_exp + 100 * g.py.misc.max_lev;
}


// The score a top-twenty line holds after its 13-character username.
function score_of(line: string): number {
  return new Readv(line.substring(13)).integer();
}


function ordinal(lev: number): string {
  const SUFFIXES: Readonly<Record<number, string>> = { 1: 'st', 2: 'nd', 3: 'rd' };

  return `${ fmt(lev, 1) }${ SUFFIXES[lev] ?? 'th' } level `;
}


// death.inc:199 top_twenty: a wizard's character is never scored.
export function top_twenty(): void {
  if (g.wizard1) {
    exit();
  }

  clear(1, 1);

  const stored: string = rt().files.read(g.moria_top) ?? '';
  const list: string[] = stored.split('\n').filter((line: string): boolean => line.length > 0).slice(0, 20);
  const i3: number = total_points();
  let i1: number = 0;

  while ((i1 < list.length) && (score_of(list[i1]) >= i3)) {
    i1++;
  }

  if ((i1 < list.length) || (list.length < 20)) {
    const misc: player_misc_type = g.py.misc;

    list.splice(i1, 0, `${ pad(rt().username, ' ', 13) }${ fmt(i3, 7) }  ${ misc.name }, a ${ ordinal(misc.lev) }${ misc.race } ${ misc.tclass }.`);
    list.splice(20);
  }

  rt().files.write(g.moria_top, list.map((line: string): string => `${ line }\n`).join(''));
  put_buffer('Username       Points  Character that died.', 1, 1);
  list.forEach((line: string, i: number): void => put_buffer(line, i + 2, 1));
  put_buffer('', list.length + 2, 1);
  put_qio();
}


// death.inc:293 kingly: the winner retires as King or Queen.
async function kingly(): Promise<void> {
  const misc: player_misc_type = g.py.misc;

  g.dun_level = 0;
  g.died_from = 'Ripe Old Age';
  misc.lev += max_player_level;

  if (misc.sex.charAt(0) === 'M') {
    misc.title = 'Magnificent';
    misc.tclass = '*King*';
  } else {
    misc.title = 'Beautiful';
    misc.tclass = '*Queen*';
  }

  misc.au += 250000;
  misc.max_exp += 5000000;
  misc.exp = misc.max_exp;
  clear(1, 1);
  dprint('                                  #', 2);
  dprint('                                #####', 3);
  dprint('                                  #', 4);
  dprint('                            ,,,  $$$  ,,,', 5);
  dprint('                        ,,=$   "$$$$$"   $=,,', 6);
  dprint('                      ,$$        $$$        $$,', 7);
  dprint('                      *>         <*>         <*', 8);
  dprint('                      $$         $$$         $$', 9);
  dprint('                      "$$        $$$        $$"', 10);
  dprint('                       "$$       $$$       $$"', 11);
  dprint('                        *#########*#########*', 12);
  dprint('                        *#########*#########*', 13);
  dprint('                          Veni, Vidi, Vici!', 16);
  dprint('                     I came, I saw, I conquered!', 17);
  dprint('                      All Hail the Mighty King!', 18);
  flush();
  await pause(24);
}


// death.inc:2 upon_death
export async function upon_death(): Promise<never> {
  if (g.total_winner) {
    await kingly();
  }

  await print_tomb();
  top_twenty();

  return exit();
}
