# TOP_LEVEL_AGENT — extract-id-lib / move-id-out

## Task
Extract doc-id generation into submodule library `submodules/obsidian-id-lib`
(remote: git@github.com:nickolay-kondratyev/obsidian-id-lib.git, currently README-only),
with cross-plugin per-path async lock on versioned window global
(design: docs/migration/extraction-of-id.md). Plugin takes dependency on the lib.
Lib repo needs concise README. Commits in BOTH repos.

## Workflow state
- [x] Setup (dirs, submodule inspected)
- [x] EXPLORATION → EXPLORATION__PUBLIC.md (done; 4 human questions raised)
- [x] CLARIFICATION — all 4 questions resolved by human (see CLARIFICATION__PUBLIC.md); ulid removal approved
- [x] DETAILED_PLANNING — plan approved
- [x] DETAILED_PLAN_REVIEW — 0 MAJOR, 3 minor inline edits
- [x] PLAN_ITERATION — SKIPPED (reviewer signal: only minor inline edits)
- [x] IMPLEMENTATION — done, all green (lib: a867be8→85d9ed5; parent: 9a24c64, 2726a18, c34aa58). CAVEAT: submodule main NOT pushed — push before sharing parent branch
- [x] IMPLEMENTATION_REVIEW — READY, 0 blocking/major, 3 minor (follow-up candidates)
- [x] IMPLEMENTATION_ITERATION — SKIPPED (reviewer signal READY; independent verification all green)
- [~] PARETO_COMPLEXITY_ANALYSIS (running, background)
- [ ] Final: change log entry (single, by TOP_LEVEL), tickets, callouts table

## Notes
- Code-modifying agents run SERIALLY.
- Known tension to clarify: design brief says processFrontMatter; current code deliberately uses raw Vault.process edits.
