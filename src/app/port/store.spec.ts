import { inven_max } from './constants';
import { magic_init } from './desc';
import { chr_adj } from './misc';
import { boot, lit_room, play, screen, screenAfter } from './port-fixture';
import { item_value, sell_price, store_carry, store_check_num, store_destroy, store_init, store_maint } from './store1';
import { enter_store } from './store2';
import type { treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, real } from '../runtime/pascal';

function item(fields: Partial<treasure_type>): treasure_type {
  return { ...clone(g.blank_treasure), number: 1, weight: 10, cost: 100, name: '& Thing', ...fields };
}

function stock(store_num: number, fields: Partial<treasure_type>, scost: number = 0): void {
  g.inventory[inven_max] = item(fields);
  store_carry(store_num, box(0));

  if (scost !== 0) {
    g.store[store_num].store_inven[g.store[store_num].store_ctr].scost = scost;
  }
}

function give(fields: Partial<treasure_type>): void {
  g.inventory[1] = item(fields);
  g.inven_ctr = 1;
}

function asking(store_num: number, wanted: treasure_type): number {
  const max_sell: IRef<number> = box(0);

  sell_price(store_num, max_sell, box(0), wanted);

  return max_sell.get() + Math.trunc(real(max_sell.get() * chr_adj()));
}

// The first offer for an item costing 100, as sell_haggle works it out.
function opening_offer(): number {
  const owner: { max_inflate: number; owner_race: number } = g.owners[g.store[1].owner];
  const cost: number = 100 - Math.trunc(real(100 * chr_adj())) - Math.trunc(real(100 * g.rgold_adj[owner.owner_race][1]));

  return Math.trunc(real(cost * real(1 - owner.max_inflate)));
}

