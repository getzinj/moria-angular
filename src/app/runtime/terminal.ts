// io.inc's terminal: put_buffer and put_qio over the screen, inkey over the keyboard.
//
// put_buffer only queued output; put_qio sent it, and inkey always sent it before reading. So
// writes land on the screen when the game next reads a key or explicitly flushes, never between.

import type { Keyboard } from './keyboard';
import type { ScreenGrid } from './screen-grid';

/** NUL, which a timed read that saw no key returned. */
export const NO_KEY: string = '\0';


export class Terminal {

  constructor(public readonly screen: ScreenGrid,
              public readonly keyboard: Keyboard) {
  }


  /** put_buffer: the cursor move and the text. A backspace in the text moves the cursor back. */
  public put_buffer(text: string, row: number, column: number): void {
    const pieces: string[] = text.split('\b');
    let at: number = column;

    pieces.forEach((piece: string, index: number): void => {
      this.screen.putString(row, at, piece);
      at += piece.length;

      if (index < pieces.length - 1) {
        at = Math.max(at - 1, 1);
        this.screen.moveCursor(row, at);
      }
    });
  }


  /** Cursor move then ESC[K. */
  public erase_to_end_of_line(row: number, column: number): void {
    this.screen.eraseToEndOfLine(row, column);
  }


  /** Cursor move then ESC[J. */
  public erase_to_end_of_screen(row: number, column: number): void {
    this.screen.eraseToEndOfScreen(row, column);
  }


  /** put_qio: sends the output buffer. */
  public put_qio(): void {
    this.screen.flush();
  }


  /** A read-all, no-echo read of one key, after the output has gone out. */
  public async read_key(): Promise<string> {
    this.put_qio();

    return this.keyboard.readKey();
  }


  /** A zero-second timed read: the key typed ahead, or NUL. */
  public poll_key(): string {
    this.put_qio();

    return this.keyboard.poll();
  }


  /** io.inc flush: discards type-ahead (it never touched output). */
  public flush_input(): void {
    this.keyboard.flush();
  }

}
