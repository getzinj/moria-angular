import { help, ident_char, moria_help, wizard_help } from './help';
import { boot, play, screen, waitAtPrompt } from './port-fixture';
import { g } from './variables';

const CTRL_Z: string = '\x1A';

async function identified(key: string): Promise<string> {
  await play((): Promise<void> => ident_char(), key);

  return screen().row(1).trimEnd();
}

describe('help', () => {
  beforeEach((): void => {
    boot();
    g.msg_line = 1;
  });

  describe('ident_char', () => {
    it('names the symbol typed', async () => {
      expect(await identified('\\')).toBe('\\ - A hafted weapon.');
    });

    it('names the player for @', async () => {
      g.py.misc.name = 'Bob';

      expect(await identified('@')).toBe('Bob');
    });

    it('says a symbol with no meaning is not used', async () => {
      expect(await identified('Z')).toBe('Not Used.');
    });

    it('does nothing on ESC', async () => {
      expect(await identified('\x1B')).toBe('');
    });
  });

  describe('help', () => {
    it('lists the commands from the top line', async () => {
      await waitAtPrompt((): Promise<void> => help());

      expect(screen().row(1).trimEnd()).toBe('B <Dir> Bash (object/creature)|  q        Quaff a potion.');
    });

    it('lists the last command on line 23', async () => {
      await waitAtPrompt((): Promise<void> => help());

      expect(screen().row(23).trimEnd()).toBe('p       Read a prayer.        |            1  2  3');
    });
  });

  describe('wizard_help', () => {
    it('ends the wizard list with ^V', async () => {
      await waitAtPrompt((): Promise<void> => wizard_help());

      expect(screen().row(10).trimEnd()).toBe('^V - Restore lost character.');
    });

    it('lists the god commands for a god', async () => {
      g.wizard2 = true;
      await waitAtPrompt((): Promise<void> => wizard_help());

      expect(screen().row(16).trimEnd()).toBe('^W - Create any object *CAN CAUSE FATAL ERROR*');
    });
  });

  describe('moria_help', () => {
    it('shows the banner above the help', async () => {
      await waitAtPrompt((): Promise<void> => moria_help(''));

      expect(screen().row(1).trimEnd()).toBe('[Entering Moria Help Library, Use ^Z to resume game]');
    });

    it('starts at the topic it is given', async () => {
      await waitAtPrompt((): Promise<void> => moria_help('Character Sex'));

      expect(screen().toString()).toContain('CHARACTER Sex');
    });

    it('returns on Ctrl-Z', async () => {
      await expect(play((): Promise<void> => moria_help('Character Sex'), CTRL_Z)).resolves.toBeUndefined();
    });
  });
});
