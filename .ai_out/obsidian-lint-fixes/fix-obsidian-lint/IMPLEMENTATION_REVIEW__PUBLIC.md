# IMPLEMENTATION REVIEW — Obsidian submission lint fixes

Commit: `8882569` on `fix-obsidian-lint`. Reviewed diff `a30c60d..8882569 -- src`.

## Verdict: APPROVED — ready to finalize

The change makes the code genuinely comply with the three bot-forbidden rules (no suppression, no
hack) and preserves behavior. All gates green.

## Gate results (independently run from repo root)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 — `0 errors, 2 warnings`. The 2 warnings are the pre-existing `main.ts:133,137` `prefer-active-doc` warnings (Option B, out of scope; no disable directive so the bot never flagged them). |
| `npm test` | exit 0 — Test Files 37 passed (37); Tests 358 passed (358). |
| `npm run build` | exit 0 — `tsc -noEmit` + esbuild clean. |
| `grep -rn "eslint-disable" src` | exactly 2 hits — both the `require("os")` trio, each carrying ` -- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile`. |

## Compliance verification

- **The three forbidden rules are no longer disabled anywhere in `src`.** No remaining
  `prefer-window-timers` / `prefer-active-doc` / `no-restricted-globals` disable.
- **No re-introduced offenders**: no bare `setTimeout`/`clearTimeout`/`document`/`localStorage`, no
  `globalThis`, no `activeWindow.<timer>`.
- **Every surviving `eslint-disable*` carries a ` -- ` description** (the two `require("os")` lines).
- **No hack / no global shadowing.** `WindowTimers` is honest DIP: a structural subset of `Window`.
  Production passes the MAIN window (`rootSplit.win`); tests pass a `{ setTimeout, clearTimeout }`
  object shorthand — a reference, not a call, so `prefer-window-timers` is genuinely not tripped.

## No behavior change

- **localStorage**: `window.localStorage` is the same object as bare `localStorage`; same STORAGE_KEY
  constants and same get/set calls in `DeviceNameProvider` and `UserNameProvider`. Device-scoped
  semantics preserved.
- **Timer state machine**: unchanged — only the scheduler is injected; the four timer call sites map
  1:1 to member calls; `armIdle/clearIdle/armGrace/clearGrace` logic and the `!== null` guards are
  identical.
- **Main-window binding**: `WindowActivityMonitor` still receives the MAIN window/doc, now derived
  from `workspace.rootSplit.win/.doc` (available at `onLayoutReady`, where
  `activateUserScopedRecording` runs; `tsc` confirms the types).

## The two documented deviations — both sound

1. **`idleTimer`/`graceTimer` typed `TimerHandle` (not `TimerHandle | null`).** With
   `TimerHandle = unknown`, `unknown | null` is a hard `@typescript-eslint/no-redundant-type-constituents`
   error. `unknown` already admits `null`, so `= null` init and the `!== null` guards remain valid and
   narrow correctly (setTimeout never returns `null` in browser/vitest, so the armed/unarmed
   distinction is preserved). No behavior change.
2. **Two additional tracker-construction sites updated** (`WindowActivityMonitor.test.ts`,
   `VhV3FocusDurationListener.test.ts`). Verified the fake timers are captured AFTER
   `vi.useFakeTimers()`: the `fakeTimers()` helper / `{ setTimeout, clearTimeout }` shorthand are built
   inside test bodies / `setup()` that run after each file's `beforeEach` `useFakeTimers`. The fake
   clock therefore genuinely drives the injected timers — idle/grace/sleep scenarios are truly
   exercised, not silently no-oped. No assertions weakened.

## Scope

`src/main.ts` correctly left untouched.

## Findings

None (no CRITICAL / IMPORTANT / suggestions). The implementation matches the approved plan; the two
deviations are toolchain-forced, documented, and correct.
