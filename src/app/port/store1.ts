// source/include/store1.inc: store stock and prices.

import { inven_max, max_objects, max_owners, max_stores, obj_town_level, store$choices, store$max_inven, store$min_inven, store$turn_around, store_inven_max } from './constants';
import { identify, known2 } from './desc';
import { magic_treasure, popt, pusht, randint } from './misc';
import type { owner_type, store_type, treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, div, index, real } from '../runtime/pascal';


const WEAPONS_AND_ARMOUR: ReadonlySet<number> = new Set([ 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36 ]);
const WEAPONS: ReadonlySet<number> = new Set([ 20, 21, 22, 23 ]);
const AMMO: ReadonlySet<number> = new Set([ 10, 11, 12, 13 ]);
const CONSUMABLES: ReadonlySet<number> = new Set([ 70, 71, 75, 76, 80 ]);
const JEWELRY: ReadonlySet<number> = new Set([ 40, 45 ]);
const DEVICES: ReadonlySet<number> = new Set([ 55, 60, 65 ]);
const UNKNOWN_DEVICE: Readonly<Record<number, number>> = { 55: 70, 60: 60, 65: 50 };


// store1.inc:4 search_list: the catalogue cost of an object kind.
function search_list(x1: number, x2: number): number {
  let i1: number = 0;
  let i2: number = 0;

  do {
    i1++;

    const known: treasure_type = g.object_list[i1];

    if ((known.tval === x1) && (known.subval === x2)) {
      i2 = known.cost;
    }
  } while (!((i1 === max_objects) || (i2 > 0)));

  return i2;
}


function no_minus_value(item: treasure_type, multiplier: number): number {
  let value: number;

  if ((item.tohit < 0) || (item.todam < 0) || (item.toac < 0)) {
    value = 0;
  } else {
    value = (item.cost + (item.tohit + item.todam + item.toac) * multiplier) * item.number;
  }

  return value;
}


// store1.inc:2 item_value: what an object is worth.
export function item_value(item: treasure_type): number {
  let value: number = item.cost;

  if (WEAPONS_AND_ARMOUR.has(item.tval)) {
    if (index(item.name, '^') > 0) {
      value = search_list(item.tval, item.subval) * item.number;
    } else if (WEAPONS.has(item.tval)) {
      value = no_minus_value(item, 100);
    } else if (item.toac < 0) {
      value = 0;
    } else {
      value = (item.cost + item.toac * 100) * item.number;
    }
  } else if (AMMO.has(item.tval)) {
    if (index(item.name, '^') > 0) {
      value = search_list(item.tval, 1) * item.number;
    } else {
      value = no_minus_value(item, 10);
    }
  } else if (CONSUMABLES.has(item.tval)) {
    if (index(item.name, '|') > 0) {
      value = item.tval === 80 ? 1 : 20;
    }
  } else if (JEWELRY.has(item.tval)) {
    if (index(item.name, '|') > 0) {
      value = 45;
    } else if (index(item.name, '^') > 0) {
      value = Math.abs(item.cost);
    }
  } else if (DEVICES.has(item.tval)) {
    value = device_value(item, value);
  }

  return value;
}


function device_value(item: treasure_type, value: number): number {
  let result: number = value;

  if (index(item.name, '|') > 0) {
    result = UNKNOWN_DEVICE[item.tval];
  } else if (index(item.name, '^') === 0) {
    result = item.cost + Math.trunc(real(item.cost / 20.0)) * item.p1;
  }

  return result;
}


// store1.inc:102 sell_price: the asking price, with the haggling range in max_sell and min_sell.
export function sell_price(snum: number, max_sell: IRef<number>, min_sell: IRef<number>, item: treasure_type): number {
  const owner: owner_type = g.owners[g.store[snum].owner];
  let i1: number = item_value(item);
  let result: number;

  if (item.cost > 0) {
    i1 += Math.trunc(real(i1 * g.rgold_adj[owner.owner_race][g.py.misc.prace]));

    if (i1 < 1) {
      i1 = 1;
    }

    max_sell.set(Math.trunc(real(i1 * real(1 + owner.max_inflate))));
    min_sell.set(Math.trunc(real(i1 * real(1 + owner.min_inflate))));

    if (min_sell.get() > max_sell.get()) {
      min_sell.set(max_sell.get());
    }

    result = i1;
  } else {
    max_sell.set(0);
    min_sell.set(0);
    result = 0;
  }

  return result;
}


// store1.inc:133 store_check_num: whether the store has room for the item in inven_max.
export function store_check_num(store_num: number): boolean {
  const shop: store_type = g.store[store_num];
  const incoming: treasure_type = g.inventory[inven_max];
  let result: boolean = false;

  if (shop.store_ctr < store_inven_max) {
    result = true;
  } else if ((incoming.subval > 255) && (incoming.subval < 512)) {
    for (let i1: number = 1; i1 <= shop.store_ctr; i1++) {
      const stocked: treasure_type = shop.store_inven[i1].sitem;

      if ((stocked.tval === incoming.tval) && (stocked.subval === incoming.subval)) {
        result = true;
      }
    }
  }

  return result;
}


