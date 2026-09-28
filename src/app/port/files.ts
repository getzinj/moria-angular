// source/include/files.inc

import { bth_lev_adj, bth_plus_adj, cur_version, inven_max, max_creatures, outpage_height, outpage_width } from './constants';
import { known1, known2, objdes, unquote } from './desc';
import { clear, get_string, no_controly, pause_exit, prt, put_buffer, put_qio } from './io';
import {
  check_pswd,
  cnv_stat,
  get_obj_num,
  insert_str,
  int_adj,
  likert,
  loc_symbol,
  magic_treasure,
  popt,
  pusht,
  test_light,
  todis_adj,
  wis_adj,
} from './misc';
import type { creature_type, player_misc_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { Readv, box, clone, fmt, fmtFixed, index, pad, read_integer, substr, uand } from '../runtime/pascal';
import { rt } from '../runtime/runtime';

// What intro wrote to MORIA.DAT on a first run, shown whenever the file has not been edited.
export const DEFAULT_NEWS: readonly string[] = [
  '                         *********************',
  `                         **    Moria ${ fmtFixed(cur_version, 4, 2) }   **`,
  '                         *********************',
  '                   COPYRIGHT (c) Robert Alan Koeneke',
  ' ',
  'Programers : Robert Alan Koeneke / University of Oklahoma',
  '             Jimmey Wayne Todd   / University of Oklahoma',
  ' ',
  'Dungeon Master: This file may contain updates and news.',
];


// files.inc:2 intro. The operating hours are not checked, and the files a first run created are
// created quietly rather than by quitting with instructions for the system manager.
export async function intro(finam: IRef<string>): Promise<void> {
  clear(1, 1);

  if (index(finam.get(), '/WIZARD') > 0) {
    if (await check_pswd()) {
      finam.set(insert_str(finam.get(), '/WIZARD', ''));
    }
  }

  if (!g.wizard1) {
    no_controly();
  }

  const news: string | null = rt().files.read(g.moria_mor);
  const lines: readonly string[] = news == null ? DEFAULT_NEWS : news.split('\n');

  clear(1, 1);

  for (let i1: number = 0; (i1 < lines.length) && (i1 < 23); i1++) {
    put_buffer(lines[i1], i1 + 1, 1);
  }

  await pause_exit(24, 0);
  create_if_missing(g.moria_mas);
  create_if_missing(g.moria_top);
}


function create_if_missing(name: string): void {
  if (rt().files.read(name) == null) {
    rt().files.write(name, '');
  }
}


const NEW_PAGE: string = '\f';


/** A text file as Pascal's write and writeln built it, a line at a time. */
export class TextFile {
  private readonly lines: string[] = [];
  private line: string = '';


  public write(...parts: readonly string[]): void {
    this.line += parts.join('');
  }


  public writeln(...parts: readonly string[]): void {
    this.write(...parts);
    this.lines.push(this.line);
    this.line = '';
  }


  /** Closes the file, handing it to the player. */
  public close(name: string): void {
    rt().download(name, this.lines.map((line: string): string => `${ line }\n`).join(''));
  }

}


/** A string written with a field width: right-justified, or cut to its first width characters. */
export function field(text: string, width: number): string {
  return text.length >= width ? text.substring(0, width) : text.padStart(width, ' ');
}


/** The file name asked for at row 1, column 12, or null on ESC. */
async function file_name(fallback: string): Promise<string | null> {
  const filename1: IRef<string> = box('');
  let result: string | null = null;

  prt('File name: ', 1, 1);

  if (await get_string(filename1, 1, 12, 64)) {
    result = filename1.get().length === 0 ? fallback : filename1.get();
  }

  return result;
}


// files.inc:214 print_map: the whole level, a page of 44 rows by 99 columns at a time.
export async function print_map(): Promise<void> {
  const filename1: string | null = await file_name('MORIAMAP.DAT');

  if (filename1 != null) {
    const file1: TextFile = new TextFile();
    let i1: number = 1;
    let i7: number = 0;

    prt('Writing Moria Dungeon Map...', 1, 1);
    put_qio();

    do {
      const i3: number = Math.min(i1 + outpage_height - 1, g.cur_height);
      let i2: number = 1;
      let i8: number = 0;

      i7++;

      do {
        i8++;
        map_section(file1, i1, i2, i3, Math.min(i2 + outpage_width - 1, g.cur_width), `${ fmt(i7, 1) },${ fmt(i8, 1) }`);
        i2 += outpage_width;
      } while (i2 < g.cur_width);

      i1 += outpage_height;
    } while (i1 < g.cur_height);

    file1.close(filename1);
    prt('Completed.', 1, 1);
  }
}


function map_section(file1: TextFile, i1: number, i2: number, i3: number, i4: number, section: string): void {
  file1.writeln(NEW_PAGE);
  file1.write(`Section[${ section }];     `);
  file1.writeln(`Depth : ${ fmt(g.dun_level * 50, 1) } (feet)`);
  file1.writeln(' ');
  file1.writeln('   ', digits(i2, i4, (i5: number): number => Math.trunc(i5 / 100)));
  file1.writeln('   ', digits(i2, i4, (i5: number): number => Math.trunc(i5 / 10) - Math.trunc(i5 / 100) * 10));
  file1.writeln('   ', digits(i2, i4, (i5: number): number => i5 - Math.trunc(i5 / 10) * 10));

  for (let i5: number = i1; i5 <= i3; i5++) {
    let dun_line: string = fmt(i5, 3);

    for (let i6: number = i2; i6 <= i4; i6++) {
      dun_line += test_light(i5, i6) ? loc_symbol(i5, i6) : ' ';
    }

    file1.writeln(dun_line);
  }
}


function digits(from: number, to: number, digit: (i5: number) => number): string {
  let result: string = '';

  for (let i5: number = from; i5 <= to; i5++) {
    result += fmt(digit(i5), 1);
  }

  return result;
}


// files.inc:300 print_objects: a sample of the objects a level would produce.
export async function print_objects(): Promise<void> {
  const tmp_str: IRef<string> = box('');
  let level: number = 0;
  let nobj: number = 0;

  prt('Produce objects on what level?: ', 1, 1);
  await get_string(tmp_str, 1, 33, 10);
  level = read_integer(tmp_str.get(), 0);
  prt('Produce how many objects?: ', 1, 1);
  await get_string(tmp_str, 1, 28, 10);
  nobj = read_integer(tmp_str.get(), 0);

  if ((nobj > 0) && (level > -1) && (level < 1201)) {
    const filename1: string | null = await file_name('MORIAOBJ.DAT');

    if (filename1 != null) {
      sample_objects(Math.min(nobj, 9999), level).close(filename1);
      prt('Completed.', 1, 1);
    }
  }
}


function sample_objects(nobj: number, level: number): TextFile {
  const file1: TextFile = new TextFile();
  const i2: IRef<number> = box(0);

  prt(`${ fmt(nobj, 1) } random objects being produced...`, 1, 1);
  put_qio();
  file1.writeln('*** Random Object Sampling:');
  file1.writeln(`*** ${ fmt(nobj, 1) } objects`);
  file1.writeln(`*** For Level ${ fmt(level, 1) }`);
  file1.writeln('');
  file1.writeln('');
  popt(i2);

  for (let i1: number = 1; i1 <= nobj; i1++) {
    g.t_list[i2.get()] = clone(g.object_list[get_obj_num(level)]);
    magic_treasure(i2.get(), level);
    g.inventory[inven_max] = clone(g.t_list[i2.get()]);

    const sample: treasure_type = g.inventory[inven_max];

    sample.name = known2(known1(unquote(sample.name)));
    file1.writeln(objdes(inven_max, true));
  }

  pusht(i2.get());

  return file1;
}


const CREATURE_FLAGS: readonly (readonly [ 'cmove' | 'cdefense', number, string ])[] = [
  [ 'cmove', 0x80000000, '     Creature is a ***Win Creature***' ],
  [ 'cmove', 0x00080000, '     Creature Eats/kills other creatures.' ],
  [ 'cdefense', 0x0001, '     Creature is a dragon.' ],
  [ 'cdefense', 0x0002, '     Creature is a monster.' ],
  [ 'cdefense', 0x0004, '     Creature is evil.' ],
  [ 'cdefense', 0x0008, '     Creature is undead.' ],
  [ 'cdefense', 0x0010, '     Creature harmed by cold.' ],
  [ 'cdefense', 0x0020, '     Creature harmed by fire.' ],
  [ 'cdefense', 0x0040, '     Creature harmed by poison.' ],
  [ 'cdefense', 0x0080, '     Creature harmed by acid.' ],
  [ 'cdefense', 0x0100, '     Creature harmed by blue light.' ],
  [ 'cdefense', 0x0200, '     Creature harmed by Stone-to-Mud.' ],
  [ 'cdefense', 0x1000, '     Creature cannot be charmed or slept.' ],
  [ 'cdefense', 0x2000, '     Creature seen with Infra-Vision.' ],
  [ 'cdefense', 0x4000, '     Creature has MAX hit points.' ],
  [ 'cmove', 0x00010000, '     Creature is invisible.' ],
  [ 'cmove', 0x00100000, '     Creature picks up objects.' ],
  [ 'cmove', 0x00200000, '     Creature multiplies.' ],
  [ 'cmove', 0x01000000, '     Carries object(s).' ],
  [ 'cmove', 0x02000000, '     Carries gold, gems, ect.' ],
  [ 'cmove', 0x04000000, '       Has object/gold 60% of time.' ],
  [ 'cmove', 0x08000000, '       Has object/gold 90% of time.' ],
  [ 'cmove', 0x10000000, '       Has 1d2 object(s)/gold.' ],
  [ 'cmove', 0x20000000, '       Has 2d2 object(s)/gold.' ],
  [ 'cmove', 0x40000000, '       Has 4d2 object(s)/gold.' ],
];

const SPELL_FLAGS: readonly (readonly [ number, string ])[] = [
  [ 0x00000010, '       Can teleport short.' ],
  [ 0x00000020, '       Can teleport long.' ],
  [ 0x00000040, '       Teleport player to itself.' ],
  [ 0x00000080, '       Cause light wounds.' ],
  [ 0x00000100, '       Cause serious wounds.' ],
  [ 0x00000200, '       Hold person.' ],
  [ 0x00000400, '       Cause blindness.' ],
  [ 0x00000800, '       Cause confusion.' ],
  [ 0x00001000, '       Cause fear.' ],
  [ 0x00002000, '       Summon a monster.' ],
  [ 0x00004000, '       Summon an undead.' ],
  [ 0x00008000, '       Slow person.' ],
  [ 0x00010000, '       Drains mana for healing.' ],
  [ 0x00020000, '       **Unknown spell value**' ],
  [ 0x00040000, '       **Unknown spell value**' ],
  [ 0x00080000, '       Breaths Lightning Dragon Breath.' ],
  [ 0x00100000, '       Breaths Gas Dragon Breath.' ],
  [ 0x00200000, '       Breaths Acid Dragon Breath.' ],
  [ 0x00400000, '       Breaths Frost Dragon Breath.' ],
  [ 0x00800000, '       Breaths Fire Dragon Breath.' ],
];

const MOVEMENT_FLAGS: readonly (readonly [ number, string ])[] = [
  [ 0x00000001, '       Move only to attack.' ],
  [ 0x00000002, '       Move and attack normally.' ],
  [ 0x00000008, '       20% random movement.' ],
  [ 0x00000010, '       40% random movement.' ],
  [ 0x00000020, '       75% random movement.' ],
  [ 0x00020000, '       Can open doors.' ],
  [ 0x00040000, '       Can phase through walls.' ],
];

const ATTACK_WAYS: Readonly<Record<number, string>> = {
  1: 'Hits for ', 2: 'Bites for ', 3: 'Claws for ', 4: 'Stings for ', 5: 'Touches for ', 6: 'Kicks for ',
  7: 'Gazes for ', 8: 'Breathes for ', 9: 'Spits for ', 10: 'Wails for ', 11: 'Embraces for ',
  12: 'Crawls on you for ', 13: 'Shoots spores for ', 14: 'Begs for money for ', 15: 'Slimes you for ',
  16: 'Crushes you for ', 17: 'Tramples you for ', 99: 'Is repelled...',
};

const ATTACK_KINDS: Readonly<Record<number, string>> = {
  1: 'normal damage.', 2: 'lowering strength.', 3: 'confusion.', 4: 'fear.', 5: 'fire damage.',
  6: 'acid damage.', 7: 'cold damage.', 8: 'lightning damage.', 9: 'corrosion damage.', 10: 'blindness.',
  11: 'paralyzation.', 12: 'stealing money.', 13: 'stealing object.', 14: 'poison damage.',
  15: 'lose dexterity.', 16: 'lose constitution.', 17: 'lose intelligence.', 18: 'lose wisdom.',
  19: 'lose experience.', 20: 'aggravates monsters.', 21: 'disenchants objects.', 22: 'eating food.',
  23: 'eating light source.', 24: 'absorbing charges.', 99: 'blank message.',
};


// files.inc:360 print_monsters: the monster dictionary.
export async function print_monsters(): Promise<void> {
  const filename1: string | null = await file_name('MORIAMON.DAT');

  if (filename1 != null) {
    const file1: TextFile = new TextFile();

    prt('Writing Monster Dictionary...', 1, 1);
    put_qio();

    for (let i1: number = 1; i1 <= max_creatures; i1++) {
      describe_creature(file1, i1, g.c_list[i1]);
    }

    file1.close(filename1);
    prt('Completed.', 1, 1);
  }
}


function describe_creature(file1: TextFile, i1: number, creature: creature_type): void {
  file1.writeln('--------------------------------------------');
  file1.writeln(fmt(i1, 3), '  ', field(`${ creature.name }                              `, 30), '     (', creature.cchar, ')');
  file1.writeln('     Speed =', fmt(creature.speed, 2), '  Level     =', fmt(creature.level, 2), '  Exp =', fmt(creature.mexp, 5));
  file1.writeln('     AC    =', fmt(creature.ac, 2), '  Eye-sight =', fmt(creature.aaf, 2), '  HD  =', field(creature.hd, 5));

  for (const [ which, bit, text ] of CREATURE_FLAGS) {
    if (uand(bit, creature[which]) !== 0) {
      file1.writeln(text);
    }
  }

  if (creature.spells > 0) {
    file1.writeln('   --Spells/Dragon Breath =');
    file1.writeln('       Casts spells 1 out of ', fmt(uand(0xF, creature.spells), 1), ' turns.');
    write_flags(file1, SPELL_FLAGS, creature.spells);
  }

  file1.writeln('   --Movement =');
  write_flags(file1, MOVEMENT_FLAGS, creature.cmove);
  file1.writeln('   --Creature attacks =');
  describe_attacks(file1, creature.damage);

  for (let i2: number = 1; i2 <= 2; i2++) {
    file1.writeln(' ');
  }
}


function write_flags(file1: TextFile, flags: readonly (readonly [ number, string ])[], value: number): void {
  for (const [ bit, text ] of flags) {
    if (uand(bit, value) !== 0) {
      file1.writeln(text);
    }
  }
}


function describe_attacks(file1: TextFile, damage: string): void {
  let attstr: string = damage;

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
    const atype: number = line.integer();
    const adesc: number = line.integer();
    const damstr: string = line.rest().substring(0, 5);
    const way: string = ATTACK_WAYS[adesc] == null ? '     **Unknown value** ' : `       ${ ATTACK_WAYS[adesc] }`;

    file1.writeln(`${ way }${ ATTACK_KINDS[atype] ?? '**Unknown value**' } (${ damstr })`);
  }
}


