# Moria port — VMS Moria 4.8 as `apps/Moria`

> Written while the port lived in [Stonequest-Angular](https://github.com/getzinj/Stonequest-Angular) as `apps/Moria`. Paths below are relative to that repo; `apps/Moria/` is this repo's root, and the `nx` commands are now the npm scripts in the README.

**Status:** Phases 1–11 ✅ — the port is complete.

**Legend:** ✅ Done &nbsp; 🟡 Partial &nbsp; ⬜ Not started

## Context

Apple II Wizardry was earlier hand-ported Apple II Wizardry as a standalone Nx app (`apps/wizardry`, added `530827b`, removed in `005bba2` when it moved to its own repo; the full app is at `94b50ac` on GitHub). This does the same for **VMS Moria 4.8** (github.com/dungeons-of-moria/vms-moria: ~25k lines VAX Pascal + 8 VAX MACRO routines). Unlike Wizardry, it should look like Stonequest's VAX/VMS terminal: green `#6e8d3b` on black, the `vt220` font, 80×24.

Decisions:
- Location: `apps/Moria` in this monorepo (it may move repos later).
- Terminal: no shared lib. Moria has its own 24×80 grid and copies only the font and colours (see below).
- Fidelity: line-by-line hand-port (same RNG, formulas and quirks); plain-TS game core with a thin Angular shell.
- Persistence: browser `localStorage` only (saves, top twenty, and a MASTER.DAT equivalent). No login, no server.
- VMS feel: the game screen only. No DCL login shell, and no MORIA.HOU operating-hours check.
- Input: original keys (digits 1–9 and the original command letters), plus arrow keys, with Home/PgUp/End/PgDn as the diagonals. No touch support.
- Colour: monochrome in Stonequest's text colour. The original uses no video attributes at all.
- Wizard/god modes: ported as-is with their original passwords (`@SHADOW@` for wizard, `@Grylion@` for god), in every build.
- Help: emulate VMS `HELP` (`Topic?` / `Subtopic?`, ^Z to resume) over text extracted from `execute/moriahlp.hlb`.
- Deployment: none; local dev server only.
- Licence: GPL-3.0 for the port's own work only; nothing is licensed for the ported game (see `apps/Moria/NOTICE`).
- Scope: the full game, delivered as the ordered phases below. Each phase lands as its own commit or PR with its checks green.

## Porting conventions (carried over from the Wizardry port)

- **One TS file per Pascal source file**, under `apps/Moria/src/app/port/`: `constants.ts`, `types.ts`, `variables.ts` (generated from `variables.inc` and `values.inc`), `io.ts`, `misc.ts`, `death.ts`, `help.ts`, `desc.ts`, `files.ts`, `store1.ts`, `save.ts`, `create.ts`, `generate.ts`, `moria.ts` (`dungeon`), `store2.ts`, `spells.ts`, `wizard.ts`, `creature.ts`, `scrolls.ts`, `potions.ts`, `eat.ts`, `wands.ts`, `staffs.ts`, `magic.ts`, `prayer.ts`, and `main.ts` (from `moria.pas`).
- **Every ported procedure gets a header comment** of the form `// source/include/misc.inc:2511 bpswd`.
- **Identifiers keep their original snake_case names.** `@typescript-eslint/naming-convention` is off in `eslint.config.mjs`, so this passes lint.
- **Globals live in one exported mutable object `g`** (plus `py` and the lists hanging off it), with `resetglobals()` to start over. Modules can't rebind an imported name, which is why it's one object.
- **Locals of `dungeon`, `generate_cave` and `creatures` that nested routines use** (`moria_flag`, `search_flag`, `teleport_flag`, `player_light`, `command`, and the local `reset_flag` that shadows the global one) go into an explicit context object passed to the nested files.
- **Every routine that can reach `inkey` is `async`**, with one promise per key, as in Wizardry. `no-floating-promises` stays on. Running the game in a Web Worker with `Atomics.wait` was rejected, because it needs cross-origin-isolation headers and makes tests harder.
- **VAX Pascal hazards** are handled by helpers in `runtime/pascal.ts`:
  - Record `:=` becomes `clone()`.
  - A `var` parameter on a field or array element becomes a getter/setter ref (`ref(obj,'field')`).
  - `with` becomes a local const.
  - `set of` becomes a small bitset.
  - `varying[n]` strings get `substr`/`index`/`pad`, and `writev`/`readv` formatting is reproduced.
  - Pascal `round` rounds halves away from zero.
  - 32-bit `REAL` uses `Math.fround`.
  - `uand`/`uor`/`uxor` use `>>> 0`.
  - A `case` with no matching branch does nothing (compiled with `/nocheck`).
  - A store that can leave a subrange goes through `byteint_of`, `bytlint_of`, `wordint_of` or `worlint_of`, and a bit field through `signed_bits` or `unsigned_bits`.
  - An `array [low..n]` is indexed as in Pascal, with padding below `low`. Loop over it with the Pascal bounds, never with `for..of`, `find` or `every`.
- **The program-level `exit`** becomes `throw new MoriaExit()`, which the shell catches to show a "press any key to restart" screen.
- **Porting progress is tracked** in `docs/plans/2026-09-moria-port.md`, like the Wizardry plan: a status per phase, a Progress list of findings, and a Risks list. A row goes into `docs/PLAN.md` per CLAUDE.md.

## Terminal: no shared lib; Moria gets its own small screen

Stonequest's SMG$ layer is **not** extracted.
- **What Moria needs is small.** It uses no SMG$. It writes raw VT100 escape codes (cursor moves, `ESC[K` erase-line, `ESC[J` erase-screen) to one full 80×24 screen, with no windows, borders or video attributes.
- **Extraction wasn't worth the risk.** It would have meant about ten refactors inside Stonequest plus roughly 478 import rewrites, just to get one plain grid.
- **So Moria copies only the look:**
  - the vt220 font files from `apps/Stonequest/src/assets/fonts/` (`glass_tty_vt220_-_modified-webfont.woff2`/`.woff`);
  - the `@font-face` block from `apps/Stonequest/src/styles.scss`;
  - `#6e8d3b` on black, from `styles/_colors.scss` `$crt_green`;
  - the 80×24 scaling approach from `styles/_fonts.scss`: `0.4em`×`1em` cells, with the font sized from the viewport, minus the toolbar and automap parts.
- Stonequest is left untouched.

## ✅ Phase 1 — `apps/Moria` scaffold and 80×24 screen

- **Project.** Use `nx g @nx/angular:application` (via the `nx-generate` skill), shaped like the old `apps/wizardry/project.json`:
  - tag `layer:app`, prefix `moria`;
  - `@angular/build` application and dev-server, with serve on port 4201;
  - no SSR or prerender, and no Vercel config.
  - Add `apps/Moria/**/*` to the `nx.json` eslint include.
- **App config.** Zoneless: `provideZonelessChangeDetection()` and `provideBrowserGlobalErrorListeners()`. `test-setup.ts` uses `setupTestBed({ zoneless: true })`.
- **Components.** `AppComponent` hosts `Vt100ScreenComponent` (`app/shell/`).
  - It renders a `ScreenGrid` model: 24 rows of 80 characters, held as one `signal<string[]>`, one entry per row, replaced on each flush.
  - Output is in the vt220 font, `#6e8d3b` on black, with a block cursor.
  - This phase shows a test pattern with the ruler and corners.
- **Keyboard** (`app/shell/key-mapping.ts`), driven by `window:keydown`:
  - Printable characters pass through.
  - Arrows map to `8`/`2`/`4`/`6`, and Home/PgUp/End/PgDn map to `7`/`9`/`1`/`3`.
  - Ctrl+letter becomes the control code.
  - Browsers swallow some Ctrl keys (^W, ^T, ^N), and god mode needs them. So **Alt+letter is an alias for Ctrl+letter**.
  - Esc sends 27, Enter sends 13, and Backspace sends DEL (127).
- **Licence files.**
  - `apps/Moria/LICENSE` holds the GPL-3.0 text.
  - `apps/Moria/NOTICE` says the grant covers only the port's own original work. Code, data and help text ported from VMS Moria 4.8 (Koeneke, Todd, McAdoo) stays under its authors' terms, which upstream doesn't state.
  - `apps/Moria/README.md` repeats this and adds how to run.
- **E2E.** Playwright `apps/Moria/e2e/` with `playwright.config.ts`, copied from `apps/Stonequest/e2e/playwright.config.ts`. One smoke spec checks that the screen renders 24 rows and that a keypress echoes.

## ✅ Phase 2 — Runtime layer (`apps/Moria/src/app/runtime/`, no Angular)

- **`random.ts`**, ported exactly from `randint.mar` and `randrep.mar`:
  - `seed = Math.imul(seed,16807) & 0x7fffffff`
  - `randint(x) = trunc((seed-1)*x/2147483647)+1`, with BigInt for the product, since `randnor` calls `randint(9999999)`.
  - `randint(0)` returns 1.
  - Golden test: running `bpswd` over the `wdata` table must produce `@SHADOW@` and `@Grylion@`.
- **`macro.ts`**: `distance`, `bit_pos` (clears the bit it finds), `insert_str`, `maxmin`, `minmax`.
- **`pascal.ts`**: the helpers listed under conventions.
- **`terminal.ts`**: a `Terminal` class over `ScreenGrid` and `Keyboard`, with `put_buffer`, `erase_to_end_of_line`, `erase_to_end_of_screen`, `put_qio`, `read_key`, `poll_key` and `flush_input`.
  - `put_buffer`/`put_qio` become buffered writes, flushed when a key is read. There is no VT100 escape parser.
  - Tests read the `ScreenGrid` through `toString()`.
- **`keyboard.ts`** (from Phase 1): a type-ahead queue with a promise per key.
  - `flush` discards type-ahead, as in the original.
  - `poll()` is the zero-second timed read, which resting uses.
  - A `waiting` flag lets tests see when the game is parked on input.
- **`clock.ts`**: a real clock and an `InstantClock` for tests. Provides `sleep`, the `get_seed` time source, and the date/time strings for the tombstone.
- **`files.ts`**: virtual VMS files in `localStorage` under the prefix `moria:`.
  - Save files are named by the player.
  - `MORIACHR.DAT` is the master key set.
  - `MORIATOP.DAT` holds the top twenty.
  - `MORIA.DAT` (news) is built in.
  - The map, object, monster and character-sheet dumps download as `.txt` files through a Blob. That part is deferred to Phase 10, where the dumps are ported.
- **Stand-ins for other VMS services:**
  - The username is a fixed `PLAYER`, stored in `localStorage` so it can be changed later.
  - `LIB$SPAWN` for `$` prints that subprocesses aren't available.
  - SYSPRV switching and Ctrl-Y enable/disable do nothing.
  - The 5/100 s wait before each read is dropped, as `vms4.txt` advises.
- **`exit.ts`**: `MoriaExit`.

## ✅ Phase 3 — Data (`constants`, `types`, `variables`)

- **Hand-ported:** `port/constants.ts` and `port/types.ts`.
  - REAL constants go through `real()`.
  - `null` becomes `null_char`, because `null` is a reserved word in TypeScript.
  - Integer subranges are `number`, and stores that can leave their range go through the `*_of` and `*_bits` wraps in `runtime/pascal.ts`.
- **Generated:** `port/variables.ts`, by `apps/Moria/tools/convert-values.ts` (`npx nx run Moria:convert-values --upstream=<vms-moria checkout>`).
  - The converter reads `types.inc`, `variables.inc` and `values.inc` directly, so it writes every global together with its type, its `values.inc` value, or the zeroes that uninitialised VMS static storage held.
  - Doing that for `variables.inc` too, rather than hand-porting it, removes a second place for a transcription slip.
  - The converter refuses a record or array given the wrong number of values, a fixed-length string that is too long (a shorter one is blank-padded), and an array with a negative lower bound.
  - Named REAL constants keep their single precision, and `*` binds tighter than `+`/`-` in constant expressions.
  - The TypeScript compiler then checks every generated record literal against `types.ts`, which pins the field names.
  - Only the generated file is committed, never upstream source.
- **Tests** pin the table sizes (`c_list` 279, `object_list` 344, `inventory_init` 105, `background` 128, `magic_spell` 6×31, among others) and spot-check values against `values.inc`.
  - The unstable shell sort of `object_list` is ported with `sort_objects` in Phase 4, and its ordering test moves there.

## ✅ Phase 4 — `io`, `misc`, `desc`

- **`io.inc`**:
  - `prt`, `erase_line`, `clear` (with the `used_line` flags), `print`, `msg_print` (with `-more-`), `inkey`, `inkey_delay`, `inkey_flush`, `get_com`, `get_string` (DEL as backspace), `get_hex_value`, `pause` and `pause_exit`.
  - Layout: row 1 is messages, the map is rows 2–23 at columns 15–80, the stats block is at column 1, and row 24 is the status line.
- **`misc.inc`**: all of it, including `bpswd`, `check_pswd` and `sort_objects`. A test pins the order the unstable shell sort leaves `object_list` in.
- **`desc.inc`**: flavour shuffling, `magic_init` and `objdes`.
- **Checkpoint:** tests show deterministic flavour names from a fixed seed, and `objdes` output for sample objects.

## ✅ Phase 5 — Startup, character creation, help

- **`main.ts`** (from `moria.pas`):
  - Startup order, then new character or restore, then `repeat generate_cave; dungeon until death`, then `upon_death`.
  - `LIB$GET_FOREIGN` is replaced by a one-line prompt at startup, only when a save exists: `Restore file (RETURN for new character):`. It accepts `/WIZARD`.
- **`create.inc`** and **`help.inc`**: the `h` command list, `/` symbol identify, and wizard help.
- **`files.inc` `intro`**: shows the news. The hours check is removed.
- **VMS HELP emulator.** `tools/extract-help.ts` parses the VAX librarian format of `moriahlp.hlb` (length-prefixed records, joined back across 512-byte block splits) into a committed `port/help-library.data.ts` topic tree, dropping the stale duplicate ARMOR topic. `port/vms-help.ts` does `HELP/PAGE`:
  - `Topic?` and `Subtopic?` prompts;
  - paging with `Press RETURN to continue ...`;
  - topic-name abbreviation matching;
  - ^Z returns to the game.
  - `moria_help` is also called from creation (Races, Sex, Classes).
- **Checkpoint:** create a character end to end, and browse HELP.

## ✅ Phase 6 — Dungeon generation and the core loop

- **`generate.inc`**: town and dungeon.
- **`moria.inc` core**: panels and scrolling, `prt_map`, lighting, `move_char`, running (`.` and `pick_dir`), search, doors, stairs, and the per-turn loop (food, regeneration, timed effects, command dispatch).
- `creatures()` is a no-op stub until Phase 7.
- **Checkpoint:** the town generated from a fixed `town_seed` matches a golden screen, and you can walk the town and go down stairs.

## ✅ Phase 7 — Monsters and combat

- `creature.inc`, `spells.inc`, and the combat and traps parts of `moria.inc`.
- **Checkpoint:** a seeded fight runs to a deterministic result.

## ✅ Phase 8 — Items and magic

- Inventory and equipment commands in `moria.inc`, plus `scrolls`, `potions`, `eat`, `wands`, `staffs`, `magic` and `prayer`.

## ✅ Phase 9 — Stores

- `store1.inc` and `store2.inc` (haggling), including `store_maint` over time.

## ✅ Phase 10 — Save, death, scores, wizard

- **`save.inc`**:
  - Keep the same fields and order, but store them as JSON in `localStorage`. The XOR/checksum encoding is not reproduced; its RNG draws are kept only where they affect play.
  - Keep the anti-cheat: saving registers a `file_id` in the master set, and restoring deletes both the key and the save file, so each save can be restored once.
  - Version rules are kept.
- **`death.inc`**: tombstone (optionally downloaded), top twenty (`max_exp + 100*max_lev`, wizards not scored), and the King/Queen ending.
- **`wizard.inc`**: all ^-commands, including `restore_char`. The uninitialized-`temp_id` bug is reproduced and noted in the plan doc.
- **`files.inc`** dumps are delivered as downloads.

## ✅ Phase 11 — Hardening

- **Playwright.** A scripted, seeded run: create a character, walk the town, buy an item, go down, save, and restore once. A second restore must fail.
- **Docs.** Update the port plan doc's Progress and Risks, and flip the `docs/PLAN.md` row to ✅.

## Critical files

- **New:** `apps/Moria/**`, `docs/plans/2026-09-moria-port.md`.
- **Modified:** `nx.json` (eslint include), `.gitignore` (the converter's and extractor's scratch output), `docs/PLAN.md`. Nothing in `apps/Stonequest` changes.
- **Reference:** `apps/wizardry` at `94b50ac` on GitHub, for `project.json`, `port-fixture.ts` (`boot`/`play`/`screenAfter`/`waitAtPrompt`, which Moria's `port-fixture.ts` mirrors) and the keyboard/promise pattern.

## Progress

- **Phase 1 (done).** `apps/Moria` was generated with `@nx/angular:application`, then trimmed to the repo's conventions:
  - The generator's root `eslint.base.config.mjs` and per-app `eslint.config.mjs` were dropped. Lint is inferred from the root config through `nx.json`'s eslint include, as it was for Wizardry.
  - `vite.config.mts`, `tsconfig.spec.json` and `test-setup.ts` follow Stonequest's (`isolate: false`, zoneless TestBed).
  - The screen is `runtime/screen-grid.ts`, plain TypeScript with 1-based rows and columns as `put_buffer` used them. It collects writes and publishes on `flush()`, which is what `put_qio` did before each read. `shell/vt100-screen.component.ts` renders it.
  - `runtime/keyboard.ts` is the promise-per-key queue that Phase 2 builds on.
  - The vt220 webfont files are copied into `apps/Moria/public/fonts/`, and the scaling mixin into `src/styles/_terminal.scss`.
  - `npx nx e2e Moria` runs a Playwright smoke test on port 4201.
  - The GPL-3.0 text in `apps/Moria/LICENSE` is the canonical file (md5 `1ebbd3e34237af26da5dc08a4e440464`).

- **Phase 2 (done).** Everything is in `apps/Moria/src/app/runtime/`, with no Angular:
  - `random.ts` is checked against the only independent evidence there is: running `bpswd` over `values.inc`'s `wdata` gives `@SHADOW@` and `@Grylion@`. That means the multiply, the top-bit mask, the `seed - 1` and the truncating 64-bit divide all match the MACRO.
  - The seed is a public field on `Random`, rather than a member of `g`, because `randint` has to reach it and the port assigns it directly.
  - `macro.ts` has the other six MACRO routines. `bit_pos` returns the cleared flags alongside the position, since TypeScript has no VAR parameter; call sites write them back.
  - `insert_str` returns the new string for the same reason.
  - `pascal.ts` has `ref`, `clone`, `round`, `div`, `real` (`Math.fround`), `uand`/`uor`/`uxor`, `pascalSet`/`charSet`, `substr`/`index`/`pad`/`packed`, the `writev` formatters and a `Readv` cursor.
  - `clock.ts` has `get_seed` from the 64-bit VMS time (100 ns ticks since 17-Nov-1858), `DATE`/`TIME` formatting, and a `RealClock` plus an `InstantClock` for tests.
  - `files.ts` has `MemoryFileStore` and `BrowserFileStore`, which uses the `moria:file:` prefix and capitalises names as VMS did.
  - `vms.ts` has `get_username` (`PLAYER` by default, blank-padded to 12) and the no-subprocess message.
  - `runtime.ts` has `rt()`/`setRuntime()`, as Wizardry did.

- **Phase 3 (done).**
  - `port/variables.ts` is generated rather than hand-ported, as described above.
  - `g` is built eagerly when the module loads, including the 66×198 cave.
  - `runtime/pascal.ts` gained `fromLowerBound`/`oneBased` for Pascal array bounds, the subrange wraps, and `mod`.

- **Phase 4 (done).** `port/io.ts`, `port/misc.ts` and `port/desc.ts`, with `port/port-fixture.ts` for tests (`boot`, `play`, `waitAtPrompt`).
  - **Conventions settled here:**
    - A VAR parameter that is only written becomes the return value (`loc_symbol`, `cnv_stat`, `objdes`, `insert_num`). Any other VAR parameter takes an `IRef` (`box()` for a local, `ref(record, 'field')` for a field).
    - Identifiers are lowercase, as the converter wrote them (`g.moria_top`), because Pascal is case-insensitive.
  - **`inkey_delay`** keeps the 5/100 s pause VMS 3.x needed before a read. It is only called to poll while resting, and without the pause resting would never yield to the browser.
  - **`check_time`** always answers open. `day_num` and `hour_num` fed nothing else and are not ported.
  - **`prt_experience`** turned out to be in `misc.inc` itself. The forward declarations of `move_char` and `creatures` are left for the phases that port them.
  - **`sort_objects`** is pinned by a fingerprint of the name order it leaves, 847818908. A separate Python run over `values.inc` (the same shell sort, but a separate parser) gives the same number, which checks the converter and the sort together.
  - **Header line references** (`// misc.inc:NNNN name`) are checked mechanically against each procedure's declaration in the source.
  - **Kept from the original:**
    - `likert` rates anything below -3 as Excellent.
    - Rings 23 and 24 are priced by `todam`.
    - Cloaks add `toac + 100`.
    - `magic_init`'s bounds checks test some flavours against the wrong list's length. A test shows no real subval runs past its list.
    - `price_adjust` does its single-precision `+ 0.99`.
- **Phase 5 (done).**
  - **`main.ts`** runs `moria.pas` in order. `termdef` has nothing to check. `LIB$GET_FOREIGN` is the page's query string (`?BOB.SAV/WIZARD`); without one, a player with save files in storage is asked `Restore file (RETURN for new character):`.
  - **`intro`** skips the hours file. MORIA.DAT, when absent, is the news a first run wrote (`DEFAULT_NEWS`, `cur_version:4:2` giving `4.80`), and MORIACHR.DAT and MORIATOP.DAT are created quietly: the original quit after creating them.
  - **`port/pending.ts`** stands in for `store_init`, `get_char`, `generate_cave`, `dungeon` and `upon_death` until their phases. The unported ones say so and exit. Skipping `store_init` changes no later roll, because `bpswd` reseeds straight after it.
  - **`create.inc`**: inside `with race[i2]`, the stat adjustments (`con_adj`, …) are the race's fields while `todam_adj`, `tohit_adj` and `toac_adj` are still the functions. `get_history` always moves to `next` (the source's indentation suggests otherwise). `get_ahw` picks the table from the sex's position in `sex_type`.
  - **The help library.** `moriahlp.hlb` reached upstream damaged: each 512-byte block kept only a 2-byte header and lost its padding. `tools/extract-help.ts` finds those headers by their rising sequence numbers and cuts them out, which leaves the length-prefixed records whole, and it drops the stale second ARMOR. The four armour tables and the last two missile rows were unreadable and are rebuilt from `values.inc` in the tables' own layout. Regenerating reproduces the committed file byte for byte.
  - **HELP** starts below `moria_help`'s banner, since it only prints `[Entering Moria Help Library, Use ^Z to resume game]` and then spawned `HELP`. A keyword path (`Character Races`) shows only its last topic, as VMS does. RETURN goes up a level, `?` relists, and ^Z, ESC, ^C or ^Y leave.
  - **The shell** (`shell/game-session.ts`) runs the game, and on `MoriaExit` offers another. The test pattern is gone.
- **Phase 6 (done).**
  - **`generate.ts`** is all of `generate.inc`. The town's shops come from `town_seed`, so the town is the same on every visit; a test pins the town for seed 12345, and a separate Python rebuild of the shops from the Pascal gives the same layout. `store_maint` stands in until Phase 9; the town reseeds from the clock before calling it, so the layout does not depend on it. The source's cross-shaped rooms mark one pillar spot twice and miss its mirror image; that is kept.
  - **`moria.ts`** holds `dungeon` and the routines nested in it that Phase 6 needs: panels, lighting (`move_light` and its four cases, `light_room`), `move_char`, running (`area_affect`, `pick_dir`), searching, resting, `carry` (gold and pick-up), doors, stairs, tunnelling, `look`, `teleport`, `take_hit`, `py_bonuses`, and the turn: light, food, regeneration and every timed effect.
  - **`dungeon-locals.ts`** holds the locals of `dungeon` that its nested routines share (`moria_flag`, the local `reset_flag`, `search_flag`, `teleport_flag`, `player_light`, `command`), so the files that later phases split out of `moria.inc` can reach them.
  - **Not yet ported** (`pending.ts`): `creatures` does nothing, so no monster moves or shows; stepping on a trap, attacking, chest traps and chest treasure say they are not ported; the item, spell, save and most wizard commands say so and cost no turn. `$` says there are no subprocesses.
  - **Wizard `^D`** (go to a level) works, which is the quick way down while testing.
- **Phase 7 (done).**
  - **`creature.ts`** is all of `creature.inc`: sight (`update_mon`), movement toward the player (`get_moves`, `make_move` with doors, runes and creatures that eat others), breeding, confusion, every melee attack and every monster spell.
  - **`spells.ts`** is `spells.inc` except `ident_spell` and `recharge`, which pick an item from the pack and so come with the item commands in Phase 8.
  - **`moria.ts`** gained the combat and trap routines: `minus_ac`, the damage kinds, `hit_trap`, `find_range`, `delete_monster`, `check_mon_lite`, `multiply_monster`, `summon_object`, `delete_object`, `monster_death`, `mon_take_hit`, `tot_dam`, `py_attack` and `chest_trap`. Wizard `^A` (cure all) and god `^F`/`^G` now work.
  - **Kept from the original:**
    - `hp_player` with a negative amount calls `take_hit`, which subtracts it, so it heals.
    - A monster opening a locked door tests `randint(100 - level)` where `level` is the door's own (0): inside `with t_list[tptr] do with m_list[monptr]` the monster record has no `level`.
    - "Eat charges" feeds the charges to the monster's hit points.
    - A monster whose spell chance is 0 always casts, since `randint(0)` is 1.
    - `wall_to_mud` never prints a monster's death, because it reads `ml` through its `with` after the kill has blanked the record.
    - `chest_trap` reads the chest's flags through a `with` on its slot, so after the explosion frees the slot the summoning trap no longer fires.
    - An attack's dice are read into a `varying [5]`, so the one longer string in the monster list, `5 1 10d12`, rolls ` 10d1`.
  - **Records versus slots.** The port's `pushm`/`pusht` put a fresh blank record in the freed slot, where the Pascal blanks the record in place. Code that reads through a `with` on a slot after something may free it (`chest_trap`, `creatures`' per-monster turn) re-reads the slot, not a held record. It matters when an ooze breeds onto its own square: the slot passes straight to the newborn.
  - **Changed:** the source walks the monster list with `repeat..until` from `muptr`, reading `m_list[0]` when no monsters are left; the port walks it only while there is one.
  - **Checks:** seeded soak runs (six seeds, 18,000 random moves on levels 4–17) found no crash.
  - **Still stubbed:** the shops (`enter_store`) say they are not ported.
