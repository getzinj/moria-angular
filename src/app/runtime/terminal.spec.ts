import type { IScreenSnapshot } from './screen-grid';
import { Keyboard } from './keyboard';
import { ScreenGrid } from './screen-grid';
import { NO_KEY, Terminal } from './terminal';

describe('Terminal', () => {
  let screen: ScreenGrid;
  let keyboard: Keyboard;
  let terminal: Terminal;
  let shown: IScreenSnapshot | null;

  beforeEach((): void => {
    screen = new ScreenGrid();
    keyboard = new Keyboard();
    terminal = new Terminal(screen, keyboard);
    shown = null;
    screen.onFlush((snapshot: IScreenSnapshot): void => {
      shown = snapshot;
    });
  });

  it('does not show buffered output before a read', () => {
    terminal.put_buffer('You feel hungry.', 1, 1);

    expect(shown!.rows[0].trim()).toBe('');
  });

  it('shows buffered output once the game reads a key', () => {
    terminal.put_buffer('You feel hungry.', 1, 1);
    void terminal.read_key();

    expect(shown!.rows[0].trim()).toBe('You feel hungry.');
  });

  it('shows buffered output on a poll', () => {
    terminal.put_buffer('Resting', 24, 44);
    terminal.poll_key();

    expect(shown!.rows[23].trim()).toBe('Resting');
  });

  it('polls NUL with nothing typed ahead', () => {
    expect(terminal.poll_key()).toBe(NO_KEY);
  });

  it('reads the key typed ahead', async () => {
    keyboard.push('j');

    expect(await terminal.read_key()).toBe('j');
  });

  it('discards type-ahead on flush_input', () => {
    keyboard.push('j');
    terminal.flush_input();

    expect(terminal.poll_key()).toBe(NO_KEY);
  });

  it('erases to the end of the line', () => {
    terminal.put_buffer('abcdef', 3, 1);
    terminal.erase_to_end_of_line(3, 4);

    expect(screen.row(3).trimEnd()).toBe('abc');
  });

  it('erases to the end of the screen', () => {
    terminal.put_buffer('keep', 2, 1);
    terminal.put_buffer('gone', 5, 1);
    terminal.erase_to_end_of_screen(3, 1);

    expect(screen.toString().trim()).toBe('keep');
  });

  it('moves the cursor back for a backspace in put_buffer', () => {
    terminal.put_buffer(' \b', 3, 10);
    terminal.put_qio();

    expect([ shown!.cursorRow, shown!.cursorColumn ]).toEqual([ 3, 10 ]);
  });
});
