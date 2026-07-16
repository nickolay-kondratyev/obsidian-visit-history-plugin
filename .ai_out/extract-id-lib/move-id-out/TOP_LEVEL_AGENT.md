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
- [~] DETAILED_PLANNING (PLANNER, background, THINK_HARDER)
- [ ] DETAILED_PLAN_REVIEW (PLAN_REVIEWER)
- [ ] PLAN_ITERATION
- [ ] IMPLEMENTATION
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] PARETO_COMPLEXITY_ANALYSIS
- [ ] Final: change log entry (single, by TOP_LEVEL), tickets, callouts table

## Notes
- Code-modifying agents run SERIALLY.
- Known tension to clarify: design brief says processFrontMatter; current code deliberately uses raw Vault.process edits.
