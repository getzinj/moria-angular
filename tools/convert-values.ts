// Generates src/app/port/variables.ts from types.inc, variables.inc and values.inc; see `npm run convert-values`.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Token = { kind: 'string' | 'number' | 'word' | 'punct'; text: string; value?: number | string; real?: boolean };

type PascalType =
  | { kind: 'named'; name: string }
  | { kind: 'record'; fields: IField[] }
  | { kind: 'array'; low: number; high: number; element: PascalType }
  | { kind: 'string'; length: number | null }
  | { kind: 'set'; of: 'number' | 'char' }
  | { kind: 'number' }
  | { kind: 'boolean' };

interface IField {
  name: string;
  type: PascalType;
}

export interface IConstants {
  readonly values: ReadonlyMap<string, number>;
  /** REAL constants, which VAX Pascal held in single precision. */
  readonly reals: ReadonlySet<string>;
}

type PascalValue =
  | { kind: 'tuple'; items: PascalValue[] }
  | { kind: 'set'; items: (PascalValue | [ PascalValue, PascalValue ])[] }
  | { kind: 'string'; text: string }
  | { kind: 'number'; value: number; real: boolean }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'repeat'; count: number; item: PascalValue };

const PUNCTUATION: readonly string[] = [ ':=', '..', '(', ')', '[', ']', ',', ';', ':', '=', '+', '-', '*' ];

// Names types.ts gives a TypeScript type of its own; everything else is spelled out.
const EXPORTED_TYPES: ReadonlySet<string> = new Set<string>([
  'quad_type', 'atype', 'btype', 'ctype', 'dtype', 'etype', 'mtype', 'ntype', 'ttype', 'vtype',
  'stat_type', 'obj_set', 'char_set', 'key_type', 'creature_type', 'monster_type', 'treasure_type',
  'player_type', 'spell_type', 'spl_rec', 'spl_type', 'race_type', 'class_type', 'background_type',
  'floor_type', 'cave_type', 'row_floor', 'owner_type', 'inven_record', 'store_type',
]);

// The seed lives on the runtime's Random, where randint can reach it.
const NOT_GLOBALS: ReadonlySet<string> = new Set<string>([ 'seed' ]);


function closing(source: string, terminator: string, from: number): number {
  const at: number = source.indexOf(terminator, from);

  if (at < 0) {
    throw new Error(`tokenize: unterminated comment at ${ from }`);
  }

  return at;
}


export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at: number = 0;

  while (at < source.length) {
    const rest: string = source.substring(at);
    let match: RegExpExecArray | null;

    if (/^\s/.test(rest)) {
      at++;
    } else if (rest.startsWith('{')) {
      at = closing(source, '}', at) + 1;
    } else if (rest.startsWith('(*')) {
      at = closing(source, '*)', at) + 2;
    } else if (rest.startsWith('\'')) {
      let text: string = '';
      let end: number = at + 1;

      while ((source.charAt(end) !== '\'') || (source.charAt(end + 1) === '\'')) {
        if (end >= source.length) {
          throw new Error(`tokenize: unterminated string at ${ at }`);
        }

        if (source.charAt(end) === '\'') {
          end++;
        }

        text += source.charAt(end);
        end++;
      }

      tokens.push({ kind: 'string', text: source.substring(at, end + 1), value: text });
      at = end + 1;
    } else if ((match = /^%([XBO])'([0-9A-Fa-f]+)'/.exec(rest)) != null) {
      const radix: number = { X: 16, B: 2, O: 8 }[match[1] as 'X' | 'B' | 'O'];

      tokens.push({ kind: 'number', text: match[0], value: parseInt(match[2], radix), real: false });
      at += match[0].length;
    } else if ((match = /^\d+\.\d+/.exec(rest)) != null) {
      tokens.push({ kind: 'number', text: match[0], value: Number(match[0]), real: true });
      at += match[0].length;
    } else if ((match = /^\d+/.exec(rest)) != null) {
      tokens.push({ kind: 'number', text: match[0], value: Number(match[0]), real: false });
      at += match[0].length;
    } else if ((match = /^[A-Za-z_$][\w$]*/.exec(rest)) != null) {
      tokens.push({ kind: 'word', text: match[0].toLowerCase() });
      at += match[0].length;
    } else {
      const punct: string | undefined = PUNCTUATION.find((candidate: string): boolean => rest.startsWith(candidate));

      if (punct != null) {
        tokens.push({ kind: 'punct', text: punct });
        at += punct.length;
      } else {
        throw new Error(`tokenize: unexpected "${ rest.substring(0, 20) }"`);
      }
    }
  }

  return tokens;
}


