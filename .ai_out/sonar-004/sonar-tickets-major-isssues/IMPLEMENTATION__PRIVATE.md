# IMPLEMENTATION — sonar-004 (PRIVATE state)

Status: COMPLETE. All 3 findings fixed, verified. No commit made (TOP_LEVEL handles commits).

## What changed (final)

### Finding 1 — S1848 PluginFactory.ts (discarded `new WindowActivityMonitor`)
- Added a `private windowActivityMonitor?: WindowActivityMonitor;` field (mirrors
  `focusDurationTracker?`), with a WHY doc comment: monitor self-registers all DOM
  listeners in its ctor via plugin.registerDomEvent/workspace events (kept alive by the
  plugin lifecycle, not this ref); held only for explicit ownership so the `new` result
  is not discarded.
- Line ~130: `new WindowActivityMonitor(...)` → `this.windowActivityMonitor = new WindowActivityMonitor(...)`.
- Did NOT remove the `new` call (that would be the real regression).
- LINT OUTCOME: private-field approach is lint-clean (no no-unused-private-class-members
  rule active in obsidianmd recommended config; write-only field did NOT trip anything).
  0 errors. Did not need the fallback.

### Finding 2 — S2933 FocusTracker.ts:52
- `private listeners` → `private readonly listeners` (reference never reassigned, only .push()).
- Left `lastFocusEvent` and `dispatchChain` untouched (they ARE reassigned).

### Finding 3 — S6564 FocusDurationTracker.ts
- Removed `export type TimerHandle = unknown;` + its doc comment (was lines 43-44).
- Replaced all `TimerHandle` occurrences with `unknown`: WindowTimers.setTimeout return,
  WindowTimers.clearTimeout param, `idleTimer`, `graceTimer`.
- Updated the comment near line 107 to say "`unknown` already admits null…" instead of
  referencing the removed alias (WHY preserved).
- Confirmed no other file imports/uses TimerHandle (`grep -rn TimerHandle src/` = none).

## Verification
- `npm run build` → BUILD_EXIT=0 (tsc -noEmit passes).
- `npm run lint` → EXIT=0, 0 errors, 2 pre-existing unrelated warnings (main.ts:133/137
  obsidianmd/prefer-active-doc — NOT ours).
- `npm test` → 37 files / 358 tests passed.

## Not touched
- `_tickets/sonar-002-*.md` pre-existing unrelated working-tree change left alone.
