// Time, as the game asked VMS for it: SYS$GETTIM for the seed, DATE and TIME for the tombstone,
// and $SETIMR/$WAITFR for its few pauses.

/** Milliseconds from the VMS epoch, 17-Nov-1858, to the Unix one. */
const VMS_EPOCH_OFFSET_MS: bigint = 3506716800000n;
const TICKS_PER_MS: bigint = 10000n;

const MONTHS: readonly string[] = [ 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC' ];


export interface IClock {
  now(): Date;
  sleep(seconds: number): Promise<void>;
}


export class RealClock implements IClock {

  public now(): Date {
    return new Date();
  }


  public sleep(seconds: number): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, seconds * 1000);
    });
  }

}


/** A clock for tests: time stands still unless moved, and sleeps return at once but are recorded. */
export class InstantClock implements IClock {
  public readonly requested: number[] = [];

  constructor(private current: Date = new Date(Date.UTC(1986, 7, 15, 12, 0, 0))) {
  }


  public now(): Date {
    return new Date(this.current.getTime());
  }


  public sleep(seconds: number): Promise<void> {
    this.requested.push(seconds);
    this.current = new Date(this.current.getTime() + (seconds * 1000));

    return Promise.resolve();
  }

}


/** SYS$GETTIM: 100-nanosecond ticks since 17-Nov-1858. */
export function vmsTime(date: Date): bigint {
  return (BigInt(date.getTime()) + VMS_EPOCH_OFFSET_MS) * TICKS_PER_MS;
}


/** misc.inc get_seed: the two longwords of the system time ORed together, forced odd. */
export function get_seed(date: Date): number {
  const time: bigint = vmsTime(date);
  const low: number = Number(time & 0xFFFFFFFFn);
  const high: number = Number((time >> 32n) & 0xFFFFFFFFn);

  return (low | high | 1) >>> 0;
}


/** VAX Pascal DATE: 'dd-MMM-yyyy', day blank-padded. */
export function vmsDate(date: Date): string {
  return `${ String(date.getDate()).padStart(2, ' ') }-${ MONTHS[date.getMonth()] }-${ date.getFullYear() }`;
}


/** VAX Pascal TIME: 'hh:mm:ss.cc'. */
export function vmsTimeOfDay(date: Date): string {
  const two: (value: number) => string = (value: number): string => String(value).padStart(2, '0');

  return `${ two(date.getHours()) }:${ two(date.getMinutes()) }:${ two(date.getSeconds()) }.${ two(Math.floor(date.getMilliseconds() / 10)) }`;
}
