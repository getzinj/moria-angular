// source/moria.pas: initialize, restore or create, then play until dead.

import { cost_adj, max_player_level, screen_height, screen_width } from './constants';
import { create_character } from './create';
import { magic_init } from './desc';
import { intro } from './files';
import { clear, get_paths, get_string, init_channel, priv_switch, prt, setup_io_pause } from './io';
import {
  bpswd,
  change_name,
  char_inven_init,
  gain_mana,
  init_m_level,
  init_t_level,
  int_adj,
  learn_prayer,
  learn_spell,
  price_adjust,
  prt_stat_block,
  sort_objects,
  wis_adj,
} from './misc';
import { generate_cave } from './generate';
import { dungeon } from './moria';
import { upon_death } from './death';
import { get_char } from './save';
import { store_init } from './store1';
import { g } from './variables';
import { get_seed } from '../runtime/clock';
import type { IRef } from '../runtime/pascal';
import { box, real, ref } from '../runtime/pascal';
import { rt } from '../runtime/runtime';

const RESTORE_PROMPT: string = 'Restore file (RETURN for new character):';


/** The data files every game has; anything else in storage is a save file. */
function save_files_exist(): boolean {
  const data_files: readonly string[] = [ g.moria_hou, g.moria_mor, g.moria_mas, g.moria_top, g.moria_hlp ];

  return rt().files.list().some((name: string): boolean => !data_files.includes(name));
}


// LIB$GET_FOREIGN: the DCL command line, here the page's query string. With none, a player who has
// saved games is asked for one. DCL handed it over in capitals, which intro's /WIZARD test relies on.
async function get_foreign(command_line: string): Promise<string> {
  let finam: string = command_line.trim().toUpperCase();

  if ((finam === '') && save_files_exist()) {
    const answer: IRef<string> = box('');

    clear(1, 1);
    prt(RESTORE_PROMPT, 1, 1);

    if (await get_string(answer, 1, RESTORE_PROMPT.length + 2, 80 - RESTORE_PROMPT.length - 1)) {
      finam = answer.get().trim().toUpperCase();
    }
  }

  return finam;
}


async function new_character(): Promise<void> {
  await create_character();
  char_inven_init();

  if (g.class[g.py.misc.pclass].mspell) {
    await learn_spell(ref(g, 'msg_flag'));
    gain_mana(int_adj());
  } else if (g.class[g.py.misc.pclass].pspell) {
    await learn_prayer();
    gain_mana(wis_adj());
  }

  g.py.misc.cmana = g.py.misc.mana;
  g.randes_seed = rt().random.seed;
  g.town_seed = rt().random.seed;
  magic_init(g.randes_seed);
  g.generate = true;
}


// moria.pas:50 the main program. termdef, which checked the terminal type, has nothing to check.
export async function main(command_line: string): Promise<void> {
  priv_switch();
  get_paths();
  setup_io_pause();
  g.msg_line = 1;
  g.quart_height = Math.trunc(real(screen_height / 4));
  g.quart_width = Math.trunc(real(screen_width / 4));
  g.dun_level = 0;
  init_channel();
  rt().random.seed = get_seed(rt().clock.now());
  sort_objects();
  init_m_level();
  init_t_level();
  store_init();

  if (cost_adj !== 1.00) {
    price_adjust();
  }

  bpswd();
  g.finam = await get_foreign(command_line);
  await intro(ref(g, 'finam'));

  if (g.finam.length > 0) {
    g.generate = await get_char(g.finam);
    await change_name();
    magic_init(g.randes_seed);
  } else {
    await new_character();
  }

  g.player_max_exp = Math.trunc(real(g.player_exp[max_player_level - 1] * g.py.misc.expfact));
  clear(1, 1);
  prt_stat_block();

  do {
    if (g.generate) {
      generate_cave();
    }

    await dungeon();
    g.generate = true;
  } while (!g.death);

  await upon_death();
}
