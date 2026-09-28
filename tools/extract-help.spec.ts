import { blockHeaders, generate, records, repair, topics } from './extract-help';

const LINE: string = 'A line of help text, long enough that a block splits one or two.';
const TEXT: readonly string[] = [
  '1 ALPHA',
  ...Array.from({ length: 30 }, (): string => LINE),
  '2 Sub',
  'Sub text.',
];
const HEADER_EVERY: number = 495;
const FIRST_HEADER: number = 700;
const FIRST_BLOCK: number = 0x50;

/** A library as upstream has it: records after a 512-byte header, with a two-byte block header cut in every ~495 bytes. */
function damaged(): { data: Uint8Array; headers: number[] } {
  const clean: number[] = [ ...new Array<number>(512).fill(0) ];
  const data: number[] = [];
  const headers: number[] = [];

  for (const record of TEXT) {
    clean.push(record.length, ...[ ...record ].map((character: string): number => character.charCodeAt(0)));
  }

  clean.forEach((byte: number, at: number): void => {
    if ((at >= FIRST_HEADER) && ((at - FIRST_HEADER) % HEADER_EVERY === 0)) {
      data.push(0x01, FIRST_BLOCK + headers.length);
      headers.push(data.length - 1);
    }

    data.push(byte);
  });

  return { data: Uint8Array.from(data), headers };
}

describe('extract-help', () => {
  describe('blockHeaders', () => {
    it('finds every block header by its rising sequence number', () => {
      const { data, headers } = damaged();

      expect(blockHeaders(data)).toEqual(headers);
    });
  });

  describe('records', () => {
    it('joins the records a block header split', () => {
      expect(records(damaged().data).filter((record: string | null): boolean => record === LINE)).toHaveLength(30);
    });
  });

  describe('topics', () => {
    it('builds the topic tree from the level numbers', () => {
      expect(topics(records(damaged().data))[0].subtopics[0].name).toBe('Sub');
    });

    it('keeps a topic\'s text', () => {
      expect(topics(records(damaged().data))[0].subtopics[0].lines).toEqual([ 'Sub text.' ]);
    });

    it('stops at a second copy of a top-level topic', () => {
      expect(topics([ '1 ALPHA', 'first', '1 BETA', '1 ALPHA', 'stale' ]).map((topic: { name: string }): string => topic.name))
        .toEqual([ 'ALPHA', 'BETA' ]);
    });
  });

  describe('repair', () => {
    it('rebuilds a damaged armour table from values.inc', () => {
      const shields: { name: string; lines: string[]; subtopics: [] } = { name: 'Shields', lines: [ 'garbage' ], subtopics: [] };

      repair(shields);

      expect(shields.lines[3]).toBe('|Small Leather Shield       |  )   |  30 |  50 |  0   |  0   |  2 |   1d1  |');
    });
  });

  describe('repair of the missile table', () => {
    it('drops the broken rows after Iron Shot for the rebuilt ones', () => {
      const missle: { name: string; lines: string[]; subtopics: [] } = {
        name: 'Missle',
        lines: [ '+---+', '|Iron Shot  |', '    |  1d4   ce  |', '--+--' ],
        subtopics: [],
      };

      repair(missle);

      expect(missle.lines.slice(2, 4)).toEqual([
        '|Arrow                        |  1d4   |  pierce           |  0.2 lbs |',
        '|Bolt                         |  1d5   |  pierce           |  0.3 lbs |',
      ]);
    });
  });

  describe('generate', () => {
    it('marks its output as generated', () => {
      expect(generate(damaged().data).split('\n')[0]).toContain('GENERATED');
    });
  });
});
