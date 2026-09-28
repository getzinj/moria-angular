// source/include/generate.inc: the town and the dungeon levels.

import {
  dun_roo_mea,
  dun_str_den,
  dun_str_mag,
  dun_str_mc,
  dun_str_qc,
  dun_str_qua,
  dun_str_rng,
  dun_tun_chg,
  dun_tun_con,
  dun_tun_jct,
  dun_tun_pen,
  dun_tun_rnd,
  dun_unusual,
  max_height,
  max_trapa,
  max_width,
  min_malloc_level,
  min_malloc_td,
  min_malloc_tn,
  screen_height,
  screen_width,
  treas_any_alloc,
  treas_gold_alloc,
  treas_room_alloc,
  win_mon_appear,
} from './constants';
import {
  alloc_monster,
  alloc_object,
  get_seed,
  in_bounds,
  mlink,
  move,
  next_to8,
  place_door,
  place_down_stairs,
  place_gold,
  place_locked_door,
  place_object,
  place_secret_door,
  place_stairs,
  place_trap,
  place_up_stairs,
  place_win_monster,
  popt,
  random_object,
  randint,
  randnor,
  summon_monster,
  tlink,
} from './misc';
import { store_maint } from './store1';
import type { cave_type, floor_type } from './types';
import { g } from './variables';
import type { IRef } from '../runtime/pascal';
import { box, clone, mod, pascalSet, real } from '../runtime/pascal';
import { rt } from '../runtime/runtime';

interface ICoords {
  y: number;
  x: number;
}

// The door stack generate_cave's nested routines share.
let doorstk: ICoords[] = [];
let doorptr: number = 0;


function odd(value: number): boolean {
  return mod(value, 2) === 1;
}


function set_floor(cell: cave_type, floor: floor_type): void {
  cell.fval = floor.ftval;
  cell.fopen = floor.ftopen;
}


// generate.inc:14 correct_dir: always picks a correct direction.
function correct_dir(rdir: IRef<number>, cdir: IRef<number>, y1: number, x1: number, y2: number, x2: number): void {
  if (y1 < y2) {
    rdir.set(1);
  } else if (y1 === y2) {
    rdir.set(0);
  } else {
    rdir.set(-1);
  }

  if (x1 < x2) {
    cdir.set(1);
  } else if (x1 === x2) {
    cdir.set(0);
  } else {
    cdir.set(-1);
  }

  if ((rdir.get() !== 0) && (cdir.get() !== 0)) {
    switch (randint(2)) {
      case 1:
        rdir.set(0);
        break;
      case 2:
        cdir.set(0);
        break;
    }
  }
}


// generate.inc:39 rand_dir: a chance of a wandering direction.
function rand_dir(rdir: IRef<number>, cdir: IRef<number>, y1: number, x1: number, y2: number, x2: number, chance: number): void {
  switch (randint(chance)) {
    case 1:
      rdir.set(-1);
      cdir.set(0);
      break;
    case 2:
      rdir.set(1);
      cdir.set(0);
      break;
    case 3:
      rdir.set(0);
      cdir.set(-1);
      break;
    case 4:
      rdir.set(0);
      cdir.set(1);
      break;
    default:
      correct_dir(rdir, cdir, y1, x1, y2, x2);
      break;
  }
}


// generate.inc:65 blank_cave
function blank_cave(): void {
  for (let i1: number = 1; i1 <= max_height; i1++) {
    for (let i2: number = 1; i2 <= max_width; i2++) {
      g.cave[i1][i2] = clone(g.blank_floor);
    }
  }
}


// generate.inc:77 fill_cave: fills the empty spots (9 is a temporary value) with rock.
function fill_cave(fill: floor_type): void {
  for (let i1: number = 2; i1 <= g.cur_height - 1; i1++) {
    for (let i2: number = 2; i2 <= g.cur_width - 1; i2++) {
      const cell: cave_type = g.cave[i1][i2];

      if ([ 0, 8, 9 ].includes(cell.fval)) {
        cell.fval = fill.ftval;
        cell.fopen = fill.ftopen;
      }
    }
  }
}


