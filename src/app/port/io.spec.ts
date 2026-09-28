import { clear, get_com, get_hex_value, get_string, msg_print, pause_exit, print, prt } from './io';
import { boot, play, screen, waitAtPrompt } from './port-fixture';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import type { IRef } from '../runtime/pascal';
import { box } from '../runtime/pascal';

const ESC: string = '\x1B';
const RETURN: string = '\r';
const DEL: string = '\x7F';

describe('io', () => {
  beforeEach((): void => {
    boot();
  });

  describe('prt', () => {
    it('erases the rest of the line before writing', () => {
      prt('long old text', 3, 1);
      prt('new', 3, 1);

      expect(screen().row(3).trimEnd()).toBe('new');
    });
  });

  describe('print', () => {
    it('places dungeon co-ordinates relative to the panel', () => {
      g.panel_row_prt = 10;
      g.panel_col_prt = 20;
      print('@', 15, 40);

      expect(screen().row(5).charAt(19)).toBe('@');
    });

    it('marks the screen line dirty', () => {
      g.panel_row_prt = 10;
      print('@', 15, 40);

      expect(g.used_line[5]).toBe(true);
    });
  });

  describe('clear', () => {
    it('marks every map line clean', () => {
      g.used_line[7] = true;
      clear(1, 1);

      expect(g.used_line[7]).toBe(false);
    });
  });

  describe('msg_print', () => {
    beforeEach((): void => {
      g.msg_line = 1;
    });

    it('puts the message on the top line', async () => {
      await msg_print('You feel hungry.');

      expect(screen().row(1).trimEnd()).toBe('You feel hungry.');
    });

    it('waits at -more- before the next message', async () => {
      await msg_print('First.');
      await waitAtPrompt((): Promise<void> => msg_print('Second.'));

      expect(screen().row(1).trimEnd()).toBe('First. -more-');
    });

    it('shows the next message once -more- is answered with space', async () => {
      await msg_print('First.');
      await play((): Promise<void> => msg_print('Second.'), ' ');

      expect(screen().row(1).trimEnd()).toBe('Second.');
    });
  });

  describe('get_com', () => {
    it('is false for escape', async () => {
      const command: IRef<string> = box('');

      expect(await play((): Promise<boolean> => get_com('Direction?', command), ESC)).toBe(false);
    });

    it('returns the key it read', async () => {
      const command: IRef<string> = box('');

      await play((): Promise<boolean> => get_com('Direction?', command), '8');

      expect(command.get()).toBe('8');
    });
  });

  describe('get_string', () => {
    it('reads up to RETURN', async () => {
      const text: IRef<string> = box('');

      await play((): Promise<boolean> => get_string(text, 3, 15, 24), `Frodo${ RETURN }`);

      expect(text.get()).toBe('Frodo');
    });

    it('rubs out with DEL', async () => {
      const text: IRef<string> = box('');

      await play((): Promise<boolean> => get_string(text, 3, 15, 24), `Frodx${ DEL }o${ RETURN }`);

      expect(text.get()).toBe('Frodo');
    });

    it('trims trailing blanks', async () => {
      const text: IRef<string> = box('');

      await play((): Promise<boolean> => get_string(text, 3, 15, 24), `Sam  ${ RETURN }`);

      expect(text.get()).toBe('Sam');
    });

    it('stops when the field is full', async () => {
      const text: IRef<string> = box('');

      await play((): Promise<boolean> => get_string(text, 3, 15, 3), 'abcd');

      expect(text.get()).toBe('abc');
    });

    it('is false for escape', async () => {
      expect(await play((): Promise<boolean> => get_string(box(''), 3, 15, 24), ESC)).toBe(false);
    });
  });

  describe('get_hex_value', () => {
    it('reads hex', async () => {
      expect(await play((): Promise<number> => get_hex_value(1, 17, 8), `1F${ RETURN }`)).toBe(31);
    });

    it('is 0 for something that is not hex', async () => {
      expect(await play((): Promise<number> => get_hex_value(1, 17, 8), `xyz${ RETURN }`)).toBe(0);
    });
  });

  describe('pause_exit', () => {
    it('ends the game on Ctrl-Z', async () => {
      await expect(play((): Promise<void> => pause_exit(24, 0), '\x1A')).rejects.toBeInstanceOf(MoriaExit);
    });

    it('carries on for any other key', async () => {
      await expect(play((): Promise<void> => pause_exit(24, 0), ' ')).resolves.toBeUndefined();
    });
  });
});
