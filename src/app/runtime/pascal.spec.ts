import type { IRef } from './pascal';
import { Readv, box, byteint_of, bytlint_of, charSet, clone, div, fromLowerBound, mod, oneBased, signed_bits, unsigned_bits, wordint_of, worlint_of, fmt, fmtBoolean, fmtFixed, index, pad, packed, pascalSet, read_integer, real, ref, round, substr, uand, uor, uxor } from './pascal';

describe('ref', () => {
  it('writes through to the field it is bound to', () => {
    const record: { hp: number } = { hp: 10 };
    const hp: IRef<number> = ref(record, 'hp');

    hp.set(hp.get() - 3);

    expect(record.hp).toBe(7);
  });

  it('binds to an array element', () => {
    const list: number[] = [ 1, 2, 3 ];

    ref(list, 1).set(20);

    expect(list).toEqual([ 1, 20, 3 ]);
  });
});

describe('box', () => {
  it('holds what a call writes through it', () => {
    const local: IRef<string> = box('');

    local.set('x');

    expect(local.get()).toBe('x');
  });
});

describe('clone', () => {
  it('copies nested records rather than sharing them', () => {
    const original: { flags: { blind: number } } = { flags: { blind: 0 } };
    const copy: { flags: { blind: number } } = clone(original);

    copy.flags.blind = 5;

    expect(original.flags.blind).toBe(0);
  });
});

describe('arithmetic', () => {
  it.each([
    [ 2.5, 3 ],
    [ -2.5, -3 ],
    [ 2.4, 2 ],
    [ -2.6, -3 ],
  ])('rounds %d to %d, halves away from zero', (value: number, rounded: number) => {
    expect(round(value)).toBe(rounded);
  });

  it('keeps MOD non-negative for a negative dividend', () => {
    expect(mod(-7, 5)).toBe(3);
  });

  it('divides truncating toward zero', () => {
    expect(div(-7, 2)).toBe(-3);
  });

  it('stores reals in single precision', () => {
    expect(real(0.1)).toBe(Math.fround(0.1));
  });

  it('keeps uand unsigned', () => {
    expect(uand(0xFFFFFFFF, 0x80000000)).toBe(0x80000000);
  });

  it('keeps uor unsigned', () => {
    expect(uor(0x80000000, 1)).toBe(0x80000001);
  });

  it('keeps uxor unsigned', () => {
    expect(uxor(0x80000000, 0xFFFFFFFF)).toBe(0x7FFFFFFF);
  });
});

describe('sets', () => {
  it('includes the members of a range', () => {
    expect(pascalSet(1, [ 3, 5 ]).has(4)).toBe(true);
  });

  it('excludes what falls between members', () => {
    expect(pascalSet(1, [ 3, 5 ]).has(2)).toBe(false);
  });

  it('builds character ranges', () => {
    expect(charSet([ 'a', 'z' ]).has('q')).toBe(true);
  });
});

describe('strings', () => {
  it('takes SUBSTR 1-based', () => {
    expect(substr('Moria', 2, 3)).toBe('ori');
  });

  it('returns INDEX 1-based', () => {
    expect(index('Balrog', 'rog')).toBe(4);
  });

  it('returns INDEX 0 for no match', () => {
    expect(index('Balrog', 'x')).toBe(0);
  });

  it('pads with the fill character', () => {
    expect(pad('ab', '.', 5)).toBe('ab...');
  });

  it('blank-pads a packed array', () => {
    expect(packed('@SHADOW@', 12)).toBe('@SHADOW@    ');
  });

  it('truncates a packed array to its length', () => {
    expect(packed('toolong', 4)).toBe('tool');
  });
});

describe('writev formatting', () => {
  it('right-justifies an integer in its field', () => {
    expect(fmt(42, 5)).toBe('   42');
  });

  it('widens a field too narrow for the number', () => {
    expect(fmt(12345, 1)).toBe('12345');
  });

  it('formats a fixed-point real', () => {
    expect(fmtFixed(3.14159, 6, 2)).toBe('  3.14');
  });

  it('spells booleans in capitals', () => {
    expect(fmtBoolean(true, 5)).toBe(' TRUE');
  });
});

describe('Readv', () => {
  it('reads integers separated by blanks', () => {
    const line: Readv = new Readv(' 12   -3 7');

    expect([ line.integer(), line.integer(), line.integer() ]).toEqual([ 12, -3, 7 ]);
  });

  it('reads a real', () => {
    expect(new Readv(' 1.5E+01').real()).toBe(15);
  });

  it('reads a boolean', () => {
    expect(new Readv(' FALSE').boolean()).toBe(false);
  });

  it('reads a char without skipping blanks', () => {
    const line: Readv = new Readv('5 x');

    line.integer();

    expect(line.char()).toBe(' ');
  });

  it('reads the rest of the line into a string', () => {
    const line: Readv = new Readv('3 Frodo Baggins');

    line.integer();

    expect(line.rest()).toBe(' Frodo Baggins');
  });

  it('refuses a line with no integer where one is expected', () => {
    expect((): number => new Readv('abc').integer()).toThrow('no integer');
  });

  it('reads an integer with error:=continue', () => {
    expect(read_integer(' 42', 7)).toBe(42);
  });

  it('keeps the fallback when nothing reads', () => {
    expect(read_integer('abc', 7)).toBe(7);
  });

  it('refuses an integer too big for 32 bits', () => {
    expect((): number => new Readv('2147483648').integer()).toThrow('out of range');
  });

  it('reads the most negative 32-bit integer', () => {
    expect(new Readv('-2147483648').integer()).toBe(-2147483648);
  });
});

describe('range wraps', () => {
  it('keeps the low byte of a byteint', () => {
    expect(byteint_of(257)).toBe(1);
  });

  it('wraps a bytlint past 127 to negative', () => {
    expect(bytlint_of(128)).toBe(-128);
  });

  it('keeps the low word of a wordint', () => {
    expect(wordint_of(-1)).toBe(65535);
  });

  it('wraps a worlint past 32767 to negative', () => {
    expect(worlint_of(32768)).toBe(-32768);
  });

  it('leaves an in-range worlint alone', () => {
    expect(worlint_of(-300)).toBe(-300);
  });
});

describe('bit fields', () => {
  it('wraps a 6-bit signed field past 31 to negative', () => {
    expect(signed_bits(32, 6)).toBe(-32);
  });

  it('keeps an in-range 6-bit signed value', () => {
    expect(signed_bits(-5, 6)).toBe(-5);
  });

  it('keeps the low 4 bits of an unsigned field', () => {
    expect(unsigned_bits(17, 4)).toBe(1);
  });
});

describe('fromLowerBound', () => {
  it('puts the first item at the lower bound', () => {
    expect(fromLowerBound(2, [ 'a' ])[2]).toBe('a');
  });

  it('refuses a negative lower bound', () => {
    expect((): string[] => fromLowerBound(-1, [ 'a' ])).toThrow('negative lower bound');
  });
});

describe('oneBased', () => {
  it('puts the first item at index 1', () => {
    expect(oneBased([ 'a', 'b' ])[1]).toBe('a');
  });

  it('keeps the last item at index n', () => {
    expect(oneBased([ 'a', 'b' ])[2]).toBe('b');
  });
});
