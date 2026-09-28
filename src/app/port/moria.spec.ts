import { dl } from './dungeon-locals';
import { place_closed_door, place_monster, popt, place_down_stairs, place_gold, place_open_door, place_rubble, place_secret_door, place_stuck_door, place_trap } from './misc';
import {
  change_speed,
  chest_trap,
  dungeon,
  find_range,
  fire_dam,
  mon_take_hit,
  monster_death,
  get_panel,
  move_char,
  movement_rate,
  no_light,
  panel_bounds,
  panel_contains,
  rest_off,
  search,
  search_on,
  take_hit,
  teleport,
  twall,
} from './moria';
import { COL, ROW, boot, lit_room, play, screen, screenAfter } from './port-fixture';
import { store_init } from './store1';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import type { IRef } from '../runtime/pascal';
import { box, clone, pascalSet } from '../runtime/pascal';

function wall_at(y: number, x: number): void {
  g.cave[y][x].fval = 10;
  g.cave[y][x].fopen = false;
}

function tval_at(y: number, x: number): number {
  return g.t_list[g.cave[y][x].tptr].tval;
}

describe('moria', () => {
  beforeEach((): void => {
    boot();
    lit_room();
  });

  describe('panels', () => {
    it('puts the second panel row half a screen down', () => {
      g.panel_row = 1;
      panel_bounds();

      expect(g.panel_row_min).toBe(12);
    });

    it('prints the map from column 15', () => {
      g.panel_col = 1;
      panel_bounds();

      expect(g.panel_col_prt).toBe(g.panel_col_min - 15);
    });

    it('moves the panel for a spot near its edge', () => {
      g.max_panel_rows = 4;

      expect(get_panel(22, COL)).toBe(true);
    });

    it('keeps the panel for a spot well inside it', () => {
      expect(get_panel(ROW, COL)).toBe(false);
    });

    it('contains a spot on the screen', () => {
      expect(panel_contains(ROW, COL)).toBe(true);
    });

    it('does not contain a spot past it', () => {
      expect(panel_contains(ROW, 67)).toBe(false);
    });
  });

  describe('no_light', () => {
    it('is false in a lit room', () => {
      expect(no_light()).toBe(false);
    });

    it('is true in the dark without a lamp', () => {
      g.cave[ROW][COL].pl = false;

      expect(no_light()).toBe(true);
    });
  });

  describe('move_char', () => {
    it('steps in the direction given', async () => {
      await move_char(6);

      expect(g.char_col).toBe(COL + 1);
    });

    it('takes the player\'s record along', async () => {
      await move_char(2);

      expect(g.cave[ROW + 1][COL].cptr).toBe(1);
    });

    it('does not walk into a wall', async () => {
      wall_at(ROW, COL + 1);
      await move_char(6);

      expect(g.char_col).toBe(COL);
    });

    it('makes bumping a wall a free move', async () => {
      wall_at(ROW, COL + 1);
      await move_char(6);

      expect(dl.reset_flag).toBe(true);
    });

    it('says when rubble is in the way', async () => {
      place_rubble(ROW, COL + 1);
      await play((): Promise<void> => move_char(6));

      expect(screen().row(1).trimEnd()).toBe('There is rubble blocking your way.');
    });

    it('says when a closed door is in the way', async () => {
      place_closed_door(ROW, COL + 1);
      await play((): Promise<void> => move_char(6));

      expect(screen().row(1).trimEnd()).toBe('There is a closed door blocking your way.');
    });

    it('stops running at a wall', async () => {
      wall_at(ROW, COL + 1);
      g.find_flag = true;
      await move_char(6);

      expect(g.find_flag).toBe(false);
    });

    it('picks up gold stepped on', async () => {
      place_gold(ROW, COL + 1);

      const gold: number = g.t_list[g.cave[ROW][COL + 1].tptr].cost;

      await play((): Promise<void> => move_char(6));

      expect(g.py.misc.au).toBe(gold);
    });

    describe('with a lamp in a dark room', () => {
      beforeEach(async (): Promise<void> => {
        for (let y: number = 1; y <= g.cur_height; y++) {
          for (let x: number = 1; x <= g.cur_width; x++) {
            g.cave[y][x].pl = false;
          }
        }

        await screenAfter((): Promise<void> => move_char(6), '');
      });

      it('lights the spot ahead', () => {
        expect(screen().row(ROW - g.panel_row_prt).charAt(COL + 2 - g.panel_col_prt - 1)).toBe('.');
      });

      it('lights the row below', () => {
        expect(screen().row(ROW + 1 - g.panel_row_prt).charAt(COL + 2 - g.panel_col_prt - 1)).toBe('.');
      });
    });

    it('draws the player where they moved to', async () => {
      await screenAfter((): Promise<void> => move_char(6), '');

      expect(screen().row(ROW - g.panel_row_prt).charAt(COL + 1 - g.panel_col_prt - 1)).toBe('@');
    });
  });

  describe('stairs', () => {
    it('go down from a down staircase', async () => {
      place_down_stairs(ROW, COL);
      await play((): Promise<void> => dungeon(), '> ');

      expect(g.dun_level).toBe(1);
    });

    it('are not there to go down elsewhere', async () => {
      await screenAfter((): Promise<void> => dungeon(), '>');

      expect(screen().row(1).trimEnd()).toBe('I see no down staircase here.');
    });

    it('are not there to go up elsewhere', async () => {
      await screenAfter((): Promise<void> => dungeon(), '<');

      expect(screen().row(1).trimEnd()).toBe('I see no up staircase here.');
    });
  });

  describe('doors', () => {
    it('open', async () => {
      place_closed_door(ROW, COL + 1);
      await screenAfter((): Promise<void> => dungeon(), 'o6');

      expect(tval_at(ROW, COL + 1)).toBe(104);
    });

    it('can be walked through once open', async () => {
      place_closed_door(ROW, COL + 1);
      await screenAfter((): Promise<void> => dungeon(), 'o6');

      expect(g.cave[ROW][COL + 1].fopen).toBe(true);
    });

    it('close', async () => {
      place_open_door(ROW, COL + 1);
      await screenAfter((): Promise<void> => dungeon(), 'c6');

      expect(g.cave[ROW][COL + 1].fopen).toBe(false);
    });

    it('can be stuck', async () => {
      place_stuck_door(ROW, COL + 1);
      await screenAfter((): Promise<void> => dungeon(), 'o6');

      expect(screen().row(1).trimEnd()).toBe('It appears to be stuck.');
    });

    it('ask again for a direction that is not one', async () => {
      await screenAfter((): Promise<void> => dungeon(), 'o5');

      expect(screen().row(1).trimEnd()).toBe('(1 2 3 4 6 7 8 9) Which direction?');
    });
  });

  describe('search', () => {
    it('finds a secret door', async () => {
      place_secret_door(ROW, COL + 1);
      await play((): Promise<void> => search(ROW, COL, 101));

      expect(g.cave[ROW][COL + 1].fval).toBe(g.corr_floor2.ftval);
    });

    it('finds a hidden trap', async () => {
      place_trap(ROW, COL + 1, 1, 1);
      await play((): Promise<void> => search(ROW, COL, 101));

      expect(tval_at(ROW, COL + 1)).toBe(102);
    });

    it('never finds anything with no chance', async () => {
      place_secret_door(ROW, COL + 1);
      await play((): Promise<void> => search(ROW, COL, 0));

      expect(tval_at(ROW, COL + 1)).toBe(109);
    });
  });

  describe('search mode', () => {
    it('slows the player', () => {
      search_on();

      expect(g.py.flags.speed).toBe(1);
    });

    it('shows on the status line', () => {
      search_on();

      expect(screen().row(24)).toContain('Searching');
    });
  });

  describe('tunnel', () => {
    beforeEach((): void => {
      g.py.stat.cstr = 200;
    });

    it('clears rubble for a strong enough digger', async () => {
      place_rubble(ROW, COL + 1);
      await screenAfter((): Promise<void> => dungeon(), 'T6');

      expect(g.cave[ROW][COL + 1].tptr).toBe(0);
    });

    it('cannot dig permanent rock', async () => {
      g.cave[ROW][COL + 1].fval = 15;
      g.cave[ROW][COL + 1].fopen = false;
      await screenAfter((): Promise<void> => dungeon(), 'T6');

      expect(screen().row(1).trimEnd()).toBe('This seems to be permanent rock.');
    });

    it('turns wall into corridor when it wins', async () => {
      wall_at(ROW, COL + 1);
      await twall(ROW, COL + 1, 2, 1);

      expect(g.cave[ROW][COL + 1].fopen).toBe(true);
    });

    it('leaves the wall when it loses', async () => {
      wall_at(ROW, COL + 1);
      await twall(ROW, COL + 1, 1, 2);

      expect(g.cave[ROW][COL + 1].fopen).toBe(false);
    });
  });

  describe('take_hit', () => {
    beforeEach((): void => {
      g.py.misc.chp = 10;
    });

    it('costs hit points', async () => {
      await take_hit(3, 'a rat');

      expect(g.py.misc.chp).toBe(7);
    });

    it('kills below -1 hit points', async () => {
      await take_hit(11, 'a rat');

      expect(g.death).toBe(true);
    });

    it('records what killed the player', async () => {
      await take_hit(11, 'a rat');

      expect(g.died_from).toBe('a rat');
    });

    it('leaves the invulnerable unhurt', async () => {
      g.py.flags.invuln = 5;
      await take_hit(11, 'a rat');

      expect(g.py.misc.chp).toBe(10);
    });
  });

  describe('movement_rate', () => {
    it('is the speed when fast', () => {
      expect(movement_rate(2)).toBe(2);
    });

    it('is once a turn at normal speed', () => {
      g.turn = 2;

      expect(movement_rate(0)).toBe(1);
    });

    it('skips turns when slow', () => {
      g.turn = 1;

      expect(movement_rate(-1)).toBe(0);
    });
  });

  describe('change_speed', () => {
    it('changes the player\'s speed', () => {
      change_speed(-1);

      expect(g.py.flags.speed).toBe(-1);
    });
  });

  describe('rest_off', () => {
    it('stops resting', () => {
      g.py.flags.rest = 5;
      rest_off();

      expect(g.py.flags.rest).toBe(0);
    });
  });

  describe('teleport', () => {
    it('moves the player no further than asked', async () => {
      await teleport(5);

      expect(Math.abs(g.char_row - ROW) + Math.abs(g.char_col - COL)).toBeLessThanOrEqual(10);
    });
  });

  describe('dungeon', () => {
    it('ends the game on ^Y Q', async () => {
      await expect(play((): Promise<void> => dungeon(), '\x19Q')).rejects.toBeInstanceOf(MoriaExit);
    });

    it('carries on after ^Y and anything but Q', async () => {
      await screenAfter((): Promise<void> => dungeon(), '\x19n');

      expect(g.death).toBe(false);
    });

    it('burns food each turn', async () => {
      place_down_stairs(ROW, COL);

      const food: number = g.py.flags.food;

      await play((): Promise<void> => dungeon(), '5> ');

      expect(food - g.py.flags.food).toBe(2 * g.py.flags.food_digested);
    });

    it('warns of hunger', async () => {
      g.py.flags.food = 1999;
      await screenAfter((): Promise<void> => dungeon(), '');

      expect(screen().row(1).trimEnd()).toBe('You are getting hungry.');
    });

    it('recalls the player down to their deepest level', async () => {
      g.py.misc.max_lev = 3;
      g.py.flags.word_recall = 1;
      await play((): Promise<void> => dungeon(), ' ');

      expect(g.dun_level).toBe(3);
    });

    it('tells the location', async () => {
      await screenAfter((): Promise<void> => dungeon(), 'L');

      expect(screen().row(1).trimEnd()).toBe('Section [1,1]; Location = [10,30]');
    });

    it('looks at what is in a direction', async () => {
      wall_at(ROW, COL + 3);
      await screenAfter((): Promise<void> => dungeon(), 'l6');

      expect(screen().row(1).trimEnd()).toBe('You see a granite wall.');
    });

    it('shows the credits', async () => {
      await screenAfter((): Promise<void> => dungeon(), 'v');

      expect(screen().row(1).trimEnd()).toBe('               Moria Version 4.80');
    });

    it('asks for help with an unknown key', async () => {
      await screenAfter((): Promise<void> => dungeon(), 'Z');

      expect(screen().row(1).trimEnd()).toBe('Type \'?\' for help...');
    });

    it('offers no subprocess for $', async () => {
      await screenAfter((): Promise<void> => dungeon(), '$');

      expect(screen().row(3).trimEnd()).toBe('Subprocesses are not available on this system.');
    });

    it('rests for the turns asked', async () => {
      await screenAfter((): Promise<void> => dungeon(), 'R5\r');

      expect(g.turn).toBe(6);
    });

    it('sees nothing past the distance it can see', async () => {
      await screenAfter((): Promise<void> => dungeon(), 'l6');

      expect(screen().row(1).trimEnd()).toBe('You see nothing of interest in that direction.');
    });

    it('lets a wizard go to a level', async () => {
      g.wizard1 = true;
      await play((): Promise<void> => dungeon(), '\x047\r');

      expect(g.dun_level).toBe(7);
    });
  });

  describe('combat', () => {
    const KOBOLD: number = 17;

    function kobold_beside(): number {
      place_monster(ROW, COL + 1, KOBOLD, false);

      return g.cave[ROW][COL + 1].cptr;
    }

    it('mon_take_hit returns the kind of creature it killed', async () => {
      const cptr: number = kobold_beside();

      expect(await mon_take_hit(cptr, 1000)).toBe(KOBOLD);
    });

    it('mon_take_hit returns 0 for a creature that lives', async () => {
      const cptr: number = kobold_beside();

      g.m_list[cptr].hp = 100;

      expect(await mon_take_hit(cptr, 1)).toBe(0);
    });

    it('mon_take_hit takes the creature off the map when it dies', async () => {
      await mon_take_hit(kobold_beside(), 1000);

      expect(g.cave[ROW][COL + 1].cptr).toBe(0);
    });

    it('mon_take_hit takes the creature off the monster list', async () => {
      await mon_take_hit(kobold_beside(), 1000);

      expect(g.muptr).toBe(0);
    });

    it('mon_take_hit gives experience for the kill', async () => {
      await mon_take_hit(kobold_beside(), 1000);

      expect(g.py.misc.exp).toBe(g.c_list[KOBOLD].mexp);
    });

    it('lets the player attack a monster by walking into it', async () => {
      g.py.misc.bth = 1000;
      g.m_list[kobold_beside()].ml = true;
      await play((): Promise<void> => move_char(6), '     ');

      expect(screen().toString()).toMatch(/You (hit|have slain) the Kobold\./);
    });

    it('keeps an afraid player from attacking', async () => {
      g.py.flags.afraid = 5;
      kobold_beside();
      await play((): Promise<void> => move_char(6));

      expect(screen().row(1).trimEnd()).toBe('You are too afraid!');
    });

    it('fire_dam cuts damage to a third for the fire resistant', async () => {
      g.py.misc.chp = 100;
      g.py.flags.fire_resist = true;
      await play((): Promise<void> => fire_dam(30, 'fire'), '     ');

      expect(g.py.misc.chp).toBe(90);
    });

    it('monster_death wins the game for the Balrog', async () => {
      await play((): Promise<void> => monster_death(ROW, COL + 1, 0x80000000), '     ');

      expect(g.total_winner).toBe(true);
    });

    it('chest_trap summons nothing once the chest has exploded', async () => {
      const cur_pos: IRef<number> = box(0);

      g.py.misc.chp = 1000;
      popt(cur_pos);
      g.cave[ROW][COL + 1].tptr = cur_pos.get();
      g.t_list[cur_pos.get()] = clone(g.t_list[0] ?? g.blank_treasure);
      g.t_list[cur_pos.get()].tval = 2;
      g.t_list[cur_pos.get()].flags = 0x181;
      await play((): Promise<void> => chest_trap(ROW, COL + 1), '     ');

      expect(g.muptr).toBe(0);
    });

    it('find_range finds the slots holding a kind of item', () => {
      g.inven_ctr = 3;
      g.inventory[1].tval = 70;
      g.inventory[2].tval = 80;
      g.inventory[3].tval = 80;

      const first: IRef<number> = box(0);
      const last: IRef<number> = box(0);

      find_range(pascalSet(80), first, last);

      expect([ first.get(), last.get() ]).toEqual([ 2, 3 ]);
    });
  });

  describe('hit_trap', () => {
    function trap_beside(subval: number): void {
      place_trap(ROW, COL + 1, 1, subval);
    }

    it('drops the player through a trap door', async () => {
      trap_beside(4);
      await play((): Promise<void> => move_char(6), '     ');

      expect(g.dun_level).toBe(1);
    });

    it('marks a teleport trap for the end of the turn', async () => {
      trap_beside(8);
      await play((): Promise<void> => move_char(6), '     ');

      expect(dl.teleport_flag).toBe(true);
    });

    it('reveals the trap that went off', async () => {
      trap_beside(1);
      await play((): Promise<void> => move_char(6), '     ');

      expect(tval_at(ROW, COL + 1)).toBe(102);
    });

    it('finds a shop locked until its opening turn', async () => {
      const cur_pos: IRef<number> = box(0);

      popt(cur_pos);
      g.cave[ROW][COL + 1].tptr = cur_pos.get();
      g.t_list[cur_pos.get()] = clone(g.store_door[1]);
      await play((): Promise<void> => move_char(6));

      expect(screen().row(1).trimEnd()).toBe('The doors are locked.');
    });

    it('takes the player into a shop that is open', async () => {
      const cur_pos: IRef<number> = box(0);

      store_init();
      g.turn = 1;
      popt(cur_pos);
      g.cave[ROW][COL + 1].tptr = cur_pos.get();
      g.t_list[cur_pos.get()] = clone(g.store_door[1]);
      await screenAfter((): Promise<void> => move_char(6), '');

      expect(screen().row(4).trim()).toBe(g.owners[g.store[1].owner].owner_name.trim());
    });
  });

});
