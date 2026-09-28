import { MoriaExit } from './exit';

describe('MoriaExit', () => {
  it('carries the reason the game ended', () => {
    expect(new MoriaExit('saved').reason).toBe('saved');
  });

  it('is an Error, so an unexpected one still reports properly', () => {
    expect(new MoriaExit()).toBeInstanceOf(Error);
  });
});
