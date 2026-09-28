import { get_username } from './vms';

describe('get_username', () => {
  beforeEach((): void => {
    window.localStorage.clear();
  });

  it('defaults to PLAYER, padded to twelve', () => {
    expect(get_username(window.localStorage)).toBe('PLAYER      ');
  });

  it('uses a stored name in capitals', () => {
    window.localStorage.setItem('moria:username', 'koeneke');

    expect(get_username(window.localStorage)).toBe('KOENEKE     ');
  });

  it('cuts a long name to twelve characters', () => {
    window.localStorage.setItem('moria:username', 'abcdefghijklmnop');

    expect(get_username(window.localStorage)).toBe('ABCDEFGHIJKL');
  });

  it('falls back to PLAYER without storage', () => {
    expect(get_username(null)).toBe('PLAYER      ');
  });
});
