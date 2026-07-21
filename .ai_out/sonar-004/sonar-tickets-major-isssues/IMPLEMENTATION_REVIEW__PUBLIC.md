# sonar-004: Core TS cleanups — IMPLEMENTATION REVIEW

**VERDICT: APPROVE**

Three SonarQube MAJOR findings fixed, all behaviour-preserving. Commit 5abc12b.
Independently verified: build PASS, lint 0 errors, 358 tests pass. Diff is tightly
scoped to the three target files — no unrelated edits, no test changes, no behaviour
surface touched.

## Independent build / lint / test results
- `npm run build` — PASS (exit 0; `tsc -noEmit -skipLibCheck` + esbuild).
- `npm run lint` — PASS (exit 0; **0 errors**, 2 pre-existing unrelated warnings at
  `main.ts:133,137` `obsidianmd/prefer-active-doc`).
- `npm test` — PASS (37 files, **358 tests**).

All three match the implementation's stated results.

## Findings

### Finding 1 — S1848 `new WindowActivityMonitor(...)` (PluginFactory.ts:138) — NO ISSUE
Independently read `src/core/focusDuration/WindowActivityMonitor.ts`. Confirmed the
monitor self-wires entirely in its constructor: `registerWindow`, the `window-open` /
`window-close` `plugin.registerEvent` hooks, and `registerPreExistingPopouts` — every DOM
listener via `plugin.registerDomEvent` and every workspace hook via `plugin.registerEvent`,
so it is kept alive by the plugin's Obsidian lifecycle, not by any held reference. The
class exposes no `dispose()`/public method. **Discarding the `new` result was never a
popout-tracking bug** — the exploration's determination is correct, and no latent bug was
hidden by it. The chosen fix (assign to a documented write-only `private
windowActivityMonitor?` field mirroring `focusDurationTracker?`) is the right minimal call:
it satisfies S1848 with zero behaviour change. The field being write-only is acceptable and
explained by its WHY comment; it did not trip `no-unused-private-class-members` (not in the
obsidianmd config) — lint stayed at 0 errors. A test is genuinely unwarranted (documented
untested wiring seam; trivial glue).

### Finding 2 — S2933 `readonly listeners` (FocusTracker.ts:52) — NO ISSUE
`private readonly listeners: FocusListener[] = []` is correct — the reference is never
reassigned (only `.push()` in `registerListener`). Correctly scoped: `lastFocusEvent`
(reassigned line 129) and `dispatchChain` (reassigned lines 68/91) were rightly left
mutable. No other same-finding member was missed.

### Finding 3 — S6564 inline `TimerHandle` alias (FocusDurationTracker.ts) — NO ISSUE
`grep -rn TimerHandle src/` returns zero hits — all four occurrences (two `WindowTimers`
methods, `idleTimer`, `graceTimer`) inlined to `unknown`; the alias and its doc removed.
The reworded null-admittance comment reads correctly and preserves the WHY. No type-safety
regression: every site does a `!== null` check and passes the value straight back to
`clearTimeout(handle: unknown)`.

## Documentation Updates Needed
None. These are internal cleanups with no doc-visible surface.
