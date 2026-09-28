// source/include/constants.inc. "Tweaking these constants can *GREATLY* change the game." -RAK-

import { real } from '../runtime/pascal';

// Current version number of Moria
export const cur_version: number = real(4.8);

// QIOW constants, see $IODEF in STARLET.MLB. Kept for the record; the terminal layer stands in
// for the QIOs they built.
export const IO$_WRITEVBLK: number = 0x0030;
export const IO$_TTYREADALL: number = 0x003A;
export const IO$M_NOECHO: number = 0x0040;
export const IO$M_NOWAIT: number = 0x0080;
export const IO$M_PURGE: number = 0x0800;
export const IO$MOR_OUTPUT: number = IO$_WRITEVBLK;
export const IO$MOR_INPUT: number = IO$_TTYREADALL + IO$M_NOECHO;
export const IO$MOR_DELAY: number = IO$MOR_INPUT + IO$M_NOWAIT;
export const IO$MOR_IPURGE: number = IO$MOR_DELAY + IO$M_PURGE;
// No longer used after VMS 4.0, and not here either.
export const IO$MOR_IOPAUSE: number = 5;

// Encryption constants. Changing them breaks restoring characters from other versions.
export const encrypt_seed1: number = 1175191;
export const encrypt_seed2: number = 997551771;

// Dungeon size parameters
export const max_height: number = 66; // Multiple of 11; >= 22
export const max_width: number = 198; // Multiple of 33; >= 66
export const screen_height: number = 22;
export const screen_width: number = 66;

// Output dungeon section sizes
export const outpage_height: number = 44;
export const outpage_width: number = 99;

// Dungeon generation values
export const dun_tun_rnd: number = 36; // Random direction (4 is min)
export const dun_tun_chg: number = 70; // Chance of changing direction (99 max)
export const dun_tun_fnd: number = 12; // Distance for auto find to kick in
export const dun_tun_con: number = 15; // Chance of extra tunneling
export const dun_roo_mea: number = 32; // Mean of # of rooms, standard dev=2
export const dun_tun_pen: number = 25; // % chance of room doors
export const dun_tun_jct: number = 15; // % chance of doors at tunnel junctons
export const dun_str_den: number = 5; // Density of streamers
export const dun_str_rng: number = 2; // Width of streamers
export const dun_str_mag: number = 3; // Number of magma streamers
export const dun_str_mc: number = 95; // 1/x chance of treasure per magma
export const dun_str_qua: number = 2; // Number of quartz streamers
export const dun_str_qc: number = 55; // 1/x chance of treasure per quartz
export const dun_unusual: number = 300; // Level/x chance of unusual room

// Store constants
export const max_owners: number = 18;
export const max_stores: number = 6;
export const store_inven_max: number = 24; // Max number of discrete objs in inven
export const store$choices: number = 26; // Number of items to choice stock from
export const store$max_inven: number = 20; // Max diff objs in stock before auto sell
export const store$min_inven: number = 14; // Min diff objs in stock before auto buy
export const store$turn_around: number = 3; // Amount of buying and selling normally
export const inven_init_max: number = 105; // Size of store init array
export const cost_adj: number = real(1.00); // Adjust prices for buying and selling

// Treasure constants
export const inven_max: number = 35; // Size of inventory array (Do not change)
export const max_obj_level: number = 50; // Maximum level of magic in dungeon
export const obj_great: number = 20; // 1/n Chance of item being a Great Item
export const max_objects: number = 344; // Number of objects for universe
export const max_gold: number = 18; // Number of different types of gold
export const max_talloc: number = 225; // Max objects per level
export const treas_room_alloc: number = 7; // Amount of objects for rooms
export const treas_any_alloc: number = 2; // Amount of objects for corridors
export const treas_gold_alloc: number = 2; // Amount of gold (and gems)

// Magic treasure generation constants
export const obj_std_adj: number = real(1.25); // Adjust STD per level
export const obj_std_min: number = 7; // Minimum STD
export const obj_town_level: number = 7; // Town object generation level
export const obj_base_magic: number = 15; // Base amount of magic
export const obj_base_max: number = 70; // Max amount of magic
export const obj_div_special: number = 6; // magic_chance/# = special magic
export const obj_div_cursed: number = real(1.3); // magic_chance/# = cursed items

// Constants describing limits of certain objects
export const obj$lamp_max: number = 15000; // Maximum amount that lamp can be filled
export const obj$bolt_range: number = 18; // Maximum range of bolts and balls
export const obj$rune_prot: number = 3000; // Rune of protection resistance

// Creature constants
export const max_creatures: number = 279; // Number of creatures defined for univ
export const max_malloc: number = 100 + 1; // Max that can be allocated
export const max_malloc_chance: number = 160; // 1/x chance of new monster each round
export const max_mons_level: number = 40; // Maximum level of creatures
export const max_sight: number = 20; // Maximum dis a creature can be seen
export const max_spell_dis: number = 20; // Maximum dis creat. spell can be cast
export const max_mon_mult: number = 75; // Maximum reproductions on a level
export const mon_mult_adj: number = 7; // High value slows multiplication
export const mon_nasty: number = 50; // Dun_level/x chance of high level creat
export const min_malloc_level: number = 14; // Minimum number of monsters/level
export const min_malloc_td: number = 4; // Number of people on town level (day)
export const min_malloc_tn: number = 8; // Number of people on town level (night)
export const win_mon_tot: number = 2; // Total number of "win" creatures
export const win_mon_appear: number = 50; // Level where winning creatures begin
export const mon$summon_adj: number = 2; // Adjust level of summoned creatures
export const mon$drain_life: number = 2; // Percent of player exp drained per hit

// Trap constants
export const max_trapa: number = 18; // Number of defined traps
export const max_trapb: number = 19; // Includes secret doors

// Descriptive constants
export const max_colors: number = 67; // Used with potions
export const max_mush: number = 29; // Used with mushrooms
export const max_woods: number = 41; // Used with staffs
export const max_metals: number = 31; // Used with wands
export const max_rocks: number = 52; // Used with rings
export const max_amulets: number = 39; // Used with amulets
export const max_syllables: number = 153; // Used with scrolls

// Player constants
export const max_player_level: number = 40; // Maximum possible character level
export const max_races: number = 8; // Number of defined races
export const max_class: number = 6; // Number of defined classes
export const use_device: number = 3; // x> Harder devices x< Easier devices
export const max_background: number = 128; // Number of types of histories for univ
export const player_food_full: number = 10000; // Getting full
export const player_food_max: number = 15000; // Maximum food value, beyond is wasted
export const player_food_faint: number = 300; // Character begins fainting
export const player_food_weak: number = 1000; // Warn player that he is getting very low
export const player_food_alert: number = 2000; // Warn player that he is getting low
export const player$regen_faint: number = real(0.0005); // Regen factor when fainting
export const player$regen_weak: number = real(0.0015); // Regen factor when weak
export const player$regen_normal: number = real(0.0030); // Regen factor when full
export const player$regen_hpbase: number = real(0.0220); // Min amount hp regen
export const player$regen_mnbase: number = real(0.0080); // Min amount mana regen
export const player_weight_cap: number = 130; // "#"*(1/10 pounds) per strength point
export const player_exit_pause: number = 6; // Pause time before player can re-roll

// Base to hit constants
export const bth_lev_adj: number = 3; // Adjust BTH per level
export const bth_plus_adj: number = 3; // Adjust BTH per plus-to-hit
export const bth_hit: number = 12; // Automatic hit; 1/bth_hit

// Misc
export const null_char: string = '\0'; // `null` in the original, a reserved word here
