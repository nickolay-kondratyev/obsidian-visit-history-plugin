# IMPLEMENTATION — Obsidian submission lint fixes

Status: **DONE — lint / test / build all green.** Changes left in the working tree (not committed).

## What changed, per file

### `src/core/focusDuration/FocusDurationTracker.ts`
- Added exported `interface WindowTimers { setTimeout(cb,ms): TimerHandle; clearTimeout(h): void }`
  and `export type TimerHandle = unknown` (near `WindowHandle`, per plan §3.1a).
- Constructor gained a 3rd injected dep `private readonly timers: WindowTimers`.
- Field types `idleTimer` / `graceTimer`: `ReturnType<typeof setTimeout> | null` → `TimerHandle`.
  **Deviation from plan §3.1c** (see below): dropped the `| null` — kept bare `TimerHandle`.
- All 4 timer sites now use member calls `this.timers.setTimeout/clearTimeout`; removed all four
  `obsidianmd/prefer-window-timers` disables and the 3-line WHY-NOT-window.setTimeout block.

### `src/core/init/PluginFactory.ts` (`activateUserScopedRecording`)
- Derived `const mainWindow = this.plugin.app.workspace.rootSplit.win` and
  `const mainDocument = ...rootSplit.doc`.
- Passed `mainWindow` as the tracker's 3rd arg (it structurally satisfies `WindowTimers`) AND to
  `WindowActivityMonitor(plugin, tracker, mainWindow, mainDocument)`.
- Removed the `obsidianmd/prefer-active-doc` disable; kept the WHY-NOT-activeDocument note as a
  plain comment (folded into the mainWindow comment).

### `src/core/util/env/DeviceNameProvider.ts`
- `localStorage.getItem/setItem` → `window.localStorage.…` (×2); removed both `no-restricted-globals`
  disables. Kept the "WHY raw localStorage" comment.
- Added `-- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile` to the retained
  `require("os")` disable.

### `src/core/service/visitHistoryService/user/UserNameProvider.ts`
- Same `window.localStorage` treatment (×2) + removed both `no-restricted-globals` disables.
- Added the same `-- <reason>` description to the retained `require('os')` disable.

## Deviations from the plan (both forced by the actual lint/type toolchain; hack-free)

1. **`TimerHandle` fields declared as `TimerHandle`, not `TimerHandle | null`** (plan §3.1c).
   With `TimerHandle = unknown`, the union `unknown | null` trips
   `@typescript-eslint/no-redundant-type-constituents` ("'unknown' overrides all other types") — a
   hard lint ERROR. Since `unknown` already admits `null`, the `| null` was pure redundancy. Dropped
   it; `= null` init and the `!== null` guards are unchanged and still valid. Added a one-line WHY
   comment on the `idleTimer` field. No behaviour change.

2. **Two ADDITIONAL test files needed the 3rd ctor arg** — the plan (§3.5 "Other call sites") stated
   only `PluginFactory.ts` and `FocusDurationTracker.test.ts` construct the tracker; that was
   incomplete. `tsc` (build) and vitest surfaced two more:
   - `src/core/focusDuration/WindowActivityMonitor.test.ts` (3 constructions) — added a
     `fakeTimers(): WindowTimers` helper returning `{ setTimeout, clearTimeout }`, CALLED inside each
     test body (after `vi.useFakeTimers`), so the shorthand captures the fake clock. Imported
     `WindowTimers`.
   - `src/core/focusTracker/listener/VhV3FocusDurationListener.test.ts` (1 construction in `setup()`)
     — passed `{ setTimeout, clearTimeout }` as the 3rd arg; `setup()` is called inside each test
     after `useFakeTimers`, so it captures the fake clock too.
   Both follow the plan's §2.1 ordering rationale exactly (references built after `useFakeTimers`);
   both files exercise `advanceTimersByTime` and now pass.

## Verification (from repo root)

```
npm run lint   → exit 0   (0 errors, 2 warnings — the pre-existing main.ts:133,137
                           prefer-active-doc WARNINGS, Option B / out of scope)
npm test       → exit 0   (Test Files 37 passed (37); Tests 358 passed (358))
npm run build  → exit 0   (tsc -noEmit clean + esbuild)
```

Final `grep -rn "eslint-disable" src --include='*.ts' --include='*.tsx'`:
```
src/core/service/visitHistoryService/user/UserNameProvider.ts:31: // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports, no-undef -- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile
src/core/util/env/DeviceNameProvider.ts:34: // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports, no-undef -- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile
```
Only the two `require("os")` disables remain, each with a ` -- ` reason. No disable of
`prefer-window-timers` / `prefer-active-doc` / `no-restricted-globals` anywhere in `src`.

Acceptance gate (plan §6): **PASS.** No behaviour change (device-scoped `window.localStorage`, same
keys; monitor still bound to the MAIN window; tracker state machine unchanged — all 358 tests green,
including idle/grace/sleep timer scenarios under the fake clock).

No `#QUESTION_FOR_HUMAN`.