// generate.inc:93 place_boundry
function place_boundry(): void {
  for (let i1: number = 1; i1 <= g.cur_height; i1++) {
    set_floor(g.cave[i1][1], g.boundry_wall);
    set_floor(g.cave[i1][g.cur_width], g.boundry_wall);
  }

  for (let i1: number = 1; i1 <= g.cur_width; i1++) {
    set_floor(g.cave[1][i1], g.boundry_wall);
    set_floor(g.cave[g.cur_height][i1], g.boundry_wall);
  }
}


// generate.inc:115 place_streamer: a streamer of rock through the dungeon.
function place_streamer(rock: floor_type, treas_chance: number): void {
  const y: IRef<number> = box(Math.trunc(real(g.cur_height / 2.0)) + 11 - randint(23));
  const x: IRef<number> = box(Math.trunc(real(g.cur_width / 2.0)) + 16 - randint(33));
  let dir: number = randint(8);
  let flag: boolean = false;
  const t1: number = 2 * dun_str_rng + 1;
  const t2: number = dun_str_rng + 1;

  if (dir > 4) {
    dir++;
  }

  do {
    for (let i1: number = 1; i1 <= dun_str_den; i1++) {
      const ty: number = y.get() + randint(t1) - t2;
      const tx: number = x.get() + randint(t1) - t2;

      if (in_bounds(ty, tx)) {
        const cell: cave_type = g.cave[ty][tx];

        if (cell.fval === g.rock_wall1.ftval) {
          set_floor(cell, rock);

          if (randint(treas_chance) === 1) {
            place_gold(ty, tx);
          }
        }
      }
    }

    if (!move(dir, y, x)) {
      flag = true;
    }
  } while (!flag);
}


// generate.inc:153 vault_trap: traps within a displacement of a point.
function vault_trap(y: number, x: number, yd: number, xd: number, num: number): void {
  for (let i1: number = 1; i1 <= num; i1++) {
    let flag: boolean = false;
    let count: number = 0;

    do {
      const y1: number = y - yd - 1 + randint(2 * yd + 1);
      const x1: number = x - xd - 1 + randint(2 * xd + 1);
      const cell: cave_type = g.cave[y1][x1];

      if (g.floor_set.has(cell.fval)) {
        if (cell.tptr === 0) {
          place_trap(y1, x1, 1, randint(max_trapa));
          flag = true;
        }
      }

      count++;
    } while (!(flag || (count > 5)));
  }
}


// generate.inc:179 vault_monster
function vault_monster(y: number, x: number, num: number): void {
  for (let i1: number = 1; i1 <= num; i1++) {
    summon_monster(box(y), box(x), true);
  }
}


function room_floor(chance: number): floor_type {
  return g.dun_level <= randint(chance) ? g.lopen_floor : g.dopen_floor;
}


function fill_room(y_height: number, y_depth: number, x_left: number, x_right: number, floor: floor_type): void {
  for (let i1: number = y_height; i1 <= y_depth; i1++) {
    for (let i2: number = x_left; i2 <= x_right; i2++) {
      set_floor(g.cave[i1][i2], floor);
    }
  }
}


/** The walls round a room; with `keep`, a wall spot already that floor is left open. */
function wall_room(y_height: number, y_depth: number, x_left: number, x_right: number, keep: floor_type | null): void {
  const wall: (cell: cave_type) => void = (cell: cave_type): void => {
    if ((keep == null) || (cell.fval !== keep.ftval)) {
      set_floor(cell, g.rock_wall1);
    }
  };

  for (let i1: number = y_height - 1; i1 <= y_depth + 1; i1++) {
    wall(g.cave[i1][x_left - 1]);
    wall(g.cave[i1][x_right + 1]);
  }

  for (let i1: number = x_left; i1 <= x_right; i1++) {
    wall(g.cave[y_height - 1][i1]);
    wall(g.cave[y_depth + 1][i1]);
  }
}


