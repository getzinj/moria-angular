import type { IScreenSnapshot } from './screen-grid';
import { SCREEN_COLUMNS, ScreenGrid } from './screen-grid';

describe('ScreenGrid', () => {
  let screen: ScreenGrid;

  beforeEach((): void => {
    screen = new ScreenGrid();
  });

  describe('putString', () => {
    it('writes the text at the 1-based row and column', () => {
      screen.putString(2, 3, 'abc');

      expect(screen.row(2).substring(0, 6)).toBe('  abc ');
    });

    it('clips text at the right margin', () => {
      screen.putString(1, SCREEN_COLUMNS - 1, 'xyz');

      expect(screen.row(1).length).toBe(SCREEN_COLUMNS);
    });

    it('keeps what fits before the right margin', () => {
      screen.putString(1, SCREEN_COLUMNS - 1, 'xyz');

      expect(screen.row(1).endsWith('xy')).toBe(true);
    });

    it('ignores a row off the screen', () => {
      screen.putString(25, 1, 'lost');

      expect(screen.toString()).toBe('\n'.repeat(23));
    });
  });

  describe('eraseToEndOfLine', () => {
    it('blanks from the column to the end of the row', () => {
      screen.putString(1, 1, 'abcdef');
      screen.eraseToEndOfLine(1, 3);

      expect(screen.row(1).trimEnd()).toBe('ab');
    });
  });

  describe('eraseToEndOfScreen', () => {
    beforeEach((): void => {
      screen.putString(1, 1, 'top');
      screen.putString(2, 1, 'middle');
      screen.putString(3, 1, 'bottom');
      screen.eraseToEndOfScreen(2, 3);
    });

    it('keeps the rows above', () => {
      expect(screen.row(1).trimEnd()).toBe('top');
    });

    it('keeps the start of the row it starts in', () => {
      expect(screen.row(2).trimEnd()).toBe('mi');
    });

    it('blanks the rows below', () => {
      expect(screen.row(3).trimEnd()).toBe('');
    });
  });

  describe('flush', () => {
    let seen: IScreenSnapshot | null;

    beforeEach((): void => {
      seen = null;
      screen.onFlush((snapshot: IScreenSnapshot): void => {
        seen = snapshot;
      });
      screen.putString(5, 10, 'hi');
    });

    it('sends nothing new until flushed', () => {
      expect(seen!.rows[4].trimEnd()).toBe('');
    });

    it('sends the rows written when flushed', () => {
      screen.flush();

      expect(seen!.rows[4].trimEnd()).toBe('         hi');
    });

    it('sends the cursor after the last write', () => {
      screen.flush();

      expect([ seen!.cursorRow, seen!.cursorColumn ]).toEqual([ 5, 12 ]);
    });
  });

  it('stops calling a listener once it is removed', () => {
    let calls: number = 0;
    const stop: () => void = screen.onFlush((): void => {
      calls++;
    });

    stop();
    screen.flush();

    expect(calls).toBe(1);
  });
});
