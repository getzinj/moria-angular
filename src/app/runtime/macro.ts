// The rest of source/macro/: small routines Koeneke wrote in VAX MACRO for speed.


/** distance.mar: (2 * max(dy, dx) + min(dy, dx)) / 2, an integer stand-in for true distance. */
export function distance(y1: number, x1: number, y2: number, x2: number): number {
  const dy: number = Math.abs(y2 - y1);
  const dx: number = Math.abs(x2 - x1);
  let doubled: number;

  if (dy < dx) {
    doubled = dy + (2 * dx);
  } else {
    doubled = (2 * dy) + dx;
  }

  return doubled >> 1;
}


export interface IBitPosResult {
  /** 1-based position of the lowest set bit, or 0 when none was set. */
  readonly position: number;
  /** The flags with that bit cleared, which the MACRO did in place through its var parameter. */
  readonly remaining: number;
}


/** bitpos.mar: finds the lowest set bit, clears it, and returns its position plus one. */
export function bit_pos(flags: number): IBitPosResult {
  const value: number = flags >>> 0;
  let result: IBitPosResult;

  if (value === 0) {
    result = { position: 0, remaining: 0 };
  } else {
    const bit: number = 31 - Math.clz32(value & -value);

    result = { position: bit + 1, remaining: (value & ~(1 << bit)) >>> 0 };
  }

  return result;
}


/** insert.mar: replaces the first occurrence of `match`; returns the source unchanged if absent. */
export function insert_str(source: string, match: string, replacement: string): string {
  const at: number = source.indexOf(match);
  let result: string;

  if (at >= 0) {
    result = source.substring(0, at) + replacement + source.substring(at + match.length);
  } else {
    result = source;
  }

  return result;
}


/** maxmin.mar: MAX(MIN(x, y) - 1, z). */
export function maxmin(x: number, y: number, z: number): number {
  return Math.max(Math.min(x, y) - 1, z);
}


/** minmax.mar: MIN(MAX(x, y) + 1, z). */
export function minmax(x: number, y: number, z: number): number {
  return Math.min(Math.max(x, y) + 1, z);
}