// generate.inc:193 build_room
function build_room(yval: number, xval: number): void {
  const cur_floor: floor_type = room_floor(25);
  const y_height: number = yval - randint(4);
  const y_depth: number = yval + randint(3);
  const x_left: number = xval - randint(11);
  const x_right: number = xval + randint(11);

  fill_room(y_height, y_depth, x_left, x_right, cur_floor);
  wall_room(y_height, y_depth, x_left, x_right, null);
}


// generate.inc:233 build_type1: several overlapping rectangular rooms.
function build_type1(yval: number, xval: number): void {
  const cur_floor: floor_type = room_floor(25);
  const rooms: number = 1 + randint(2);

  for (let i0: number = 1; i0 <= rooms; i0++) {
    const y_height: number = yval - randint(4);
    const y_depth: number = yval + randint(3);
    const x_left: number = xval - randint(11);
    const x_right: number = xval + randint(11);

    fill_room(y_height, y_depth, x_left, x_right, cur_floor);
    wall_room(y_height, y_depth, x_left, x_right, cur_floor);
  }
}


function secret_door_on_side(y_height: number, y_depth: number, x_left: number, x_right: number, yval: number, xval: number): void {
  switch (randint(4)) {
    case 1:
      place_secret_door(y_height - 1, xval);
      break;
    case 2:
      place_secret_door(y_depth + 1, xval);
      break;
    case 3:
      place_secret_door(yval, x_left - 1);
      break;
    case 4:
      place_secret_door(yval, x_right + 1);
      break;
  }
}


function mark_block(y1: number, y2: number, x1: number, x2: number): void {
  for (let i1: number = y1; i1 <= y2; i1++) {
    for (let i2: number = x1; i2 <= x2; i2++) {
      g.cave[i1][i2].fval = 8;
    }
  }
}


// generate.inc:297 build_type2: an inner room, in one of five variations.
function build_type2(yval: number, xval: number): void {
  const cur_floor: floor_type = room_floor(30);
  let y_height: number = yval - 4;
  let y_depth: number = yval + 4;
  let x_left: number = xval - 11;
  let x_right: number = xval + 11;

  fill_room(y_height, y_depth, x_left, x_right, cur_floor);
  wall_room(y_height, y_depth, x_left, x_right, null);

  y_height += 2;
  y_depth -= 2;
  x_left += 2;
  x_right -= 2;

  for (let i1: number = y_height - 1; i1 <= y_depth + 1; i1++) {
    g.cave[i1][x_left - 1].fval = 8;
    g.cave[i1][x_right + 1].fval = 8;
  }

  for (let i1: number = x_left; i1 <= x_right; i1++) {
    g.cave[y_height - 1][i1].fval = 8;
    g.cave[y_depth + 1][i1].fval = 8;
  }

  switch (randint(5)) {
    case 1:
      secret_door_on_side(y_height, y_depth, x_left, x_right, yval, xval);
      vault_monster(yval, xval, 1);
      break;
    case 2:
      treasure_vault(y_height, y_depth, x_left, x_right, yval, xval);
      break;
    case 3:
      inner_pillars(y_height, y_depth, x_left, x_right, yval, xval);
      break;
    case 4:
      inner_maze(y_height, y_depth, x_left, x_right, yval, xval);
      break;
    case 5:
      four_rooms(y_height, y_depth, x_left, x_right, yval, xval);
      break;
  }
}


