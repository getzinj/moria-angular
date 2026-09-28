import { create_character } from './create';
import { boot, play, screen, screenAfter } from './port-fixture';
import { g } from './variables';
import type { InstantClock } from '../runtime/clock';
import { MoriaExit } from '../runtime/exit';
import type { IRuntime } from '../runtime/runtime';

const CTRL_Z: string = '\x1A';
const HUMAN_MALE_WARRIOR: string = 'amaBob\r';

describe('create', () => {
  let runtime: IRuntime;

  beforeEach((): void => {
    runtime = boot(1);
    g.msg_line = 1;
  });

  describe('a human male warrior', () => {
    beforeEach(async (): Promise<void> => {
      await play((): Promise<void> => create_character(), `${ HUMAN_MALE_WARRIOR } `);
    });

    it('is human', () => {
      expect(g.py.misc.race).toBe('Human');
    });

    it('is male', () => {
      expect(g.py.misc.sex).toBe('Male');
    });

    it('is a warrior', () => {
      expect(g.py.misc.tclass).toBe('Warrior');
    });

    it('takes the name typed', () => {
      expect(g.py.misc.name).toBe('Bob');
    });

    it('starts at level 1', () => {
      expect(g.py.misc.lev).toBe(1);
    });

    it('has as many hit points as it can have', () => {
      expect(g.py.misc.chp).toBe(g.py.misc.mhp);
    });

    it('starts with its current strength at its maximum', () => {
      expect(g.py.stat.cstr).toBe(g.py.stat.str);
    });

    it('rolls the same character from the same seed', () => {
      expect([ g.py.stat.str, g.py.stat.int, g.py.stat.wis, g.py.stat.dex, g.py.stat.con, g.py.stat.chr, g.py.misc.au ])
        .toEqual([ 16, 12, 12, 16, 16, 7, 394 ]);
    });

    it('rolls the same history from the same seed', () => {
      expect(g.py.misc.history.slice(1)).toEqual([
        'You are one of several children of a Serf.  You are a well liked',
        'child.  You have brown eyes, straight brown hair, and an average',
        'complexion.',
        '',
        '',
      ]);
    });

    it('wraps the history within 70 columns', () => {
      expect(g.py.misc.history.slice(1).every((line: string): boolean => line.length <= 70)).toBe(true);
    });

    it('keeps the social class between 1 and 100', () => {
      expect((g.py.misc.sc >= 1) && (g.py.misc.sc <= 100)).toBe(true);
    });

    it('has at least 80 gold', () => {
      expect(g.py.misc.au).toBeGreaterThanOrEqual(80);
    });

    it('takes the warrior\'s experience penalty on top of the human\'s', () => {
      expect(g.py.misc.expfact).toBeCloseTo(g.race[1].b_exp + g.class[1].m_exp, 5);
    });
  });

  describe('choosing', () => {
    it('offers every race', async () => {
      expect(await screenAfter((): Promise<void> => create_character(), '')).toContain('h) Half-Troll');
    });

    it('offers an elf no paladin', async () => {
      expect(await screenAfter((): Promise<void> => create_character(), 'cm')).not.toContain('Paladin');
    });

    it('offers a human a paladin', async () => {
      expect(await screenAfter((): Promise<void> => create_character(), 'am')).toContain('f) Paladin');
    });

    it('ignores a letter past the end of the list', async () => {
      await screenAfter((): Promise<void> => create_character(), 'z');

      expect(g.py.misc.race).toBe('');
    });

    it('asks for the race again after help', async () => {
      expect(await screenAfter((): Promise<void> => create_character(), `?${ CTRL_Z }`)).toContain('Choose a race');
    });

    it('asks for the class again after help', async () => {
      expect(await screenAfter((): Promise<void> => create_character(), `am?${ CTRL_Z }`)).toContain('Choose a class');
    });

    it('keeps the history on screen after help at the class prompt', async () => {
      expect(await screenAfter((): Promise<void> => create_character(), `am?${ CTRL_Z }`)).toContain('Character Background');
    });
  });

  describe('the closing pause', () => {
    it('asks for a key to go on', async () => {
      await screenAfter((): Promise<void> => create_character(), HUMAN_MALE_WARRIOR);

      expect(screen().row(24).trim()).toBe('[Press any key to continue, or <Control>-Z to exit]');
    });

    it('exits on Ctrl-Z', async () => {
      await expect(play((): Promise<void> => create_character(), `${ HUMAN_MALE_WARRIOR }${ CTRL_Z }`)).rejects.toBeInstanceOf(MoriaExit);
    });

    it('makes a player who exits wait before rolling again', async () => {
      await play((): Promise<void> => create_character(), `${ HUMAN_MALE_WARRIOR }${ CTRL_Z }`).catch((): void => undefined);

      expect((runtime.clock as InstantClock).requested).toEqual([ 6 ]);
    });
  });
});