// store1.inc:161 insert: inven_max into the stock at pos.
function insert(store_num: number, pos: number, icost: number): void {
  const shop: store_type = g.store[store_num];

  for (let i1: number = shop.store_ctr; i1 >= pos; i1--) {
    shop.store_inven[i1 + 1] = shop.store_inven[i1];
  }

  shop.store_inven[pos] = { sitem: clone(g.inventory[inven_max]), scost: -icost };
  shop.store_ctr++;
}


// store1.inc:153 store_carry: the item in inven_max into the stock, in tval order; ipos is its
// slot, or 0 when it joined a stack or was worthless.
export function store_carry(store_num: number, ipos: IRef<number>): void {
  const incoming: treasure_type = g.inventory[inven_max];
  const icost: IRef<number> = box(0);

  ipos.set(0);
  identify(incoming);
  incoming.name = known2(incoming.name);
  sell_price(store_num, icost, box(0), incoming);

  if (icost.get() > 0) {
    const shop: store_type = g.store[store_num];
    const item_num: number = incoming.number;
    const typ: number = incoming.tval;
    const subt: number = incoming.subval;
    let item_val: number = 0;
    let flag: boolean = false;

    do {
      item_val++;

      const stocked: treasure_type = shop.store_inven[item_val].sitem;

      if (typ === stocked.tval) {
        if ((subt === stocked.subval) && (subt > 255)) {
          if (stocked.number < 24) {
            stocked.number += item_num;
          }

          flag = true;
        }
      } else if (typ > stocked.tval) {
        insert(store_num, item_val, icost.get());
        flag = true;
        ipos.set(item_val);
      }
    } while (!((item_val >= shop.store_ctr) || flag));

    if (!flag) {
      insert(store_num, shop.store_ctr + 1, icost.get());
      ipos.set(shop.store_ctr);
    }
  }
}


// store1.inc:224 store_destroy: one of a stack, or the whole slot, out of the stock into inven_max.
export function store_destroy(store_num: number, item_val: number, one_of: boolean): void {
  const shop: store_type = g.store[store_num];
  const stocked: treasure_type = shop.store_inven[item_val].sitem;

  g.inventory[inven_max] = clone(stocked);

  if ((stocked.number > 1) && (stocked.subval < 512) && one_of) {
    stocked.number--;
    g.inventory[inven_max].number = 1;
  } else {
    for (let i2: number = item_val; i2 <= shop.store_ctr - 1; i2++) {
      shop.store_inven[i2] = shop.store_inven[i2 + 1];
    }

    shop.store_inven[shop.store_ctr] = { sitem: clone(g.blank_treasure), scost: 0 };
    shop.store_ctr--;
  }
}


// store1.inc:255 store_init: an owner for each store, and empty shelves.
export function store_init(): void {
  const i1: number = div(max_owners, max_stores);

  for (let i2: number = 1; i2 <= max_stores; i2++) {
    const shop: store_type = g.store[i2];

    shop.owner = max_stores * (randint(i1) - 1) + i2;
    shop.insult_cur = 0;
    shop.store_open = 0;
    shop.store_ctr = 0;

    for (let i3: number = 1; i3 <= store_inven_max; i3++) {
      shop.store_inven[i3] = { sitem: clone(g.blank_treasure), scost: 0 };
    }
  }
}


// store1.inc:277 store_create: up to four tries at a new item the store would stock.
function store_create(store_num: number): void {
  const cur_pos: IRef<number> = box(0);
  let tries: number = 0;

  popt(cur_pos);

  do {
    const i1: number = g.store_choice[store_num][randint(store$choices)];

    g.t_list[cur_pos.get()] = clone(g.inventory_init[i1]);
    magic_treasure(cur_pos.get(), obj_town_level);
    g.inventory[inven_max] = clone(g.t_list[cur_pos.get()]);

    if (store_check_num(store_num)) {
      const made: treasure_type = g.t_list[cur_pos.get()];

      if ((made.cost > 0) && (made.cost < g.owners[g.store[store_num].owner].max_cost)) {
        store_carry(store_num, box(0));
        tries = 10;
      }
    }

    tries++;
  } while (tries <= 3);

  pusht(cur_pos.get());
}


// store1.inc:304 store_maint: each store sells some stock off and buys some in.
export function store_maint(): void {
  for (let i1: number = 1; i1 <= max_stores; i1++) {
    const shop: store_type = g.store[i1];

    shop.insult_cur = 0;

    if (shop.store_ctr > store$max_inven) {
      const count: number = shop.store_ctr - store$max_inven + 2;

      for (let i2: number = 1; i2 <= count; i2++) {
        store_destroy(i1, randint(shop.store_ctr), false);
      }
    } else if (shop.store_ctr < store$min_inven) {
      const count: number = store$min_inven - shop.store_ctr + 2;

      for (let i2: number = 1; i2 <= count; i2++) {
        store_create(i1);
      }
    } else {
      turn_around(i1);
    }
  }
}


function turn_around(i1: number): void {
  const sold: number = 1 + randint(store$turn_around);

  for (let i2: number = 1; i2 <= sold; i2++) {
    store_destroy(i1, randint(g.store[i1].store_ctr), true);
  }

  const bought: number = 1 + randint(store$turn_around);

  for (let i2: number = 1; i2 <= bought; i2++) {
    store_create(i1);
  }
}