const EQUIPMENT_PLACES: Readonly<Record<number, string>> = {
  23: ') You are wielding   : ',
  24: ') Worn on head       : ',
  25: ') Worn around neck   : ',
  26: ') Worn on body       : ',
  27: ') Worn on shield arm : ',
  28: ') Worn on hands      : ',
  29: ') Right ring finger  : ',
  30: ') Left  ring finger  : ',
  31: ') Worn on feet       : ',
  32: ') Worn about body    : ',
  33: ') Light source is    : ',
  34: ') Secondary weapon   : ',
};


// files.inc:583 file_character: the character sheet, equipment and inventory.
export async function file_character(): Promise<void> {
  const filename1: string | null = await file_name('MORIACHR.DAT');

  if (filename1 != null) {
    const file1: TextFile = new TextFile();

    prt('Writing character sheet...', 1, 1);
    put_qio();
    file1.writeln(NEW_PAGE);
    sheet_stats(file1);
    sheet_abilities(file1);
    sheet_background(file1);
    sheet_equipment(file1);
    sheet_inventory(file1);
    file1.close(filename1);
    prt('Completed.', 1, 1);
  }
}


function sheet_stats(file1: TextFile): void {
  const misc: player_misc_type = g.py.misc;

  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln('  Name  :', pad(misc.name, ' ', 25), '  Age         :', fmt(misc.age, 4), '     Strength     :', cnv_stat(g.py.stat.cstr));
  file1.writeln('  Race  :', pad(misc.race, ' ', 25), '  Height      :', fmt(misc.ht, 4), '     Intelligence :', cnv_stat(g.py.stat.cint));
  file1.writeln('  Sex   :', pad(misc.sex, ' ', 25), '  Weight      :', fmt(misc.wt, 4), '     Wisdom       :', cnv_stat(g.py.stat.cwis));
  file1.writeln('  Class :', pad(misc.tclass, ' ', 25), '  Social Class:', fmt(misc.sc, 4), '     Dexterity    :', cnv_stat(g.py.stat.cdex));
  file1.writeln('  Title :', pad(misc.title, ' ', 25), '               ', '    ', '     Constitution :', cnv_stat(g.py.stat.ccon));
  file1.writeln('         ', field(' ', 30), '              ', '     Charisma     :', cnv_stat(g.py.stat.cchr));
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln('  + To Hit    :', fmt(misc.dis_th, 6), '     Level      :', fmt(misc.lev, 6), '     Max Hit Points :', fmt(misc.mhp, 6));
  file1.writeln('  + To Damage :', fmt(misc.dis_td, 6), '     Experience :', fmt(misc.exp, 6), '     Cur Hit Points :', fmt(Math.trunc(misc.chp), 6));
  file1.writeln('  + To AC     :', fmt(misc.dis_tac, 6), '     Gold       :', fmt(misc.au, 6), '     Max Mana       :', fmt(misc.mana, 6));
  file1.writeln('    Total AC  :', fmt(misc.dis_ac, 6), '                       ', '     Cur Mana       :', fmt(misc.mana, 6));
  file1.writeln(' ');
  file1.writeln(' ');
}


