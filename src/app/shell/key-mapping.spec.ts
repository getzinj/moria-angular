import type { IKeyEvent } from './key-mapping';
import { vt100KeyOf } from './key-mapping';

function keyEvent(key: string, modifiers: Partial<IKeyEvent> = {}): IKeyEvent {
  return { key, code: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers };
}

describe('vt100KeyOf', () => {
  it.each([
    [ 'ArrowUp', '8' ],
    [ 'ArrowDown', '2' ],
    [ 'ArrowLeft', '4' ],
    [ 'ArrowRight', '6' ],
    [ 'Home', '7' ],
    [ 'PageUp', '9' ],
    [ 'End', '1' ],
    [ 'PageDown', '3' ],
  ])('sends %s as the keypad digit %s', (key: string, digit: string) => {
    expect(vt100KeyOf(keyEvent(key))).toBe(digit);
  });

  it('passes a printable character through', () => {
    expect(vt100KeyOf(keyEvent('R'))).toBe('R');
  });

  it('sends Enter as carriage return', () => {
    expect(vt100KeyOf(keyEvent('Enter'))).toBe('\r');
  });

  it('sends Backspace as DEL', () => {
    expect(vt100KeyOf(keyEvent('Backspace'))).toBe('\x7F');
  });

  it('sends Escape as ESC', () => {
    expect(vt100KeyOf(keyEvent('Escape'))).toBe('\x1B');
  });

  it('sends Ctrl+letter as its control code', () => {
    expect(vt100KeyOf(keyEvent('p', { code: 'KeyP', ctrlKey: true }))).toBe('\x10');
  });

  it('sends Alt+letter as the same control code', () => {
    expect(vt100KeyOf(keyEvent('w', { code: 'KeyW', altKey: true }))).toBe('\x17');
  });

  it('takes the Alt letter from the physical key when macOS Option composes another character', () => {
    expect(vt100KeyOf(keyEvent('\u2211', { code: 'KeyW', altKey: true }))).toBe('\x17');
  });

  it('sends Ctrl+[ as ESC', () => {
    expect(vt100KeyOf(keyEvent('[', { code: 'BracketLeft', ctrlKey: true }))).toBe('\x1B');
  });

  it('types the character AltGr produces rather than a control code', () => {
    expect(vt100KeyOf(keyEvent('{', { code: 'Digit7', ctrlKey: true, altKey: true }))).toBe('{');
  });

  it('leaves Ctrl+Shift combinations to the browser', () => {
    expect(vt100KeyOf(keyEvent('I', { code: 'KeyI', ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it('ignores a key the terminal has no use for', () => {
    expect(vt100KeyOf(keyEvent('F5'))).toBeNull();
  });

  it('ignores Meta combinations so browser shortcuts still work', () => {
    expect(vt100KeyOf(keyEvent('r', { metaKey: true }))).toBeNull();
  });
});
