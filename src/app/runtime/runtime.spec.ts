import { InstantClock } from './clock';
import { MemoryFileStore } from './files';
import { Keyboard } from './keyboard';
import { Random } from './random';
import type { IRuntime } from './runtime';
import { rt, setRuntime } from './runtime';
import { ScreenGrid } from './screen-grid';
import { Terminal } from './terminal';

describe('runtime', () => {
  beforeEach((): void => {
    setRuntime(null);
  });

  afterEach((): void => {
    setRuntime(null);
  });

  it('refuses to be used before it is set', () => {
    expect((): IRuntime => rt()).toThrow('no Moria runtime');
  });

  it('hands back the runtime that was set', () => {
    const runtime: IRuntime = {
      random: new Random(1),
      terminal: new Terminal(new ScreenGrid(), new Keyboard()),
      clock: new InstantClock(),
      files: new MemoryFileStore(),
      username: 'PLAYER      ',
      download: (): void => undefined,
    };

    setRuntime(runtime);

    expect(rt()).toBe(runtime);
  });
});
