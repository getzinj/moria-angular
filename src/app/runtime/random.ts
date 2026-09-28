// source/macro/randint.mar and randrep.mar: Moria's random number generator.
//
//   mull2  #16807,seed          seed := seed * 16807, wrapping at 32 bits
//   bicl2  #^X80000000,seed     and dropping the top bit
//   subl3  #1,seed,r0
//   emul   r0,4(ap),#0,r0       (seed - 1) * x as a 64-bit product
//   ediv   #2147483647,r0,r0,r1 divided by 2^31 - 1, truncated toward zero
//   addl2  #1,r0                plus one
//
// It is not Park-Miller: it masks rather than reduces modulo 2^31 - 1. The product outgrows a
// double's 53 bits once x passes about four million (randnor asks for randint(9999999)), so it
// is taken in BigInt.
//
// The seed is a Pascal global the game assigns directly (bpswd, magic_init, town_gen, the save
// code), so it is a public field here rather than something hidden behind the generator.

const MULTIPLIER: number = 16807;
const TOP_BIT_CLEAR: number = 0x7FFFFFFF;
const DIVISOR: bigint = 2147483647n;


export class Random {

  constructor(public seed: number = 1) {
  }


  /** 1 <= result <= x for x >= 1; randint(0) is 1, as the MACRO gives. */
  public randint(x: number): number {
    this.step();

    return this.draw(x) + 1;
  }


  /** The sum of `num` rolls of randint(die); 0 when num <= 0. What damroll's NdS goes through. */
  public rand_rep(num: number, die: number): number {
    let sum: number = 0;

    if (num > 0) {
      for (let roll: number = 0; roll < num; roll++) {
        this.step();
        sum += this.draw(die);
      }

      sum += num;
    }

    return sum;
  }


  private step(): void {
    this.seed = (Math.imul(this.seed >>> 0, MULTIPLIER) & TOP_BIT_CLEAR) >>> 0;
  }


  private draw(x: number): number {
    return Number((BigInt(this.seed - 1) * BigInt(Math.trunc(x))) / DIVISOR);
  }

}
