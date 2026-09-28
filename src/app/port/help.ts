// source/include/help.inc

import { clear, get_com, pause, prt, put_qio } from './io';
import { draw_cave } from './misc';
import { g } from './variables';
import { vms_help } from './vms-help';
import type { IRef } from '../runtime/pascal';
import { box } from '../runtime/pascal';

// What each symbol stands for; the ones the original marks Not used fall to its otherwise.
const SYMBOLS: ReadonlyMap<string, string> = new Map<string, string>([
  [ ' ', '  - An open pit.' ],
  [ '!', '! - A potion.' ],
  [ '"', '" - An amulet, periapt, or necklace.' ],
  [ '#', '# - A stone wall.' ],
  [ '$', '$ - Treasure.' ],
  [ '&', '& - Treasure chest.' ],
  [ '\'', '\' - An open door.' ],
  [ '(', '( - Soft armor.' ],
  [ ')', ') - A shield.' ],
  [ '*', '* - Gems.' ],
  [ '+', '+ - A closed door.' ],
  [ ',', ', - Food or mushroom patch.' ],
  [ '-', '- - A wand' ],
  [ '.', '. - Floor.' ],
  [ '/', '/ - A pole weapon.' ],
  [ '1', '1 - Entrance to General Store.' ],
  [ '2', '2 - Entrance to Armory.' ],
  [ '3', '3 - Entrance to Weaponsmith.' ],
  [ '4', '4 - Entrance to Temple.' ],
  [ '5', '5 - Entrance to Alchemy shop.' ],
  [ '6', '6 - Entrance to Magic-Users store.' ],
  [ ':', ': - Rubble.' ],
  [ ';', '; - A loose rock.' ],
  [ '<', '< - An up staircase.' ],
  [ '=', '= - A ring.' ],
  [ '>', '> - A down staircase.' ],
  [ '?', '? - A scroll.' ],
  [ 'A', 'A - Giant Ant Lion.' ],
  [ 'B', 'B - The Balrog.' ],
  [ 'C', 'C - Gelentanious Cube.' ],
  [ 'D', 'D - An Ancient Dragon (Beware).' ],
  [ 'E', 'E - Elemental.' ],
  [ 'F', 'F - Giant Fly.' ],
  [ 'G', 'G - Ghost.' ],
  [ 'H', 'H - Hobgoblin.' ],
  [ 'I', 'I - Invisible Stalker.' ],
  [ 'J', 'J - Jelly.' ],
  [ 'K', 'K - Killer Beetle.' ],
  [ 'L', 'L - Lich.' ],
  [ 'M', 'M - Mummy.' ],
  [ 'O', 'O - Ooze.' ],
  [ 'P', 'P - Giant humanoid.' ],
  [ 'Q', 'Q - Quylthulg (Pulsing Flesh Mound).' ],
  [ 'R', 'R - Reptile.' ],
  [ 'S', 'S - Giant Scorpion.' ],
  [ 'T', 'T - Troll.' ],
  [ 'U', 'U - Umber Hulk.' ],
  [ 'V', 'V - Vampire.' ],
  [ 'W', 'W - Wight or Wraith.' ],
  [ 'X', 'X - Xorn.' ],
  [ 'Y', 'Y - Yeti.' ],
  [ '[', '[ - Hard armor.' ],
  [ '\\', '\\ - A hafted weapon.' ],
  [ ']', '] - Misc. armor.' ],
  [ '^', '^ - A trap.' ],
  [ '_', '_ - A staff.' ],
  [ 'a', 'a - Giant Ant.' ],
  [ 'b', 'b - Giant Bat.' ],
  [ 'c', 'c - Giant Centipede.' ],
  [ 'd', 'd - Dragon.' ],
  [ 'e', 'e - Floating Eye.' ],
  [ 'f', 'f - Giant Frog' ],
  [ 'g', 'g - Golem.' ],
  [ 'h', 'h - Harpy.' ],
  [ 'i', 'i - Icky Thing.' ],
  [ 'j', 'j - Jackal.' ],
  [ 'k', 'k - Kobold.' ],
  [ 'l', 'l - Giant Lice.' ],
  [ 'm', 'm - Mold.' ],
  [ 'n', 'n - Naga.' ],
  [ 'o', 'o - Orc or Ogre.' ],
  [ 'p', 'p - Person (Humanoid).' ],
  [ 'q', 'q - Quasit.' ],
  [ 'r', 'r - Rodent.' ],
  [ 's', 's - Skeleton.' ],
  [ 't', 't - Gaint tick.' ],
  [ 'w', 'w - Worm(s).' ],
  [ 'y', 'y - Yeek.' ],
  [ 'z', 'z - Zombie.' ],
  [ '{', '{ - Arrow, bolt, or bullet.' ],
  [ '|', '| - A sword or dagger.' ],
  [ '}', '} - Bow, crossbow, or sling.' ],
  [ '~', '~ - Miscellaneous item.' ],
]);

