import { Random } from './random';

// values.inc wdata: the seed, then the password's twelve characters XORed with randint(255).
const WDATA: readonly (readonly number[])[] = [
  [ 11065, 87, 36, 139, 197, 12, 22, 228, 250, 54, 148, 136, 163 ],
  [ 122565, 181, 170, 214, 182, 212, 8, 195, 173, 86, 76, 252, 124 ],
];

// misc.inc bpswd, which is the only check against the original there is: the passwords only
// come out as words if every step of the generator matches the MACRO.
function password(row: readonly number[]): string {
  const random: Random = new Random(row[0]);
  let text: string = '';

  for (let character: number = 1; character <= 12; character++) {
    text += String.fromCharCode(row[character] ^ random.randint(255));
  }

  return text;
}

describe('Random', () => {
  it('rebuilds the wizard password from wdata', () => {
    expect(password(WDATA[0])).toBe('@SHADOW@    ');
  });

  it('rebuilds the god password from wdata', () => {
    expect(password(WDATA[1])).toBe('@Grylion@   ');
  });

  it('advances the seed by the masked 32-bit product', () => {
    const random: Random = new Random(123456789);

    random.randint(10);

    expect(random.seed).toBe(((123456789 * 16807) % 2 ** 32) & 0x7FFFFFFF);
  });

  it('returns 1 for randint(0)', () => {
    expect(new Random(12345).randint(0)).toBe(1);
  });

  it('keeps randint(9999999) exact past 2^53', () => {
    const random: Random = new Random(0x7FFFFFFF);
    const expected: number = Number((BigInt(((Math.imul(0x7FFFFFFF, 16807) & 0x7FFFFFFF) >>> 0) - 1) * 9999999n) / 2147483647n) + 1;

    expect(random.randint(9999999)).toBe(expected);
  });

  it('stays within 1..x', () => {
    const random: Random = new Random(99);
    const rolls: number[] = Array.from({ length: 1000 }, (): number => random.randint(6));

    expect(rolls.every((roll: number): boolean => (roll >= 1) && (roll <= 6))).toBe(true);
  });

  it('rolls rand_rep as the sum of the same randint draws', () => {
    const one: Random = new Random(4242);
    const other: Random = new Random(4242);
    const summed: number = other.randint(8) + other.randint(8) + other.randint(8);

    expect(one.rand_rep(3, 8)).toBe(summed);
  });

  it('returns 0 from rand_rep for no dice', () => {
    expect(new Random(1).rand_rep(0, 8)).toBe(0);
  });

  it('leaves the seed alone when rand_rep rolls no dice', () => {
    const random: Random = new Random(77);

    random.rand_rep(-1, 8);

    expect(random.seed).toBe(77);
  });
});