function sheet_abilities(file1: TextFile): void {
  const misc: player_misc_type = g.py.misc;
  const xbth: number = misc.bth + misc.lev * bth_lev_adj + misc.ptohit * bth_plus_adj;
  const xbthb: number = misc.bthb + misc.lev * bth_lev_adj + misc.ptohit * bth_plus_adj;
  const xfos: number = Math.max(27 - misc.fos, 0);
  const xsrh: number = misc.srh + int_adj();
  const xstl: number = misc.stl;
  const xdis: number = misc.disarm + misc.lev + 2 * todis_adj() + int_adj();
  const xsave: number = misc.save + misc.lev + wis_adj();
  const xdev: number = misc.save + misc.lev + int_adj();
  const xinfra: string = `${ fmt(g.py.flags.see_infra * 10, 1) } feet`;

  file1.writeln(field('(Miscellaneous Abilities)', 40));
  file1.writeln(' ');
  file1.writeln('  Fighting    : ', pad(likert(xbth, 12), ' ', 10), '  Stealth     : ', pad(likert(xstl, 1), ' ', 10), '  Perception  : ', pad(likert(xfos, 3), ' ', 10));
  file1.writeln('  Throw/Bows  : ', pad(likert(xbthb, 12), ' ', 10), '  Disarming   : ', pad(likert(xdis, 8), ' ', 10), '  Searching   : ', pad(likert(xsrh, 6), ' ', 10));
  file1.writeln('  Saving Throw: ', pad(likert(xsave, 6), ' ', 10), '  Magic Device: ', pad(likert(xdev, 7), ' ', 10), '  Infra-Vision: ', pad(xinfra, ' ', 10));
}


