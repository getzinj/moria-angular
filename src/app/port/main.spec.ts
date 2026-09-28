import { main } from './main';
import { boot, play, screen, screenAfter } from './port-fixture';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import type { IRuntime } from '../runtime/runtime';

const NEW_WARRIOR: string = ' amaBob\r ';

describe('main', () => {
  let runtime: IRuntime;

  beforeEach((): void => {
    runtime = boot();
  });

  describe('a new character', () => {
    it('starts in the town', async () => {
      await screenAfter((): Promise<void> => main(''), NEW_WARRIOR);

      expect(screen().row(24)).toContain('Town level');
    });

    it('puts the player on the map', async () => {
      await screenAfter((): Promise<void> => main(''), NEW_WARRIOR);

      expect(screen().toString()).toContain('@');
    });

    it('ends when the player quits', async () => {
      await expect(play((): Promise<void> => main(''), `${ NEW_WARRIOR }\x19Q`)).rejects.toBeInstanceOf(MoriaExit);
    });

    it('seeds the town from the generator', async () => {
      await screenAfter((): Promise<void> => main(''), NEW_WARRIOR);

      expect(g.town_seed).toBe(g.randes_seed);
    });

    it('caps experience for the character\'s race and class', async () => {
      await screenAfter((): Promise<void> => main(''), NEW_WARRIOR);

      expect(g.player_max_exp).toBe(Math.trunc(Math.fround(g.player_exp[39] * g.py.misc.expfact)));
    });

    it('builds the wizard password', async () => {
      await screenAfter((): Promise<void> => main(''), '');

      expect(g.password1).toBe('@SHADOW@    ');
    });

    it('starts on the news without asking for a save when there is none', async () => {
      await screenAfter((): Promise<void> => main(''), '');

      expect(screen().toString()).toContain('Moria 4.80');
    });
  });

  describe('a saved character', () => {
    let files: Map<string, string>;

    beforeEach(async (): Promise<void> => {
      await play((): Promise<void> => main(''), `${ NEW_WARRIOR }\x1aBOB.SAV\r`).catch((): void => undefined);
      files = new Map<string, string>(runtime.files.list().map((name: string): [ string, string ] => [ name, runtime.files.read(name) ?? '' ]));
      runtime = boot();
      files.forEach((contents: string, name: string): void => runtime.files.write(name, contents));
    });

    it('comes back by name', async () => {
      await screenAfter((): Promise<void> => main('BOB.SAV'), ' ');

      expect(g.py.misc.name).toBe('Bob');
    });

    it('comes back to the town', async () => {
      await screenAfter((): Promise<void> => main('BOB.SAV'), ' \x1b');

      expect(screen().row(24)).toContain('Town level');
    });

    it('comes back only once', async () => {
      await play((): Promise<void> => main('BOB.SAV'), ' \x1b\x19Q').catch((): void => undefined);
      files.forEach((contents: string, name: string): void => {
        if (name !== 'MORIACHR.DAT') {
          runtime.files.write(name, contents);
        }
      });

      expect(await screenAfter((): Promise<void> => main('BOB.SAV'), ' ')).toContain('Data Corruption Error.');
    });
  });

  describe('with a save file', () => {
    beforeEach((): void => {
      runtime.files.write('BOB.SAV', 'saved');
    });

    it('asks for it', async () => {
      await screenAfter((): Promise<void> => main(''), '');

      expect(screen().row(1).trimEnd()).toBe('Restore file (RETURN for new character):');
    });

    it('rolls a new character on RETURN', async () => {
      expect(await screenAfter((): Promise<void> => main(''), '\r ')).toContain('Choose a race');
    });

    it('refuses a file that is not a save', async () => {
      expect(await screenAfter((): Promise<void> => main(''), 'BOB.SAV\r ')).toContain('Data Corruption Error.');
    });

    it('takes a lower-case /wizard as DCL did, in capitals', async () => {
      await screenAfter((): Promise<void> => main('bob.sav/wizard'), '');

      expect(screen().row(1).trimEnd()).toBe('Password :');
    });

    it('takes the file from the command line without asking', async () => {
      expect(await screenAfter((): Promise<void> => main('BOB.SAV'), ' ')).toContain('Data Corruption Error.');
    });
  });
});
