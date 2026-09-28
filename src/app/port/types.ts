// source/include/types.inc. Subranges are number; unchecked stores wrap with pascal.ts's *_of and *_bits.
// An array [1..n] is indexed as in Pascal, index 0 unused.

/** [byte] 0..255 */
export type byteint = number;
/** [byte] -128..127 */
export type bytlint = number;
/** [word] 0..65535 */
export type wordint = number;
/** [word] -32768..32767 */
export type worlint = number;
/** 32-bit unsigned bit field */
export type unsigned = number;

export interface quad_type {
  l0: unsigned;
  l1: unsigned;
}

// varying [n] of char: the capacity is noted, not enforced.
/** varying [16] */
export type atype = string;
/** varying [14] */
export type btype = string;
/** varying [26] */
export type ctype = string;
/** varying [5] */
export type dtype = string;
/** varying [34] */
export type etype = string;
/** varying [190] */
export type mtype = string;
/** varying [1024] */
export type ntype = string;
/** varying [68] */
export type ttype = string;
/** varying [80] */
export type vtype = string;
/** packed array [1..6] of char */
export type stat_type = string;
/** set of 0..255 */
export type obj_set = ReadonlySet<number>;
/** set of 'A'..'z' */
export type char_set = ReadonlySet<string>;

/** For char saver. */
export interface key_type {
  file_id: string; // packed array [1..70] of char
  seed: number;
}

export interface creature_type {
  name: ctype; // Descrip of creature
  cmove: unsigned; // Bit field
  spells: unsigned; // Creature spells
  cdefense: wordint; // Bit field
  sleep: worlint; // Inactive counter
  mexp: wordint; // Exp value for kill
  aaf: byteint; // Area affect radius
  ac: byteint; // AC
  speed: bytlint; // Movement speed
  cchar: string; // Character rep.
  hd: dtype; // Creatures hit die
  damage: etype; // Type attack and damage
  level: byteint; // Level of creature
}

export interface monster_type {
  hp: worlint; // Hit points
  csleep: worlint; // Inactive counter
  cdis: worlint; // Cur dis from player
  mptr: wordint; // Pointer into creature
  nptr: wordint; // Pointer to next block
  cspeed: bytlint; // Movement speed
  fy: byteint; // Y Pointer into map; constrains dungeon size to 255
  fx: byteint; // X Pointer into map
  stuned: number; // [bit(6)] -32..31, rounds stunned: signed_bits(x, 6)
  ml: boolean; // On if shown
  confused: boolean; // On if confused
}

export interface treasure_type {
  name: ttype; // Object name
  tval: byteint; // Catagory number
  tchar: string; // Character representation
  flags: unsigned; // Special flags
  p1: number; // Misc. use variable
  cost: number; // Cost of item
  subval: number; // Sub-catagory number
  weight: wordint; // Weight
  number: wordint; // Number of items
  tohit: worlint; // Pluses to hit
  todam: worlint; // Pluses to damage
  ac: worlint; // Normal AC
  toac: worlint; // Pluses to AC
  damage: dtype; // Damage when hits
  level: bytlint; // Level item found
}

export interface player_misc_type {
  name: vtype; // Name of character
  race: vtype; // Race of character
  sex: vtype; // Sex of character
  title: vtype; // Character's title
  tclass: vtype; // Character's class
  max_exp: number; // Max experience
  exp: number; // Cur experience
  au: number; // Gold
  age: wordint; // Characters age
  ht: wordint; // Height
  wt: wordint; // Weight
  lev: wordint; // Level
  max_lev: wordint; // Max level explored
  srh: worlint; // Chance in search
  fos: worlint; // Frenq of search
  bth: worlint; // Base to hit
  bthb: worlint; // BTH with bows
  mana: worlint; // Mana points
  mhp: worlint; // Max hit pts
  ptohit: worlint; // Pluses to hit
  ptodam: worlint; // Pluses to dam
  pac: worlint; // Total AC
  ptoac: worlint; // Magical AC
  dis_th: worlint; // Display +ToHit
  dis_td: worlint; // Display +ToDam
  dis_ac: worlint; // Display +ToAC
  dis_tac: worlint; // Display +ToTAC
  disarm: worlint; // % to Disarm
  save: worlint; // Saving throw
  sc: worlint; // Social Class
  pclass: byteint; // # of class
  prace: byteint; // # of race
  hitdie: byteint; // Char hit die
  stl: bytlint; // Stealth factor
  expfact: number; // real: Experience factor
  cmana: number; // real: Cur mana pts
  chp: number; // real: Cur hit pts
  history: vtype[]; // array [1..5]
}

export interface player_stat_type {
  str: byteint; // Max strength
  cstr: byteint; // Current strength
  dex: byteint; // Max dexterity
  cdex: byteint; // Current dexterity
  con: byteint; // Max constitution
  ccon: byteint; // Current constitution
  int: byteint; // Max intelligence
  cint: byteint; // Current intelligence
  wis: byteint; // Max wisdom
  cwis: byteint; // Current wisdom
  chr: byteint; // Max charisma
  cchr: byteint; // Current charisma
}

