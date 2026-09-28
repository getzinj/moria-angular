import { place_monster, place_trap } from './misc';
import { COL, ROW, boot, lit_room, play, screen } from './port-fixture';
import {
  aggravate_monster,
  bless,
  cure_poison,
  detect_monsters,
  disarm_all,
  earthquake,
  enchant,
  fire_ball,
  fire_bolt,
  hp_player,
  light_area,
  lose_str,
  mass_genocide,
  sleep_monsters1,
  slow_poison,
  teleport_away,
  wall_to_mud,
} from './spells';
import type { monster_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box } from '../runtime/pascal';

const KOBOLD: number = 17;

function kobold_at(y: number, x: number): monster_type {
  place_monster(y, x, KOBOLD, false);

  return g.m_list[g.cave[y][x].cptr];
}

describe('spells', () => {
  beforeEach((): void => {
    boot(5);
    lit_room();
  });

  describe('sleep_monsters1', () => {
    it('puts a low-level monster beside the player to sleep', async () => {
      const kobold: monster_type = kobold_at(ROW, COL + 1);

      g.c_list[KOBOLD].level = 0;
      await play((): Promise<boolean> => sleep_monsters1(ROW, COL));
      g.c_list[KOBOLD].level = 1;

      expect(kobold.csleep).toBe(500);
    });
  });

  describe('fire_bolt', () => {
    it('kills a creature it does enough damage to', async () => {
      kobold_at(ROW, COL + 3);
      await play((): Promise<boolean> => fire_bolt(5, 6, ROW, COL, 1000, 'bolt of fire'), '     ');

      expect(g.cave[ROW][COL + 3].cptr).toBe(0);
    });

    it('stops at the first creature', async () => {
      kobold_at(ROW, COL + 3);

      const second: monster_type = kobold_at(ROW, COL + 5);
      const hp: number = second.hp;

      await play((): Promise<boolean> => fire_bolt(5, 6, ROW, COL, 1000, 'bolt of fire'), '     ');

      expect(second.hp).toBe(hp);
    });

    it('says what it struck', async () => {
      kobold_at(ROW, COL + 3);
      await play((): Promise<boolean> => fire_bolt(5, 6, ROW, COL, 1, 'magic missile'), '     ');

      expect(screen().row(1)).toContain('The magic missile strikes the Kobold.');
    });
  });

  describe('fire_ball', () => {
    it('catches a creature beside the one it hits', async () => {
      kobold_at(ROW, COL + 3);

      const beside: monster_type = kobold_at(ROW + 1, COL + 3);
      const hp: number = beside.hp;

      await play((): Promise<boolean> => fire_ball(5, 6, ROW, COL, 20, 'fire ball'), '     ');

      expect(beside.hp < hp || (g.cave[ROW + 1][COL + 3].cptr === 0)).toBe(true);
    });
  });

  describe('wall_to_mud', () => {
    it('turns the first wall along the line to floor', async () => {
      g.cave[ROW][COL + 4].fval = 10;
      g.cave[ROW][COL + 4].fopen = false;
      await play((): Promise<boolean> => wall_to_mud(6, ROW, COL), '     ');

      expect(g.cave[ROW][COL + 4].fopen).toBe(true);
    });
  });

  describe('disarm_all', () => {
    it('removes a trap along the line', async () => {
      place_trap(ROW, COL + 2, 2, 1);
      await play((): Promise<boolean> => disarm_all(6, ROW, COL + 1));

      expect(g.cave[ROW][COL + 2].tptr).toBe(0);
    });
  });

  describe('teleport_away', () => {
    it('moves the creature off its spot', () => {
      const kobold: monster_type = kobold_at(ROW, COL + 3);

      teleport_away(g.cave[ROW][COL + 3].cptr, 10);

      expect(g.cave[ROW][COL + 3].cptr === 0 && ((kobold.fy !== ROW) || (kobold.fx !== COL + 3))).toBe(true);
    });
  });

  describe('aggravate_monster', () => {
    it('wakes every monster', () => {
      const kobold: monster_type = kobold_at(ROW + 5, COL + 20);

      kobold.csleep = 100;
      aggravate_monster(20);

      expect(kobold.csleep).toBe(0);
    });
  });

  describe('detect_monsters', () => {
    it('shows the monsters on the panel', async () => {
      const kobold: monster_type = kobold_at(ROW + 5, COL + 20);

      await play((): Promise<boolean> => detect_monsters(), ' ');

      expect(kobold.ml).toBe(true);
    });
  });

  describe('mass_genocide', () => {
    it('removes the monsters in sight', async () => {
      kobold_at(ROW, COL + 3);
      g.m_list[g.cave[ROW][COL + 3].cptr].cdis = 3;
      await mass_genocide();

      expect(g.muptr).toBe(0);
    });
  });

  describe('hp_player', () => {
    beforeEach((): void => {
      g.py.misc.mhp = 20;
      g.py.misc.chp = 10;
    });

    it('heals', async () => {
      await play((): Promise<boolean> => hp_player(5, 'a potion'));

      expect(g.py.misc.chp).toBe(15);
    });

    it('heals no further than the maximum', async () => {
      await play((): Promise<boolean> => hp_player(50, 'a potion'));

      expect(g.py.misc.chp).toBe(20);
    });

    it('says how much better the player feels', async () => {
      await play((): Promise<boolean> => hp_player(5, 'a potion'));

      expect(screen().row(1).trimEnd()).toBe('You feel better.');
    });

    it('heals through take_hit for a negative amount, as the source does', async () => {
      await play((): Promise<boolean> => hp_player(-5, 'a potion'));

      expect(g.py.misc.chp).toBe(15);
    });
  });

  describe('cures', () => {
    it('cure_poison leaves one turn of poison', () => {
      g.py.flags.poisoned = 20;
      cure_poison();

      expect(g.py.flags.poisoned).toBe(1);
    });

    it('slow_poison halves the poison', async () => {
      g.py.flags.poisoned = 20;
      await play((): Promise<boolean> => slow_poison());

      expect(g.py.flags.poisoned).toBe(10);
    });

    it('bless adds to the blessing', () => {
      bless(12);

      expect(g.py.flags.blessed).toBe(12);
    });
  });

  describe('lose_str', () => {
    it('lowers strength', async () => {
      g.py.stat.cstr = 15;
      await play((): Promise<boolean> => lose_str());

      expect(g.py.stat.cstr).toBe(14);
    });

    it('leaves sustained strength alone', async () => {
      g.py.stat.cstr = 15;
      g.py.flags.sustain_str = true;
      await play((): Promise<boolean> => lose_str());

      expect(g.py.stat.cstr).toBe(15);
    });
  });

  describe('enchant', () => {
    it('always succeeds at no pluses', () => {
      const pluses: IRef<number> = box(0);

      enchant(pluses);

      expect(pluses.get()).toBe(1);
    });
  });

  describe('light_area', () => {
    it('lights the spots round a corridor', async () => {
      g.cave[ROW + 1][COL].pl = false;
      g.cave[ROW][COL].fval = 4;
      await play((): Promise<boolean> => light_area(ROW, COL));

      expect(g.cave[ROW + 1][COL].pl).toBe(true);
    });
  });

  describe('earthquake', () => {
    it('never buries the player', async () => {
      await play((): Promise<boolean> => earthquake());

      expect(g.cave[ROW][COL].fopen).toBe(true);
    });
  });
});
