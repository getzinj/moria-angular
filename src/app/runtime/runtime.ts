// The machine the port runs on. Ported code reaches it through rt(), since the original reached
// the same things through globals and system calls rather than parameters.

import type { IClock } from './clock';
import type { IFileStore } from './files';
import type { Random } from './random';
import type { Terminal } from './terminal';

export interface IRuntime {
  readonly random: Random;
  readonly terminal: Terminal;
  readonly clock: IClock;
  readonly files: IFileStore;
  readonly username: string;
  /** Hands a printed file (a map, a character sheet) to the player; VMS wrote it to their directory. */
  readonly download: (name: string, contents: string) => void;
}

let current: IRuntime | null = null;


export function setRuntime(runtime: IRuntime | null): void {
  current = runtime;
}


export function rt(): IRuntime {
  if (current == null) {
    throw new Error('rt(): no Moria runtime has been set');
  }

  return current;
}
