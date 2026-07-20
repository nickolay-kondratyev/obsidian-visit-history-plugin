# IMPLEMENTATION_REVIEWER — private notes

Commit reviewed: `8882569` (branch `fix-obsidian-lint`), diff `a30c60d..8882569 -- src`.

## Gates (independently run)
- `npm run lint` → exit 0; `✖ 2 problems (0 errors, 2 warnings)` — both warnings are the
  pre-existing `main.ts:133,137` `prefer-active-doc` warnings (Option B, out of scope, no disable
  directive → bot didn't list them). PASS.
- `npm test` → exit 0; Test Files 37 passed, Tests 358 passed.
- `npm run build` → exit 0 (tsc -noEmit + esbuild clean).
- `grep -rn "eslint-disable" src` → exactly 2 lines, both the `require("os")` trio, each with
  ` -- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile`.

## Correctness checks
- Forbidden rules (`prefer-window-timers`, `prefer-active-doc`, `no-restricted-globals`): no disable
  anywhere in src. No bare `setTimeout/clearTimeout/document/localStorage`, no `globalThis`,
  no `activeWindow.<timer>` reintroduced.
- No global shadowing / no hack. `WindowTimers` is honest DIP — a structural subset of Window;
  production passes `rootSplit.win`, tests pass `{ setTimeout, clearTimeout }` object shorthand.
- Behavior unchanged:
  - `window.localStorage` === `localStorage` object, same STORAGE_KEY constants, same get/set. No
    key/semantic change.
  - Timer state machine identical — only the scheduler is injected; call sites 1:1.
  - `WindowActivityMonitor` still bound to MAIN window (`mainWindow`/`mainDocument` from rootSplit).
  - `rootSplit.win/.doc` type-check clean (build passes) and are available at onLayoutReady when
    `activateUserScopedRecording` runs.
- Deviation 1 (`TimerHandle` fields без `| null`): sound. `TimerHandle = unknown`; `unknown | null`
  trips `no-redundant-type-constituents`. `unknown` admits `null` assignment (`= null` init OK), and
  `!== null` guards still narrow correctly — setTimeout never returns null in browser/vitest, so the
  armed/unarmed distinction holds. No behavior change.
- Deviation 2 (2 extra test files): correct. `WindowActivityMonitor.test.ts` uses a `fakeTimers()`
  helper CALLED inside test bodies (lines 93/111/122) — all run after `beforeEach` `useFakeTimers`
  (line 78). `VhV3FocusDurationListener.test.ts` builds `{ setTimeout, clearTimeout }` inside
  `setup()`, called inside each test after `beforeEach` `useFakeTimers` (line 48). Ordering correct →
  fake clock genuinely drives injected timers; `advanceTimersByTime` scenarios not no-oped.
- No weakened assertions; no test bodies changed beyond ctor arg. `main.ts` untouched (confirmed by
  stat — not in diff).

## Verdict: APPROVED.
