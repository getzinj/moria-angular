# Moria

A hand-port of VMS Moria 4.8 (Robert Alan Koeneke, Jimmey Wayne Todd, Gary D.
McAdoo) to the browser, drawn on an 80x24 VT220 terminal in green on black.

Play it at <https://moria.stonequest.org>.

The port follows the original line by line: same random number generator, same
formulas, same quirks. Saves, the top twenty and the MASTER file live in the
browser's `localStorage`; nothing is sent to a server.

The port was written inside
[Stonequest-Angular](https://github.com/getzinj/Stonequest-Angular) as
`apps/Moria` and moved here once it was complete. Its plan, phase by phase, and
the findings along the way are in [`docs/port-plan.md`](docs/port-plan.md).

## Running

Node 24 or later.

```sh
npm ci
npm start           # http://localhost:4201
npm test
npm run lint
npm run e2e         # Playwright: starts the dev server itself
npm run build       # dist/moria/browser
```

Pushes to `main` are linted, tested, built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Pull requests get the lint and tests.

## Keys

The original moved with the numeric keypad's digits. Without a keypad, the
arrow keys move in the four straight directions and Home, PgUp, End and PgDn
move diagonally. Alt+letter (Option+letter on a Mac) sends the same code as
Ctrl+letter, for the Ctrl combinations browsers keep for themselves. The game
takes the other Ctrl keys, so Ctrl+R redraws rather than reloads; Ctrl+Shift
combinations are left to the browser.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/app/runtime/` | The VMS and VAX Pascal emulation: the random generator, the terminal, the keyboard, the clock, the files, the other VMS services, and the Pascal helpers. Knows nothing about the game. |
| `src/app/port/` | The ported game, one file per original Pascal file. |
| `src/app/shell/` | The Angular shell: the 80x24 screen and the key mapping. |
| `tools/` | The generators for `port/variables.ts` and `port/help-library.data.ts`. |
| `e2e/` | Playwright: the screen, and a seeded game that shops, saves and restores. |

## Conventions for `src/app/port/`

- **One file per Pascal source file**, and each procedure carries a comment
  naming its origin, such as `// source/include/misc.inc:2511 bpswd`.
- **Original identifiers, in their original snake_case.**
- **Globals live on one object, `g`**, since a module cannot rebind an
  imported name.
- **Every routine that can reach a keypress is `async`**, and
  `no-floating-promises` stays on.
- **VAX Pascal's semantics come from `runtime/pascal.ts`**: `clone()` for a
  record assignment, `ref()` for a `var` parameter on a field, 32-bit `REAL`
  through `Math.fround`, rounding halves away from zero, subrange wrapping, and
  arrays indexed from their Pascal lower bound. Loop over those arrays with the
  Pascal bounds, never with `for..of`.
- **The program-level `exit`** throws `MoriaExit`, which the shell catches to
  offer a restart.

## Generated files

`src/app/port/variables.ts` and `src/app/port/help-library.data.ts` are
generated from a checkout of
[dungeons-of-moria/vms-moria](https://github.com/dungeons-of-moria/vms-moria),
which is not committed here:

```sh
npm run convert-values -- <path to vms-moria>
npm run extract-help -- <path to vms-moria>
```

## Licence

GPL-3.0 for the original work of this port only. The game itself belongs to its
authors and is not licensed here. See [NOTICE](NOTICE).
