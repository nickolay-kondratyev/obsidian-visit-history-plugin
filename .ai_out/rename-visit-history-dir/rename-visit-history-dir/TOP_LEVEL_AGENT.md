# TOP_LEVEL_AGENT — rename-visit-history-dir

## Task
Rename `.visit_history` → `__visit_history` (Obsidian Sync does not sync dot-hidden folders:
https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123/26 — URL must go into a comment at the dir-path constant).
Built-in migration: existing `.visit_history` → `__visit_history`.

## Flow (straightforward-flow)
EXPLORATION → CLARIFICATION → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Status log
- [x] Branch `rename-visit-history-dir` created off master (955a634)
- [~] EXPLORATION: Explore sub-agent running in background → EXPLORATION_PUBLIC.md
- [ ] CLARIFICATION (with HUMAN)
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Final: change log entry (single, by TOP_LEVEL_AGENT), tickets, callouts
