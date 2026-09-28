import { DEFAULT_NEWS, intro } from './files';
import { get_paths } from './io';
import { bpswd } from './misc';
import { boot, play, screen, screenAfter } from './port-fixture';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import type { IRef } from '../runtime/pascal';
import { box } from '../runtime/pascal';
import type { IRuntime } from '../runtime/runtime';

const CTRL_Z: string = '\x1A';

describe('files', () => {
  let runtime: IRuntime;

  beforeEach((): void => {
    runtime = boot();
    g.msg_line = 1;
    get_paths();
  });

  describe('intro', () => {
    it('shows the news the first run would have written', async () => {
      await screenAfter((): Promise<void> => intro(box('')), '');

      expect(screen().row(2).trimEnd()).toBe('                         **    Moria 4.80   **');
    });

    it('shows every line of the default news', async () => {
      await screenAfter((): Promise<void> => intro(box('')), '');

      expect(screen().row(DEFAULT_NEWS.length).trimEnd()).toBe('Dungeon Master: This file may contain updates and news.');
    });

    it('shows MORIA.DAT when there is one', async () => {
      runtime.files.write('MORIA.DAT', 'Dungeon closed Tuesdays.');
      await screenAfter((): Promise<void> => intro(box('')), '');

      expect(screen().row(1).trimEnd()).toBe('Dungeon closed Tuesdays.');
    });

    it('waits for a key under the news', async () => {
      await screenAfter((): Promise<void> => intro(box('')), '');

      expect(screen().row(24).trim()).toBe('[Press any key to continue, or <Control>-Z to exit]');
    });

    it('exits on Ctrl-Z', async () => {
      await expect(play((): Promise<void> => intro(box('')), CTRL_Z)).rejects.toBeInstanceOf(MoriaExit);
    });

    it('creates the master file', async () => {
      await play((): Promise<void> => intro(box('')), ' ');

      expect(runtime.files.read('MORIACHR.DAT')).toBe('');
    });

    it('creates the top twenty', async () => {
      await play((): Promise<void> => intro(box('')), ' ');

      expect(runtime.files.read('MORIATOP.DAT')).toBe('');
    });

    it('leaves an existing top twenty alone', async () => {
      runtime.files.write('MORIATOP.DAT', 'scores');
      await play((): Promise<void> => intro(box('')), ' ');

      expect(runtime.files.read('MORIATOP.DAT')).toBe('scores');
    });

    describe('with /WIZARD', () => {
      let finam: IRef<string>;

      beforeEach((): void => {
        bpswd();
        finam = box('MY.SAV/WIZARD');
      });

      it('asks for the password', async () => {
        await screenAfter((): Promise<void> => intro(finam), '');

        expect(screen().row(1).trimEnd()).toBe('Password :');
      });

      it('makes the player a wizard given the password', async () => {
        await play((): Promise<void> => intro(finam), '@SHADOW@\r ');

        expect(g.wizard1).toBe(true);
      });

      it('takes the qualifier off the file name given the password', async () => {
        await play((): Promise<void> => intro(finam), '@SHADOW@\r ');

        expect(finam.get()).toBe('MY.SAV');
      });

      it('leaves a wrong password an ordinary player', async () => {
        await play((): Promise<void> => intro(finam), 'guess\r ');

        expect(g.wizard1).toBe(false);
      });
    });
  });
});
