// Generates src/app/port/help-library.data.ts from execute/moriahlp.hlb; see `npm run extract-help`.
//
// The library reached the upstream repository damaged: each 512-byte block kept only two bytes of
// its header (a control byte and the block's sequence number) and lost its padding, so blocks
// are about 490 bytes and records run across the leftovers. Those pairs are found by their
// rising sequence number and cut out, which leaves the length-prefixed text records whole. The
// stale second copy of ARMOR, at the end of the file, is too broken to use and is dropped.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface IHelpTopic {
  name: string;
  lines: string[];
  subtopics: IHelpTopic[];
}

const MAXIMUM_RECORD: number = 100;
const TOPIC: RegExp = /^([1-9]) ([A-Za-z_][A-Za-z_' ]{0,28})$/;

type ArmourRow = readonly [ string, string, number, number, number, number, number, string ];

// Tables the damage left unreadable, rebuilt in the Headgear table's layout from the same items'
// entries in values.inc (cost, weight, to-hit, to-dam, AC, damage), which are what the help showed.
const ARMOUR_TABLES: Readonly<Record<string, readonly ArmourRow[]>> = {
  Miscellaneous: [
    [ 'Robe', '(', 4, 20, 0, 0, 2, '0d0' ],
    [ 'Cloak', '(', 3, 10, 0, 0, 1, '0d0' ],
    [ 'Set of Leather Gloves', ']', 3, 5, 0, 0, 1, '0d0' ],
    [ 'Set of Gauntlets', ']', 35, 25, 0, 0, 2, '1d1' ],
    [ 'Pair of Soft Leather Shoes', ']', 4, 5, 0, 0, 1, '0d0' ],
    [ 'Pair of Soft Leather Boots', ']', 7, 20, 0, 0, 2, '1d1' ],
    [ 'Pair of Hard Leather Boots', ']', 12, 40, 0, 0, 3, '1d1' ],
  ],
  Shields: [
    [ 'Small Leather Shield', ')', 30, 50, 0, 0, 2, '1d1' ],
    [ 'Medium Leather Shield', ')', 60, 75, 0, 0, 3, '1d2' ],
    [ 'Large Leather Shield', ')', 120, 100, 0, 0, 4, '1d2' ],
    [ 'Small Metal Shield', ')', 50, 65, 0, 0, 3, '1d2' ],
    [ 'Medium Metal Shield', ')', 125, 90, 0, 0, 4, '1d3' ],
    [ 'Large Metal Shield', ')', 200, 120, 0, 0, 5, '1d3' ],
  ],
  Leather_Armor: [
    [ 'Soft Leather Armor', '(', 18, 80, 0, 0, 4, '0d0' ],
    [ 'Soft Studded Leather', '(', 35, 90, 0, 0, 5, '1d1' ],
    [ 'Hard Leather Armor', '(', 55, 100, -1, 0, 6, '1d1' ],
    [ 'Hard Studded Leather', '(', 100, 110, -1, 0, 7, '1d2' ],
    [ 'Woven Cord Armor', '(', 45, 150, -1, 0, 6, '0d0' ],
    [ 'Soft Leather Ring Mail', '(', 160, 130, -1, 0, 6, '1d2' ],
    [ 'Hard Leather Ring Mail', '(', 230, 150, -2, 0, 8, '1d3' ],
    [ 'Leather Scale Mail', '(', 330, 140, -1, 0, 11, '1d1' ],
  ],
  Metal_Armor: [
    [ 'Metal Scale Mail', '[', 430, 250, -2, 0, 13, '1d4' ],
    [ 'Chain Mail', '[', 530, 220, -2, 0, 14, '1d4' ],
    [ 'Double Chain Mail', '[', 630, 260, -2, 0, 15, '1d4' ],
    [ 'Augmented Chain Mail', '[', 675, 270, -2, 0, 16, '1d4' ],
    [ 'Bar Chain Mail', '[', 720, 280, -2, 0, 18, '1d4' ],
    [ 'Metal Brigandine Armor', '[', 775, 290, -3, 0, 19, '1d4' ],
    [ 'Laminated Armor', '[', 825, 300, -3, 0, 20, '1d4' ],
    [ 'Partial Plate Armor', '[', 900, 260, -3, 0, 22, '1d6' ],
    [ 'Metal Lamellar Armor', '[', 950, 340, -3, 0, 23, '1d6' ],
    [ 'Full Plate Armor', '[', 1050, 380, -3, 0, 25, '2d4' ],
    [ 'Ribbed Plate Armor', '[', 1200, 380, -3, 0, 28, '2d4' ],
  ],
};

// The Missle table lost its last two rows; arrows and bolts from values.inc (1d4 and 1d5, 2 and 3
// tenths of a pound), in the table's own layout.
const MISSLE_TAIL: readonly string[] = [
  '|Arrow                        |  1d4   |  pierce           |  0.2 lbs |',
  '|Bolt                         |  1d5   |  pierce           |  0.3 lbs |',
  '+-----------------------------+--------+-------------------+----------+',
];

const ARMOUR_RULE: string = '+---------------------------+------+-----+-----+------+------+----+--------+';
const ARMOUR_HEADING: string = '|name                       |SYMBOL| COST| WGT |TO HIT|TO DAM| AC | DAMAGE |';


function armourRow([ name, symbol, cost, weight, hit, dam, ac, damage ]: ArmourRow): string {
  const pluses: (value: number) => string = (value: number): string => `${ String(value).padStart(3, ' ') }   `;

  return `|${ name.padEnd(27, ' ') }|  ${ symbol }   |${ String(cost).padStart(4, ' ') } |${ String(weight).padStart(4, ' ') } |` +
    `${ pluses(hit) }|${ pluses(dam) }|${ String(ac).padStart(3, ' ') } |   ${ damage.padEnd(5, ' ') }|`;
}


/** Replaces the tables the damage left unreadable. */
export function repair(topic: IHelpTopic): void {
  const rebuilt: readonly ArmourRow[] | undefined = ARMOUR_TABLES[topic.name];

  if (rebuilt != null) {
    topic.lines = [
      ARMOUR_RULE,
      ARMOUR_HEADING,
      ARMOUR_RULE,
      ...rebuilt.map(armourRow),
      ARMOUR_RULE,
    ];
  } else if (topic.name === 'Missle') {
    const last_whole: number = topic.lines.findIndex((line: string): boolean => line.startsWith('|Iron Shot'));

    topic.lines = [ ...topic.lines.slice(0, last_whole + 1), ...MISSLE_TAIL ];
  }

  topic.subtopics.forEach(repair);
}


function printable(byte: number): boolean {
  return (byte >= 32) && (byte <= 126);
}


/** The positions of the surviving block headers: a control byte, then the block number. */
export function blockHeaders(data: Uint8Array): number[] {
  const found: number[] = [];
  const first: number = firstHeader(data);
  let at: number = first;
  let sequence: number = data[first];

  found.push(first);

  for (let next: number | null = at; next != null;) {
    next = null;

    for (let skip: number = 1; (skip <= 4) && (next == null); skip++) {
      next = nearest(data, at, sequence + skip, 380, 720, 495);

      if (next != null) {
        sequence += skip;
      }
    }

    if (next != null) {
      found.push(next);
      at = next;
    }
  }

  at = first;
  sequence = data[first];

  for (let previous: number | null = at; (previous != null) && (sequence > 1);) {
    previous = nearest(data, at, sequence - 1, -640, -380, -490);

    if (previous != null) {
      found.push(previous);
      at = previous;
      sequence--;
    }
  }

  return found.sort((one: number, other: number): number => one - other);
}


function nearest(data: Uint8Array, from: number, sequence: number, low: number, high: number, typical: number): number | null {
  let best: number | null = null;

  for (let at: number = from + low; at < Math.min(from + high, data.length); at++) {
    if ((at > 0) && (data[at] === sequence) && (data[at - 1] < 0x20) &&
        ((best == null) || (Math.abs(at - from - typical) < Math.abs(best - from - typical)))) {
      best = at;
    }
  }

  return best;
}


/** The first header: the first place where three of them follow at block-sized steps. */
function firstHeader(data: Uint8Array): number {
  let found: number = -1;

  for (let at: number = 512; (at < data.length) && (found < 0); at++) {
    if ((data[at - 1] < 0x20) && (nearest(data, at, data[at] + 1, 380, 720, 495) != null)) {
      const second: number = nearest(data, at, data[at] + 1, 380, 720, 495) as number;

      if (nearest(data, second, data[at] + 2, 380, 720, 495) != null) {
        found = at;
      }
    }
  }

  if (found < 0) {
    throw new Error('extract-help: no block headers found');
  }

  return found;
}


/** The text records left once the block headers are cut out, with null where binary lay between. */
export function records(data: Uint8Array): (string | null)[] {
  const drop: Set<number> = new Set<number>(blockHeaders(data).flatMap((at: number): number[] => [ at - 1, at ]));
  const clean: number[] = [ ...data ].filter((_byte: number, at: number): boolean => !drop.has(at));
  const found: (string | null)[] = [];
  let at: number = 0;

  while (at < clean.length) {
    const length: number = clean[at];
    const body: number[] = clean.slice(at + 1, at + 1 + length);

    if ((length > 0) && (length <= MAXIMUM_RECORD) && (body.length === length) && body.every(printable)) {
      found.push(String.fromCharCode(...body));
      at += 1 + length;
    } else {
      if (found[found.length - 1] !== null) {
        found.push(null);
      }

      at++;
    }
  }

  return found;
}


/** Table rows that ran together, cut back to the table's width, which its first rule line sets. */
function rows(fragments: readonly string[]): string[] {
  const joined: string = fragments.join('').replace(/[A-Z](?=[|+])/g, (marker: string, at: number, text: string): string => {
    return (at > 0) && ([ '|', '+' ].includes(text.charAt(at - 1))) ? '' : marker;
  });
  const width: number = joined.indexOf('+', 1) >= 0 ? rule_width(joined) : joined.length;
  const found: string[] = [];

  for (let at: number = 0; at < joined.length; at += width) {
    const row: string = joined.substring(at, at + width);

    found.push(row);
  }

  return found;
}


function rule_width(joined: string): number {
  const match: RegExpExecArray | null = /^\+[-+]*\+/.exec(joined);

  return match != null ? match[0].length : joined.length;
}


/** Builds the topic tree from the records, up to the stale second ARMOR. */
export function topics(found: readonly (string | null)[]): IHelpTopic[] {
  const root: IHelpTopic = { name: '', lines: [], subtopics: [] };
  const path: IHelpTopic[] = [ root ];
  const seen: Set<string> = new Set<string>();
  let table: string[] = [];
  let stopped: boolean = false;
  const flush: () => void = (): void => {
    if (table.length > 0) {
      path[path.length - 1].lines.push(...rows(table));
      table = [];
    }
  };

  for (const record of found) {
    const header: RegExpExecArray | null = record == null ? null : TOPIC.exec(record);

    if (stopped || (record == null) || (record === '`')) {
      // Binary between modules, or past the end of what can be used.
    } else if (header != null) {
      const level: number = Number(header[1]);

      flush();

      if ((level === 1) && seen.has(header[2])) {
        stopped = true;
      } else if (level <= path.length) {
        const topic: IHelpTopic = { name: header[2], lines: [], subtopics: [] };

        seen.add(level === 1 ? header[2] : '');
        path.length = level;
        path[level - 1].subtopics.push(topic);
        path.push(topic);
      } else {
        path[path.length - 1].lines.push(record);
      }
    } else if ((path.length > 1) && /^[|+]/.test(record) || (table.length > 0 && !/^ {5}\S/.test(record))) {
      table.push(record);
    } else {
      path[path.length - 1].lines.push(record);
    }
  }

  flush();

  return root.subtopics.filter((topic: IHelpTopic): boolean => topic.name !== 'HELP' || topic.lines.length > 0);
}


export function generate(library: Uint8Array): string {
  const tree: IHelpTopic[] = topics(records(library));

  tree.forEach(repair);

  return [
    '// GENERATED by tools/extract-help.ts from execute/moriahlp.hlb. Do not edit by hand.',
    '',
    'import type { IHelpTopic } from \'./vms-help\';',
    '',
    `export const HELP_LIBRARY: readonly IHelpTopic[] = ${ JSON.stringify(tree, null, 2) };`,
    '',
  ].join('\n');
}


if ((process.argv[1] != null) && process.argv[1].endsWith('extract-help.ts')) {
  const upstream: string | undefined = process.argv[2];

  if (upstream != null) {
    const target: string = path.resolve('src', 'app', 'port', 'help-library.data.ts');

    writeFileSync(target, generate(readFileSync(path.join(upstream, 'execute', 'moriahlp.hlb'))));
    console.log(`wrote ${ target }`);
  } else {
    console.error('usage: npm run extract-help -- <path to vms-moria>');
    process.exitCode = 1;
  }
}
