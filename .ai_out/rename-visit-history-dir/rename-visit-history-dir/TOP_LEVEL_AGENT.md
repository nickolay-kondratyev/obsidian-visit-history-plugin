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
- [~] IMPLEMENTATION_WITH_SELF_PLAN: sub-agent running in background → 1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Final: change log entry (single, by TOP_LEVEL_AGENT), tickets, callouts
