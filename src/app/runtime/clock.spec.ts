import { InstantClock, get_seed, vmsDate, vmsTime, vmsTimeOfDay } from './clock';

describe('clock', () => {
  it('counts VMS time from 17-Nov-1858', () => {
    expect(vmsTime(new Date(Date.UTC(1858, 10, 17)))).toBe(0n);
  });

  it('counts in 100-nanosecond ticks', () => {
    expect(vmsTime(new Date(Date.UTC(1858, 10, 17, 0, 0, 1)))).toBe(10000000n);
  });

  it('makes an odd seed', () => {
    expect(get_seed(new Date(Date.UTC(2026, 8, 27))) % 2).toBe(1);
  });

  it('makes an unsigned seed', () => {
    expect(get_seed(new Date(Date.UTC(2026, 8, 27)))).toBeGreaterThan(0);
  });

  it('formats DATE as dd-MMM-yyyy', () => {
    expect(vmsDate(new Date(1986, 7, 5))).toBe(' 5-AUG-1986');
  });

  it('formats TIME as hh:mm:ss.cc', () => {
    expect(vmsTimeOfDay(new Date(1986, 7, 5, 9, 4, 3, 270))).toBe('09:04:03.27');
  });

  it('records the sleeps it is asked for', async () => {
    const clock: InstantClock = new InstantClock();

    await clock.sleep(2);

    expect(clock.requested).toEqual([ 2 ]);
  });

  it('moves its time on by the sleep', async () => {
    const clock: InstantClock = new InstantClock(new Date(Date.UTC(2000, 0, 1)));

    await clock.sleep(6);

    expect(clock.now().getTime()).toBe(Date.UTC(2000, 0, 1, 0, 0, 6));
  });
});
