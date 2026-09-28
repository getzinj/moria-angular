import { RESTART_PROMPT, commandLineOf, playOnce } from './game-session';
import { boot, screen, screenAfter } from '../port/port-fixture';
import type { IRuntime } from '../runtime/runtime';

const CTRL_Z: string = '\x1A';

describe('game-session', () => {
  describe('commandLineOf', () => {
    it('takes the query string as the command line', () => {
      expect(commandLineOf('?MORIACHR.SAV/WIZARD')).toBe('MORIACHR.SAV/WIZARD');
    });

    it('decodes it', () => {
      expect(commandLineOf('?MY%20GAME.SAV')).toBe('MY GAME.SAV');
    });

    it('takes a bad escape as typed', () => {
      expect(commandLineOf('?50%')).toBe('50%');
    });

    it('is empty without one', () => {
      expect(commandLineOf('')).toBe('');
    });
  });

  describe('playOnce', () => {
    let runtime: IRuntime;

    beforeEach((): void => {
      runtime = boot();
    });

    it('offers another game once Moria exits', async () => {
      await screenAfter((): Promise<void> => playOnce(runtime, ''), CTRL_Z);

      expect(screen().row(24).trimEnd()).toBe(RESTART_PROMPT);
    });

    it('returns on the next key', async () => {
      let done: boolean = false;

      await screenAfter((): Promise<void> => playOnce(runtime, '').then((): void => {
        done = true;
      }), `${ CTRL_Z } `);

      expect(done).toBe(true);
    });
  });
});
