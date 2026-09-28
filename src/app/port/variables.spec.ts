import { max_background, max_class, max_creatures, max_height, max_malloc, max_objects, max_player_level, max_races, max_stores, max_width, inven_init_max } from './constants';
import type { IGlobals } from './variables';
import { g, newglobals, resetglobals } from './variables';

// Pascal arrays keep their bounds: index 0 of an [1..n] array is padding, so length is n + 1.
function count(items: readonly unknown[], low: number = 1): number {
  return items.length - low;
}

describe('globals from values.inc', () => {
  let globals: IGlobals;

  beforeEach((): void => {
    globals = newglobals();
  });

  describe('table sizes', () => {
    it.each([
      [ 'c_list', (): readonly unknown[] => globals.c_list, max_creatures ],
      [ 'object_list', (): readonly unknown[] => globals.object_list, max_objects ],
      [ 'inventory_init', (): readonly unknown[] => globals.inventory_init, inven_init_max ],
      [ 'background', (): readonly unknown[] => globals.background, max_background ],
      [ 'race', (): readonly unknown[] => globals.race, max_races ],
      [ 'class', (): readonly unknown[] => globals.class, max_class ],
      [ 'player_exp', (): readonly unknown[] => globals.player_exp, max_player_level ],
      [ 'store', (): readonly unknown[] => globals.store, max_stores ],
      [ 'm_list', (): readonly unknown[] => globals.m_list, max_malloc ],
      [ 'cave', (): readonly unknown[] => globals.cave, max_height ],
    ])('%s holds its declared number of entries', (_name: string, table: () => readonly unknown[], size: number) => {
      expect(count(table())).toBe(size);
    });

    it('gives each cave row max_width cells', () => {
      expect(count(globals.cave[1])).toBe(max_width);
    });

    it('gives each class 31 spells', () => {
      expect(count(globals.magic_spell[max_class])).toBe(31);
    });

    it('keeps used_line indexed 2..23', () => {
      expect([ globals.used_line.length, globals.used_line[23] ]).toEqual([ 24, false ]);
    });
  });

  describe('spot checks against values.inc', () => {
    it('starts c_list with the Filthy Street Urchin', () => {
      expect(globals.c_list[1].name).toBe('Filthy Street Urchin');
    });

    it('reads a creature bit field in hex', () => {
      expect(globals.c_list[1].cmove).toBe(0x0012000A);
    });

    it('ends c_list with the Balrog', () => {
      expect(globals.c_list[max_creatures].name).toBe('Balrog');
    });

    it('starts object_list with the Mushroom of Poison', () => {
      expect(globals.object_list[1].name).toBe('& %M Mushroom~| of Poison');
    });

    it('gives the priest Holy Word last', () => {
      expect(globals.magic_spell[max_class][31].sname).toBe('Holy Word');
    });

    it('stores the Human experience factor as a single-precision real', () => {
      expect(globals.race[1].b_exp).toBe(Math.fround(1.00));
    });

    it('builds the floor set', () => {
      expect([ ...globals.floor_set ]).toEqual([ 1, 2, 4, 5, 6, 7 ]);
    });

    it('keeps the wizard password seed in wdata', () => {
      expect(globals.wdata[1][0]).toBe(11065);
    });

    it('starts the player with 7500 food', () => {
      expect(globals.py.flags.food).toBe(7500);
    });

    it('zeroes the uninitialised password until bpswd builds it', () => {
      expect(globals.password1).toBe('\0'.repeat(12));
    });
  });

  describe('fresh copies', () => {
    it('gives each call its own tables', () => {
      globals.c_list[1].name = 'changed';

      expect(newglobals().c_list[1].name).toBe('Filthy Street Urchin');
    });

    it('puts g back as it started on resetglobals', () => {
      g.turn = 500;
      resetglobals();

      expect(g.turn).toBe(0);
    });
  });
});
