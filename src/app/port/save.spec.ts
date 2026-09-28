import { magic_init } from './desc';
import { place_gold, place_monster, tlink } from './misc';
import { COL, ROW, boot, lit_room, play, screen, screenAfter } from './port-fixture';
import { get_char, restore_char, save_char } from './save';
import { store_init } from './store1';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import { rt } from '../runtime/runtime';

interface ISaved {
  save: string;
  master: string;
}

function character(): void {
  boot();
  lit_room();
  magic_init(12345);
  store_init();
  g.moria_mas = 'MORIACHR.DAT';
  g.moria_top = 'MORIATOP.DAT';
  rt().files.write(g.moria_mas, '');
  g.py.misc.name = 'Bob';
  g.py.misc.prace = 1;
  g.py.misc.au = 1234;
  g.py.misc.mhp = 20;
  g.py.misc.chp = 12.46;
  g.turn = 0x123;
  g.inventory[1] = { ...g.blank_treasure, name: '& Flask~ of oil', tval: 77, number: 2 };
  g.inven_ctr = 1;
  g.cave[ROW][COL + 2].fm = true;
  place_gold(ROW + 1, COL);
  place_monster(ROW, COL + 3, 1, false);
}

async function saved(name: string = 'BOB.SAV'): Promise<ISaved> {
  await play((): Promise<boolean> => save_char(), `${ name }\r`).catch((): void => undefined);

  return { save: rt().files.read(name) ?? '', master: rt().files.read('MORIACHR.DAT') ?? '' };
}

// A fresh machine holding the save and MASTER, as the next session would find them.
function next_session(files: ISaved): void {
  boot();
  magic_init(12345);
  tlink();
  g.msg_line = 1;
  g.moria_mas = 'MORIACHR.DAT';
  g.moria_top = 'MORIATOP.DAT';
  rt().files.write('BOB.SAV', files.save);
  rt().files.write('MORIACHR.DAT', files.master);
}

async function restored(): Promise<void> {
  const files: ISaved = await saved();

  next_session(files);
  await play((): Promise<boolean> => get_char('BOB.SAV'), '');
}