function sheet_background(file1: TextFile): void {
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln(field('Character Background', 45));

  for (let i1: number = 1; i1 <= 5; i1++) {
    file1.writeln(field(pad(g.py.misc.history[i1], ' ', 71), 76));
  }
}


function sheet_equipment(file1: TextFile): void {
  let i2: number = 0;

  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln('  [Character\'s Equipment List]');
  file1.writeln(' ');

  if (g.equip_ctr === 0) {
    file1.writeln('  Character has no equipment in use.');
  } else {
    for (let i1: number = 23; i1 <= inven_max - 1; i1++) {
      if (g.inventory[i1].tval > 0) {
        i2++;
        file1.writeln(`  ${ String.fromCharCode(i2 + 96) }${ EQUIPMENT_PLACES[i1] }${ objdes(i1, true) }`);
      }
    }
  }
}


function sheet_inventory(file1: TextFile): void {
  file1.writeln(NEW_PAGE);
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln(' ');
  file1.writeln('  [General Inventory List]');
  file1.writeln(' ');

  if (g.inven_ctr === 0) {
    file1.writeln('  Character has no objects in inventory.');
  } else {
    for (let i1: number = 1; i1 <= g.inven_ctr; i1++) {
      file1.writeln(`${ String.fromCharCode(i1 + 96) }) ${ objdes(i1, true) }`);
    }
  }

  file1.writeln(NEW_PAGE);
}
