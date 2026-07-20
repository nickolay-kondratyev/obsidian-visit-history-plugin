# PLANNER PRIVATE — fix-obsidian-lint (rehydration memory)

Status: PLAN COMPLETE. Deliverable written to `DETAILED_PLANNING__PUBLIC.md`. No blockers, no
QUESTION_FOR_HUMAN.

## What the task was
Plan the fix so the Obsidian review-bot ESLint passes. All bot errors = eslint-disable violations.
Primary input: `EXPLORATION_PUBLIC.md` (trusted, verified). I re-verified everything below by reading
source + rule dist + configs.

## Verified facts (don't re-check unless doubting)
- `dist/lib/rules/preferWindowTimers.js`: reports ONLY CallExpression w/ bare Identifier callee in the
  timer set (or `activeWindow.<timer>()`). References (`{ setTimeout, clearTimeout }`, `const f=setTimeout`)
  and member calls (`this.timers.setTimeout()`, `win.setTimeout()`) are NOT flagged. Also skips if the
  identifier resolves to a local var with defs (shadowing) — but shadowing = HACK, rejected.
- `eslint.config.mts`: flat config, `globals.browser` (so window/setTimeout/clearTimeout defined for
  no-undef). Test files under src/** ARE linted (only node_modules/dist/submodules/etc ignored).
- `no-restricted-globals` restricts app/fetch/localStorage → `window.localStorage.x()` passes (window
  bare is allowed; localStorage is a property).
- `prefer-active-doc` flags only bare `document`; bare `window` never flagged.
- `no-global-this` error → globalThis forbidden.
- tsconfig: lib ES2021+DOM, include `src/**/*.ts` → `tsc -noEmit` (build script) type-checks TESTS too.
- obsidian.d.ts: `app.workspace.rootSplit: WorkspaceRoot`, WorkspaceRoot has `win: Window`, `doc: Document`
  (lines 7419-7423). rootSplit ready by onLayoutReady (when activateUserScopedRecording runs).
- vitest useFakeTimers replaces global setTimeout/clearTimeout + Date.now; advanceTimersByTime fires them.
  A reference captured AFTER useFakeTimers points at the fake (must build in beforeEach, NOT module scope).

## The design decision (the open point)
Inject a minimal `WindowTimers` interface = `{ setTimeout(cb,ms):TimerHandle; clearTimeout(h):void }` into
FocusDurationTracker. `TimerHandle = unknown` (widest return so Window→number and node→NodeJS.Timeout both
satisfy; opaque, never inspected). Production passes `rootSplit.win` (Window satisfies structurally — NO
adapter class). Tracker calls `this.timers.setTimeout(...)` (member call → rule-clean).
Test double: in beforeEach after useFakeTimers → `const fakeTimers: WindowTimers = { setTimeout, clearTimeout };`
pass as 3rd ctor arg. Reference (not call) → lint-clean; captured post-useFakeTimers → fake-clock driven.
Fallback if @types/node overload friction: `{ setTimeout, clearTimeout } as unknown as WindowTimers`
(matches existing `makeFakeWindow` boundary idiom in WindowActivityMonitor.test.ts). Chose subset-interface
over exploration's `Timers{set,clear}`+adapter on 80/20 (less code, same DIP). Rejected shadowing/globalThis
as hacks.

## Exact edits (see PUBLIC for full before/after)
1. FocusDurationTracker.ts: add WindowTimers+TimerHandle exports; ctor 3rd param `private readonly timers`;
   fields idleTimer/graceTimer → `TimerHandle | null`; 4 timer sites → `this.timers.setTimeout/clearTimeout`;
   delete 4 prefer-window-timers disables + the WHY-NOT-window.setTimeout block.
2. FocusDurationTracker.test.ts: import WindowTimers; build fakeTimers in beforeEach (ordering!); 3rd ctor arg.
3. PluginFactory.ts activateUserScopedRecording: `const mainWindow=...rootSplit.win; const mainDocument=...rootSplit.doc;`
   pass mainWindow to tracker (as WindowTimers) + `new WindowActivityMonitor(...,mainWindow,mainDocument)`;
   remove prefer-active-doc disable (keep WHY-NOT note as plain comment).
4. DeviceNameProvider.ts:18/25 → window.localStorage, remove 2 disables; :36 keep require os disable + add
   `-- 'os' is a desktop-only Electron builtin, guarded by try/catch for mobile`.
5. UserNameProvider.ts:56/61 → window.localStorage, remove 2 disables; :31 same os description.
Only PluginFactory + FocusDurationTracker.test construct the tracker. WindowActivityMonitor sig unchanged.

## Acceptance
`npm run lint` 0 errors (2 pre-existing main.ts warnings remain — Option B, OUT of scope), `npm test` green,
`npm run build` tsc clean, grep shows only 2 remaining disables (both require os, both `-- `described).
main.ts:133,137 explicitly OUT of scope (TOP_LEVEL Option B).
