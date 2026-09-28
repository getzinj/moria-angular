import { dprint, top_twenty, total_points, upon_death } from './death';
import { boot, downloads, lit_room, play, screen, screenAfter } from './port-fixture';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import { rt } from '../runtime/runtime';

function scores(): string[] {
  return (rt().files.read('MORIATOP.DAT') ?? '').split('\n').filter((line: string): boolean => line !== '');
}

function entry(points: number): string {
  return `${ 'OTHER'.padEnd(13) }${ String(points).padStart(7) }  Someone, a 1st level Human Warrior.`;
}

describe('death', () => {
  beforeEach((): void => {
    boot();
    lit_room();
    g.moria_top = 'MORIATOP.DAT';
    g.py.misc.name = 'Bob';
    g.py.misc.race = 'Human';
    g.py.misc.tclass = 'Warrior';
    g.py.misc.title = 'Rookie';
    g.py.misc.sex = 'Male';
    g.py.misc.lev = 2;
    g.py.misc.max_exp = 50;
    g.py.misc.max_lev = 3;
    g.died_from = 'a Kobold';
  });

  describe('dprint', () => {
    it('writes a line at its first non-blank', () => {
      dprint('   RIP', 2);
      rt().terminal.put_qio();

      expect(screen().row(2).trimEnd()).toBe('   RIP');
    });
  });

  describe('total_points', () => {
    it('is the most experience plus 100 a level', () => {
      expect(total_points()).toBe(350);
    });
  });

  describe('the tombstone', () => {
    it('names the dead', async () => {
      await screenAfter((): Promise<never> => upon_death(), '');

      expect(screen().row(7)).toContain('Bob');
    });

    it('says what killed them', async () => {
      await screenAfter((): Promise<never> => upon_death(), '');

      expect(screen().row(17)).toContain('a Kobold');
    });

    it('prints to a file on request', async () => {
      await play((): Promise<never> => upon_death(), 'yTOMB.TXT\r').catch((): void => undefined);

      expect(downloads.get('TOMB.TXT')).toContain('RIP');
    });

    it('names the file MORIACHR.DIE by default', async () => {
      await play((): Promise<never> => upon_death(), 'y\r').catch((): void => undefined);

      expect(downloads.has('MORIACHR.DIE')).toBe(true);
    });
  });

  describe('top_twenty', () => {
    it('adds the dead to the list', () => {
      top_twenty();

      expect(scores()[0]).toBe(`${ 'PLAYER'.padEnd(13) }    350  Bob, a 2nd level Human Warrior.`);
    });

    it('ranks a better score first', () => {
      rt().files.write('MORIATOP.DAT', `${ entry(900) }\n`);
      top_twenty();

      expect(scores()[1]).toContain('Bob');
    });

    it('ranks the dead above a worse score', () => {
      rt().files.write('MORIATOP.DAT', `${ entry(100) }\n`);
      top_twenty();

      expect(scores()[0]).toContain('Bob');
    });

    it('keeps twenty at most', () => {
      rt().files.write('MORIATOP.DAT', Array.from({ length: 20 }, (): string => `${ entry(100) }\n`).join(''));
      top_twenty();

      expect(scores()).toHaveLength(20);
    });

    it('leaves out a score too low for a full list', () => {
      rt().files.write('MORIATOP.DAT', Array.from({ length: 20 }, (): string => `${ entry(900) }\n`).join(''));
      top_twenty();

      expect(scores().some((line: string): boolean => line.includes('Bob'))).toBe(false);
    });

    it('never scores a wizard', () => {
      g.wizard1 = true;

      expect((): void => top_twenty()).toThrow(MoriaExit);
    });

    it('shows the list', () => {
      top_twenty();
      rt().terminal.put_qio();

      expect(screen().row(1).trimEnd()).toBe('Username       Points  Character that died.');
    });
  });

  describe('a total winner', () => {
    beforeEach((): void => {
      g.total_winner = true;
    });

    it('is crowned King', async () => {
      await play((): Promise<never> => upon_death(), ' n').catch((): void => undefined);

      expect(g.py.misc.tclass).toBe('*King*');
    });

    it('dies of ripe old age', async () => {
      await play((): Promise<never> => upon_death(), ' n').catch((): void => undefined);

      expect(g.died_from).toBe('Ripe Old Age');
    });

    it('crowns a woman Queen', async () => {
      g.py.misc.sex = 'Female';
      await play((): Promise<never> => upon_death(), ' n').catch((): void => undefined);

      expect(g.py.misc.tclass).toBe('*Queen*');
    });
  });

  it('ends the game', async () => {
    await expect(play((): Promise<never> => upon_death(), 'n')).rejects.toBeInstanceOf(MoriaExit);
  });
});