- **Phase 8 (done).**
  - **`moria.ts`** gained the pack commands: `inven_command` (`i`, `e`, `t`, `w`, `x` with `show_inven`, `show_equip`, `remove`, `unwear`, `wear`, `switch_weapon`), `get_item`, `cast_spell`, `examine_book`, `drop`, `disarm_trap`, `add_food`, `desc_charges`, `desc_remain`, `throw_object` (`inven_throw`, `facts`, `drop_throw`), `bash`, `jamdoor` and `refill_lamp`. Only `v` (the version) still says it is not ported.
  - **One file per item include:** `scrolls.ts` (`read`), `potions.ts` (`quaff`), `eat.ts` (`eat`), `wands.ts` (`aim`), `staffs.ts` (`use`), `magic.ts` (`cast`) and `prayer.ts` (`pray`). Each big `case` is split into a few functions by range; an effect that leaves `ident` alone returns `null`. `magic.ts` exports the experience and mana steps that `prayer.ts` repeats word for word.
  - **`spells.ts`** gained `ident_spell` and `recharge`; wizard `^I` uses `ident_spell`.
  - **Kept from the original:**
    - Potion 17 (constitution) adds the new maximum hit points to the current ones, so it heals as well.
    - Potions 29–31 and 40–42 and foods 4–5 never set `ident`, so they stay unknown.
    - A scroll gives its experience after `inven_destroy`, reading the flags and level of whatever then sits in its slot.
    - Wand 24 (wonder) replaces the remaining bits with one random effect bit.
    - Staff 22 cures blindness, poison or confusion, stopping at the first that works (Risk #7).
    - Scroll 35 (curse armour) tries its slots in turn with the same short-circuit `or`, so empty slots roll no dice (Risk #7).
    - A spell or prayer escaped at the direction prompt costs no mana and gives no experience: `get_dir` sets `reset_flag`. `get_spell`, outside `dungeon`, sets the global `reset_flag`, not the one `cast` tests.
    - The mage's Remove Curse clears only the equipment (slots 23–34); the priest's clears the pack too (1–34).
    - The source's typos stay: "You have have a warm feeling.", "You more dexteritous.", "Your skins starts itching.", "Your feel your head clear...".
  - **Checks:** item and pack specs (62), and seeded soak runs (six seeds, 20,000 random keys each, with a dozen random objects in the pack and the item keys among them) found no crash.
- **Phase 9 (done).**
  - **`store1.ts`** is `store1.inc`: `item_value`, `sell_price`, `store_carry`, `store_destroy`, `store_init`, `store_create` and `store_maint`. `store_init` and `store_maint` leave `pending.ts`; the town restocks on each visit, after `town_gen` reseeds from the clock, so the golden town is unchanged.
  - **`store2.ts`** is `store2.inc`: the shop screen, the owner's comments, buying and selling with haggling, insults and being thrown out (the shop stays locked for 2500 + `randint(2500)` turns). Walking into a shop's door enters it.
  - **Kept from the original:**
    - A stack in the store only grows while it holds fewer than 24, and then grows by the whole incoming number, so it can pass 24.
    - A haggling answer that won't read as a number keeps the last one read (READV with `error:=continue`), and 0 asks again.
    - A shop is open only while `store_open < turn`, so at turn 0 every door is locked.
    - The source's spellings stay: "bargin", "resonable", "Ridiculus", "Haggeling", "must of heard".
  - **Changed:** `display_cost` writes to an `i2` it never declares; the port gives it a local.
  - **Wraps:** `store_open` is a 16-bit `worlint`, so from about turn 27,768 on a shop that throws the player out wraps to a negative opening turn and opens again at once, as in the original. READV now refuses an integer outside 32 bits, so an oversized haggling answer asks again.
  - **Checks:** store specs (39), and seeded soak runs in town (six seeds, 20,000 random keys each, about 15,000 of them inside a shop) found no crash.
- **Phase 10 (done).**
  - **`save.ts`** is `save.inc`: `save_char`, `get_char`, `restore_char`. The save is JSON holding the fields the source writes, changed as its text lines change them:
    - only the turn's low four bits survive;
    - hit points and the experience factor keep one decimal;
    - a shop's opening turn becomes turns from the save plus 15;
    - the flags the source leaves out (resting, paralysis and the like) start afresh.
    Each save's id goes into MASTER (`MORIACHR.DAT`) and restoring strikes it off and deletes the file, so a save restores once; a second try is a Data Corruption Error.
  - **RNG:** the ids are drawn as the source draws them, including the `encrypt_seed1` coding pass between retries. The per-line XOR coding is not reproduced, so after a restore `store_maint` runs from the save's seed without the coding's draws, so the shops restock differently from the source's (the seed itself came from the clock at save time, so neither is predictable).
  - **`restore_char`** (wizard `^V`) looks up an id it never sets before deleting, so it deletes nothing and only adds the id back; a save whose id is still registered gets "Could not write ID in MASTER."
  - **`death.ts`** is `death.inc`: the tombstone, the top twenty (`MORIATOP.DAT`, `max_exp + 100*max_lev`, a wizard's character never scored) and the King or Queen's ending.
  - **`wizard.ts`** is `wizard.inc`: `game_version` (`v`, which costs a turn as in the source), `wizard_light` (`^L`), `change_character` (`^E`; its Save prompt says 0-100 but takes 200, as the source does) and `wizard_create` (`^W`).
  - **`files.ts`** gains the dumps: `print_map` (`P`), `print_objects` (`^B`), `print_monsters` (`^N`), `file_character` (`C`), and the tombstone's copy. They go to the player as browser downloads through a new `download` on the runtime rather than into the save storage, where `MORIACHR.DAT` would clash with MASTER.
  - **`pending.ts` is gone**: nothing is stubbed any more.
  - **Kept from the original:** the character sheet's "Cur Mana" prints the maximum, and cancelling the save prompt costs a turn (`^Z` never sets `reset_flag`).
  - **Changed:** a save may not take the name of one of the game's own files (`MORIACHR.DAT`, `MORIATOP.DAT` and the like), which VMS kept in another directory; it gets "Error creating>". A save or MASTER that is not what the game wrote gives Data Corruption Error, or "ERROR opening file MASTER.", rather than breaking the session: every field is checked for its kind, and those used as indices or coordinates for their range, before MASTER is touched, and only the keys the game writes are copied back.
  - **Risk:** the source writes current mana with `:1`, a floating-point format whose digits VAX Pascal chooses; the port keeps it exact.
  - **Checks:** save, death, wizard and dump specs (62); a save-and-restore round trip through `main`; seeded soak runs (six seeds, 20,000 keys each, with 8–33 saves and restores and a few deaths per seed) found no crash.

- **Phase 11 (done).**
  - **`e2e/journey.spec.ts`** plays one seeded game in Chromium. Playwright freezes the page clock, so every seed the game takes from the time, and so the town, is the same on each run.
  - The test reads the map off the screen and walks by shortest path. It does these in order:
    - creates a character;
    - walks into the General Store and buys the cheapest item at the asking price, checking the gold goes down;
    - walks to the stairs and goes down to 50 feet;
    - saves with `^Z`, then restores at the restart prompt, back at 50 feet;
    - puts a copy of the save file back and restores it again, which gets "Data Corruption Error." because MASTER no longer holds its id.
  - It passed five runs out of five.
  - **Left as it was:** the Risks below. The mana-precision risk from Phase 10 is one of them, since the VAX format could not be pinned down without the compiler.

## Risks

1. **Upstream licence.** VMS Moria states no licence. The port's ported code stays unlicensed until upstream says otherwise, and the app must not be deployed publicly before that is settled.
2. **A missed `await`** on anything that reaches `inkey` is the most likely transliteration bug. `no-floating-promises` is the guard.
3. **The RNG product** exceeds 2^53 for large ranges (`randint(9999999)` in `randnor`). It must go through BigInt, or every derived value drifts.
4. ~~**VAX Pascal `MOD` with a negative left operand.**~~ Resolved in Phase 3.
   - VAX Pascal has a separate `REM` for the sign-of-dividend remainder, so `MOD` is the ISO one, and `runtime/pascal.ts` `mod` implements that.
   - It makes no difference in practice: every one of the source's `mod` sites has a non-negative left operand (`turn`, counters, `start - 1`).
5. **`randnor` and other REAL arithmetic** are rounded to single precision at each step, but JavaScript's `log`, `sqrt` and `cos` are not VAX F_floating's. A roll that lands exactly on a rounding edge could come out differently.
6. **The unstable shell sort of `object_list`** has to be reproduced exactly, or saved item indices mean different items.
7. **`and`/`or` with a random draw on the right.** VAX Pascal does not promise whether both operands of `and`/`or` are evaluated. The port evaluates left to right and stops once the result is known, as JavaScript does. Where the right side calls `randint` (e.g. `turn_undead`'s `(lev+1 > level) or (randint(5) = 1)`), an original that evaluated both would draw once more.
8. **Current mana in a save.** The source writes it as `cmana:1`, a floating-point format whose digits VAX Pascal chooses; under ISO rules that is two significant digits. The port keeps it exact.

## Verification (every phase)

- `npx nx run-many -t lint,test -p Moria` and `npx nx build Moria`, plus `npx nx e2e Moria-e2e` (or whatever target the Playwright setup produces) from Phase 1 on.
- Tests follow CLAUDE.md: `mock<T>()`, one assertion per `it`, and `beforeEach` does the play.
- Game tests run through `port-fixture.ts` with seed-fixed RNG, an `InstantClock` and a `ScreenGrid`, and never need upstream files.
- Manual check each phase: `npx nx serve Moria` (port 4201), then drive it with the `run` skill or Playwright and take screenshots.
