// The VT100 Moria drew on: 24 rows of 80 columns, addressed 1-based as the game's put_buffer did.
// Writes collect in the grid and only reach the page on flush(), the way put_qio sent the game's
// output buffer to the terminal just before each read.

export const SCREEN_ROWS: number = 24;
export const SCREEN_COLUMNS: number = 80;

export interface IScreenSnapshot {
  readonly rows: readonly string[];
  readonly cursorRow: number;
  readonly cursorColumn: number;
}

export type ScreenListener = (snapshot: IScreenSnapshot) => void;

const BLANK_ROW: string = ' '.repeat(SCREEN_COLUMNS);


export class ScreenGrid {
  private readonly rows: string[] = Array.from({ length: SCREEN_ROWS }, (): string => BLANK_ROW);

  private cursorRow: number = 1;
  private cursorColumn: number = 1;

  private readonly listeners: ScreenListener[] = [];


  /** Writes text at a 1-based position, clipped at the right margin, and leaves the cursor after it. */
  public putString(row: number, column: number, text: string): void {
    if (this.isOnScreen(row, column)) {
      const room: number = SCREEN_COLUMNS - column + 1;
      const written: string = text.substring(0, room);
      const line: string = this.rows[row - 1];

      this.rows[row - 1] = line.substring(0, column - 1) + written + line.substring(column - 1 + written.length);
      this.moveCursor(row, Math.min(column + written.length, SCREEN_COLUMNS));
    } else {
      this.moveCursor(row, column);
    }
  }


  /** ESC[K: blanks from the position to the end of its row. */
  public eraseToEndOfLine(row: number, column: number): void {
    if (this.isOnScreen(row, column)) {
      this.rows[row - 1] = this.rows[row - 1].substring(0, column - 1).padEnd(SCREEN_COLUMNS, ' ');
    }

    this.moveCursor(row, column);
  }


  /** ESC[J: blanks from the position to the end of the screen. */
  public eraseToEndOfScreen(row: number, column: number): void {
    this.eraseToEndOfLine(row, column);

    for (let below: number = row + 1; below <= SCREEN_ROWS; below++) {
      this.rows[below - 1] = BLANK_ROW;
    }

    this.moveCursor(row, column);
  }


  public moveCursor(row: number, column: number): void {
    this.cursorRow = Math.min(Math.max(row, 1), SCREEN_ROWS);
    this.cursorColumn = Math.min(Math.max(column, 1), SCREEN_COLUMNS);
  }


  /** Calls the listener now and on every flush; the function returned stops it. */
  public onFlush(listener: ScreenListener): () => void {
    this.listeners.push(listener);
    listener(this.snapshot());

    return (): void => {
      const index: number = this.listeners.indexOf(listener);

      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }


  /** Sends what has been written so far to whoever is showing the screen. */
  public flush(): void {
    const snapshot: IScreenSnapshot = this.snapshot();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }


  public row(row: number): string {
    return this.rows[row - 1];
  }


  /** The screen as text, trailing blanks trimmed, for tests to read. */
  public toString(): string {
    return this.rows.map((line: string): string => line.trimEnd()).join('\n');
  }


  private snapshot(): IScreenSnapshot {
    return { rows: [...this.rows], cursorRow: this.cursorRow, cursorColumn: this.cursorColumn };
  }


  private isOnScreen(row: number, column: number): boolean {
    return (row >= 1) && (row <= SCREEN_ROWS) && (column >= 1) && (column <= SCREEN_COLUMNS);
  }

}
