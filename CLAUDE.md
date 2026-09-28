# Moria

A line-by-line hand-port of VMS Moria 4.8 to Angular. See README.md for the layout and the porting
conventions, and docs/port-plan.md for the history.

- Run checks with the npm scripts: `npm run lint`, `npm test`, `npm run build`, `npm run e2e`.
- Fidelity comes first: keep the original's random draws, their order and count, and its quirks.
  Record a deliberate departure in docs/port-plan.md.

## Testing Preferences

- **When a spec needs a provider mock, use `mock<T>()` from `vitest-mock-extended`** (add it as a devDependency the first time) in spec files instead of hand-written `{ method: vi.fn(), ... }` objects. Pass signals and non-default returns via the override argument or as property assignments on the mock:
  ```typescript
  import { mock } from 'vitest-mock-extended';
  
  const mockPos = mock<PositionService>({ positionX: signal(1), positionY: signal(1) });
  mockPos.getPosition.mockReturnValue({ x: 1, y: 1, z: 1 });
  TestBed.overrideProvider(PositionService, { useValue: mockPos });
  ```
- Methods returning `void`/`Promise<void>` need no `mockReturnValue` setup — `vi.fn()` already returns `undefined`.
- Prefer simple unit tests with **one assertion per test case**. More small, focused tests are better than fewer complex ones. Group related test cases in `describe` blocks with descriptive `it` names that state the full expected behavior.

## Code Style Preferences

- Prefer `== null` / `!= null` (loose equality) over `=== undefined` / `=== null` for null-ish checks, since it safely covers both `null` and `undefined` in one check. Exception: when `null` and `undefined` carry distinct meanings and must be handled differently (e.g. a DTO field that is `undefined` when absent vs. explicitly set to `null`), use strict equality against the specific value you mean.
- Use explicit types on almost everything — function/method parameters, return types, and variables — except in the rare cases where the explicit type would be too complex to represent clearly (let inference take over there). This matches the enforced lint rules (`explicit-function-return-type`, `explicit-member-accessibility`).
- Avoid early returns/guard clauses. Prefer `if`/`else` with explicit `else` blocks, since they reveal the branching structure more clearly than a flat sequence of early exits.
- When convenient, prefer testing the positive case (`if (x)`) over the negative (`if (!x)`).
- Comments should be rare and succinct. Code should be clear enough that a comment isn't needed; a comment is an admission that the code itself failed to make something clear. Avoid verbose JSDoc blocks and narrative inline comments — a short one-liner is the ceiling, not the norm.
- Explicit access modifiers (`public`/`private`/`protected`) on all class members; omit `public` only on constructors.
- Prefer `inject()` over constructor-parameter injection in Angular classes.
- `readonly` for injected dependencies and any field that isn't reassigned after construction.
- Single quotes, semicolons, 2-space indentation, trailing commas in multiline literals. `.editorconfig` covers the whitespace and quotes; there is no Prettier.
- Use `import type` for type-only imports.