function treasure_vault(y_height: number, y_depth: number, x_left: number, x_right: number, yval: number, xval: number): void {
  secret_door_on_side(y_height, y_depth, x_left, x_right, yval, xval);

  for (let i1: number = yval - 1; i1 <= yval + 1; i1++) {
    g.cave[i1][xval - 1].fval = 8;
    g.cave[i1][xval + 1].fval = 8;
  }

  g.cave[yval - 1][xval].fval = 8;
  g.cave[yval + 1][xval].fval = 8;

  switch (randint(4)) {
    case 1:
      place_locked_door(yval - 1, xval);
      break;
    case 2:
      place_locked_door(yval + 1, xval);
      break;
    case 3:
      place_locked_door(yval, xval - 1);
      break;
    case 4:
      place_locked_door(yval, xval + 1);
      break;
  }

  switch (randint(10)) {
    case 1:
      place_up_stairs(yval, xval);
      break;
    case 2:
      place_down_stairs(yval, xval);
      break;
    default:
      place_object(yval, xval);
      break;
  }

  vault_monster(yval, xval, 2 + randint(3));
  vault_trap(yval, xval, 4, 10, 2 + randint(3));
}


function inner_pillars(y_height: number, y_depth: number, x_left: number, x_right: number, yval: number, xval: number): void {
  secret_door_on_side(y_height, y_depth, x_left, x_right, yval, xval);
  mark_block(yval - 1, yval + 1, xval - 1, xval + 1);

  if (randint(2) === 1) {
    switch (randint(2)) {
      case 1:
        mark_block(yval - 1, yval + 1, xval - 6, xval - 4);
        mark_block(yval - 1, yval + 1, xval + 4, xval + 6);
        break;
      case 2:
        mark_block(yval - 1, yval + 1, xval - 7, xval - 5);
        mark_block(yval - 1, yval + 1, xval + 5, xval + 7);
        break;
    }

    if (randint(3) === 1) {
      for (let i1: number = xval - 5; i1 <= xval + 5; i1++) {
        g.cave[yval - 1][i1].fval = 8;
        g.cave[yval + 1][i1].fval = 8;
      }

      switch (randint(2)) {
        case 1:
          place_secret_door(yval + 1, xval - 3);
          break;
        case 2:
          place_secret_door(yval - 1, xval - 3);
          break;
      }

      switch (randint(2)) {
        case 1:
          place_secret_door(yval + 1, xval + 3);
          break;
        case 2:
          place_secret_door(yval - 1, xval + 3);
          break;
      }

      if (randint(3) === 1) {
        place_object(yval, xval - 2);
      }

      if (randint(3) === 1) {
        place_object(yval, xval + 2);
      }

      vault_monster(yval, xval - 2, randint(2));
      vault_monster(yval, xval + 2, randint(2));
    }
  }
}


function inner_maze(y_height: number, y_depth: number, x_left: number, x_right: number, yval: number, xval: number): void {
  secret_door_on_side(y_height, y_depth, x_left, x_right, yval, xval);

  for (let i1: number = y_height; i1 <= y_depth; i1++) {
    for (let i2: number = x_left; i2 <= x_right; i2++) {
      if (odd(i2 + i1)) {
        g.cave[i1][i2].fval = 8;
      }
    }
  }

  vault_monster(yval, xval - 5, randint(3));
  vault_monster(yval, xval + 5, randint(3));
  vault_trap(yval, xval - 3, 2, 8, randint(3));
  vault_trap(yval, xval + 3, 2, 8, randint(3));

  for (let i1: number = 1; i1 <= 3; i1++) {
    random_object(yval, xval, 1);
  }
}


function four_rooms(y_height: number, y_depth: number, x_left: number, x_right: number, yval: number, xval: number): void {
  for (let i1: number = y_height; i1 <= y_depth; i1++) {
    g.cave[i1][xval].fval = 8;
  }

  for (let i1: number = x_left; i1 <= x_right; i1++) {
    g.cave[yval][i1].fval = 8;
  }

  switch (randint(2)) {
    case 1: {
      const i1: number = randint(10);

      place_secret_door(y_height - 1, xval - i1);
      place_secret_door(y_height - 1, xval + i1);
      place_secret_door(y_depth + 1, xval - i1);
      place_secret_door(y_depth + 1, xval + i1);
      break;
    }
    case 2: {
      const i1: number = randint(3);

      place_secret_door(yval + i1, x_left - 1);
      place_secret_door(yval - i1, x_left - 1);
      place_secret_door(yval + i1, x_right + 1);
      place_secret_door(yval - i1, x_right + 1);
      break;
    }
  }

  random_object(yval, xval, 2 + randint(2));
  vault_monster(yval + 2, xval - 4, randint(2));
  vault_monster(yval + 2, xval + 4, randint(2));
  vault_monster(yval - 2, xval - 4, randint(2));
  vault_monster(yval - 2, xval + 4, randint(2));
}