class Parser {
  private at: number = 0;

  /** Whether the last constant() read a REAL literal or REAL constant. */
  private sawReal: boolean = false;

  constructor(private readonly tokens: readonly Token[],
              private readonly constants: IConstants) {
  }


  public get done(): boolean {
    return this.at >= this.tokens.length;
  }


  public peek(offset: number = 0): Token | undefined {
    return this.tokens[this.at + offset];
  }


  public next(): Token {
    const token: Token | undefined = this.tokens[this.at];

    if (token != null) {
      this.at++;
    } else {
      throw new Error('parse: ran out of tokens');
    }

    return token;
  }


  public is(text: string): boolean {
    return this.peek()?.text === text;
  }


  public expect(text: string): void {
    const token: Token = this.next();

    if (token.text !== text) {
      throw new Error(`parse: expected "${ text }", found "${ token.text }"`);
    }
  }


  public skipAttributes(): void {
    while (this.is('[')) {
      let depth: number = 0;

      do {
        const token: Token = this.next();

        if (token.text === '[') {
          depth++;
        } else if (token.text === ']') {
          depth--;
        }
      } while (depth > 0);
    }
  }


  /** A constant expression: numbers, named constants, unary minus, + and -, and * binding tighter. */
  public constant(): number {
    this.sawReal = false;

    let value: number = this.term();

    while (this.is('+') || this.is('-')) {
      const operator: string = this.next().text;
      const right: number = this.term();

      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }


  public get lastWasReal(): boolean {
    return this.sawReal;
  }


  public type(): PascalType {
    this.skipAttributes();

    const token: Token = this.next();
    let type: PascalType;

    if (token.text === 'packed') {
      type = this.type();
    } else if (token.text === 'record') {
      type = { kind: 'record', fields: this.fields('end') };
      this.expect('end');
    } else if (token.text === 'array') {
      type = this.array();
    } else if (token.text === 'varying') {
      this.expect('[');
      this.constant();
      type = { kind: 'string', length: null };
      this.expect(']');
      this.expect('of');
      this.next();
    } else if (token.text === 'set') {
      this.expect('of');
      type = { kind: 'set', of: this.peek()?.kind === 'string' ? 'char' : 'number' };
      this.constant_or_char();
      this.expect('..');
      this.constant_or_char();
    } else if ([ 'integer', 'unsigned', 'real' ].includes(token.text)) {
      type = { kind: 'number' };
    } else if (token.text === 'boolean') {
      type = { kind: 'boolean' };
    } else if (token.text === 'char') {
      type = { kind: 'string', length: 1 };
    } else if (this.is('..')) {
      this.at--;
      this.constant();
      this.expect('..');
      this.constant();
      type = { kind: 'number' };
    } else if ((token.kind === 'number') || (token.text === '-')) {
      this.at--;
      this.constant();
      this.expect('..');
      this.constant();
      type = { kind: 'number' };
    } else {
      type = { kind: 'named', name: token.text };
    }

    return type;
  }


  /** `a, b : type;` repeated until `terminator` (not consumed). */
  public fields(terminator: string): IField[] {
    const fields: IField[] = [];

    while (!this.done && !this.is(terminator)) {
      const names: string[] = [ this.next().text ];

      while (this.is(',')) {
        this.next();
        names.push(this.next().text);
      }

      this.expect(':');

      const type: PascalType = this.type();

      for (const name of names) {
        fields.push({ name, type });
      }

      if (this.is(';')) {
        this.next();
      }
    }

    return fields;
  }


  public value(): PascalValue {
    const token: Token = this.next();
    let value: PascalValue;

    if (token.text === '(') {
      value = { kind: 'tuple', items: this.list(')') };
    } else if (token.text === '[') {
      value = { kind: 'set', items: this.setItems() };
    } else if (token.kind === 'string') {
      value = { kind: 'string', text: token.value as string };
    } else if ((token.text === '-') || (token.kind === 'number') || this.constants.values.has(token.text)) {
      this.at--;
      this.sawReal = false;

      const number: number = this.operand();

      value = { kind: 'number', value: number, real: this.sawReal };
    } else if ((token.text === 'true') || (token.text === 'false')) {
      value = { kind: 'boolean', value: token.text === 'true' };
    } else {
      throw new Error(`parse: unexpected value "${ token.text }"`);
    }

    return value;
  }


  private list(terminator: string): PascalValue[] {
    const items: PascalValue[] = [];

    while (!this.is(terminator)) {
      if (this.peek(1)?.text === 'of') {
        const count: number = this.constant();

        this.expect('of');
        items.push({ kind: 'repeat', count, item: this.value() });
      } else {
        items.push(this.value());
      }

      if (this.is(',')) {
        this.next();
      }
    }

    this.expect(terminator);

    return items;
  }


  private setItems(): (PascalValue | [ PascalValue, PascalValue ])[] {
    const items: (PascalValue | [ PascalValue, PascalValue ])[] = [];

    while (!this.is(']')) {
      const low: PascalValue = this.value();

      if (this.is('..')) {
        this.next();
        items.push([ low, this.value() ]);
      } else {
        items.push(low);
      }

      if (this.is(',')) {
        this.next();
      }
    }

    this.expect(']');

    return items;
  }


  private array(): PascalType {
    this.expect('[');

    const bounds: [ number, number ][] = [];

    do {
      if (this.is(',')) {
        this.next();
      }

      const low: number = this.constant();

      this.expect('..');
      bounds.push([ low, this.constant() ]);
    } while (this.is(','));

    this.expect(']');
    this.expect('of');

    let type: PascalType = this.type();

    // packed array [1..n] of char is a fixed-length string, compared blank-padded.
    if ((bounds.length === 1) && (type.kind === 'string') && (type.length === 1)) {
      type = { kind: 'string', length: bounds[0][1] - bounds[0][0] + 1 };
      bounds.length = 0;
    }

    for (const [ low, high ] of [ ...bounds ].reverse()) {
      type = { kind: 'array', low, high, element: type };
    }

    return type;
  }


  private constant_or_char(): void {
    if (this.peek()?.kind === 'string') {
      this.next();
    } else {
      this.constant();
    }
  }


  private term(): number {
    let value: number = this.operand();

    while (this.is('*')) {
      this.next();
      value *= this.operand();
    }

    return value;
  }


  private operand(): number {
    const token: Token = this.next();
    let value: number;

    if (token.text === '-') {
      value = -this.operand();
    } else if (token.kind === 'number') {
      value = token.value as number;
      this.sawReal ||= token.real === true;
    } else if (this.constants.values.has(token.text)) {
      value = this.constants.values.get(token.text) as number;
      this.sawReal ||= this.constants.reals.has(token.text);
    } else {
      throw new Error(`parse: "${ token.text }" is not a constant`);
    }

    return value;
  }

}


/** constants.inc: `name = expression;` after `const`. Non-numeric constants are skipped. */
export function readConstants(source: string): IConstants {
  const values: Map<string, number> = new Map<string, number>();
  const reals: Set<string> = new Set<string>();
  const constants: IConstants = { values, reals };
  const parser: Parser = new Parser(tokenize(source), constants);

  parser.expect('const');

  while (!parser.done) {
    const name: string = parser.next().text;

    parser.expect('=');

    if ((parser.peek()?.kind === 'word') && (parser.peek(1)?.text === '(')) {
      while (!parser.is(';')) {
        parser.next();
      }
    } else {
      values.set(name, parser.constant());

      if (parser.lastWasReal) {
        reals.add(name);
      }
    }

    parser.expect(';');
  }

  return constants;
}


export function readTypes(source: string, constants: IConstants): Map<string, PascalType> {
  const types: Map<string, PascalType> = new Map<string, PascalType>();
  const parser: Parser = new Parser(tokenize(source), constants);

  parser.expect('type');

  while (!parser.done) {
    const name: string = parser.next().text;

    parser.expect('=');
    types.set(name, parser.type());
    parser.expect(';');
  }

  return types;
}


export function readVariables(source: string, constants: IConstants): IField[] {
  const parser: Parser = new Parser(tokenize(source), constants);

  parser.expect('var');

  return parser.fields('');
}


export function readValues(source: string, constants: IConstants): Map<string, PascalValue> {
  const values: Map<string, PascalValue> = new Map<string, PascalValue>();
  const parser: Parser = new Parser(tokenize(source), constants);

  parser.expect('value');

  while (!parser.done) {
    const name: string = parser.next().text;

    parser.expect(':=');
    values.set(name, parser.value());
    parser.expect(';');
  }

  return values;
}


export class Emitter {

