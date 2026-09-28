// Runs the game on a runtime. When the image exits, as VMS would have returned to DCL, the player is
// offered another game.

import { main } from '../port/main';
import { resetglobals } from '../port/variables';
import { MoriaExit } from '../runtime/exit';
import type { IRuntime } from '../runtime/runtime';
import { setRuntime } from '../runtime/runtime';

export const RESTART_PROMPT: string = 'Moria has exited.  Press any key to play again.';


/** The DCL qualifiers a page URL carries, e.g. `?MORIACHR.SAV/WIZARD`; a bad escape is taken as typed. */
export function commandLineOf(search: string): string {
  const raw: string = search.replace(/^\?/, '');
  let command_line: string;

  try {
    command_line = decodeURIComponent(raw);
  } catch {
    command_line = raw;
  }

  return command_line;
}


/** One game, from startup to its exit, then the restart prompt. */
export async function playOnce(runtime: IRuntime, command_line: string): Promise<void> {
  resetglobals();
  setRuntime(runtime);

  try {
    await main(command_line);
  } catch (error: unknown) {
    if (!(error instanceof MoriaExit)) {
      throw error;
    }
  }

  runtime.terminal.erase_to_end_of_line(24, 1);
  runtime.terminal.put_buffer(RESTART_PROMPT, 24, 1);
  runtime.terminal.put_qio();
  runtime.terminal.flush_input();
  await runtime.terminal.read_key();
}


/** Games one after another; only the first takes the page's command line. */
export async function playForever(runtime: IRuntime, command_line: string): Promise<never> {
  let next: string = command_line;

  for (;;) {
    await playOnce(runtime, next);
    next = '';
  }
}
