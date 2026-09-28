// The terminal's input side. The game read one raw key at a time with a no-echo, read-all QIO, so
// control characters arrive as ordinary keys. Keys typed before the game asks for one wait in a
// type-ahead buffer, which flush() throws away, as the original's flush did.
//
// Waiting for a key is what suspends the game, which is why every ported routine that can reach
// inkey is async.

export class Keyboard {
  private readonly buffer: string[] = [];

  private waiter: (() => void) | null = null;


  public push(key: string): void {
    this.buffer.push(key);

    const waiting: (() => void) | null = this.waiter;

    if (waiting != null) {
      this.waiter = null;
      waiting();
    }
  }


  /** Whether the game is parked waiting for a key, rather than busy with something else. */
  public get waiting(): boolean {
    return this.waiter != null;
  }


  public get hasTypeAhead(): boolean {
    return this.buffer.length > 0;
  }


  /** Discards type-ahead. */
  public flush(): void {
    this.buffer.length = 0;
  }


  /** Waits for a key. The game has one reader, so a second read while one is waiting is a bug. */
  public async readKey(): Promise<string> {
    if (this.waiter != null) {
      throw new Error('Keyboard.readKey: a read is already waiting');
    }

    // A flush between the key arriving and this read resuming leaves nothing to take, so wait again.
    while (this.buffer.length === 0) {
      await new Promise<void>((resolve: () => void): void => {
        this.waiter = resolve;
      });
    }

    return this.buffer.shift() as string;
  }


  /** A key if one is waiting, otherwise NUL, as a zero-second timed read returned. */
  public poll(): string {
    let key: string;

    if (this.buffer.length > 0) {
      key = this.buffer.shift() as string;
    } else {
      key = '\0';
    }

    return key;
  }

}
