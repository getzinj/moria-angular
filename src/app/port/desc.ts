// source/include/desc.inc: the unidentified names of things, and how items are described.

import { inven_max, max_amulets, max_colors, max_metals, max_mush, max_objects, max_rocks, max_syllables, max_talloc, max_woods } from './constants';
import { insert_num, insert_str, randint } from './misc';
import type { treasure_type } from './types';
import { g } from './variables';
import { fmt, index, substr } from '../runtime/pascal';
import { rt } from '../runtime/runtime';


function shuffle(list: string[], count: number): void {
  for (let i1: number = 1; i1 <= count; i1++) {
    const i2: number = randint(count);
    const tmp: string = list[i1];

    list[i1] = list[i2];
    list[i2] = tmp;
  }
}


// desc.inc:4 randes: shuffles the flavours.
export function randes(): void {
  shuffle(g.colors, max_colors);
  shuffle(g.woods, max_woods);
  shuffle(g.metals, max_metals);
  shuffle(g.rocks, max_rocks);
  shuffle(g.amulets, max_amulets);
  shuffle(g.mushrooms, max_mush);
}


// desc.inc:55 rantitle: a scroll's made-up title.
export function rantitle(): string {
  const i3: number = randint(2) + 1;
  let title: string = 'Titled "';

  for (let i1: number = 1; i1 <= i3; i1++) {
    const syllables: number = randint(2);

    for (let i2: number = 1; i2 <= syllables; i2++) {
      title += g.syllables[randint(max_syllables)];
    }

    if (i1 !== i3) {
      title += ' ';
    }
  }

  return `${ title }"`;
}


// desc.inc:74 magic_init. Each bounds check is the original's, including the ones that test
// against a different list than they index (rings against max_colors, for one); no real subval
// reaches past its list.
export function magic_init(random_seed: number): void {
  rt().random.seed = random_seed;
  randes();

  for (let i1: number = 1; i1 <= max_objects; i1++) {
    const item: treasure_type = g.object_list[i1];
    const tmpv: number = item.subval & 0xFF;

    switch (item.tval) {
      case 75: case 76:
        if (tmpv <= max_colors) {
          item.name = insert_str(item.name, '%C', g.colors[tmpv]);
        }
        break;
      case 70: case 71:
        item.name = insert_str(item.name, '%T', rantitle());
        break;
      case 45:
        if (tmpv <= max_colors) {
          item.name = insert_str(item.name, '%R', g.rocks[tmpv]);
        }
        break;
      case 40:
        if (tmpv <= max_rocks) {
          item.name = insert_str(item.name, '%A', g.amulets[tmpv]);
        }
        break;
      case 65:
        if (tmpv <= max_amulets) {
          item.name = insert_str(item.name, '%M', g.metals[tmpv]);
        }
        break;
      case 55:
        if (tmpv <= max_woods) {
          item.name = insert_str(item.name, '%W', g.woods[tmpv]);
        }
        break;
      case 80:
        if (tmpv <= max_mush) {
          item.name = insert_str(item.name, '%M', g.mushrooms[tmpv]);
        }
        break;
    }
  }
}


function without_marker(object_str: string, marker: string): string {
  const pos: number = index(object_str, marker);
  let result: string = object_str;

  if (pos > 0) {
    const olen: number = object_str.length;

    result = substr(object_str, 1, pos - 1) + substr(object_str, pos + 1, olen - pos);
  }

  return result;
}


// desc.inc:110 known1: drops the '|' that hides an object's identity.
export function known1(object_str: string): string {
  return without_marker(object_str, '|');
}


// desc.inc:129 known2: drops the '^' that hides its pluses.
export function known2(object_str: string): string {
  return without_marker(object_str, '^');
}


// desc.inc:148 unquote: removes the quoted flavour between '~' and '|'.
export function unquote(object_str: string): string {
  let result: string = object_str;

  if (index(object_str, '"') > 0) {
    const pos1: number = index(object_str, '~');
    const pos2: number = index(object_str, '|');
    const olen: number = object_str.length;

    result = substr(object_str, 1, pos1) + substr(object_str, pos2 + 1, olen - pos2);
  }

  return result;
}


function reveal(item: treasure_type): void {
  item.name = known1(unquote(item.name));
}


// desc.inc:170 identify: every item of this kind, wherever it is, is now known.
export function identify(item: treasure_type): void {
  const x1: number = item.tval;
  const x2: number = item.subval;

  if (index(item.name, '|') > 0) {
    for (let i1: number = 1; i1 <= max_talloc; i1++) {
      if ((g.t_list[i1].tval === x1) && (g.t_list[i1].subval === x2)) {
        reveal(g.t_list[i1]);
      }
    }

    for (let i1: number = 1; i1 <= inven_max; i1++) {
      if ((g.inventory[i1].tval === x1) && (g.inventory[i1].subval === x2)) {
        reveal(g.inventory[i1]);
      }
    }

    for (let i1: number = 1; i1 <= max_objects; i1++) {
      const known: treasure_type = g.object_list[i1];

      if ((known.tval === x1) && (known.subval === x2)) {
        if (index(known.name, '%T') > 0) {
          known.name = insert_str(known.name, ' %T|', '');
        } else {
          reveal(known);
        }

        g.object_ident[i1] = true;
      }
    }
  }
}


// desc.inc:214 objdes: how inventory[ptr] reads, with an article and a full stop if pref.
export function objdes(ptr: number, pref: boolean): string {
  const item: treasure_type = g.inventory[ptr];
  let tmp_val: string = item.name;
  let pos: number = index(tmp_val, '|');
  let out_val: string;

  if (pos > 0) {
    tmp_val = substr(tmp_val, 1, pos - 1);
  }

  pos = index(tmp_val, '^');

  if (pos > 0) {
    tmp_val = substr(tmp_val, 1, pos - 1);
  }

  if (!pref) {
    pos = index(tmp_val, ' (');

    if (pos > 0) {
      tmp_val = substr(tmp_val, 1, pos - 1);
    }
  }

  tmp_val = insert_num(tmp_val, '%P1', item.p1, true);
  tmp_val = insert_num(tmp_val, '%P2', item.tohit, true);
  tmp_val = insert_num(tmp_val, '%P3', item.todam, true);
  tmp_val = insert_num(tmp_val, '%P4', item.toac, true);
  tmp_val = insert_num(tmp_val, '%P5', item.p1, false);
  tmp_val = insert_num(tmp_val, '%P6', item.ac, false);

  if (item.number !== 1) {
    tmp_val = insert_str(tmp_val, 'ch~', 'ches');
    tmp_val = insert_str(tmp_val, '~', 's');
  } else {
    tmp_val = insert_str(tmp_val, '~', '');
  }

  if (pref) {
    if (index(tmp_val, '&') > 0) {
      tmp_val = insert_str(tmp_val, '&', '');

      if (item.number > 1) {
        out_val = fmt(item.number, 1) + tmp_val;
      } else if (item.number < 1) {
        out_val = `no more${ tmp_val }`;
      } else if (g.vowel_set.has(tmp_val.charAt(1))) {
        out_val = `an${ tmp_val }`;
      } else {
        out_val = `a${ tmp_val }`;
      }
    } else {
      out_val = tmp_val;
    }

    out_val += '.';
  } else {
    out_val = insert_str(tmp_val, '& ', '');
  }

  return out_val;
}
