// Turns a browser key event into the character a VT100 would have sent Moria.
//
// Movement was the numeric keypad's digits. A keyboard without one gets the arrows for the four
// straight directions and Home/PgUp/End/PgDn for the diagonals, which is where those keys sit on
// a numeric keypad with NumLock off.
//
// Browsers keep some Ctrl combinations for themselves (^W, ^T, ^N), and god mode needs them, so
// Alt+letter stands in for Ctrl+letter. The letter comes from the physical key, because macOS
// Option composes a different character. Ctrl and Alt together are AltGr on Windows, which types
// ordinary characters, and Ctrl+Shift is left to the browser (reload, devtools).

export interface IKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}

const NAMED_KEYS: Readonly<Record<string, string>> = {
  ArrowUp: '8',
  ArrowDown: '2',
  ArrowLeft: '4',
  ArrowRight: '6',
  Home: '7',
  PageUp: '9',
  End: '1',
  PageDown: '3',
  Clear: '5',
  Enter: '\r',
  Escape: '\x1B',
  Backspace: '\x7F',
  Delete: '\x7F',
  Tab: '\t',
};

// The non-letter keys with a control code of their own: ESC, FS, GS.
const CONTROL_PUNCTUATION: Readonly<Record<string, string>> = {
  BracketLeft: '\x1B',
  Backslash: '\x1C',
  BracketRight: '\x1D',
};


function controlCharacterOf(code: string): string | null {
  let character: string | null = null;

  if (/^Key[A-Z]$/.test(code)) {
    character = String.fromCharCode(code.charCodeAt(3) - 64);
  } else if (code in CONTROL_PUNCTUATION) {
    character = CONTROL_PUNCTUATION[code];
  }

  return character;
}


function isPrintable(key: string): boolean {
  return (key.length === 1) && (key.charCodeAt(0) >= 32) && (key.charCodeAt(0) <= 126);
}


/** Meta combinations, and Ctrl+Shift (reload, devtools), belong to the browser. */
function isForTheTerminal(event: IKeyEvent): boolean {
  return !event.metaKey && !(event.ctrlKey && event.shiftKey);
}


function terminalCharacterOf(event: IKeyEvent): string | null {
  let character: string | null = null;

  if (event.ctrlKey && event.altKey) {
    character = isPrintable(event.key) ? event.key : null;
  } else if (event.ctrlKey || event.altKey) {
    character = controlCharacterOf(event.code);
  } else if (event.key in NAMED_KEYS) {
    character = NAMED_KEYS[event.key];
  } else if (isPrintable(event.key)) {
    character = event.key;
  }

  return character;
}


/** The character the key sends, or null for a key the terminal had no use for. */
export function vt100KeyOf(event: IKeyEvent): string | null {
  return isForTheTerminal(event) ? terminalCharacterOf(event) : null;
}
