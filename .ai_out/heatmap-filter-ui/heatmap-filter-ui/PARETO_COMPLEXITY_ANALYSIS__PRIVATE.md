# PARETO_COMPLEXITY_ANALYSIS — PRIVATE memory

## State
- Analysis COMPLETE; verdict JUSTIFIED, published in
  `PARETO_COMPLEXITY_ANALYSIS__PUBLIC.md`. Nothing pending.

## Basis (what I actually verified)
- Diff stat `1d1d3c6..HEAD -- src/ styles.css`: +1337/−120; 8 new src files;
  tests ~470 lines (heatmapConfig/filterVaultTree/FilterTermOps/
  ContentTermMatcher/VaultUtil), CSS +213 (net ~+180 after rework).
- Read in full: `App.tsx` (233 L), `FilterTermOps.ts` (45 L),
  `ContentTermMatcher.ts` (59 L), `filterVaultTree.ts` (69 L),
  `FilterPopover.tsx` (60 L). Other header components 27–61 L (wc only).
- All 5 phase docs read; ITERATION fixed all 4 MINOR review findings;
  335 tests / lint 0 / build clean per reviewer's independent run.

## Key judgments (rationale kept for challenge)
1. Nav refactor: NOT creep — filtered-copy navStack is a hard bug once
   filtering exists (files never restorable). Minimal fix = path segments +
   derive from canonical data (reuses findFolderTrail). No simpler shape.
2. ContentTermMatcher: forced by view Obsidian-agnosticism. One effect,
   cancel-flag latest-wins, no index (ticketed). Rejected alt C (content on
   VaultNode) was the over-engineered path.
3. FilterTermOps: right (single normalization point, BoundedValueOps
   precedent). MICRO-NIT: NUL FILTER_TERM_KEY_SEP + add-ban exists only to
   make the effect key split() losslessly; JSON.stringify key + recompute
   in-effect would have deleted the whole invariant. Trivial cost — flagged,
   explicitly NOT recommending rework.
4. Popovers: no framework — shared .hdr-pop CSS recipe + single openPanel
   state; dismissal deferred wholesale (ticket). 20%-effort UI, correct.
5. undefined-vs-EMPTY-set on contentMatchedPaths: essential semantics
   (inactive vs pending/no-match), tested AC12 — not incidental complexity.

## Ticket triage published
- popover-dismissal = do-first; content-match-perf + exclusion-terms =
  demand-driven park; react-harness = park, don't drop.

## If re-engaged
- If HUMAN pushes back on verdict: the only defensible SIMPLIFY target is the
  KEY_SEP invariant (item 3) — everything else is load-bearing.
- Do not suggest building the content index or harness preemptively.