export interface player_flags_type {
  status: unsigned; // Status of player
  rest: number; // Rest counter
  blind: number; // Blindness counter
  paralysis: number; // Paralysis counter
  confused: number; // Confusion counter
  food: number; // Food counter
  food_digested: number; // Food per round
  protection: number; // Protection fr. evil
  speed: number; // Cur speed adjust
  fast: number; // Temp speed change
  slow: number; // Temp speed change
  afraid: number; // Fear
  poisoned: number; // Poisoned
  image: number; // Halucinate
  protevil: number; // Protect VS evil
  invuln: number; // Increases AC
  hero: number; // Heroism
  shero: number; // Super Heroism
  blessed: number; // Blessed
  resist_heat: number; // Timed heat resist
  resist_cold: number; // Timed cold resist
  detect_inv: number; // Timed see invisible
  word_recall: number; // Timed teleport level
  see_infra: number; // See warm creatures
  tim_infra: number; // Timed infra vision
  see_inv: boolean; // Can see invisible
  teleport: boolean; // Random teleportation
  free_act: boolean; // Never paralyzed
  slow_digest: boolean; // Lower food needs
  aggravate: boolean; // Agravate monsters
  fire_resist: boolean; // Resistance to fire
  cold_resist: boolean; // Resistance to cold
  acid_resist: boolean; // Resistance to acid
  regenerate: boolean; // Regenerate hit pts
  lght_resist: boolean; // Resistance to light
  ffall: boolean; // No damage falling
  sustain_str: boolean; // Keep strength
  sustain_int: boolean; // Keep intelligence
  sustain_wis: boolean; // Keep wisdom
  sustain_con: boolean; // Keep constitution
  sustain_dex: boolean; // Keep dexterity
  sustain_chr: boolean; // Keep charisma
  confuse_monster: boolean; // Glowing hands...
}

export interface player_type {
  misc: player_misc_type;
  stat: player_stat_type;
  flags: player_flags_type;
}

export interface spell_type {
  sname: ctype;
  slevel: byteint;
  smana: byteint;
  sexp: wordint;
  sfail: byteint;
  learned: boolean;
}

export interface spl_rec {
  splnum: number;
  splchn: number;
}

/** array [1..22] of spl_rec */
export type spl_type = spl_rec[];

export interface race_type {
  trace: vtype; // Type of race
  str_adj: bytlint; // adjustments
  int_adj: bytlint;
  wis_adj: bytlint;
  dex_adj: bytlint;
  con_adj: bytlint;
  chr_adj: bytlint;
  b_age: wordint; // Base age of character
  m_age: wordint; // Maximum age of character
  m_b_ht: wordint; // base height for males
  m_m_ht: wordint; // mod height for males
  m_b_wt: wordint; // base weight for males
  m_m_wt: wordint; // mod weight for males
  f_b_ht: wordint; // base height females
  f_m_ht: wordint; // mod height for females
  f_b_wt: wordint; // base weight for female
  f_m_wt: wordint; // mod weight for females
  b_exp: number; // real: Base experience factor
  b_dis: bytlint; // base chance to disarm
  srh: bytlint; // base chance for search
  stl: bytlint; // Stealth of character
  fos: bytlint; // frequency of auto search
  bth: bytlint; // adj base chance to hit
  bthb: bytlint; // adj base to hit with bows
  bsav: bytlint; // Race base for saving throw
  bhitdie: bytlint; // Base hit points for race
  infra: bytlint; // See infra-red
  tclass: unsigned; // Bit field for class types
}

export interface class_type {
  title: vtype; // type of class
  m_exp: number; // real: Class experience factor
  adj_hd: bytlint; // Adjust hit points
  mdis: bytlint; // mod disarming traps
  msrh: bytlint; // modifier to searching
  mstl: bytlint; // modifier to stealth
  mfos: bytlint; // modifier to freq-of-search
  mbth: bytlint; // modifier to base to hit
  mbthb: bytlint; // modifier to base to hit - bows
  msav: bytlint; // Class modifier to save
  madj_str: bytlint; // Class modifier for strength
  madj_int: bytlint; // Class modifier for intelligence
  madj_wis: bytlint; // Class modifier for wisdom
  madj_dex: bytlint; // Class modifier for dexterity
  madj_con: bytlint; // Class modifier for constitution
  madj_chr: bytlint; // Class modifier for charisma
  pspell: boolean; // class use priest spells
  mspell: boolean; // class use mage spells
}

export interface background_type {
  info: vtype; // History information
  roll: byteint; // Die roll needed for history
  chart: byteint; // Table number
  next: bytlint; // Pointer to next table
  bonus: bytlint; // Bonus to the Social Class
}

export interface floor_type {
  ftval: number; // [bit(7)] 0..15: unsigned_bits(x, 7)
  ftopen: boolean;
}

export interface cave_type {
  cptr: byteint;
  tptr: byteint;
  fval: number; // [bit(4)] 0..15: unsigned_bits(x, 4)
  fopen: boolean;
  fm: boolean;
  pl: boolean;
  tl: boolean;
}

/** array [1..max_width] of cave_type */
export type row_floor = cave_type[];

export interface owner_type {
  owner_name: vtype;
  max_cost: worlint;
  max_inflate: number; // real
  min_inflate: number; // real
  haggle_per: number; // real
  owner_race: byteint;
  insult_max: byteint;
}

export interface inven_record {
  scost: number;
  sitem: treasure_type;
}

export interface store_type {
  store_open: worlint;
  owner: byteint;
  insult_cur: bytlint;
  store_ctr: byteint;
  store_inven: inven_record[]; // array [1..store_inven_max]
}
