import type { IConstants } from './convert-values';
import { Emitter, readConstants, readTypes, readValues, readVariables, tokenize } from './convert-values';

const CONSTANTS: string = `const
  max_thing = 3;
  bigger = max_thing + 1;
  mixed = 1 + 2 * max_thing;
  cur_version = 4.8;
  null = chr(0);`;

const TYPES: string = `type
  vtype = varying [80] of char;
  stat_type = packed array [1..6] of char;
  thing_type = record
    name : vtype;
    flags : unsigned;
    small : [bit(6),pos(8)] -32..31;
    ok : boolean;
  end;`;

function emit(declaration: string, value: string | null): string {
  const constants: IConstants = readConstants(CONSTANTS);
  const emitter: Emitter = new Emitter(readTypes(TYPES, constants));
  const [ field ] = readVariables(`var ${ declaration }`, constants);
  let code: string;

  if (value != null) {
    code = emitter.value(field.type, readValues(`value ${ field.name } := ${ value };`, constants).get(field.name)!, '');
  } else {
    code = emitter.zero(field.type, '');
  }

  return code;
}

describe('convert-values', () => {
  describe('tokenize', () => {
    it('reads a doubled quote inside a string as one quote', () => {
      expect(tokenize('\'it\'\'s\'')[0].value).toBe('it\'s');
    });

    it('reads %X hex', () => {
      expect(tokenize('%X\'80000000\'')[0].value).toBe(0x80000000);
    });

    it('reads %B binary', () => {
      expect(tokenize('%B\'111111\'')[0].value).toBe(63);
    });

    it('marks a literal with a decimal point as real', () => {
      expect(tokenize('0.0005')[0].real).toBe(true);
    });

    it('refuses an unterminated string', () => {
      expect((): unknown => tokenize('\'abc')).toThrow('unterminated string');
    });

    it('refuses an unterminated comment', () => {
      expect((): unknown => tokenize('{ abc')).toThrow('unterminated comment');
    });

    it('skips brace comments', () => {
      expect(tokenize('{ comment } x').map((token: { text: string }): string => token.text)).toEqual([ 'x' ]);
    });

    it('keeps $ inside identifiers', () => {
      expect(tokenize('store$choices')[0].text).toBe('store$choices');
    });
  });

  describe('readConstants', () => {
    it('evaluates a sum of constants', () => {
      expect(readConstants(CONSTANTS).values.get('bigger')).toBe(4);
    });

    it('multiplies before adding', () => {
      expect(readConstants(CONSTANTS).values.get('mixed')).toBe(7);
    });

    it('remembers which constants are real', () => {
      expect(readConstants(CONSTANTS).reals.has('cur_version')).toBe(true);
    });

    it('skips constants that are not numbers', () => {
      expect(readConstants(CONSTANTS).values.has('null')).toBe(false);
    });
  });

  describe('emitting', () => {
    it('matches record values to fields by position', () => {
      expect(emit('t : thing_type;', '(\'Balrog\', %X\'10\', -3, true)')).toBe('{ name: \'Balrog\', flags: 16, small: -3, ok: true }');
    });

    it('refuses a record given the wrong number of values', () => {
      expect((): string => emit('t : thing_type;', '(\'Balrog\', 1)')).toThrow('record of 4 fields given 2 values');
    });

    it('expands `n of value` repetition', () => {
      expect(emit('a : array [0..max_thing] of boolean;', '(bigger of false)')).toBe('[\n  false,\n  false,\n  false,\n  false,\n]');
    });

    it('refuses an array given the wrong number of values', () => {
      expect((): string => emit('a : array [1..max_thing] of integer;', '(1, 2)')).toThrow('given 2 values');
    });

    it('offsets a 1-based array', () => {
      expect(emit('a : array [1..2] of integer;', '(5, 6)')).toBe('oneBased([\n  5,\n  6,\n])');
    });

    it('offsets an array with another lower bound', () => {
      expect(emit('a : array [2..3] of integer;', '(5, 6)')).toBe('fromLowerBound(2, [\n  5,\n  6,\n])');
    });

    it('negates a named constant', () => {
      expect(emit('i : integer;', '-max_thing')).toBe('-3');
    });

    it('keeps a named REAL constant single precision', () => {
      expect(emit('r : real;', 'cur_version')).toBe('real(4.8)');
    });

    it('blank-pads a fixed-length string', () => {
      expect(emit('s : stat_type;', '\'abc\'')).toBe('\'abc   \'');
    });

    it('refuses a fixed-length string that is too long', () => {
      expect((): string => emit('s : stat_type;', '\'abcdefg\'')).toThrow('longer than 6');
    });

    it('refuses an array with a negative lower bound', () => {
      expect((): string => emit('a : array [-1..1] of integer;', '(1, 2, 3)')).toThrow('negative lower bound');
    });

    it('stores reals in single precision', () => {
      expect(emit('r : real;', '1.25')).toBe('real(1.25)');
    });

    it('treats a packed array of char as a string', () => {
      expect(emit('s : stat_type;', '\'abcdef\'')).toBe('\'abcdef\'');
    });

    it('builds sets with ranges', () => {
      expect(emit('s : set of 0..255;', '[1, 3..5]')).toBe('pascalSet(1, [ 3, 5 ])');
    });

    it('zeroes a varying string as empty', () => {
      expect(emit('v : vtype;', null)).toBe('\'\'');
    });

    it('zeroes a packed array of char as NULs', () => {
      expect(emit('s : stat_type;', null)).toBe('\'\\0\\0\\0\\0\\0\\0\'');
    });

    it('wraps a zeroed record in parentheses when an arrow returns it', () => {
      expect(emit('a : array [1..1] of thing_type;', null)).toContain('=> ({');
    });
  });
});
