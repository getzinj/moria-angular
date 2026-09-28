import { generate_cave } from './generate';
import { loc_symbol } from './misc';
import { boot } from './port-fixture';
import { store_init } from './store1';
import { g } from './variables';

const TOWN_12345: readonly string[] = [
  '##################################################################',
  '#....>...........................................................#',
  '#............##########..........................................#',
  '#............##########........2#####.......#######..............#',
  '#............##########........######.......#######..............#',
  '#............1#########........######.......#######..............#',
  '#............##########........######.......#######..............#',
  '#............##########........######.......6######..............#',
  '#............##########........######.......#######..............#',
  '#............##########........######.......#######..............#',
  '#................................................................#',
  '#................................................................#',
  '#................................................................#',
  '#.........##########.............................................#',
  '#.........##########...........####........#3#####...............#',
  '#.........##########...........####........#######...............#',
  '#.........#####4####...........####........#######...............#',
  '#..............................####........#######...............#',
  '#..............................###5..............................#',
  '#..............................####..............................#',
  '#................................................................#',
  '##################################################################',
];

function map_rows(): string[] {
  const rows: string[] = [];

  for (let y: number = 1; y <= g.cur_height; y++) {
    let row: string = '';

    for (let x: number = 1; x <= g.cur_width; x++) {
      row += loc_symbol(y, x);
    }

    rows.push(row);
  }

  return rows;
}

function count_tval(tval: number): number {
  let count: number = 0;

  for (let y: number = 1; y <= g.cur_height; y++) {
    for (let x: number = 1; x <= g.cur_width; x++) {
      const tptr: number = g.cave[y][x].tptr;

      if ((tptr > 0) && (g.t_list[tptr].tval === tval)) {
        count++;
      }
    }
  }

  return count;
}

function all_edges_are(fval: number): boolean {
  let result: boolean = true;

  for (let y: number = 1; y <= g.cur_height; y++) {
    result = result && (g.cave[y][1].fval === fval) && (g.cave[y][g.cur_width].fval === fval);
  }

  for (let x: number = 1; x <= g.cur_width; x++) {
    result = result && (g.cave[1][x].fval === fval) && (g.cave[g.cur_height][x].fval === fval);
  }

  return result;
}

describe('generate', () => {
  beforeEach((): void => {
    boot();
    g.quart_height = 5;
    g.quart_width = 16;
  });

  describe('the town', () => {
    beforeEach((): void => {
      g.dun_level = 0;
      g.town_seed = 12345;
      store_init();
      generate_cave();
    });

    it('is laid out from the town seed', () => {
      expect(map_rows()).toEqual(TOWN_12345);
    });

    it('is one screen high', () => {
      expect(g.cur_height).toBe(22);
    });

    it('is one screen wide', () => {
      expect(g.cur_width).toBe(66);
    });

    it('has one way down', () => {
      expect(count_tval(108)).toBe(1);
    });

    it('is walled in by permanent rock', () => {
      expect(all_edges_are(15)).toBe(true);
    });

    it('is lit by day', () => {
      expect(g.cave[11][30].pl).toBe(true);
    });

    it('leaves the player to be placed', () => {
      expect(g.char_row).toBe(-1);
    });

    it('is the same town on the next visit', () => {
      const first: string[] = map_rows();

      generate_cave();

      expect(map_rows()).toEqual(first);
    });
  });

  describe('the town by night', () => {
    beforeEach((): void => {
      g.dun_level = 0;
      g.town_seed = 12345;
      store_init();
      g.turn = 1;
      generate_cave();
    });

    it('leaves the streets dark', () => {
      expect(g.cave[11][30].pl).toBe(false);
    });

    it('keeps the shop walls lit', () => {
      expect(g.cave[4][14].pl).toBe(true);
    });
  });

  describe('a dungeon level', () => {
    beforeEach((): void => {
      g.dun_level = 1;
      generate_cave();
    });

    it('is the full size', () => {
      expect([ g.cur_height, g.cur_width ]).toEqual([ 66, 198 ]);
    });

    it('scrolls over five panels each way', () => {
      expect([ g.max_panel_rows, g.max_panel_cols ]).toEqual([ 4, 4 ]);
    });

    it('is walled in by permanent rock', () => {
      expect(all_edges_are(15)).toBe(true);
    });

    it('has three or four ways down', () => {
      expect([ 3, 4 ]).toContain(count_tval(108));
    });

    it('has one or two ways up', () => {
      expect([ 1, 2 ]).toContain(count_tval(107));
    });

    it('leaves none of the temporary values behind', () => {
      let found: number = 0;

      for (let y: number = 1; y <= g.cur_height; y++) {
        for (let x: number = 1; x <= g.cur_width; x++) {
          found += [ 0, 8, 9 ].includes(g.cave[y][x].fval) ? 1 : 0;
        }
      }

      expect(found).toBe(0);
    });
  });
});