  constructor(private readonly types: ReadonlyMap<string, PascalType>) {
  }


  public resolve(type: PascalType): PascalType {
    let resolved: PascalType = type;

    while (resolved.kind === 'named') {
      const found: PascalType | undefined = this.types.get(resolved.name);

      if (found != null) {
        resolved = found;
      } else {
        throw new Error(`emit: unknown type "${ resolved.name }"`);
      }
    }

    return resolved;
  }


  public typeName(type: PascalType): string {
    let name: string;

    if ((type.kind === 'named') && EXPORTED_TYPES.has(type.name)) {
      name = type.name;
    } else if (type.kind === 'named') {
      name = this.typeName(this.resolve(type));
    } else if (type.kind === 'array') {
      name = `${ this.typeName(type.element) }[]`;
    } else if (type.kind === 'string') {
      name = 'string';
    } else if (type.kind === 'set') {
      name = type.of === 'char' ? 'char_set' : 'obj_set';
    } else if (type.kind === 'boolean') {
      name = 'boolean';
    } else if (type.kind === 'number') {
      name = 'number';
    } else {
      name = `{ ${ type.fields.map((field: IField): string => `${ field.name }: ${ this.typeName(field.type) }`).join('; ') } }`;
    }

    return name;
  }


  /** What uninitialised static storage held on VMS: zeroes. */
  public zero(type: PascalType, indent: string): string {
    const resolved: PascalType = this.resolve(type);
    let code: string;

    if (resolved.kind === 'array') {
      code = this.arrayOf(resolved, `Array.from({ length: ${ resolved.high - resolved.low + 1 } }, (): ${ this.typeName(resolved.element) } => (${ this.zero(resolved.element, indent) }))`);
    } else if (resolved.kind === 'record') {
      const inner: string = `${ indent }  `;

      code = `{\n${ resolved.fields.map((field: IField): string => `${ inner }${ field.name }: ${ this.zero(field.type, inner) },`).join('\n') }\n${ indent }}`;
    } else if (resolved.kind === 'string') {
      code = resolved.length == null ? '\'\'' : quote('\0'.repeat(resolved.length));
    } else if (resolved.kind === 'set') {
      code = resolved.of === 'char' ? 'charSet()' : 'pascalSet()';
    } else if (resolved.kind === 'boolean') {
      code = 'false';
    } else {
      code = '0';
    }

    return code;
  }


