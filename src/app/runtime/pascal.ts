// VAX Pascal behaviour the port leans on, where TypeScript would otherwise quietly differ.


/** A Pascal VAR parameter bound to a field or an array element. */
export interface IRef<T> {
  get(): T;
  set(value: T): void;
}


export function ref<O extends object, K extends keyof O>(owner: O, key: K): IRef<O[K]> {
  return {
    get: (): O[K] => owner[key],
    set: (value: O[K]): void => {
      owner[key] = value;
    },
  };
}


/** A VAR parameter bound to a local: read it back through .get() after the call. */
export function box<T>(initial: T): IRef<T> {
  let value: T = initial;

  return {
    get: (): T => value,
    set: (next: T): void => {
      value = next;
    },
  };
}


/** Record assignment copies; object assignment in TypeScript shares. */
export function clone<T>(record: T): T {
  return structuredClone(record);
}


/** ROUND: halves go away from zero, where Math.round sends -2.5 to -2. */
export function round(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}


/** DIV: integer division truncating toward zero. */
export function div(dividend: number, divisor: number): number {
  return Math.trunc(dividend / divisor);
}


/** MOD: never negative for a positive divisor, unlike %. VAX Pascal kept REM for that. */
export function mod(dividend: number, divisor: number): number {
  return ((dividend % divisor) + divisor) % divisor;
}


/** REAL is VAX single precision (F_floating); every stored real goes through this. */
export function real(value: number): number {
  return Math.fround(value);
}


/** [byte] 0..255: what an unchecked store into a byteint field keeps. */
export function byteint_of(value: number): number {
  return value & 0xFF;
}


/** [byte] -128..127 */
export function bytlint_of(value: number): number {
  return (value << 24) >> 24;
}


/** [word] 0..65535 */
export function wordint_of(value: number): number {
  return value & 0xFFFF;
}


/** [word] -32768..32767 */
export function worlint_of(value: number): number {
  return (value << 16) >> 16;
}


/** [bit(width)] signed subrange field, e.g. a monster's stuned. */
export function signed_bits(value: number, width: number): number {
  return (value << (32 - width)) >> (32 - width);
}


/** [bit(width)] unsigned subrange field, e.g. a cave cell's fval. */
export function unsigned_bits(value: number, width: number): number {
  return (value & ((1 << width) - 1)) >>> 0;
}


/**
 * A Pascal `array [low..n]`, indexed as it was. The padding below `low` is not T: iterate with the
 * Pascal bounds, never for..of, find or every.
 */
export function fromLowerBound<T>(low: number, items: readonly T[]): T[] {
  if (low < 0) {
    throw new Error(`fromLowerBound: negative lower bound ${ low }`);
  }

  return [ ...Array.from({ length: low }, (): T => undefined as unknown as T), ...items ];
}


/** A Pascal `array [1..n]`. */
export function oneBased<T>(items: readonly T[]): T[] {
  return fromLowerBound(1, items);
}


export function uand(a: number, b: number): number {
  return (a & b) >>> 0;
}


export function uor(a: number, b: number): number {
  return (a | b) >>> 0;
}


export function uxor(a: number, b: number): number {
  return (a ^ b) >>> 0;
}


/** A `set of` literal: members and inclusive [low, high] ranges, as in [1, 3..5]. */
export function pascalSet(...members: readonly (number | readonly [ number, number ])[]): ReadonlySet<number> {
  const set: Set<number> = new Set<number>();

  for (const member of members) {
    if (typeof member === 'number') {
      set.add(member);
    } else {
      for (let value: number = member[0]; value <= member[1]; value++) {
        set.add(value);
      }
    }
  }

  return set;
}


/** A `set of char` literal: characters and inclusive ['a', 'z'] ranges. */
export function charSet(...members: readonly (string | readonly [ string, string ])[]): ReadonlySet<string> {
  const set: Set<string> = new Set<string>();

  for (const member of members) {
    if (typeof member === 'string') {
      set.add(member);
    } else {
      for (let code: number = member[0].charCodeAt(0); code <= member[1].charCodeAt(0); code++) {
        set.add(String.fromCharCode(code));
      }
    }
  }

  return set;
}


/** SUBSTR(s, start, length), 1-based. */
export function substr(text: string, start: number, length: number): string {
  return text.substring(start - 1, start - 1 + length);
}


/** INDEX(s, pattern): 1-based position of the first match, 0 when there is none. */
export function index(text: string, pattern: string): number {
  return text.indexOf(pattern) + 1;
}


/** PAD(s, fill, length): s followed by fill up to length; a longer s is left as it is. */
export function pad(text: string, fill: string, length: number): string {
  return text.padEnd(length, fill);
}


/** Blank-padded fixed-length `packed array of char`, compared the way Pascal compares them. */
export function packed(text: string, length: number): string {
  return text.padEnd(length, ' ').substring(0, length);
}


/** WRITEV of an integer with a field width: right-justified, widened if it does not fit. */
export function fmt(value: number, width: number): string {
  return String(Math.trunc(value)).padStart(width, ' ');
}


/** WRITEV of a real as x:width:decimals. */
export function fmtFixed(value: number, width: number, decimals: number): string {
  return value.toFixed(decimals).padStart(width, ' ');
}


/** WRITEV of a boolean, which VAX Pascal spells in capitals. */
export function fmtBoolean(value: boolean, width: number): string {
  return (value ? 'TRUE' : 'FALSE').padStart(width, ' ');
}


/**
 * READV: reads values off a string left to right. Numbers skip leading blanks; a char takes the
 * next character as it stands; a varying string takes the rest of the line.
 */
export class Readv {
  private position: number = 0;

  constructor(private readonly text: string) {
  }


  public integer(): number {
    const value: number = Number(this.token(/^[+-]?\d+/, 'integer'));

    if ((value < -2147483648) || (value > 2147483647)) {
      throw new Error(`READV: integer out of range in "${ this.text }"`);
    }

    return value;
  }


  public real(): number {
    return Math.fround(Number(this.token(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/, 'real')));
  }


  public boolean(): boolean {
    this.skipBlanks();

    const rest: string = this.text.substring(this.position).toUpperCase();
    let value: boolean;

    if (rest.startsWith('TRUE')) {
      this.position += 4;
      value = true;
    } else if (rest.startsWith('FALSE')) {
      this.position += 5;
      value = false;
    } else {
      throw new Error(`READV: no boolean at column ${ this.position + 1 } of "${ this.text }"`);
    }

    return value;
  }


  public char(): string {
    const character: string = this.text.charAt(this.position);

    this.position++;

    return character;
  }


  public rest(): string {
    const remaining: string = this.text.substring(this.position);

    this.position = this.text.length;

    return remaining;
  }


  private token(pattern: RegExp, what: string): string {
    this.skipBlanks();

    const match: RegExpExecArray | null = pattern.exec(this.text.substring(this.position));

    if (match != null) {
      this.position += match[0].length;
    } else {
      throw new Error(`READV: no ${ what } at column ${ this.position + 1 } of "${ this.text }"`);
    }

    return match[0];
  }


  private skipBlanks(): void {
    while ((this.position < this.text.length) && (this.text.charAt(this.position) === ' ')) {
      this.position++;
    }
  }

}


/** READV of one integer with error:=continue: the fallback when it will not read. */
export function read_integer(text: string, fallback: number): number {
  let value: number = fallback;

  try {
    value = new Readv(text).integer();
  } catch {
    // error:=continue
  }

  return value;
}
