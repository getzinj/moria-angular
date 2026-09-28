import { creatures } from './creature';
import { dl } from './dungeon-locals';
import { distance, place_gold, place_monster } from './misc';
import { COL, ROW, boot, lit_room, play, screen } from './port-fixture';
import type { monster_type } from './types';
import { g } from './variables';

const KOBOLD: number = 17;
const GREY_MUSHROOM: number = 9;

function monster_at(y: number, x: number): monster_type {
  return g.m_list[g.cave[y][x].cptr];
}

function kobold_at(y: number, x: number): monster_type {
  place_monster(y, x, KOBOLD, false);

  return monster_at(y, x);
}

describe('creature', () => {
  beforeEach((): void => {
    boot(3);
    lit_room();
    g.py.misc.chp = 1000;
    g.py.misc.mhp = 1000;
  });

  describe('creatures without attacking', () => {
    it('shows a monster the player can see', async () => {
      const kobold: monster_type = kobold_at(ROW, COL + 5);

      await creatures(false);

      expect(kobold.ml).toBe(true);
    });

    it('draws it on the map', async () => {
      kobold_at(ROW, COL + 5);
      await play((): Promise<void> => creatures(false));

      expect(screen().row(ROW - g.panel_row_prt).charAt(COL + 5 - g.panel_col_prt - 1)).toBe('k');
    });

    it('does not show one in the dark', async () => {
      g.cave[ROW][COL + 5].pl = false;

      const kobold: monster_type = kobold_at(ROW, COL + 5);

      await creatures(false);

      expect(kobold.ml).toBe(false);
    });

    it('leaves it where it is', async () => {
      const kobold: monster_type = kobold_at(ROW, COL + 5);

      await creatures(false);

      expect(kobold.fx).toBe(COL + 5);
    });
  });

  describe('an ooze that breeds onto its own square', () => {
    const BLACK_OOZE: number = 188;
    const OY: number = ROW;
    const OX: number = COL + 10;

    // Walled in bar one square with gold on it: breeding can land only on the ooze's own square,
    // which frees its slot for the newborn, and the newborn can still move onto the gold.
    function enclose(): void {
      for (let y: number = OY - 1; y <= OY + 1; y++) {
        for (let x: number = OX - 1; x <= OX + 1; x++) {
          if ((y !== OY) || (x !== OX)) {
            g.cave[y][x].fval = 10;
            g.cave[y][x].fopen = false;
          }
        }
      }

      g.cave[OY][OX - 1].fval = 1;
      g.cave[OY][OX - 1].fopen = true;
      place_gold(OY, OX - 1);
    }

    it('stays drawn where it moves to', async () => {
      let hidden: number = 0;

      for (let seed: number = 1; seed <= 200; seed++) {
        boot(seed);
        lit_room();
        enclose();
        place_monster(OY, OX, BLACK_OOZE, false);
        await creatures(false);
        await play((): Promise<void> => creatures(true));

        for (let x: number = OX - 1; x <= OX; x++) {
          const cptr: number = g.cave[OY][x].cptr;

          if ((cptr > 1) && g.m_list[cptr].ml && (screen().row(OY - g.panel_row_prt).charAt(x - g.panel_col_prt - 1) !== 'O')) {
            hidden++;
          }
        }
      }

      expect(hidden).toBe(0);
    });
  });

  describe('creatures attacking', () => {
    it('moves a monster toward the player', async () => {
      const kobold: monster_type = kobold_at(ROW, COL + 5);

      await play((): Promise<void> => creatures(true));

      expect(distance(ROW, COL, kobold.fy, kobold.fx)).toBeLessThan(5);
    });

    it('leaves a sleeping monster be', async () => {
      const kobold: monster_type = kobold_at(ROW, COL + 5);

      kobold.csleep = 1000;
      await play((): Promise<void> => creatures(true));

      expect(kobold.fx).toBe(COL + 5);
    });

    it('never moves a monster that never moves', async () => {
      place_monster(ROW, COL + 5, GREY_MUSHROOM, false);
      await play((): Promise<void> => creatures(true));

      expect(g.cave[ROW][COL + 5].cptr).toBeGreaterThan(1);
    });

    it('has a monster next to the player attack', async () => {
      g.py.misc.pac = -1000;
      kobold_at(ROW, COL + 1);
      await play((): Promise<void> => creatures(true), '     ');

      expect(g.py.misc.chp).toBeLessThan(1000);
    });

    it('says what the monster did', async () => {
      g.py.misc.pac = -1000;
      kobold_at(ROW, COL + 1);
      await play((): Promise<void> => creatures(true), '     ');

      expect(screen().row(1)).toMatch(/The Kobold (hits you|misses you)\./);
    });

    it('reads only five characters of an attack\'s dice, as the source\'s varying [5] does', async () => {
      g.py.misc.pac = 0;
      g.c_list[KOBOLD].damage = '1 1 10d12';
      kobold_at(ROW, COL + 1);
      await play((): Promise<void> => creatures(true), '     ');
      g.c_list[KOBOLD].damage = '1 1 1d6';

      expect(g.py.misc.chp).toBe(990);
    });

    it('does not move a monster through a wall', async () => {
      for (let y: number = ROW - 1; y <= ROW + 1; y++) {
        g.cave[y][COL + 4].fval = 10;
        g.cave[y][COL + 4].fopen = false;
      }

      const kobold: monster_type = kobold_at(ROW, COL + 5);

      await play((): Promise<void> => creatures(true));

      expect(kobold.fx).toBeGreaterThanOrEqual(COL + 5);
    });

    it('stops after the first monster once the player leaves the level', async () => {
      const last: monster_type = kobold_at(ROW, COL + 5);

      kobold_at(ROW + 5, COL);
      dl.moria_flag = true;
      await play((): Promise<void> => creatures(true));
      dl.moria_flag = false;

      expect(last.fx).toBe(COL + 5);
    });
  });
});