// generate.inc:497 build_type3: cross-shaped rooms.
function build_type3(yval: number, xval: number): void {
  const cur_floor: floor_type = room_floor(25);
  let i0: number = 2 + randint(2);

  fill_room(yval - i0, yval + i0, xval - 1, xval + 1, cur_floor);
  wall_room(yval - i0, yval + i0, xval - 1, xval + 1, null);
  i0 = 2 + randint(9);
  fill_room(yval - 1, yval + 1, xval - i0, xval + i0, cur_floor);
  wall_room(yval - 1, yval + 1, xval - i0, xval + i0, cur_floor);

  switch (randint(4)) {
    case 1:
      mark_block(yval - 1, yval + 1, xval - 1, xval + 1);
      break;
    case 2:
      cross_vault(yval, xval);
      break;
    case 3:
      cross_pillars(yval, xval);
      break;
  }
}


function cross_vault(yval: number, xval: number): void {
  for (let i1: number = yval - 1; i1 <= yval + 1; i1++) {
    g.cave[i1][xval - 1].fval = 8;
    g.cave[i1][xval + 1].fval = 8;
  }

  g.cave[yval - 1][xval].fval = 8;
  g.cave[yval + 1][xval].fval = 8;

  switch (randint(4)) {
    case 1:
      place_secret_door(yval - 1, xval);
      break;
    case 2:
      place_secret_door(yval + 1, xval);
      break;
    case 3:
      place_secret_door(yval, xval - 1);
      break;
    case 4:
      place_secret_door(yval, xval + 1);
      break;
  }

  place_object(yval, xval);
  vault_monster(yval, xval, 2 + randint(2));
  vault_trap(yval, xval, 4, 4, 1 + randint(3));
}


// The source marks (yval-1, xval+2) twice and never (yval+1, xval+2); kept.
function cross_pillars(yval: number, xval: number): void {
  if (randint(3) === 1) {
    g.cave[yval - 1][xval - 2].fval = 8;
    g.cave[yval + 1][xval - 2].fval = 8;
    g.cave[yval - 1][xval + 2].fval = 8;
    g.cave[yval - 1][xval + 2].fval = 8;
    g.cave[yval - 2][xval - 1].fval = 8;
    g.cave[yval - 2][xval + 1].fval = 8;
    g.cave[yval + 2][xval - 1].fval = 8;
    g.cave[yval + 2][xval + 1].fval = 8;

    if (randint(3) === 1) {
      place_secret_door(yval, xval - 2);
      place_secret_door(yval, xval + 2);
      place_secret_door(yval - 2, xval);
      place_secret_door(yval + 2, xval);
    }
  } else if (randint(3) === 1) {
    g.cave[yval][xval].fval = 8;
    g.cave[yval - 1][xval].fval = 8;
    g.cave[yval + 1][xval].fval = 8;
    g.cave[yval][xval - 1].fval = 8;
    g.cave[yval][xval + 1].fval = 8;
  } else if (randint(3) === 1) {
    g.cave[yval][xval].fval = 8;
  }
}


