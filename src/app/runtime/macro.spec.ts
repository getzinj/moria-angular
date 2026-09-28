import { bit_pos, distance, insert_str, maxmin, minmax } from './macro';

describe('distance', () => {
  it('is (2 * dy + dx) / 2 when dy is the larger', () => {
    expect(distance(1, 1, 7, 4)).toBe(7);
  });

  it('is (2 * dx + dy) / 2 when dx is the larger', () => {
    expect(distance(1, 1, 4, 11)).toBe(11);
  });

  it('truncates the halving', () => {
    expect(distance(0, 0, 1, 1)).toBe(1);
  });
});

describe('bit_pos', () => {
  it('returns 0 when no bit is set', () => {
    expect(bit_pos(0).position).toBe(0);
  });

  it('returns the lowest set bit, 1-based', () => {
    expect(bit_pos(0b10100).position).toBe(3);
  });

  it('clears the bit it found', () => {
    expect(bit_pos(0b10100).remaining).toBe(0b10000);
  });

  it('finds the top bit of an unsigned flag word', () => {
    expect(bit_pos(0x80000000).position).toBe(32);
  });

  it('clears the top bit to leave zero', () => {
    expect(bit_pos(0x80000000).remaining).toBe(0);
  });
});

describe('insert_str', () => {
  it('replaces the first occurrence only', () => {
    expect(insert_str('a %s and %s', '%s', 'b')).toBe('a b and %s');
  });

  it('leaves the string alone when there is no match', () => {
    expect(insert_str('moria', 'x', 'y')).toBe('moria');
  });
});

describe('maxmin and minmax', () => {
  it('maxmin is MAX(MIN(x, y) - 1, z)', () => {
    expect(maxmin(5, 3, 1)).toBe(2);
  });

  it('maxmin is floored at z', () => {
    expect(maxmin(5, 1, 1)).toBe(1);
  });

  it('minmax is MIN(MAX(x, y) + 1, z)', () => {
    expect(minmax(5, 3, 10)).toBe(6);
  });

  it('minmax is capped at z', () => {
    expect(minmax(5, 9, 10)).toBe(10);
  });
});
