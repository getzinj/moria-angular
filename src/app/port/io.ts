// source/include/io.inc

import { IO$MOR_IOPAUSE } from './constants';
import { g } from './variables';
import { MoriaExit } from '../runtime/exit';
import type { IRef } from '../runtime/pascal';
import { box, pad, substr } from '../runtime/pascal';
import { rt } from '../runtime/runtime';

const ABORT_KEYS: readonly number[] = [ 3, 25, 26, 27 ];
const MORE_KEYS: readonly number[] = [ 3, 13, 25, 26, 27, 32 ];


// io.inc:60 sleep. convert_time caps a wait at 59 seconds.
export async function sleep(int_time: number): Promise<void> {
  await rt().clock.sleep(Math.min(int_time, 59));
}


// io.inc:74 setup_io_pause, 84 priv_switch, 124 no_controly, 140 controly, 186 init_channel:
// VMS housekeeping with nothing to do in a browser.
export function setup_io_pause(): void {
  // No QIO driver to wait for.
}


export function priv_switch(): void {
  // No SYSPRV.
}


export function no_controly(): void {
  // Ctrl-Y reaches the game as an ordinary key.
}


export function controly(): void {
  // Ctrl-Y reaches the game as an ordinary key.
}


export function init_channel(): void {
  // The terminal is always there.
}


// io.inc:157 put_buffer
export function put_buffer(out_str: string, row: number, col: number): void {
  rt().terminal.put_buffer(out_str, row, col);
}


// io.inc:167 put_qio
export function put_qio(): void {
  rt().terminal.put_qio();
}


// io.inc:171 exit
export function exit(): never {
  controly();
  put_qio();
  throw new MoriaExit();
}


// io.inc:228 inkey
export async function inkey(getchar: IRef<string>): Promise<void> {
  getchar.set(await rt().terminal.read_key());
  g.msg_flag = false;
}


// io.inc:247 inkey_delay: waits delay seconds, then takes a key if one came. The game only polls
// (delay 0), while resting. The 5/100 second pause VMS 3.x needed before a read is kept here
// alone: it paced resting, and lets the page draw and take keys between turns.
export async function inkey_delay(getchar: IRef<string>, delay: number): Promise<void> {
  put_qio();
  await rt().clock.sleep((IO$MOR_IOPAUSE / 100) + delay);
  getchar.set(rt().terminal.poll_key());
}


// io.inc:270 flush: throws away type-ahead.
export function flush(): void {
  rt().terminal.flush_input();
}


// io.inc:282 inkey_flush
export async function inkey_flush(x: IRef<string>): Promise<void> {
  put_qio();

  if (!g.wizard1) {
    flush();
  }

  await inkey(x);
}


// io.inc:299 erase_line
export function erase_line(row: number, col: number): void {
  rt().terminal.erase_to_end_of_line(row, col);
}


// io.inc:309 clear
export function clear(row: number, col: number): void {
  for (let i1: number = 2; i1 <= 23; i1++) {
    g.used_line[i1] = false;
  }

  rt().terminal.erase_to_end_of_screen(row, col);
  put_qio();
}


// io.inc:320 print: dungeon co-ordinates to screen position.
export function print(str_buff: string, row: number, col: number): void {
  const screen_row: number = row - g.panel_row_prt;
  const screen_col: number = col - g.panel_col_prt;

  g.used_line[screen_row] = true;
  put_buffer(str_buff, screen_row, screen_col);
}


// io.inc:334 prt
export function prt(str_buff: string, row: number, col: number): void {
  erase_line(row, col);
  put_buffer(str_buff, row, col);
}


// io.inc:345 msg_print
export async function msg_print(str_buff: string): Promise<void> {
  if (g.msg_flag) {
    const in_char: IRef<string> = box('');

    put_buffer(' -more-', g.msg_line, g.old_msg.length + 1);

    do {
      await inkey(in_char);
    } while (!MORE_KEYS.includes(in_char.get().charCodeAt(0)));
  }

  prt(str_buff, g.msg_line, g.msg_line);
  g.old_msg = str_buff;
  g.msg_flag = true;
}


// io.inc:366 get_com: false for ESC, ^C, ^Y or ^Z.
export async function get_com(prompt: string, command: IRef<string>): Promise<boolean> {
  if (prompt.length > 1) {
    prt(prompt, 1, 1);
  }

  await inkey(command);

  const answered: boolean = !ABORT_KEYS.includes(command.get().charCodeAt(0));

  erase_line(g.msg_line, g.msg_line);
  g.msg_flag = false;

  return answered;
}


// io.inc:387 get_string: false for ESC, ^C, ^Y or ^Z. DEL rubs out.
export async function get_string(in_str: IRef<string>, row: number, column: number, slen: number): Promise<boolean> {
  let abort: boolean = false;
  let flag: boolean = false;
  let col: number = column;
  const start_col: number = column;
  const end_col: number = column + slen - 1;
  let text: string = '';
  const x: IRef<string> = box('');

  put_buffer(pad(text, ' ', slen), row, col);
  put_buffer('', row, col);

  do {
    await inkey(x);

    const code: number = x.get().charCodeAt(0);

    if (ABORT_KEYS.includes(code)) {
      abort = true;
    } else if (code === 13) {
      flag = true;
    } else if (code === 127) {
      if (col > start_col) {
        col--;
        put_buffer(' \b', row, col);
        text = substr(text, 1, text.length - 1);
      }
    } else {
      put_buffer(x.get(), row, col);
      text += x.get();
      col++;

      if (col > end_col) {
        flag = true;
      }
    }
  } while (!(flag || abort));

  if (!abort) {
    let i1: number = text.length;

    if (i1 > 1) {
      while ((text.charAt(i1 - 1) === ' ') && (i1 > 1)) {
        i1--;
      }

      text = substr(text, 1, i1);
    }
  }

  in_str.set(text);

  return !abort;
}


// io.inc:445 get_hex_value: OTS$CVT_TZ_L with blanks ignored; anything else that is not hex is 0.
export async function get_hex_value(row: number, col: number, slen: number): Promise<number> {
  const tmp_str: IRef<string> = box('');
  let value: number = 0;

  if (await get_string(tmp_str, row, col, slen)) {
    const digits: string = tmp_str.get().replace(/ /g, '');

    if ((tmp_str.get().length <= 8) && /^[0-9A-Fa-f]*$/.test(digits)) {
      value = digits === '' ? 0 : parseInt(digits, 16) | 0;
    }
  }

  return value;
}


// io.inc:474 pause
export async function pause(prt_line: number): Promise<void> {
  prt('[Press any key to continue]', prt_line, 24);
  await inkey(box(''));
  erase_line(24, 1);
}


// io.inc:487 pause_exit. The delay makes players rolling "perfect" characters wait a bit.
export async function pause_exit(prt_line: number, delay: number): Promise<void> {
  const dummy: IRef<string> = box('');

  prt('[Press any key to continue, or <Control>-Z to exit]', prt_line, 11);
  await inkey(dummy);

  if ([ 3, 25, 26 ].includes(dummy.get().charCodeAt(0))) {
    erase_line(prt_line, 1);

    if (delay > 0) {
      await sleep(delay);
    }

    exit();
  }

  erase_line(prt_line, 1);
}


// io.inc:509 get_paths: the data files are named files in browser storage, with no directory.
export function get_paths(): void {
  g.moria_hou = 'HOURS.DAT';
  g.moria_mor = 'MORIA.DAT';
  g.moria_mas = 'MORIACHR.DAT';
  g.moria_top = 'MORIATOP.DAT';
  g.moria_hlp = 'MORIAHLP.HLB';
}