describe('save', () => {
  beforeEach((): void => {
    character();
  });

  describe('save_char', () => {
    it('ends the game once saved', async () => {
      await expect(play((): Promise<boolean> => save_char(), 'BOB.SAV\r')).rejects.toBeInstanceOf(MoriaExit);
    });

    it('writes the save file', async () => {
      expect((await saved()).save).not.toBe('');
    });

    it('registers the save in MASTER', async () => {
      expect(JSON.parse((await saved()).master)).toHaveLength(1);
    });

    it('writes MORIACHR.SAV for an empty name', async () => {
      await saved('');

      expect(rt().files.read('MORIACHR.SAV')).not.toBeNull();
    });

    it('says it saved', async () => {
      await saved();

      expect(screen().row(1)).toContain('Character saved. [Moria Version  4.80]');
    });

    it('will not write over MASTER', async () => {
      await screenAfter((): Promise<boolean> => save_char(), 'MORIACHR.DAT\r');

      expect(screen().row(1).trimEnd()).toBe('Error creating> MORIACHR.DAT');
    });

    it('leaves MASTER a list when refused', async () => {
      await screenAfter((): Promise<boolean> => save_char(), 'MORIACHR.DAT\r');

      expect(rt().files.read('MORIACHR.DAT')).toBe('');
    });

    it('will not save with MASTER unreadable', async () => {
      rt().files.write('MORIACHR.DAT', 'not a list');
      await screenAfter((): Promise<boolean> => save_char(), 'BOB.SAV\r');

      expect(screen().row(1).trimEnd()).toBe('Error saving character, contact MORIA Wizard.');
    });

    it('carries on when the name is escaped', async () => {
      expect(await play((): Promise<boolean> => save_char(), '\x1b')).toBe(false);
    });
  });

  describe('get_char', () => {
    it('restores the name', async () => {
      await restored();

      expect(g.py.misc.name).toBe('Bob');
    });

    it('restores the gold', async () => {
      await restored();

      expect(g.py.misc.au).toBe(1234);
    });

    it('restores the pack', async () => {
      await restored();

      expect(g.inventory[1].number).toBe(2);
    });

    it('keeps one decimal of the hit points', async () => {
      await restored();

      expect(g.py.misc.chp).toBe(Math.fround(12.5));
    });

    it('keeps only the low four bits of the turn', async () => {
      await restored();

      expect(g.turn).toBe(3);
    });

    it('restores what the player has mapped', async () => {
      await restored();

      expect(g.cave[ROW][COL + 2].fm).toBe(true);
    });

    it('restores what lies on the floor', async () => {
      await restored();

      expect(g.t_list[g.cave[ROW + 1][COL].tptr].tval).toBe(100);
    });

    it('restores the monsters', async () => {
      await restored();

      expect(g.m_list[g.cave[ROW][COL + 3].cptr].mptr).toBe(1);
    });

    it('strikes the save off MASTER', async () => {
      await restored();

      expect(rt().files.read('MORIACHR.DAT')).toBe('[]');
    });

    it('deletes the save file', async () => {
      await restored();

      expect(rt().files.read('BOB.SAV')).toBeNull();
    });

    it('keeps the level', async () => {
      const files: ISaved = await saved();

      next_session(files);

      expect(await play((): Promise<boolean> => get_char('BOB.SAV'), '')).toBe(false);
    });

    it('will not restore the same save twice', async () => {
      const files: ISaved = await saved();

      next_session({ save: files.save, master: '[]' });
      await screenAfter((): Promise<boolean> => get_char('BOB.SAV'), '');

      expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
    });

    it('calls a file that is not a save corrupt', async () => {
      rt().files.write('NULL.SAV', 'null');
      await screenAfter((): Promise<boolean> => get_char('NULL.SAV'), '');

      expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
    });

    describe('a save that is not what the game wrote', () => {
      async function restore_changed(change: (record: Record<string, unknown>) => void): Promise<void> {
        const files: ISaved = await saved();
        const record: Record<string, unknown> = JSON.parse(files.save) as Record<string, unknown>;

        change(record);
        next_session({ save: JSON.stringify(record), master: files.master });
        await screenAfter((): Promise<boolean> => get_char('BOB.SAV'), '');
      }

      it.each([ 'spells', 'turn', 'cur_height', 'name', 'misc', 'stat', 'flags', 'floor', 'stores', 'version', 'identified' ])(
        'is corrupt without %s',
        async (key: string): Promise<void> => {
          await restore_changed((record: Record<string, unknown>): void => {
            delete record[key];
          });

          expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
        },
      );

      it.each([
        [ 'a position off the map', (record: Record<string, unknown>): void => {
          record['char_row'] = 500;
        } ],
        [ 'a race that does not exist', (record: Record<string, unknown>): void => {
          (record['misc'] as Record<string, unknown>)['prace'] = 99;
        } ],
        [ 'level 0', (record: Record<string, unknown>): void => {
          (record['misc'] as Record<string, unknown>)['lev'] = 0;
        } ],
        [ 'a depth below 0', (record: Record<string, unknown>): void => {
          record['dun_level'] = -1;
        } ],
      ])('is corrupt with %s', async (_: string, change: (record: Record<string, unknown>) => void): Promise<void> => {
        await restore_changed(change);

        expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
      });

      it('is corrupt with a stat that is not a number', async () => {
        await restore_changed((record: Record<string, unknown>): void => {
          (record['stat'] as Record<string, unknown>)['str'] = 'x';
        });

        expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
      });

      it('is corrupt with a store too many', async () => {
        await restore_changed((record: Record<string, unknown>): void => {
          (record['stores'] as unknown[]).push((record['stores'] as unknown[])[0]);
        });

        expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
      });

      it('is corrupt with a spell too many', async () => {
        await restore_changed((record: Record<string, unknown>): void => {
          (record['spells'] as unknown[]).push({ learned: false, sexp: 0 });
        });

        expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
      });

      it('is corrupt with a monster off the map', async () => {
        await restore_changed((record: Record<string, unknown>): void => {
          ((record['monsters'] as Record<string, unknown>[])[0])['fy'] = 999;
        });

        expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
      });

      it('keeps its id in MASTER', async () => {
        await restore_changed((record: Record<string, unknown>): void => {
          delete record['turn'];
        });

        expect(rt().files.read('MORIACHR.DAT')).not.toBe('[]');
      });

      it('ignores a key the game never writes', async () => {
        await restore_changed((record: Record<string, unknown>): void => {
          (record['misc'] as Record<string, unknown>)['bogus'] = 1;
        });

        expect('bogus' in g.py.misc).toBe(false);
      });
    });

    it('stops when MASTER is unreadable', async () => {
      const files: ISaved = await saved();

      next_session({ save: files.save, master: 'not a list' });
      await screenAfter((): Promise<boolean> => get_char('BOB.SAV'), '');

      expect(screen().row(1).trimEnd()).toBe('ERROR opening file MASTER.');
    });

    it('says so for a missing file', async () => {
      await screenAfter((): Promise<boolean> => get_char('NONE.SAV'), '');

      expect(screen().row(1).trimEnd()).toBe('Error Opening> NONE.SAV');
    });

    it('keeps a shop\'s opening turn as turns from the save, plus 15', async () => {
      g.store[2].store_open = g.turn + 100;
      await restored();

      expect(g.store[2].store_open).toBe(115);
    });
  });

  describe('restore_char', () => {
    it('calls a file that is not a save corrupt', async () => {
      rt().files.write('NULL.SAV', 'null');
      await screenAfter((): Promise<void> => restore_char(), 'NULL.SAV\r');

      expect(screen().row(1).trimEnd()).toBe('Data Corruption Error.');
    });

    it('makes a restored save restorable again', async () => {
      const files: ISaved = await saved();

      next_session({ save: files.save, master: '[]' });
      await play((): Promise<void> => restore_char(), 'BOB.SAV\r');

      expect(JSON.parse(rt().files.read('MORIACHR.DAT') ?? '[]')).toHaveLength(1);
    });

    it('will not register a save twice', async () => {
      const files: ISaved = await saved();

      next_session(files);
      await screenAfter((): Promise<void> => restore_char(), 'BOB.SAV\r');

      expect(screen().row(1).trimEnd()).toBe('Could not write ID in MASTER.');
    });

    it('says so for a missing file', async () => {
      await screenAfter((): Promise<void> => restore_char(), 'NONE.SAV\r');

      expect(screen().row(1).trimEnd()).toBe('Error Opening> NONE.SAV');
    });
  });
});
