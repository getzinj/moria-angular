import { inven_max } from './constants';
import { magic_init } from './desc';
import { inven_carry, place_closed_door, place_open_door, tohit_adj } from './misc';
import { dungeon, get_item } from './moria';
import { COL, ROW, boot, lit_room, play, screen, screenAfter } from './port-fixture';
import type { treasure_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone } from '../runtime/pascal';

const CURSED: number = 0x80000000;

function give(fields: Partial<treasure_type>): number {
  const at: IRef<number> = box(0);

  g.inventory[inven_max] = { ...clone(g.blank_treasure), number: 1, weight: 10, ...fields };
  inven_carry(at);

  return at.get();
}

function equip(slot: number, fields: Partial<treasure_type>): void {
  g.inventory[slot] = { ...clone(g.blank_treasure), number: 1, weight: 10, ...fields };
  g.equip_ctr++;
}

async function after(keys: string): Promise<string> {
  await screenAfter((): Promise<void> => dungeon(), keys);

  return screen().row(1).trimEnd();
}

function floor_items_east(): number {
  let count: number = 0;

  for (let x: number = COL + 1; x < g.cur_width; x++) {
    if (g.cave[ROW][x].tptr > 0) {
      count++;
    }
  }

  return count;
}

describe('inventory', () => {
  beforeEach((): void => {
    boot();
    lit_room();
    magic_init(12345);
  });

  describe('wear', () => {
    it('wields a weapon', async () => {
      give({ tval: 21, subval: 1 });
      await after('wa');

      expect(g.inventory[23].tval).toBe(21);
    });

    it('takes the weapon out of the pack', async () => {
      give({ tval: 21, subval: 1 });
      await after('wa');

      expect(g.inven_ctr).toBe(0);
    });

    it('adds the weapon\'s to-hit', async () => {
      give({ tval: 21, subval: 1, tohit: 3 });
      await after('wa');

      expect(g.py.misc.ptohit).toBe(tohit_adj() + 3);
    });

    it('puts a second ring on the other hand', async () => {
      equip(29, { tval: 45, subval: 1 });
      give({ tval: 45, subval: 2 });
      await after('wa');

      expect(g.inventory[30].tval).toBe(45);
    });

    it('hangs an amulet around the neck', async () => {
      give({ tval: 40, subval: 1 });
      await after('wa');

      expect(g.inventory[25].tval).toBe(40);
    });

    it('will not use a potion', async () => {
      give({ tval: 75, subval: 1 });

      expect(await after('wa')).toBe('I don\'t see how you can use that.');
    });

    it('will not replace a cursed weapon', async () => {
      equip(23, { tval: 21, subval: 1, flags: CURSED });
      give({ tval: 21, subval: 2 });

      expect(await after('wa')).toContain('appears to be cursed.');
    });

    it('puts the old weapon back in the pack', async () => {
      equip(23, { tval: 20, subval: 1 });
      give({ tval: 21, subval: 2 });
      await after('wa ');

      expect(g.inventory[1].tval).toBe(20);
    });
  });

  describe('take off', () => {
    it('puts the weapon back in the pack', async () => {
      equip(23, { tval: 21, subval: 1 });
      await after('ta');

      expect(g.inventory[1].tval).toBe(21);
    });

    it('empties the weapon slot', async () => {
      equip(23, { tval: 21, subval: 1 });
      await after('ta');

      expect(g.inventory[23].tval).toBe(0);
    });

    it('will not take off a cursed weapon', async () => {
      equip(23, { tval: 21, subval: 1, flags: CURSED });

      expect(await after('ta')).toBe('Hmmm, it seems to be cursed...');
    });

    it('says so with nothing on', async () => {
      expect(await after('t')).toBe('You are not using any equipment.');
    });
  });

  describe('exchange', () => {
    it('moves the primary weapon to the secondary slot', async () => {
      equip(23, { tval: 21, subval: 1 });
      await after('x');

      expect(g.inventory[34].tval).toBe(21);
    });

    it('says so with no weapons', async () => {
      expect(await after('x')).toBe('But you are wielding no weapons.');
    });
  });

  describe('inventory list', () => {
    it('heads the list', async () => {
      give({ tval: 80, subval: 1 });
      await after('i');

      expect(screen().row(1).trimEnd()).toBe('You are currently carrying -');
    });
  });

  describe('get_item', () => {
    it('is false when escaped', async () => {
      give({ tval: 80, subval: 1 });

      expect(await play((): Promise<boolean> => get_item(box(0), 'Which?', box(false), 1, 1), '\x1b')).toBe(false);
    });

    it('returns the slot picked', async () => {
      const com_val: IRef<number> = box(0);

      give({ tval: 80, subval: 1 });
      give({ tval: 75, subval: 1 });
      await play((): Promise<boolean> => get_item(com_val, 'Which?', box(false), 1, 2), 'b');

      expect(com_val.get()).toBe(2);
    });

    it('ignores a letter out of range', async () => {
      const com_val: IRef<number> = box(0);

      give({ tval: 80, subval: 1 });
      give({ tval: 75, subval: 1 });
      await play((): Promise<boolean> => get_item(com_val, 'Which?', box(false), 1, 1), 'ba');

      expect(com_val.get()).toBe(1);
    });
  });

  describe('drop', () => {
    it('puts the item on the floor', async () => {
      give({ tval: 80, subval: 1 });
      await after('da');

      expect(g.t_list[g.cave[ROW][COL].tptr].tval).toBe(80);
    });

    it('takes the item out of the pack', async () => {
      give({ tval: 80, subval: 1 });
      await after('da');

      expect(g.inven_ctr).toBe(0);
    });
  });

  describe('throw', () => {
    it('takes the item out of the pack', async () => {
      give({ tval: 80, subval: 1 });
      await after('fa6');

      expect(g.inven_ctr).toBe(0);
    });

    it('lands the item somewhere east', async () => {
      give({ tval: 80, subval: 1 });
      await after('fa6');

      expect(floor_items_east()).toBe(1);
    });
  });

  describe('bash', () => {
    it('finds nothing to bash in an empty room', async () => {
      expect(await after('B6')).toBe('I do not see anything you can bash there.');
    });
  });

  describe('jam', () => {
    it('needs a door', async () => {
      expect(await after('j6')).toBe('That isn\'t a door!');
    });

    it('needs the door closed', async () => {
      place_open_door(ROW, COL + 1);

      expect(await after('j6')).toBe('The door must be closed first.');
    });

    it('needs a spike', async () => {
      place_closed_door(ROW, COL + 1);

      expect(await after('j6')).toBe('But you have no spikes...');
    });

    it('spikes the door shut', async () => {
      place_closed_door(ROW, COL + 1);
      give({ tval: 13, subval: 1 });
      await after('j6');

      expect(g.t_list[g.cave[ROW][COL + 1].tptr].p1).toBeLessThan(-19);
    });
  });

  describe('refill', () => {
    it('needs a lamp', async () => {
      expect(await after('F')).toBe('But you are not using a lamp.');
    });

    it('pours the flask into the lamp', async () => {
      equip(33, { tval: 15, subval: 2, p1: 100 });
      give({ tval: 77, subval: 1, p1: 7500 });
      await after('F ');

      expect(g.inventory[33].p1).toBeGreaterThan(7500);
    });
  });

  describe('disarm', () => {
    it('finds nothing to disarm in an empty room', async () => {
      expect(await after('D6')).toBe('I do not see anything to disarm there.');
    });
  });

  describe('examine book', () => {
    it('needs a book', async () => {
      expect(await after('b')).toBe('You are not carrying any books.');
    });
  });
});
