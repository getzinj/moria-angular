import { boot, play, screen, screenAfter, waitAtPrompt } from './port-fixture';
import type { IHelpTopic } from './vms-help';
import { matching, vms_help } from './vms-help';

const RETURN: string = '\r';
const CTRL_Z: string = '\x1A';

const LIBRARY: readonly IHelpTopic[] = [
  { name: 'ALPHA', lines: [ 'Alpha text.' ], subtopics: [ { name: 'Sub', lines: [ 'Sub text.' ], subtopics: [] } ] },
  { name: 'ALPINE', lines: [ 'Alpine text.' ], subtopics: [] },
  { name: 'BETA', lines: Array.from({ length: 30 }, (_value: unknown, at: number): string => `Beta line ${ at + 1 }.`), subtopics: [] },
  { name: 'FULL', lines: Array.from({ length: 19 }, (_value: unknown, at: number): string => `Full line ${ at + 1 }.`), subtopics: [] },
];

function names(topics: readonly IHelpTopic[]): string[] {
  return topics.map((topic: IHelpTopic): string => topic.name);
}

async function shownAtPrompt(keywords: string): Promise<string> {
  await waitAtPrompt((): Promise<void> => vms_help(keywords, LIBRARY));

  return screen().toString();
}

describe('vms-help', () => {
  beforeEach((): void => {
    boot();
  });

  describe('matching', () => {
    it('prefers an exact name over the topics it abbreviates', () => {
      expect(names(matching(LIBRARY, 'alpha'))).toEqual([ 'ALPHA' ]);
    });

    it('takes an abbreviation as every topic it begins', () => {
      expect(names(matching(LIBRARY, 'AL'))).toEqual([ 'ALPHA', 'ALPINE' ]);
    });

    it('finds nothing for a keyword no topic begins with', () => {
      expect(matching(LIBRARY, 'ZETA')).toEqual([]);
    });

    it('takes * as any run of characters', () => {
      expect(names(matching(LIBRARY, 'A*E'))).toEqual([ 'ALPINE' ]);
    });

    it('takes % as any one character', () => {
      expect(names(matching(LIBRARY, '%ETA'))).toEqual([ 'BETA' ]);
    });

    it('matches a wildcard against the whole name, not a prefix', () => {
      expect(matching(LIBRARY, 'AL%')).toEqual([]);
    });
  });

  describe('vms_help', () => {
    it('leaves the caller\'s banner on row 1', async () => {
      screen().putString(1, 1, 'Banner');
      await shownAtPrompt('');

      expect(screen().row(1).trimEnd()).toBe('Banner');
    });

    it('lists the topics when given no keyword', async () => {
      expect(await shownAtPrompt('')).toContain('Information available:');
    });

    it('prompts for a topic at the top level', async () => {
      expect(await shownAtPrompt('')).toContain('Topic?');
    });

    it('shows a topic\'s text', async () => {
      expect(await shownAtPrompt('BETA')).toContain('Beta line 1.');
    });

    it('lists a topic\'s subtopics after its text', async () => {
      expect(await shownAtPrompt('ALPHA')).toContain('Additional information available:');
    });

    it('asks for a subtopic of a topic that has them', async () => {
      expect(await shownAtPrompt('ALPHA')).toContain('ALPHA Subtopic?');
    });

    it('shows only the last topic of a keyword path', async () => {
      expect(await shownAtPrompt('ALPHA SUB')).not.toContain('Alpha text.');
    });

    it('shows the subtopic a keyword path names', async () => {
      expect(await shownAtPrompt('ALPHA SUB')).toContain('Sub text.');
    });

    it('shows every topic an ambiguous keyword matches', async () => {
      expect(await shownAtPrompt('AL')).toContain('Alpine text.');
    });

    it('says when there is no such topic', async () => {
      expect(await shownAtPrompt('ZETA')).toContain('Sorry, no documentation on ZETA');
    });

    it('pauses when a topic fills the screen', async () => {
      expect(await shownAtPrompt('BETA')).toContain('Press RETURN to continue ...');
    });

    it('shows the rest of a long topic after the pause', async () => {
      expect(await screenAfter((): Promise<void> => vms_help('BETA', LIBRARY), RETURN)).toContain('Beta line 30.');
    });

    it('goes up a level on RETURN at a subtopic prompt', async () => {
      expect(await screenAfter((): Promise<void> => vms_help('ALPHA', LIBRARY), RETURN)).toContain('Topic?');
    });

    it('relists the topics on ? at a prompt', async () => {
      expect(await screenAfter((): Promise<void> => vms_help('BETA', LIBRARY), `${ RETURN }?${ RETURN }`)).toContain('Information available:');
    });

    it('leaves on RETURN at the top-level prompt', async () => {
      await expect(play((): Promise<void> => vms_help('', LIBRARY), RETURN)).resolves.toBeUndefined();
    });

    it('leaves on Ctrl-Z at a subtopic prompt', async () => {
      await expect(play((): Promise<void> => vms_help('ALPHA', LIBRARY), CTRL_Z)).resolves.toBeUndefined();
    });

    it('puts the prompt at the top of a new page when the last one filled', async () => {
      await screenAfter((): Promise<void> => vms_help('FULL', LIBRARY), RETURN);

      expect(screen().row(2).trimEnd()).toBe('Topic?');
    });

    it('leaves on Ctrl-Z at the pause before a prompt', async () => {
      await expect(play((): Promise<void> => vms_help('FULL', LIBRARY), CTRL_Z)).resolves.toBeUndefined();
    });

    it('leaves on Ctrl-Z at a page pause', async () => {
      await expect(play((): Promise<void> => vms_help('BETA', LIBRARY), CTRL_Z)).resolves.toBeUndefined();
    });
  });
});
