# sonar-004: Core TS cleanups — IMPLEMENTATION RESULT

3 SonarQube MAJOR findings fixed, all behaviour-preserving. Build/lint/test green.

## Files changed
1. `src/core/init/PluginFactory.ts` (S1848)
2. `src/core/focusTracker/FocusTracker.ts` (S2933)
3. `src/core/focusDuration/FocusDurationTracker.ts` (S6564)

## Finding 1 — S1848: discarded `new WindowActivityMonitor(...)`
Approach: assign to a new `private` field (mirrors `focusDurationTracker?`) so the result
is used and intent is explicit. The monitor self-registers all its DOM listeners in its
ctor (kept alive by the plugin lifecycle), so it needs no post-construction calls — the
field is held purely for explicit ownership. The `new` call was NOT removed.

New field:
```ts
/**
 * Held for explicit ownership only. The monitor self-registers ALL its DOM
 * listeners via plugin.registerDomEvent / workspace events in its ctor (kept
 * alive by the plugin's Obsidian lifecycle, not by this reference), so it
 * needs no method calls after construction — but discarding the `new` result
 * reads as a useless instantiation. Undefined until a user name is pinned.
 */
private windowActivityMonitor?: WindowActivityMonitor;
```
Call site:
```ts
this.windowActivityMonitor = new WindowActivityMonitor(this.plugin, this.focusDurationTracker, mainWindow, mainDocument);
```
LINT OUTCOME: clean — 0 errors. The write-only private field did NOT trip
`no-unused-private-class-members` (not active in the obsidianmd recommended config).
Fallback was not needed.

## Finding 2 — S2933: readonly field
```ts
- private listeners: FocusListener[] = [];
+ private readonly listeners: FocusListener[] = [];
```
`lastFocusEvent` and `dispatchChain` left as-is (both ARE reassigned).

## Finding 3 — S6564: redundant `unknown` alias inlined
Removed:
```ts
/** Opaque timer handle: produced by setTimeout, passed back to clearTimeout. */
export type TimerHandle = unknown;
```
All `TimerHandle` occurrences → `unknown`:
```ts
export interface WindowTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}
...
// `unknown` already admits null — no `| null` (it'd be a redundant union);
// null still means "no timer armed" (see the checks below).
private idleTimer: unknown = null;
...
private graceTimer: unknown = null;
```
Confirmed no other file references `TimerHandle`.

## Verification
- `npm run build` (tsc -noEmit + esbuild): PASS (exit 0).
- `npm run lint`: PASS — 0 errors; only 2 PRE-EXISTING unrelated warnings
  (`main.ts:133`,`137` obsidianmd/prefer-active-doc).
- `npm test`: PASS — 37 files, 358 tests.

## Notes
- No behaviour change in any edit.
- Pre-existing unrelated `_tickets/sonar-002-*.md` working-tree change left untouched; no commit made.
