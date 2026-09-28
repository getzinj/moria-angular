// The locals of moria.inc's dungeon that its nested routines, and the files included inside it
// (creatures, spells, the item commands), read and write. reset_flag here shadows the global.

export interface IDungeonLocals {
  command: string;
  out_val: string;
  moria_flag: boolean;
  reset_flag: boolean;
  search_flag: boolean;
  teleport_flag: boolean;
  player_light: boolean;
}

export const dl: IDungeonLocals = {
  command: '',
  out_val: '',
  moria_flag: false,
  reset_flag: false,
  search_flag: false,
  teleport_flag: false,
  player_light: false,
};