  public value(type: PascalType, value: PascalValue, indent: string): string {
    const resolved: PascalType = this.resolve(type);
    let code: string;

    if (resolved.kind === 'array') {
      const items: PascalValue[] = expand(tupleItems(value));
      const count: number = resolved.high - resolved.low + 1;

      if (items.length !== count) {
        throw new Error(`emit: array [${ resolved.low }..${ resolved.high }] given ${ items.length } values`);
      }

      const inner: string = `${ indent }  `;

      code = this.arrayOf(resolved, `[\n${ items.map((item: PascalValue): string => `${ inner }${ this.value(resolved.element, item, inner) },`).join('\n') }\n${ indent }]`);
    } else if (resolved.kind === 'record') {
      const items: PascalValue[] = expand(tupleItems(value));

      if (items.length !== resolved.fields.length) {
        throw new Error(`emit: record of ${ resolved.fields.length } fields given ${ items.length } values`);
      }

      code = `{ ${ resolved.fields.map((field: IField, at: number): string => `${ field.name }: ${ this.value(field.type, items[at], indent) }`).join(', ') } }`;
    } else if (resolved.kind === 'set') {
      code = this.set(resolved.of, value);
    } else if ((resolved.kind === 'string') && (resolved.length != null)) {
      code = scalar(fixedLength(value, resolved.length));
    } else {
      code = scalar(value);
    }

    return code;
  }


  private arrayOf(type: { low: number }, items: string): string {
    let code: string;

    if (type.low < 0) {
      throw new Error(`emit: array with negative lower bound ${ type.low }`);
    } else if (type.low === 0) {
      code = items;
    } else if (type.low === 1) {
      code = `oneBased(${ items })`;
    } else {
      code = `fromLowerBound(${ type.low }, ${ items })`;
    }

    return code;
  }


