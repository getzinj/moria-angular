// The VMS HELP utility, as `HELP/PAGE/NOLIBLIST/LIBRARY=MORIAHLP` ran it over Moria's help library.
// Topics match on any unambiguous abbreviation; RETURN at a prompt goes up a level, and Ctrl-Z
// (or ESC, ^C, ^Y) leaves HELP altogether.

import { HELP_LIBRARY } from './help-library.data';
import { clear, get_string, inkey, prt, put_buffer } from './io';
import type { IRef } from '../runtime/pascal';
import { box } from '../runtime/pascal';

export interface IHelpTopic {
  name: string;
  lines: string[];
  subtopics: IHelpTopic[];
}

const PAGE_ROWS: number = 23;
const COLUMN_WIDTH: number = 16;


/** Writes lines down the screen, pausing with "Press RETURN to continue" when it is full. */
class Pager {
  private stopped: boolean = false;


  constructor(private row: number = 1) {
  }


  public get quit(): boolean {
    return this.stopped;
  }


  public async line(text: string): Promise<void> {
    if (!this.stopped) {
      if (this.row > PAGE_ROWS) {
        const key: IRef<string> = box('');

        prt('Press RETURN to continue ...', 24, 1);
        await inkey(key);
        this.stopped = key.get() === '\x1A';
        clear(1, 1);
        this.row = 1;
      }

      if (!this.stopped) {
        put_buffer(text, this.row, 1);
        this.row++;
      }
    }
  }


  /** Where the next prompt goes. */
  public get next_row(): number {
    return Math.min(this.row, 24);
  }

}


/** The topics a keyword names: with `*` or `%` wildcards, every name it fits; else an exact match, else every topic it abbreviates. */
export function matching(topics: readonly IHelpTopic[], keyword: string): IHelpTopic[] {
  const wanted: string = keyword.toUpperCase();
  let found: IHelpTopic[];

  if (/[*%]/.test(wanted)) {
    const pattern: RegExp = new RegExp(`^${ wanted.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.') }$`);

    found = topics.filter((topic: IHelpTopic): boolean => pattern.test(topic.name.toUpperCase()));
  } else {
    const exact: IHelpTopic[] = topics.filter((topic: IHelpTopic): boolean => topic.name.toUpperCase() === wanted);

    found = exact.length > 0 ? exact : topics.filter((topic: IHelpTopic): boolean => topic.name.toUpperCase().startsWith(wanted));
  }

  return found;
}


async function show_list(pager: Pager, heading: string, topics: readonly IHelpTopic[]): Promise<void> {
  let row: string = '  ';

  await pager.line('');
  await pager.line(heading);
  await pager.line('');

  for (const topic of topics) {
    if ((row.length + COLUMN_WIDTH) > 78) {
      await pager.line(row);
      row = '  ';
    }

    row += topic.name.padEnd(COLUMN_WIDTH, ' ');
  }

  if (row.trim() !== '') {
    await pager.line(row);
  }
}


async function show_topic(pager: Pager, topic: IHelpTopic, path: string): Promise<void> {
  await pager.line('');
  await pager.line(path);
  await pager.line('');

  for (const line of topic.lines) {
    await pager.line(line);
  }

  if (topic.subtopics.length > 0) {
    await show_list(pager, '  Additional information available:', topic.subtopics);
  }
}


/** The answer to a prompt under a blank line, or null when the player left at a pause or the prompt. */
async function prompt(pager: Pager, question: string): Promise<string | null> {
  const answer: IRef<string> = box('');
  let result: string | null = null;

  await pager.line('');

  if (!pager.quit) {
    const row: number = pager.next_row;

    prt(question, row, 1);

    if (await get_string(answer, row, question.length + 1, 78 - question.length)) {
      result = answer.get().trim();
    }
  }

  return result;
}


/**
 * HELP with a starting keyword path (empty for the list of topics), below the caller's banner on
 * row 1. Returns when the player leaves; the caller redraws its own screen.
 */
export async function vms_help(keywords: string, library: readonly IHelpTopic[] = HELP_LIBRARY): Promise<void> {
  const stack: { topic: IHelpTopic; path: string }[] = [];
  let pending: string[] = keywords.split(/\s+/).filter((word: string): boolean => word !== '');
  let done: boolean = false;

  clear(2, 1);

  let pager: Pager = new Pager(2);

  if (pending.length === 0) {
    await show_list(pager, '  Information available:', library);
  }

  while (!done && !pager.quit) {
    if (pending.length > 0) {
      const level: readonly IHelpTopic[] = stack.length > 0 ? stack[stack.length - 1].topic.subtopics : library;
      const word: string = pending[0];
      const found: IHelpTopic[] = matching(level, word);
      const path: string = stack.length > 0 ? `${ stack[stack.length - 1].path } ` : '';

      pending = pending.slice(1);

      if (found.length === 0) {
        await pager.line('');
        await pager.line(`  Sorry, no documentation on ${ path }${ word.toUpperCase() }`);
        pending = [];
      } else if ((found.length === 1) && (found[0].subtopics.length > 0)) {
        if (pending.length === 0) {
          await show_topic(pager, found[0], `${ path }${ found[0].name }`);
        }

        stack.push({ topic: found[0], path: `${ path }${ found[0].name }` });
      } else {
        for (const topic of found) {
          await show_topic(pager, topic, `${ path }${ topic.name }`);
        }

        pending = [];
      }
    } else {
      const question: string = stack.length > 0 ? `${ stack[stack.length - 1].path } Subtopic? ` : 'Topic? ';
      const answer: string | null = await prompt(pager, question);

      clear(1, 1);
      pager = new Pager();

      if (answer == null) {
        done = true;
      } else if (answer === '') {
        if (stack.length > 0) {
          stack.pop();
          await show_list(pager, stack.length > 0 ? '  Additional information available:' : '  Information available:',
                          stack.length > 0 ? stack[stack.length - 1].topic.subtopics : library);
        } else {
          done = true;
        }
      } else if (answer === '?') {
        await show_list(pager, stack.length > 0 ? '  Additional information available:' : '  Information available:',
                        stack.length > 0 ? stack[stack.length - 1].topic.subtopics : library);
      } else {
        pending = answer.split(/\s+/);
      }
    }
  }
}
