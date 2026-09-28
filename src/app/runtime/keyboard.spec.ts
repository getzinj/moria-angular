import { Keyboard } from './keyboard';
import { settle } from '../port/port-fixture';

describe('Keyboard', () => {
  let keyboard: Keyboard;

  beforeEach((): void => {
    keyboard = new Keyboard();
  });

  it('hands over a key typed ahead', async () => {
    keyboard.push('a');

    expect(await keyboard.readKey()).toBe('a');
  });

  it('waits for a key when none is typed ahead', async () => {
    const reading: Promise<string> = keyboard.readKey();

    keyboard.push('b');

    expect(await reading).toBe('b');
  });

  it('reports that the game is waiting while a read is outstanding', () => {
    void keyboard.readKey();

    expect(keyboard.waiting).toBe(true);
  });

  it('stops reporting waiting once a key arrives', () => {
    void keyboard.readKey();
    keyboard.push('c');

    expect(keyboard.waiting).toBe(false);
  });

  it('throws type-ahead away on flush', () => {
    keyboard.push('d');
    keyboard.flush();

    expect(keyboard.hasTypeAhead).toBe(false);
  });

  it('polls NUL when nothing is typed ahead', () => {
    expect(keyboard.poll()).toBe('\0');
  });

  it('polls the key typed ahead', () => {
    keyboard.push('e');

    expect(keyboard.poll()).toBe('e');
  });

  it('refuses a second read while one is waiting', async () => {
    void keyboard.readKey();

    await expect(keyboard.readKey()).rejects.toThrow('already waiting');
  });

  it('keeps waiting when the key it woke for was flushed first', async () => {
    let read: string | null = null;

    void keyboard.readKey().then((key: string): void => {
      read = key;
    });
    keyboard.push('f');
    keyboard.flush();
    await Promise.resolve();
    keyboard.push('g');
    await settle();

    expect(read).toBe('g');
  });
});