  private set(of: 'number' | 'char', value: PascalValue): string {
    if (value.kind !== 'set') {
      throw new Error(`emit: expected a set, found ${ value.kind }`);
    }

    const members: string[] = value.items.map((item: PascalValue | [ PascalValue, PascalValue ]): string => {
      return Array.isArray(item) ? `[ ${ scalar(item[0]) }, ${ scalar(item[1]) } ]` : scalar(item);
    });

    return `${ of === 'char' ? 'charSet' : 'pascalSet' }(${ members.join(', ') })`;
  }

}


function tupleItems(value: PascalValue): PascalValue[] {
  let items: PascalValue[];

  if (value.kind === 'tuple') {
    items = value.items;
  } else if (value.kind === 'repeat') {
    items = [ value ];
  } else {
    throw new Error(`emit: expected a tuple, found ${ value.kind }`);
  }

  return items;
}


function expand(items: readonly PascalValue[]): PascalValue[] {
  return items.flatMap((item: PascalValue): PascalValue[] => {
    return item.kind === 'repeat' ? Array.from({ length: item.count }, (): PascalValue => item.item) : [ item ];
  });
}


/** A char or packed array of char: blank-padded to its length, and never longer. */
function fixedLength(value: PascalValue, length: number): PascalValue {
  if (value.kind !== 'string') {
    throw new Error(`emit: expected a string, found ${ value.kind }`);
  } else if (value.text.length > length) {
    throw new Error(`emit: '${ value.text }' is longer than ${ length }`);
  }

  return { kind: 'string', text: value.text.padEnd(length, ' ') };
}


function quote(text: string): string {
  return `'${ text.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\0/g, '\\0') }'`;
}


function scalar(value: PascalValue): string {
  let code: string;

  if (value.kind === 'string') {
    code = quote(value.text);
  } else if (value.kind === 'boolean') {
    code = String(value.value);
  } else if ((value.kind === 'number') && value.real) {
    code = `real(${ value.value })`;
  } else if (value.kind === 'number') {
    code = String(value.value);
  } else {
    throw new Error(`emit: expected a scalar, found ${ value.kind }`);
  }

  return code;
}


export function generate(upstream: string): string {
  const include: (name: string) => string = (name: string): string => readFileSync(path.join(upstream, 'source', 'include', name), 'latin1');
  const constants: IConstants = readConstants(include('constants.inc'));
  const types: Map<string, PascalType> = readTypes(include('types.inc'), constants);
  const variables: IField[] = readVariables(include('variables.inc'), constants)
    .filter((field: IField): boolean => !NOT_GLOBALS.has(field.name));
  const values: Map<string, PascalValue> = readValues(include('values.inc'), constants);
  const emitter: Emitter = new Emitter(types);
  const declared: Set<string> = new Set<string>(variables.map((field: IField): string => field.name));
  const orphans: string[] = [ ...values.keys() ].filter((name: string): boolean => !declared.has(name));

  if (orphans.length > 0) {
    throw new Error(`generate: values.inc sets undeclared ${ orphans.join(', ') }`);
  }

  const body: string[] = [
    'export interface IGlobals {',
    ...variables.map((field: IField): string => `  ${ field.name }: ${ emitter.typeName(field.type) };`),
    '}',
    '',
    '',
    '/** Every global as the image started it. */',
    'export function newglobals(): IGlobals {',
    '  return {',
    ...variables.map((field: IField): string => {
      const value: PascalValue | undefined = values.get(field.name);
      const code: string = value != null ? emitter.value(field.type, value, '    ') : emitter.zero(field.type, '    ');

      return `    ${ field.name }: ${ code },`;
    }),
    '  };',
    '}',
  ];
  const usedTypes: string[] = [ ...EXPORTED_TYPES ]
    .filter((name: string): boolean => body.some((line: string): boolean => new RegExp(`:\\s*${ name }\\b|\\): ${ name }\\b`).test(line)))
    .sort((one: string, other: string): number => one.localeCompare(other));

  const lines: string[] = [
    '// GENERATED by tools/convert-values.ts from source/include/variables.inc and',
    '// values.inc. Do not edit by hand; change the converter and run it again.',
    '//',
    '// Every global the game declared, with the value values.inc gave it, or the zeroes',
    '// uninitialised static storage held. Globals live on one object, g, because a module cannot',
    '// rebind a name another module imported.',
    '',
    'import { charSet, fromLowerBound, oneBased, pascalSet, real } from \'../runtime/pascal\';',
    `import type { ${ usedTypes.join(', ') } } from './types';`,
    '',
    ...body,
    '',
    '',
    'export const g: IGlobals = newglobals();',
    '',
    '',
    '/** Starts the globals over, in place, since other modules hold g itself. */',
    'export function resetglobals(): void {',
    '  Object.assign(g, newglobals());',
    '}',
    '',
  ];

  return lines.join('\n');
}


if (process.argv[1] != null && process.argv[1].endsWith('convert-values.ts')) {
  const upstream: string | undefined = process.argv[2];

  if (upstream != null) {
    const target: string = path.resolve('src', 'app', 'port', 'variables.ts');

    writeFileSync(target, generate(upstream));
    console.log(`wrote ${ target }`);
  } else {
    console.error('usage: npm run convert-values -- <path to vms-moria>');
    process.exitCode = 1;
  }
}