describe('store', () => {
  beforeEach((): void => {
    boot();
    lit_room();
    magic_init(12345);
    store_init();
    g.turn = 1;
    g.py.misc.prace = 1;
    g.py.stat.cstr = 18;
    g.py.misc.wt = 150;
  });

  describe('store_init', () => {
    it('gives each store one of its own owners', () => {
      expect((g.store[3].owner - 3) % 6).toBe(0);
    });

    it('empties the shelves', () => {
      expect(g.store[3].store_ctr).toBe(0);
    });
  });

  describe('store_maint', () => {
    it('stocks an empty store', () => {
      store_maint();

      expect(g.store[1].store_ctr).toBeGreaterThan(0);
    });

    it('sells stock off a store with too much', () => {
      for (let i: number = 1; i <= 22; i++) {
        stock(2, { tval: 36, subval: i });
      }

      store_maint();

      expect(g.store[2].store_ctr).toBe(18);
    });
  });

  describe('item_value', () => {
    it('adds 100 a plus to a weapon', () => {
      expect(item_value(item({ tval: 21, tohit: 1, todam: 2 }))).toBe(400);
    });

    it('makes a cursed weapon worthless', () => {
      expect(item_value(item({ tval: 21, tohit: -1 }))).toBe(0);
    });

    it('prices an unknown potion at 20', () => {
      expect(item_value(item({ tval: 75, name: '& %C Potion~| of Speed' }))).toBe(20);
    });

    it('prices unknown food at 1', () => {
      expect(item_value(item({ tval: 80, name: '& %M Mushroom~| of Poison' }))).toBe(1);
    });

    it('adds a twentieth of the cost a charge to a known wand', () => {
      expect(item_value(item({ tval: 65, p1: 4, cost: 200 }))).toBe(240);
    });
  });

  describe('sell_price', () => {
    it('asks nothing for a worthless item', () => {
      expect(sell_price(1, box(0), box(0), item({ cost: 0 }))).toBe(0);
    });

    it('marks up by the owner\'s inflation', () => {
      const max_sell: IRef<number> = box(0);
      const price: number = sell_price(1, max_sell, box(0), item({ tval: 77 }));

      expect(max_sell.get()).toBe(Math.trunc(real(price * real(1 + g.owners[g.store[1].owner].max_inflate))));
    });
  });

  describe('store_carry', () => {
    it('keeps the stock in tval order', () => {
      stock(1, { tval: 77 });
      stock(1, { tval: 80 });

      expect(g.store[1].store_inven[1].sitem.tval).toBe(80);
    });

    it('stacks a stackable kind', () => {
      stock(1, { tval: 80, subval: 300 });
      stock(1, { tval: 80, subval: 300 });

      expect(g.store[1].store_inven[1].sitem.number).toBe(2);
    });

    it('turns down a worthless item', () => {
      stock(1, { tval: 80, cost: 0 });

      expect(g.store[1].store_ctr).toBe(0);
    });

    it('stores a haggled price as negative', () => {
      stock(1, { tval: 80 });

      expect(g.store[1].store_inven[1].scost).toBeLessThan(0);
    });
  });

  describe('store_destroy', () => {
    it('takes one off a stack', () => {
      stock(1, { tval: 80, subval: 300, number: 3 });
      store_destroy(1, 1, true);

      expect(g.store[1].store_inven[1].sitem.number).toBe(2);
    });

    it('hands over just the one', () => {
      stock(1, { tval: 80, subval: 300, number: 3 });
      store_destroy(1, 1, true);

      expect(g.inventory[inven_max].number).toBe(1);
    });

    it('closes the gap a whole slot leaves', () => {
      stock(1, { tval: 80 });
      stock(1, { tval: 77 });
      store_destroy(1, 1, false);

      expect(g.store[1].store_inven[1].sitem.tval).toBe(77);
    });
  });

  describe('store_check_num', () => {
    it('refuses a new kind in a full store', () => {
      g.store[1].store_ctr = 24;
      g.inventory[inven_max] = item({ tval: 80, subval: 1 });

      expect(store_check_num(1)).toBe(false);
    });
  });

  describe('enter_store', () => {
    it('shows the owner', async () => {
      await screenAfter((): Promise<void> => enter_store(1), '');

      expect(screen().row(4).trim()).toBe(g.owners[g.store[1].owner].owner_name.trim());
    });

    it('lists the stock', async () => {
      stock(1, { tval: 77, name: '& Flask~ of oil' });
      await screenAfter((): Promise<void> => enter_store(1), '');

      expect(screen().row(6)).toContain('a) a Flask of oil');
    });

    it('says the whole stock is on show', async () => {
      await screenAfter((): Promise<void> => enter_store(1), 'b');

      expect(screen().row(1).trimEnd()).toBe('Entire inventory is shown.');
    });

    it('turns down an unknown command', async () => {
      await screenAfter((): Promise<void> => enter_store(1), 'z');

      expect(screen().row(1).trimEnd()).toBe('Invalid Command.');
    });

    it('lets the player leave', async () => {
      await expect(play((): Promise<void> => enter_store(1), '\x1b')).resolves.toBeUndefined();
    });

    it('is out of stock with empty shelves', async () => {
      await screenAfter((): Promise<void> => enter_store(1), 'p');

      expect(screen().row(1).trimEnd()).toBe('I am currently out of stock.');
    });
  });

  describe('buying at a fixed price', () => {
    beforeEach((): void => {
      stock(1, { tval: 77, name: '& Flask~ of oil' }, 10);
      g.py.misc.au = 100;
    });

    it('takes the gold', async () => {
      await play((): Promise<void> => enter_store(1), 'pa \x1b');

      expect(g.py.misc.au).toBe(90);
    });

    it('puts the item in the pack', async () => {
      await play((): Promise<void> => enter_store(1), 'pa \x1b');

      expect(g.inventory[1].tval).toBe(77);
    });

    it('calls a player without the gold a liar', async () => {
      g.py.misc.au = 5;
      await screenAfter((): Promise<void> => enter_store(1), 'pa ');

      expect(screen().row(1).trimEnd()).toBe('Liar!  You have not the gold!');
    });
  });

  describe('haggling to buy', () => {
    let price: number;

    beforeEach((): void => {
      stock(1, { tval: 77, name: '& Flask~ of oil' });
      price = asking(1, g.store[1].store_inven[1].sitem);
      g.py.misc.au = 100000;
    });

    it('opens with the asking price', async () => {
      await screenAfter((): Promise<void> => enter_store(1), 'pa');

      expect(screen().row(2).trimEnd()).toBe(`Asking : ${ price }`);
    });

    it('sells at the asking price', async () => {
      await play((): Promise<void> => enter_store(1), `pa${ price }\r \x1b`);

      expect(g.py.misc.au).toBe(100000 - price);
    });

    it('comes down after a fair offer', async () => {
      await screenAfter((): Promise<void> => enter_store(1), `pa${ Math.trunc(price * 0.9) }\r `);

      expect(Number(/Asking : (\d+)/.exec(screen().row(2))?.[1])).toBeLessThan(price);
    });

    it('remembers the fair offer', async () => {
      await screenAfter((): Promise<void> => enter_store(1), `pa${ Math.trunc(price * 0.9) }\r `);

      expect(screen().row(2)).toContain(`Your last offer : ${ Math.trunc(price * 0.9) }`);
    });

    it('keeps the gold when the player walks away', async () => {
      await play((): Promise<void> => enter_store(1), 'pa\x1b\x1b');

      expect(g.py.misc.au).toBe(100000);
    });

    it('does not take an offer over the asking price', async () => {
      await screenAfter((): Promise<void> => enter_store(1), `pa${ price + 1 }\r`);

      expect([ 'I must of heard you wrong...', 'What was that?', 'I\'m sorry, say that again...', 'What did you say?', 'Sorry, what was that again?' ])
        .toContain(screen().row(1).trimEnd().replace(' -more-', ''));
    });

    it('asks again for a number too big to read', async () => {
      await screenAfter((): Promise<void> => enter_store(1), 'pa99999999999\r');

      expect(screen().row(1)).toContain('What do you offer?');
    });

    it('reopens at once when the 16-bit opening turn wraps', async () => {
      g.turn = 31000;
      g.store[1].insult_cur = g.owners[g.store[1].owner].insult_max;
      await play((): Promise<void> => enter_store(1), 'pa1\r    ');

      expect(g.store[1].store_open).toBeLessThan(g.turn);
    });

    it('shuts the shop on the player who insults once too often', async () => {
      g.store[1].insult_cur = g.owners[g.store[1].owner].insult_max;
      await play((): Promise<void> => enter_store(1), 'pa1\r    ');

      expect(g.store[1].store_open).toBeGreaterThan(g.turn);
    });
  });

  describe('selling', () => {
    it('will not buy what the store does not stock', async () => {
      give({ tval: 21 });
      await screenAfter((): Promise<void> => enter_store(1), 'sa ');

      expect(screen().row(1).trimEnd()).toBe('I do not buy such items.');
    });

    it('takes offence at a worthless item', async () => {
      give({ tval: 77, cost: 0 });
      await screenAfter((): Promise<void> => enter_store(1), 'sa  ');

      expect(screen().row(1).trimEnd()).toContain('I will not buy that!');
    });

    it('goes up after a fair asking price', async () => {
      const offer: number = opening_offer();

      give({ tval: 77 });
      await screenAfter((): Promise<void> => enter_store(1), `sa ${ offer * 2 }\r `);

      expect(Number(/Offer : (\d+)/.exec(screen().row(2))?.[1])).toBeGreaterThan(offer);
    });

    it('pays what the owner offers', async () => {
      const offer: number = opening_offer();

      give({ tval: 77 });
      g.py.misc.au = 0;
      await play((): Promise<void> => enter_store(1), `sa ${ offer }\r \x1b`);

      expect(g.py.misc.au).toBe(offer);
    });
  });
});
