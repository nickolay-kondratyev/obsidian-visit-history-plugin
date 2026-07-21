# EXPLORATION — sonar-004: Core TS cleanups

Three SonarQube MAJOR findings. All three are **behaviour-preserving cleanups**.
Investigation of the PluginFactory finding (the only one flagged "possible real bug")
is complete — see Finding 1.

## Finding 1 — src/core/init/PluginFactory.ts:130 (typescript:S1848) — NOT A REAL BUG

Line 130:
```ts
new WindowActivityMonitor(this.plugin, this.focusDurationTracker, mainWindow, mainDocument);
```
The `new` result is discarded → Sonar S1848 "useless object instantiation".

**Determination: this is NOT a wiring bug. The monitor IS active.**
Evidence (read `src/core/focusDuration/WindowActivityMonitor.ts`):
- Its constructor performs ALL its work synchronously: `registerWindow(mainWindow, ...)`,
  `plugin.app.workspace.on('window-open'|'window-close', ...)` via `plugin.registerEvent`,
  and `registerPreExistingPopouts(...)`.
- Every DOM listener is registered through `plugin.registerDomEvent(...)` and every
  workspace event through `plugin.registerEvent(...)` — i.e. retained by the **plugin's**
  Obsidian lifecycle, not by the monitor instance.
- The class exposes **no** `dispose()` / public method; the only field is a private
  `registeredDocs` set used internally by the closures.
- The registered handler closures capture `this`, so the plugin's registrations
  transitively keep the monitor alive anyway. A held reference is NOT required for
  correctness. Popout activity (blur/focus/visibility/input) IS tracked today.

So the ticket's worry ("monitor never registered → popout activity not tracked") does
**not** hold. No failing test is warranted (the behaviour is already correct, and
`PluginFactory` wiring is a documented "known untested seam" in CLAUDE.md — a full App
mock would be needed and the class is intentionally kept trivial).

**Recommended fix (behaviour-preserving, makes intent explicit):**
Assign the constructed monitor to a `private` field on `PluginFactory` (mirrors how
`focusDurationTracker` is held), with a short WHY comment that it self-registers DOM
listeners via `plugin.registerDomEvent` and is retained for explicit ownership/lifetime.
This satisfies S1848 (result is used) without changing behaviour.

⚠ MUST verify `npm run lint` stays at ZERO errors — an unused/write-only private field
could trip a different rule (e.g. no-unused-private-class-members / Sonar S1450). If it
does, fall back to the minimal alternative that keeps lint green (e.g. reference the field
in `dispose()` as a no-op owner, or another lint-clean construction-for-side-effect
expression). Do NOT introduce a new lint error to fix this one. Do NOT remove the
`new WindowActivityMonitor(...)` call — that WOULD be the real regression.

## Finding 2 — src/core/focusTracker/FocusTracker.ts (typescript:S2933, readonly)

`src/core/focusTracker/FocusTracker.ts:52`:
```ts
private listeners: FocusListener[] = [];
```
The array **reference** is never reassigned — only mutated via `.push()` in
`registerListener` (line 78). Mark it `private readonly listeners`.
(NOTE: `lastFocusEvent` and `dispatchChain` ARE reassigned — leave them as-is.)

## Finding 3 — src/core/focusDuration/FocusDurationTracker.ts:44 (typescript:S6564)

Line 43–44:
```ts
/** Opaque timer handle: produced by setTimeout, passed back to clearTimeout. */
export type TimerHandle = unknown;
```
S6564 "redundant type alias" — aliasing `unknown` adds no type-checking value.
Per the ticket: remove the alias and replace its occurrences with `unknown`.

Occurrences of `TimerHandle` to update (same file):
- `WindowTimers.setTimeout(...): TimerHandle` → `: unknown` (line ~39)
- `WindowTimers.clearTimeout(handle: TimerHandle)` → `handle: unknown` (line ~40)
- `private idleTimer: TimerHandle = null;` → `: unknown` (line ~109)
- `private graceTimer: TimerHandle = null;` → `: unknown` (line ~115)
- The comment on line ~107 ("`TimerHandle` (unknown) already admits null…") — update
  wording so it no longer references the removed alias but preserves the WHY (unknown
  already admits null; no `| null` union needed).
- Remove the `/** Opaque timer handle… */` doc + the `export type TimerHandle` line (43–44).

Type-safety note: all sites compare `!== null` and pass the value straight back to the
injected `clearTimeout`, so switching to `unknown` compiles cleanly (verified by reading).

Tradeoff flagged: the alias carried documentation value; the ticket owner explicitly chose
to inline `unknown` (owner-approved direction), so follow it. A branded opaque type would
break assignment from real timer handles without casts — not worth it.

## Verification bar (all findings)
- `npm run build` (tsc) green, `npm run lint` ZERO errors, `npm test` green.
- No behaviour change intended in any of the three edits.

## Notes for orchestration
- Pre-existing unrelated working-tree change: `_tickets/sonar-002-*.md` (a closed-ticket
  status update). Leave it OUT of this feature's commits, or handle separately — it is not
  part of sonar-004.
