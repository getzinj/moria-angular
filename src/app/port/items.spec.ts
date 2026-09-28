import { inven_max } from './constants';
import { magic_init } from './desc';
import { eat } from './eat';
import { cast } from './magic';
import { inven_carry } from './misc';
import { quaff } from './potions';
import { pray } from './prayer';
import { COL, ROW, boot, lit_room, play, screen, screenAfter } from './port-fixture';
import { read } from './scrolls';
import { use } from './staffs';
import type { treasure_type } from './types';
import { g } from './variables';
import { aim } from './wands';
import { box, clone } from '../runtime/pascal';

const MORE: string = '          ';

function give(fields: Partial<treasure_type>): number {
  const at: { get(): number; set(value: number): void } = box(0);

  g.inventory[inven_max] = { ...clone(g.blank_treasure), number: 1, weight: 1, ...fields };
  inven_carry(at);

  return at.get();
}

function bit(n: number): number {
  return 2 ** (n - 1);
}

describe('items', () => {
  beforeEach((): void => {
    boot();
    lit_room();
    magic_init(12345);
  });

  describe('quaff', () => {
    it('says so with nothing in the pack', async () => {
      await screenAfter((): Promise<void> => quaff(), '');

      expect(screen().row(1).trimEnd()).toBe('But you are not carrying anything.');
    });

    it('says so with no potions in the pack', async () => {
      give({ tval: 80, subval: 1 });
      await screenAfter((): Promise<void> => quaff(), '');

      expect(screen().row(1).trimEnd()).toBe('You are not carrying any potions.');
    });

    it('keeps the potion when the prompt is escaped', async () => {
      give({ tval: 75, subval: 1, flags: bit(13) });
      await play((): Promise<void> => quaff(), '\x1b');

      expect(g.inven_ctr).toBe(1);
    });

    it('uses the potion up', async () => {
      give({ tval: 75, subval: 1, flags: bit(13) });
      await play((): Promise<void> => quaff(), `a${ MORE }`);

      expect(g.inven_ctr).toBe(0);
    });

    it('heals with cure light wounds', async () => {
      g.py.misc.mhp = 40;
      g.py.misc.chp = 5;
      give({ tval: 75, subval: 1, flags: bit(13) });
      await play((): Promise<void> => quaff(), `a${ MORE }`);

      expect(g.py.misc.chp).toBeGreaterThan(5);
    });

    it('heals by the whole new maximum with constitution', async () => {
      g.py.misc.mhp = 20;
      g.py.misc.chp = 5;
      g.py.stat.con = 10;
      g.py.stat.ccon = 10;
      give({ tval: 75, subval: 1, flags: bit(17) });
      await play((): Promise<void> => quaff(), `a${ MORE }`);

      expect(g.py.misc.chp).toBe(26);
    });

    it('stays identified when a later restore has nothing to restore', async () => {
      g.py.stat.wis = 10;
      g.py.stat.cwis = 10;
      give({ tval: 75, subval: 300, number: 2, name: '& Potion~| of Wisdom', flags: bit(7) | bit(9) });
      await play((): Promise<void> => quaff(), `a${ MORE }`);

      expect(g.inventory[1].name).not.toContain('|');
    });

    it('adds 31 to the effect of the second potion kind', async () => {
      give({ tval: 76, subval: 1, flags: bit(3) });
      await play((): Promise<void> => quaff(), `a${ MORE }`);

      expect(g.py.flags.paralysis).toBe(4);
    });

    it('feeds the player', async () => {
      g.py.flags.food = 1000;
      give({ tval: 75, subval: 1, flags: bit(13), p1: 500 });
      await play((): Promise<void> => quaff(), `a${ MORE }`);

      expect(g.py.flags.food).toBe(1500);
    });
  });

  describe('eat', () => {
    it('says so with no food in the pack', async () => {
      give({ tval: 75, subval: 1 });
      await screenAfter((): Promise<void> => eat(), '');

      expect(screen().row(1).trimEnd()).toBe('You are not carrying any food.');
    });

    it('calms fear down to one turn', async () => {
      g.py.flags.afraid = 20;
      give({ tval: 80, subval: 1, flags: bit(8) });
      await play((): Promise<void> => eat(), `a${ MORE }`);

      expect(g.py.flags.afraid).toBe(1);
    });

    it('clears the hunger bits of the status', async () => {
      g.py.flags.status = 0x3;
      give({ tval: 80, subval: 1, p1: 100 });
      await play((): Promise<void> => eat(), `a${ MORE }`);

      expect(g.py.flags.status).toBe(0);
    });

    it('uses the food up', async () => {
      give({ tval: 80, subval: 1, p1: 100 });
      await play((): Promise<void> => eat(), `a${ MORE }`);

      expect(g.inven_ctr).toBe(0);
    });
  });

  describe('aim', () => {
    it('fails for a player with no skill', async () => {
      g.py.misc.save = 0;
      give({ tval: 65, subval: 1, flags: bit(1), p1: 3 });
      await screenAfter((): Promise<void> => aim(), 'a6');

      expect(screen().row(1).trimEnd()).toBe('You failed to use the wand properly.');
    });

    it('lights a line', async () => {
      g.py.misc.save = 100;
      give({ tval: 65, subval: 1, flags: bit(1), p1: 3 });
      await screenAfter((): Promise<void> => aim(), 'a6');

      expect(screen().row(1)).toContain('A line of blue shimmering light appears.');
    });

    it('uses a charge', async () => {
      g.py.misc.save = 100;
      give({ tval: 65, subval: 1, flags: bit(1), p1: 3 });
      await play((): Promise<void> => aim(), `a6${ MORE }`);

      expect(g.inventory[1].p1).toBe(2);
    });

    it('lights the squares along the line', async () => {
      g.py.misc.save = 100;
      g.cave[ROW][COL + 2].pl = false;
      give({ tval: 65, subval: 1, flags: bit(1), p1: 3 });
      await play((): Promise<void> => aim(), `a6${ MORE }`);

      expect(g.cave[ROW][COL + 2].pl).toBe(true);
    });
  });

  describe('use', () => {
    it('fails for a player with no skill', async () => {
      g.py.misc.save = 0;
      give({ tval: 55, subval: 1, flags: bit(17), p1: 3 });
      await screenAfter((): Promise<void> => use(), 'a');

      expect(screen().row(1).trimEnd()).toBe('You failed to use the staff properly.');
    });

    it('hastes the player with speed', async () => {
      g.py.misc.save = 100;
      give({ tval: 55, subval: 1, flags: bit(17), p1: 3 });
      await play((): Promise<void> => use(), `a${ MORE }`);

      expect(g.py.flags.fast).toBeGreaterThan(15);
    });

    it('uses a charge', async () => {
      g.py.misc.save = 100;
      give({ tval: 55, subval: 1, flags: bit(17), p1: 3 });
      await play((): Promise<void> => use(), `a${ MORE }`);

      expect(g.inventory[1].p1).toBe(2);
    });

    it('does nothing with no charges left', async () => {
      g.py.misc.save = 100;
      give({ tval: 55, subval: 1, flags: bit(17), p1: 0 });
      await play((): Promise<void> => use(), `a${ MORE }`);

      expect(g.py.flags.fast).toBe(0);
    });
  });

  describe('read', () => {
    it('cannot be done blind', async () => {
      g.py.flags.blind = 5;
      give({ tval: 70, subval: 1, flags: bit(11) });
      await screenAfter((): Promise<void> => read(), '');

      expect(screen().row(1).trimEnd()).toBe('You can\'t see to read the scroll.');
    });

    it('makes the hands glow with monster confusion', async () => {
      give({ tval: 70, subval: 1, flags: bit(11) });
      await play((): Promise<void> => read(), `a${ MORE }`);

      expect(g.py.flags.confuse_monster).toBe(true);
    });

    it('uses the scroll up', async () => {
      give({ tval: 70, subval: 1, flags: bit(11) });
      await play((): Promise<void> => read(), `a${ MORE }`);

      expect(g.inven_ctr).toBe(0);
    });

    it('adds 31 to the effect of the second scroll kind', async () => {
      give({ tval: 71, subval: 1, flags: bit(9) });
      await play((): Promise<void> => read(), `a${ MORE }`);

      expect(g.py.flags.word_recall).toBeGreaterThan(25);
    });
  });

  describe('cast', () => {
    beforeEach((): void => {
      g.py.misc.pclass = 2;
      g.py.misc.mana = 10;
      g.py.misc.cmana = 10;
      g.magic_spell[2][2].learned = true;
      give({ tval: 90, subval: 1, flags: bit(2) });
    });

    it('is not for a class without spells', async () => {
      g.py.misc.pclass = 1;
      await screenAfter((): Promise<void> => cast(), '');

      expect(screen().row(1).trimEnd()).toBe('You can\'t cast spells!');
    });

    it('costs the spell\'s mana', async () => {
      const smana: number = g.magic_spell[2][2].smana;

      await play((): Promise<void> => cast(), `aa${ MORE }`);

      expect(g.py.misc.cmana).toBe(10 - smana);
    });

    it('spends the spell\'s first-cast experience once', async () => {
      await play((): Promise<void> => cast(), `aa${ MORE }`);

      expect(g.magic_spell[2][2].sexp).toBe(0);
    });

    it('costs nothing when the spell is escaped', async () => {
      await play((): Promise<void> => cast(), `a\x1b${ MORE }`);

      expect(g.py.misc.cmana).toBe(10);
    });

    it('leaves the player paralysed when the mana runs short', async () => {
      g.py.misc.cmana = 0;
      await play((): Promise<void> => cast(), `aa${ MORE }`);

      expect(g.py.flags.paralysis).toBeGreaterThan(0);
    });
  });

  describe('pray', () => {
    beforeEach((): void => {
      g.py.misc.pclass = 3;
      g.py.misc.mana = 10;
      g.py.misc.cmana = 10;
      g.magic_spell[3][1].learned = true;
      give({ tval: 91, subval: 1, flags: bit(1) });
    });

    it('is not for a class without prayers', async () => {
      g.py.misc.pclass = 1;
      await screenAfter((): Promise<void> => pray(), '');

      expect(screen().row(1).trimEnd()).toBe('Pray hard enough and your prayers may be answered.');
    });

    it('costs the prayer\'s mana', async () => {
      const smana: number = g.magic_spell[3][1].smana;

      await play((): Promise<void> => pray(), `aa${ MORE }`);

      expect(g.py.misc.cmana).toBe(10 - smana);
    });

    it('cannot be read in the dark', async () => {
      g.cave[ROW][COL].pl = false;
      g.cave[ROW][COL].tl = false;
      await screenAfter((): Promise<void> => pray(), '');

      expect(screen().row(1).trimEnd()).toBe('You have no light to read by.');
    });
  });
});
