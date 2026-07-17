# TOP_LEVEL_AGENT — rename-visit-history-dir

## Task
Rename `.visit_history` → `__visit_history` (Obsidian Sync does not sync dot-hidden folders:
https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123/26 — URL must go into a comment at the dir-path constant).
Built-in migration: existing `.visit_history` → `__visit_history`.

## Flow (straightforward-flow)
EXPLORATION → CLARIFICATION → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Status log
- [x] Branch `rename-visit-history-dir` created off master (955a634)
- [x] EXPLORATION → EXPLORATION_PUBLIC.md (Explore agent was read-only; TOP_LEVEL persisted its report verbatim)
- [x] CLARIFICATION (HUMAN aligned) → CLARIFICATION__PUBLIC.md
      1) visibility accepted; 2) both-exist → skip + console.error + user-facing dialog; 3) cleanup horizon stays 2026-October
- [x] IMPLEMENTATION_WITH_SELF_PLAN → 1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md
      Claims: 315/315 tests, lint 0 errors, build green; 4 commits (c6b06fe..464ab60);
      new VhTopDirRenameMigrationService wired FIRST in onload; IsTrackedProvider imports VhUserPaths.TOP_DIR.
- [x] IMPLEMENTATION_REVIEW → IMPLEMENTATION_REVIEW__PUBLIC.md
      Verdict READY: 0 BLOCKING, 1 SHOULD-FIX (human question — answered), 3 NIT.
      Reviewer independently verified 315/315 tests, lint 0 errors, build green.
- [x] HUMAN sign-off on Finding 1 (synced mobile adoption) — accepted; superseding
      user-name confirmation modal feature approved as FOLLOW-UP FLOW (new branch).
- [x] IMPLEMENTATION_ITERATION → IMPLEMENTATION_ITERATION__PUBLIC.md (commit dee8cfb)
      Applied Finding #2 (boundary-aware exclusion + 4 tests → 319 green) and Finding #1
      doc note; Findings #3/#4 accepted as-is. READY.
- [x] Final: change log entry below; env ticket already exists
      (docs/tickets/dev-env-broken-nvm-node-shim.md); merge to master.

## Change log (single entry for entire flow)

**2026-07-17 — rename-visit-history-dir** (branch `rename-visit-history-dir`)
VH data dir renamed `.visit_history` → `__visit_history` so Obsidian Sync syncs it
(Sync ignores dot-hidden folders — forum issue 32123, URL at `VhUserPaths.TOP_DIR`).
New `VhTopDirRenameMigrationService` auto-renames a legacy `.visit_history/` FIRST in
onload (before user-name resolution — mobile adoption depends on ordering); both-exist →
skip, keep legacy untouched, console.error + user-facing `UserNotifier` notice; cleanup
after 2026-October. The now-visible dir is excluded from tracking/heatmap by
`IsTrackedProvider` (boundary-aware, covers legacy `_visit_history` too). Generated V3
README, rationale comments, and docs updated. Accepted tradeoffs: dir visible in
explorer/search; synced mobile identity adoption (confirmation-modal feature to follow).
Tests 319 green, lint 0 errors, build green.
