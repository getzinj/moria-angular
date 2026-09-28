import { max_creatures, max_mons_level, max_objects, max_obj_level, win_mon_tot } from './constants';
import {
  attack_blows,
  bpswd,
  check_pswd,
  cnv_stat,
  damroll,
  init_m_level,
  init_t_level,
  insert_num,
  likert,
  los,
  magic_treasure,
  move,
  price_adjust,
  sort_objects,
} from './misc';
import { boot, play } from './port-fixture';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box } from '../runtime/pascal';
import { Random } from '../runtime/random';
import { rt } from '../runtime/runtime';

describe('misc', () => {
  beforeEach((): void => {
    boot();
  });

  describe('bpswd', () => {
    it('decodes the wizard password', () => {
      bpswd();

      expect(g.password1).toBe('@SHADOW@    ');
    });

    it('decodes the god password', () => {
      bpswd();

      expect(g.password2).toBe('@Grylion@   ');
    });

    it('leaves the generator reseeded from the clock', () => {
      bpswd();

      expect(rt().random.seed % 2).toBe(1);
    });
  });

  describe('check_pswd', () => {
    beforeEach((): void => {
      bpswd();
    });

    it('makes a wizard of someone who types the wizard password', async () => {
      await play((): Promise<boolean> => check_pswd(), '@SHADOW@\r');

      expect([ g.wizard1, g.wizard2 ]).toEqual([ true, false ]);
    });

    it('makes a god of someone who types the god password', async () => {
      await play((): Promise<boolean> => check_pswd(), '@Grylion@\r');

      expect([ g.wizard1, g.wizard2 ]).toEqual([ true, true ]);
    });

    it('refuses anything else', async () => {
      expect(await play((): Promise<boolean> => check_pswd(), 'balrog\r')).toBe(false);
    });
  });

  describe('sort_objects', () => {
    beforeEach((): void => {
      sort_objects();
    });

    it('orders object_list by level', () => {
      const levels: number[] = g.object_list.slice(1).map((item: { level: number }): number => item.level);

      expect(levels.every((level: number, at: number): boolean => (at === 0) || (levels[at - 1] <= level))).toBe(true);
    });

    // The shell sort is unstable and save files store indices into the list it leaves, so the
    // exact order is pinned. Its fingerprint is the names in order, joined and summed.
    it('leaves the order the port has always left', () => {
      const names: string = g.object_list.slice(1).map((item: { name: string }): string => item.name).join('|');
      let fingerprint: number = 0;

      for (let at: number = 0; at < names.length; at++) {
        fingerprint = ((fingerprint * 31) + names.charCodeAt(at)) >>> 0;
      }

      expect(fingerprint).toBe(847818908);
    });
  });

  describe('level tables', () => {
    // Cumulative from level 1: the town's level-0 creatures stay apart in m_level[0].
    it('counts every ordinary dungeon creature in m_level at the top level', () => {
      const ordinary: { level: number }[] = g.c_list.slice(1, max_creatures - win_mon_tot + 1);

      init_m_level();

      expect(g.m_level[max_mons_level]).toBe(ordinary.filter((creature: { level: number }): boolean => creature.level > 0).length);
    });

    it('counts every object in t_level at the top level', () => {
      sort_objects();
      init_t_level();

      expect(g.t_level[max_obj_level]).toBe(max_objects);
    });
  });

  describe('price_adjust', () => {
    it('keeps whole prices whole at cost_adj 1.00', () => {
      const before: number = g.object_list[1].cost;

      price_adjust();

      expect(g.object_list[1].cost).toBe(before);
    });
  });

  describe('damroll', () => {
    it('rolls within NdS', () => {
      const rolls: number[] = Array.from({ length: 50 }, (): number => damroll('2d6'));

      expect(rolls.every((roll: number): boolean => (roll >= 2) && (roll <= 12))).toBe(true);
    });

    it('rolls 0 for something that is not dice', () => {
      expect(damroll('xyz')).toBe(0);
    });
  });

  describe('cnv_stat', () => {
    it('shows 18/xx without a leading zero', () => {
      expect(cnv_stat(23)).toBe('18/5  ');
    });

    it('shows a low stat in two places', () => {
      expect(cnv_stat(9)).toBe(' 9    ');
    });

    it('shows 18/100', () => {
      expect(cnv_stat(118)).toBe('18/100');
    });
  });

  describe('likert', () => {
    it('rates 0 as Bad', () => {
      expect(likert(0, 12)).toBe('Bad');
    });

    it('rates 6 as Very Good', () => {
      expect(likert(72, 12)).toBe('Very Good');
    });

    it('rates anything below -3 as Excellent, as the original did', () => {
      expect(likert(-50, 12)).toBe('Excellent');
    });
  });

  describe('insert_num', () => {
    it('signs a positive number when asked', () => {
      expect(insert_num('a Ring (%P1)', '%P1', 3, true)).toBe('a Ring (+3)');
    });

    it('does not sign it otherwise', () => {
      expect(insert_num('[%P6]', '%P6', 3, false)).toBe('[3]');
    });
  });

  describe('move', () => {
    beforeEach((): void => {
      g.cur_height = 66;
      g.cur_width = 198;
    });

    it('moves up for 8', () => {
      const y: IRef<number> = box(10);

      move(8, y, box(10));

      expect(y.get()).toBe(9);
    });

    it('refuses to leave the map', () => {
      expect(move(7, box(1), box(1))).toBe(false);
    });
  });

  describe('los', () => {
    beforeEach((): void => {
      g.cur_height = 66;
      g.cur_width = 198;

      for (let x: number = 1; x <= 20; x++) {
        g.cave[5][x].fopen = true;
      }
    });

    it('sees along an open row', () => {
      expect(los(5, 2, 5, 10)).toBe(true);
    });

    it('is blocked by a wall in the row', () => {
      g.cave[5][6].fopen = false;

      expect(los(5, 2, 5, 10)).toBe(false);
    });
  });

  describe('magic_treasure', () => {
    // obj_base_magic + level, capped, and its /6 and /1.3 shares, as magic_treasure works them out.
    const level: number = 10;
    const chance: number = 25;
    const special: number = Math.trunc(Math.fround(chance / 6));
    const cursed: number = Math.trunc(Math.fround(chance / Math.fround(1.3)));

    // A seed whose draws make a helm cursed but not special: not magic, cursed, two randnor
    // draws for m_bonus, then a failed special roll.
    function cursed_plain_seed(): number {
      let seed: number = 1;
      let found: number = 0;

      while (found === 0) {
        const probe: Random = new Random(seed);
        const magic: number = probe.randint(100);
        const curse: number = probe.randint(100);

        probe.randint(9999999);
        probe.randint(9999999);

        if ((magic > chance) && (curse <= cursed) && (probe.randint(100) > special)) {
          found = seed;
        }

        seed += 2;
      }

      return found;
    }

    it('rolls randint(5) for every cursed helm, special or not', () => {
      const seed: number = cursed_plain_seed();
      const replay: Random = new Random(seed);

      for (let draw: number = 0; draw < 6; draw++) {
        replay.randint(2);
      }

      rt().random.seed = seed;
      g.t_list[1] = { ...g.object_list[1], tval: 33, subval: 1, p1: 0 };
      magic_treasure(1, level);

      expect(rt().random.seed).toBe(replay.seed);
    });
  });

  describe('attack_blows', () => {
    it('gives one blow and a penalty for a weapon too heavy to swing', () => {
      const wtohit: IRef<number> = box(0);

      g.py.stat.cstr = 3;
      attack_blows(500, wtohit);

      expect(wtohit.get()).toBe(-500);
    });
  });
});
