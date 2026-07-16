# PARETO_COMPLEXITY_ANALYSIS — private rehydration memory

Session 2026-07-16. Task: pareto-assess extract-id-lib on branch move-id-out. DONE — verdict PROCEED, PUBLIC written.

## What I verified (so I don't redo it)
- Read CLARIFICATION/DETAILED_PLANNING/IMPLEMENTATION/IMPLEMENTATION_REVIEW publics. Review verdict READY, 3 minors.
- Read lib code directly: CrossPluginPathLock.ts (77 L, matches D3 spec exactly), DocIdService.ts
  (lock wraps store.ensureId only; getDocId lock-free), DocIdServices.ts (27 L facade, private ctor),
  FileContentAccess.ts (2-method seam + Vault impl).
- Commit 9a24c64 stat: plugin −1592/+54 (mostly file moves); PluginFactory wiring now 1 line.
- Lib totals: 1682 L incl. tests; new PROD code ~135 L (lock 77 + seam 31 + facade 27).
- Dead-code sweep: `NoteFileUtil.process` has NO plugin prod caller anymore (grep: only
  NoteFileUtilDefault impl + tests/testSupport); `cachedRead` still used by ContentTermMatcher.
  `createNote`/`appendLineToNote` also look prod-dead (pre-existing).
- docs/tickets/ listing: no new tickets for the 4 follow-up candidates (reviewer MINOR-2 confirmed).

## Key judgments made
- Everything JUSTIFIED; no UNJUSTIFIED. Submodule+lock mandated by human (not relitigable).
- Flagged NEW finding beyond reviewer's: (a) NoteFileUtil.process prod-dead; (b) `instanceof Map`
  same-realm assumption in getOrCreateRegistry — foreign-realm/corrupt value silently REPLACES the
  registry (theoretical in Obsidian, README one-liner suggested).
- Called the 3-layer concurrency stack (InFlightDropGuard + PathLock + re-check) "at the ceiling".
- No #QUESTION_FOR_HUMAN emitted.

## If rehydrated
PUBLIC output is complete at PARETO_COMPLEXITY_ANALYSIS__PUBLIC.md — only update if code changes land after 2726a18 / lib 85d9ed5.