// generate.inc:650 tunnel: a tunnel between two points (9 is a temporary value).
function tunnel(start_row: number, start_col: number, row2: number, col2: number): void {
  const row_dir: IRef<number> = box(0);
  const col_dir: IRef<number> = box(0);
  const tunstk: ICoords[] = [];
  const wallstk: ICoords[] = [];
  let row1: number = start_row;
  let col1: number = start_col;
  let tunptr: number = 0;
  let wallptr: number = 0;
  let stop_flag: boolean = false;
  let door_flag: boolean = false;

  correct_dir(row_dir, col_dir, row1, col1, row2, col2);

  do {
    if (randint(100) > dun_tun_chg) {
      rand_dir(row_dir, col_dir, row1, col1, row2, col2, dun_tun_rnd);
    }

    let tmp_row: number = row1 + row_dir.get();
    let tmp_col: number = col1 + col_dir.get();

    while (!in_bounds(tmp_row, tmp_col)) {
      rand_dir(row_dir, col_dir, row1, col1, row2, col2, dun_tun_rnd);
      tmp_row = row1 + row_dir.get();
      tmp_col = col1 + col_dir.get();
    }

    const cell: cave_type = g.cave[tmp_row][tmp_col];

    if (cell.fval === g.rock_wall1.ftval) {
      row1 = tmp_row;
      col1 = tmp_col;

      if (wallptr < 1000) {
        wallptr++;
      }

      wallstk[wallptr] = { y: row1, x: col1 };

      for (let i1: number = row1 - 1; i1 <= row1 + 1; i1++) {
        for (let i2: number = col1 - 1; i2 <= col1 + 1; i2++) {
          if (in_bounds(i1, i2) && g.wall_set.has(g.cave[i1][i2].fval)) {
            g.cave[i1][i2].fval = 9;
          }
        }
      }
    } else if (cell.fval === g.corr_floor1.ftval) {
      row1 = tmp_row;
      col1 = tmp_col;

      if (!door_flag) {
        if (doorptr <= 100) {
          doorptr++;
          doorstk[doorptr] = { y: row1, x: col1 };
        }

        door_flag = true;
      }

      if (randint(100) > dun_tun_con) {
        stop_flag = true;
      }
    } else if (cell.fval === 0) {
      row1 = tmp_row;
      col1 = tmp_col;

      if (tunptr < 1000) {
        tunptr++;
      }

      tunstk[tunptr] = { y: row1, x: col1 };
      door_flag = false;
    } else if (cell.fval !== 9) {
      row1 = tmp_row;
      col1 = tmp_col;
    }
  } while (!(((row1 === row2) && (col1 === col2)) || stop_flag));

  for (let i1: number = 1; i1 <= tunptr; i1++) {
    set_floor(g.cave[tunstk[i1].y][tunstk[i1].x], g.corr_floor1);
  }

  for (let i1: number = 1; i1 <= wallptr; i1++) {
    const cell: cave_type = g.cave[wallstk[i1].y][wallstk[i1].x];

    if (cell.fval === 9) {
      if (randint(100) < dun_tun_pen) {
        place_door(wallstk[i1].y, wallstk[i1].x);
      } else {
        set_floor(cell, g.corr_floor2);
      }
    }
  }
}


// generate.inc:753 next_to: a corridor spot between two walls.
function next_to(y: number, x: number): boolean {
  let result: boolean = false;

  if (next_to8(y, x, pascalSet(4, 5, 6)) > 2) {
    if (g.wall_set.has(g.cave[y - 1][x].fval) && g.wall_set.has(g.cave[y + 1][x].fval)) {
      result = true;
    } else if (g.wall_set.has(g.cave[y][x - 1].fval) && g.wall_set.has(g.cave[y][x + 1].fval)) {
      result = true;
    }
  }

  return result;
}


// generate.inc:751 try_door: a door where at least two walls meet a corridor.
function try_door(y: number, x: number): void {
  if (randint(100) > dun_tun_jct) {
    if (g.cave[y][x].fval === g.corr_floor1.ftval) {
      if (next_to(y, x)) {
        place_door(y, x);
      }
    }
  }
}


