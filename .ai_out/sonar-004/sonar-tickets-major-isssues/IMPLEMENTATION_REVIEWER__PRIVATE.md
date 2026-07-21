# sonar-004 IMPLEMENTATION_REVIEWER — private notes

Commit reviewed: 5abc12b. Branch sonar-tickets-major-isssues. READ-ONLY review.

## Scope check
`git show 5abc12b --stat`: only 3 src files touched + 4 .ai_out docs. No unrelated
src edits, no test edits, no behaviour surface changes. Matches ticket exactly.

## Finding 1 — S1848 WindowActivityMonitor (PluginFactory.ts:138)
Read WindowActivityMonitor.ts in full. Confirmed: ctor does ALL work synchronously —
`registerWindow(mainWindow,...)`, `plugin.registerEvent(workspace.on('window-open'/'window-close'))`,
`registerPreExistingPopouts`. Every DOM listener via `plugin.registerDomEvent`, every
workspace hook via `plugin.registerEvent` → retained by the PLUGIN lifecycle, not by the
instance. Class exposes no dispose()/public method; only private `registeredDocs` set used
by closures. Therefore NOT holding a reference was never a popout-tracking bug — the
exploration's determination is correct. No latent bug hidden by the discard.
Chosen fix (write-only `private windowActivityMonitor?` field + WHY comment) is the right
minimal call: mirrors `focusDurationTracker?`, satisfies S1848 (result used), zero
behaviour change. Field is never read — acceptable, documented as explicit-ownership hold.
Lint did NOT trip no-unused-private-class-members (not in obsidianmd config) — verified.
No test warranted (documented untested wiring seam; trivial glue).

## Finding 2 — S2933 readonly (FocusTracker.ts:52)
`private readonly listeners: FocusListener[] = []` — reference never reassigned, only
`.push()` in registerListener (line 78). Correct. Other members correctly left mutable:
`lastFocusEvent` reassigned (line 129), `dispatchChain` reassigned (lines 68/91). Injected
`plugin`/`isTrackedProvider` already readonly. No missed same-finding members. Complete.

## Finding 3 — S6564 TimerHandle inlining (FocusDurationTracker.ts)
`grep -rn TimerHandle src/` → zero hits. All 4 sites inlined to `unknown` (2 interface
methods, idleTimer, graceTimer). Alias + its doc removed. Reworded comment reads correctly
and preserves the WHY (unknown admits null; no redundant `| null`). No type-safety
regression: all sites `!== null` compare and pass value straight back to
`clearTimeout(handle: unknown)`. Compiles.

## Independent verification (redirected to .tmp/)
- npm run build: BUILD_EXIT=0 (tsc -noEmit -skipLibCheck + esbuild).
- npm run lint: LINT_EXIT=0 — 0 errors, 2 PRE-EXISTING warnings (main.ts:133,137
  obsidianmd/prefer-active-doc, unrelated).
- npm test: TEST_EXIT=0 — 37 files, 358 tests passed.
All match implementation claims.

VERDICT: APPROVE.