// The command list, one line per row from the top.
const COMMANDS: readonly string[] = [
  'B <Dir> Bash (object/creature)|  q        Quaff a potion.',
  'C       Display character.    |  r        Read a scroll.',
  'D <Dir> Disarm a trap/chest.  |  s        Search for hidden doors.',
  'E       Eat some food.        |  t        Take off an item.',
  'F       Fill lamp with oil.   |  u        Use a staff.',
  'L       Current location.     |  v        Version and credits.',
  'P       Print map.            |  w        Wear/Wield an item.',
  'R       Rest for a period.    |  x        Exchange weapon.',
  'S       Search Mode.          |  /        Identify a character.',
  'T <Dir> Tunnel.               |  ?        Display this panel.',
  'a       Aim and fire a wand.  |',
  'b       Browse a book.        |  ^M       Repeat the last message.',
  'c <Dir> Close a door.         |  ^R       Redraw the screen.',
  'd       Drop an item.         |  ^Y       Quit the game.',
  'e       Equipment list.       |  ^Z       Save character and quit.',
  'f       Fire/Throw an item.   |   $       Shell out of game.',
  'h       Help on key commands. |',
  'i       Inventory list.       |  < Go up an up-staircase.',
  'j <Dir> Jam a door with spike.|  > Go down a down-staircase.',
  'l <Dir> Look given direction. |  . <Dir>  Move in direction.',
  'm       Cast a magic spell.   |  Movement: 7  8  9',
  'o <Dir> Open a door/chest.    |            4     6    5 = Rest',
  'p       Read a prayer.        |            1  2  3',
];

const GOD_COMMANDS: readonly string[] = [
  '^A - Remove Curse and Cure all maladies.',
  '^B - Print random objects sample.',
  '^D - Down/Up n levels.',
  '^E - Change character.',
  '^F - Delete monsters.',
  '^G - Allocate treasures.',
  '^H - Wizard Help.',
  '^I - Identify.',
  '^J - Gain experience.',
  '^K - Summon monster.',
  '^L - Wizard light.',
  '^N - Print monster dictionary.',
  '^P - Wizard password on/off.',
  '^T - Teleport player.',
  '^V - Restore lost character.',
  '^W - Create any object *CAN CAUSE FATAL ERROR*',
];

const WIZARD_COMMANDS: readonly string[] = [
  '^A - Remove Curse and Cure all maladies.',
  '^B - Print random objects sample.',
  '^D - Down/Up n levels.',
  '^H - Wizard Help.',
  '^I - Identify.',
  '^L - Wizard light.',
  '^N - Print monster dictionary.',
  '^P - Wizard password on/off.',
  '^T - Teleport player.',
  '^V - Restore lost character.',
];


// help.inc:1 ident_char
export async function ident_char(): Promise<void> {
  const command: IRef<string> = box('');

  if (await get_com('Enter character to be identified :', command)) {
    if (command.get() === '@') {
      prt(g.py.misc.name, 1, 1);
    } else {
      prt(SYMBOLS.get(command.get()) ?? 'Not Used.', 1, 1);
    }
  }
}


function show_lines(lines: readonly string[]): void {
  clear(1, 1);
  lines.forEach((line: string, at: number): void => {
    prt(line, at + 1, 1);
  });
}


// help.inc:108 help
export async function help(): Promise<void> {
  show_lines(COMMANDS);
  await pause(24);
  draw_cave();
}


// help.inc:141 wizard_help
export async function wizard_help(): Promise<void> {
  show_lines(g.wizard2 ? GOD_COMMANDS : WIZARD_COMMANDS);
  await pause(24);
  draw_cave();
}


// help.inc:183 moria_help: HELP/PAGE on the help library, starting at help_level.
export async function moria_help(help_level: string): Promise<void> {
  prt('[Entering Moria Help Library, Use ^Z to resume game]', 1, 1);
  put_qio();
  await vms_help(help_level);
}