// generate.inc:777 cave_gen
function cave_gen(): void {
  const room_map: boolean[][] = [];
  const yloc: number[] = [];
  const xloc: number[] = [];
  const row_rooms: number = 2 * Math.trunc(real(g.cur_height / screen_height));
  const col_rooms: number = 2 * Math.trunc(real(g.cur_width / screen_width));
  let i3: number = 0;

  rt().random.seed = get_seed();

  for (let i1: number = 1; i1 <= row_rooms; i1++) {
    room_map[i1] = [];

    for (let i2: number = 1; i2 <= col_rooms; i2++) {
      room_map[i1][i2] = false;
    }
  }

  const rooms: number = randnor(dun_roo_mea, 2);

  for (let i1: number = 1; i1 <= rooms; i1++) {
    const row: number = randint(row_rooms);

    room_map[row][randint(col_rooms)] = true;
  }

  for (let i1: number = 1; i1 <= row_rooms; i1++) {
    for (let i2: number = 1; i2 <= col_rooms; i2++) {
      if (room_map[i1][i2]) {
        i3++;
        yloc[i3] = (i1 - 1) * (g.quart_height * 2 + 1) + g.quart_height + 1;
        xloc[i3] = (i2 - 1) * (g.quart_width * 2 + 1) + g.quart_width + 1;

        if (g.dun_level > randint(dun_unusual)) {
          switch (randint(3)) {
            case 1:
              build_type1(yloc[i3], xloc[i3]);
              break;
            case 2:
              build_type2(yloc[i3], xloc[i3]);
              break;
            case 3:
              build_type3(yloc[i3], xloc[i3]);
              break;
          }
        } else {
          build_room(yloc[i3], xloc[i3]);
        }
      }
    }
  }

  for (let i4: number = 1; i4 <= i3; i4++) {
    const pick1: number = randint(i3);
    const pick2: number = randint(i3);
    const y1: number = yloc[pick1];
    const x1: number = xloc[pick1];

    yloc[pick1] = yloc[pick2];
    xloc[pick1] = xloc[pick2];
    yloc[pick2] = y1;
    xloc[pick2] = x1;
  }

  doorptr = 0;
  doorstk = [];

  for (let i4: number = 1; i4 <= i3 - 1; i4++) {
    tunnel(yloc[i4 + 1], xloc[i4 + 1], yloc[i4], xloc[i4]);
  }

  fill_cave(g.rock_wall1);

  for (let i1: number = 1; i1 <= dun_str_mag; i1++) {
    place_streamer(g.rock_wall2, dun_str_mc);
  }

  for (let i1: number = 1; i1 <= dun_str_qua; i1++) {
    place_streamer(g.rock_wall3, dun_str_qc);
  }

  place_boundry();

  for (let i1: number = 1; i1 <= doorptr; i1++) {
    try_door(doorstk[i1].y, doorstk[i1].x - 1);
    try_door(doorstk[i1].y, doorstk[i1].x + 1);
    try_door(doorstk[i1].y - 1, doorstk[i1].x);
    try_door(doorstk[i1].y + 1, doorstk[i1].x);
  }

  const alloc_level: number = Math.min(Math.max(Math.trunc(real(g.dun_level / 3)), 2), 10);

  place_stairs(2, randint(2) + 2, 3);
  place_stairs(1, randint(2), 3);
  alloc_monster(pascalSet(1, 2), randint(8) + min_malloc_level + alloc_level, 0, true);
  alloc_object(pascalSet(4), 3, randint(alloc_level));
  alloc_object(pascalSet(1, 2), 5, randnor(treas_room_alloc, 3));
  alloc_object(pascalSet(1, 2, 4), 5, randnor(treas_any_alloc, 3));
  alloc_object(pascalSet(1, 2, 4), 4, randnor(treas_gold_alloc, 3));
  alloc_object(pascalSet(1, 2, 4), 1, randint(alloc_level));

  if (g.dun_level >= win_mon_appear) {
    place_win_monster();
  }
}


