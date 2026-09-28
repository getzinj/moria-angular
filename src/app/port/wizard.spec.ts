import { magic_init } from './desc';
import { file_character, print_map, print_monsters, print_objects } from './files';
import { tlink } from './misc';
import { COL, ROW, boot, downloads, lit_room, play, screen, screenAfter } from './port-fixture';
import { g } from './variables';
import { change_character, game_version, wizard_create, wizard_light } from './wizard';

describe('wizard', () => {
  beforeEach((): void => {
    boot();
    lit_room();
    magic_init(12345);
    g.py.misc.name = 'Bob';
  });

  describe('game_version', () => {
    it('heads the credits with the version', async () => {
      await screenAfter((): Promise<void> => game_version(), '');

      expect(screen().row(1).trimEnd()).toBe('               Moria Version 4.80');
    });

    it('credits the authors', async () => {
      await screenAfter((): Promise<void> => game_version(), '');

      expect(screen().row(17)).toContain('Robert Alan Koeneke');
    });
  });

  describe('wizard_light', () => {
    it('darkens a lit level', () => {
      wizard_light();

      expect(g.cave[ROW][COL].pl).toBe(false);
    });

    it('forgets what was mapped when it darkens', () => {
      g.cave[ROW][COL].fm = true;
      wizard_light();

      expect(g.cave[ROW][COL].fm).toBe(false);
    });

    it('lights a dark level', () => {
      g.cave[ROW][COL].pl = false;
      wizard_light();

      expect(g.cave[ROW + 1][COL + 1].pl).toBe(true);
    });
  });

  describe('change_character', () => {
    const KEEP_THE_REST: string = '\r'.repeat(14);

    it('sets strength', async () => {
      await play((): Promise<void> => change_character(), `18\r${ KEEP_THE_REST }`);

      expect(g.py.stat.str).toBe(18);
    });

    it('ignores strength out of range', async () => {
      g.py.stat.str = 10;
      await play((): Promise<void> => change_character(), `200\r${ KEEP_THE_REST }`);

      expect(g.py.stat.str).toBe(10);
    });

    it('sets the gold last', async () => {
      await play((): Promise<void> => change_character(), `${ '\r'.repeat(14) }500\r`);

      expect(g.py.misc.au).toBe(500);
    });
  });

  describe('wizard_create', () => {
    const OBJECT: string = ' Stick\r65\r1\r1\r1\r1d1\r\r\r\r\r5\r1\r100\ry';

    it('drops the object at the player\'s feet', async () => {
      await play((): Promise<void> => wizard_create(), OBJECT);

      expect(g.t_list[g.cave[ROW][COL].tptr].tval).toBe(65);
    });

    it('draws a wand as a wand', async () => {
      await play((): Promise<void> => wizard_create(), OBJECT);

      expect(g.t_list[g.cave[ROW][COL].tptr].tchar).toBe('-');
    });

    it('asks again for a tval it does not know', async () => {
      await play((): Promise<void> => wizard_create(), ' Stick\r3\r65\r1\r1\r1\r1d1\r\r\r\r\r5\r1\r100\ry');

      expect(g.t_list[g.cave[ROW][COL].tptr].tval).toBe(65);
    });

    it('drops nothing unless told to', async () => {
      await play((): Promise<void> => wizard_create(), OBJECT.replace(/y$/, 'n'));

      expect(g.cave[ROW][COL].tptr).toBe(0);
    });
  });
});

describe('files', () => {
  beforeEach((): void => {
    boot();
    lit_room();
    magic_init(12345);
    g.py.misc.name = 'Bob';
  });

  describe('print_map', () => {
    it('writes MORIAMAP.DAT by default', async () => {
      await play((): Promise<void> => print_map(), '\r');

      expect(downloads.has('MORIAMAP.DAT')).toBe(true);
    });

    it('heads each section', async () => {
      await play((): Promise<void> => print_map(), 'MAP.TXT\r');

      expect(downloads.get('MAP.TXT')).toContain('Section[1,1];     Depth : 0 (feet)');
    });

    it('draws the player', async () => {
      await play((): Promise<void> => print_map(), 'MAP.TXT\r');

      expect(downloads.get('MAP.TXT')?.split('\n').find((line: string): boolean => line.startsWith(' 10'))).toBe(` 10${ '#'.padEnd(29, '.') }@${ '.'.repeat(35) }#`);
    });

    it('writes nothing when escaped', async () => {
      await play((): Promise<void> => print_map(), '\x1b');

      expect(downloads.size).toBe(0);
    });
  });

  describe('print_monsters', () => {
    it('lists the first creature', async () => {
      await play((): Promise<void> => print_monsters(), '\r');

      expect(downloads.get('MORIAMON.DAT')).toContain(`  1  ${ g.c_list[1].name }`);
    });

    it('describes the attacks', async () => {
      await play((): Promise<void> => print_monsters(), '\r');

      expect(downloads.get('MORIAMON.DAT')).toContain('   --Creature attacks =');
    });
  });

  describe('print_objects', () => {
    beforeEach((): void => {
      tlink();
    });

    it('writes as many objects as asked for', async () => {
      await play((): Promise<void> => print_objects(), '5\r7\r\r');

      expect(downloads.get('MORIAOBJ.DAT')?.split('\n').filter((line: string): boolean => line !== '')).toHaveLength(10);
    });

    it('makes nothing for a level out of range', async () => {
      await play((): Promise<void> => print_objects(), '1201\r7\r');

      expect(downloads.size).toBe(0);
    });
  });

  describe('file_character', () => {
    it('names the character', async () => {
      await play((): Promise<void> => file_character(), '\r');

      expect(downloads.get('MORIACHR.DAT')).toContain('  Name  :Bob');
    });

    it('says when nothing is worn', async () => {
      await play((): Promise<void> => file_character(), '\r');

      expect(downloads.get('MORIACHR.DAT')).toContain('  Character has no equipment in use.');
    });
  });
});
