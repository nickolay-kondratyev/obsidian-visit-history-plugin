# PARETO / COMPLEXITY ANALYSIS — Obsidian submission lint fixes

Assessment done inline by TOP_LEVEL (spawning a dedicated agent to confirm objectively-minimal
complexity would itself violate PARETO). Grounded in the approved plan + implementation review.

## Complexity added vs. value
| Change | Complexity | Justified? |
|---|---|---|
| `WindowTimers` interface (2 methods) + constructor injection into `FocusDurationTracker` | Minimal — 1 tiny interface, no new file, no adapter class | YES — the ONLY hack-free way to satisfy `prefer-window-timers` while keeping the class DOM-agnostic/node-testable. Heavier `Timers{set,clear}`+adapter alternative was explicitly REJECTED for 80/20. |
| `window.localStorage` (×4) | Trivial — member-access prefix | YES — preserves device-scope semantics; passes `no-restricted-globals` with zero indirection. |
| `rootSplit.win/.doc` in `PluginFactory` | Trivial — straight substitution of globals | YES — removes bare `document`, preserves MAIN-window semantics, no cast. |
| Describe the two `require("os")` disables | Trivial — comment text | YES — those disables are permitted; only need a reason. |
| 3 extra test files updated for the new ctor arg | Mechanical | Necessary — construction-site fan-out, no design cost. |

## Verdict
**Complexity is minimal and fully justified.** No over-engineering: no new files, no behavior
change, the heavier design alternative was rejected on PARETO grounds, and the injection is
idiomatic DIP already used throughout this codebase (PluginFactory wires concretions). The 80%
solution (pass the linter) and the 100% solution (do it without any hack or regression) coincide
here — there was no cheaper honest option.

## Residual (deliberately NOT done — PARETO)
- `src/main.ts:133,137` pre-existing `prefer-active-doc` **warnings** left untouched (non-blocking,
  not in the bot's error list, shipped in 1.0.2). Fixing is optional polish → captured as a follow-up
  for the human to decide, not bundled in (avoids scope creep + a small `onload`-timing risk).