// generate.inc:872 build_store
function build_store(store_num: number, y: number, x: number): void {
  const yval: number = (y - 1) * 10 + 6;
  const xval: number = (x - 1) * 16 + 17;
  const y_height: number = yval - randint(3);
  const y_depth: number = yval + randint(4);
  const x_left: number = xval - randint(6);
  const x_right: number = xval + randint(6);
  const cur_pos: IRef<number> = box(0);
  let i1: number = 0;
  let i2: number = 0;

  fill_room(y_height, y_depth, x_left, x_right, g.boundry_wall);

  switch (randint(4)) {
    case 1:
      i1 = randint(y_depth - y_height) + y_height - 1;
      i2 = x_left;
      break;
    case 2:
      i1 = randint(y_depth - y_height) + y_height - 1;
      i2 = x_right;
      break;
    case 3:
      i1 = y_depth;
      i2 = randint(x_right - x_left) + x_left - 1;
      break;
    case 4:
      i1 = y_height;
      i2 = randint(x_right - x_left) + x_left - 1;
      break;
  }

  const cell: cave_type = g.cave[i1][i2];

  set_floor(cell, g.corr_floor3);
  popt(cur_pos);
  cell.tptr = cur_pos.get();
  g.t_list[cur_pos.get()] = clone(g.store_door[store_num]);
}


// generate.inc:920 town_gen: the stores come from town_seed, so the town is the same each visit.
function town_gen(): void {
  const rooms: number[] = [ 0, 1, 2, 3, 4, 5, 6 ];
  let i4: number = 6;

  rt().random.seed = g.town_seed;

  for (let i1: number = 1; i1 <= 2; i1++) {
    for (let i2: number = 1; i2 <= 3; i2++) {
      const i3: number = randint(i4);

      build_store(rooms[i3], i1, i2);

      for (let i5: number = i3; i5 <= i4 - 1; i5++) {
        rooms[i5] = rooms[i5 + 1];
      }

      i4--;
    }
  }

  fill_cave(g.dopen_floor);
  place_boundry();

  if (odd(mod(g.turn, 5000))) {
    for (let i1: number = 1; i1 <= g.cur_height; i1++) {
      for (let i2: number = 1; i2 <= g.cur_width; i2++) {
        if (g.cave[i1][i2].fval !== g.dopen_floor.ftval) {
          g.cave[i1][i2].pl = true;
        }
      }
    }

    place_stairs(2, 1, 0);
    rt().random.seed = get_seed();
    alloc_monster(pascalSet(1, 2), min_malloc_tn, 3, true);
    store_maint();
  } else {
    for (let i1: number = 1; i1 <= g.cur_height; i1++) {
      for (let i2: number = 1; i2 <= g.cur_width; i2++) {
        g.cave[i1][i2].pl = true;
      }
    }

    place_stairs(2, 1, 0);
    rt().random.seed = get_seed();
    alloc_monster(pascalSet(1, 2), min_malloc_td, 3, true);
    store_maint();
  }
}


// generate.inc:2 generate_cave
export function generate_cave(): void {
  g.panel_row_min = 0;
  g.panel_row_max = 0;
  g.panel_col_min = 0;
  g.panel_col_max = 0;
  g.char_row = -1;
  g.char_col = -1;
  tlink();
  mlink();
  blank_cave();

  if (g.dun_level === 0) {
    g.cur_height = screen_height;
    g.cur_width = screen_width;
    set_panels();
    town_gen();
  } else {
    g.cur_height = max_height;
    g.cur_width = max_width;
    set_panels();
    cave_gen();
  }
}


function set_panels(): void {
  g.max_panel_rows = Math.trunc(real(g.cur_height / screen_height)) * 2 - 2;
  g.max_panel_cols = Math.trunc(real(g.cur_width / screen_width)) * 2 - 2;
  g.panel_row = g.max_panel_rows;
  g.panel_col = g.max_panel_cols;
}
