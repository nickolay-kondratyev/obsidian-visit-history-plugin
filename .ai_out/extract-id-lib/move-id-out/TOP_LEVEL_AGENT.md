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
- [x] PARETO_COMPLEXITY_ANALYSIS — PROCEED; all abstractions JUSTIFIED, 0 unjustified
- [x] Final: 4 follow-up tickets in docs/tickets/, change log entry below, callouts delivered to human

## Notes
- Code-modifying agents run SERIALLY.
- Known tension to clarify: design brief says processFrontMatter; current code deliberately uses raw Vault.process edits.

## Change log (single entry for entire flow)
2026-07-16 — extract-id-lib (branch move-id-out): Doc-id generation (generator,
md-frontmatter store, canvas store, dispatch service) extracted verbatim into the
git-submodule library `submodules/obsidian-id-lib` (own repo, commits a867be8→85d9ed5
on main, NOT pushed), consumed as raw TS via npm `file:` dep and bundled into main.js.
NEW: CrossPluginPathLock — per-path promise-chain registry on window key
`__obsidian_id_lib_path_lock_registry_v1__` — guards ensureDocId so two plugins bundling
the lib serialize same-path id creation; getDocId stays lock-free. Plugin rewired via
`DocIdServices.createDefault(app.vault)`; backfill/listeners/DocIdFilenameSafety stay
plugin-side. 52 tests moved (none dropped) + new lock/backstop suites (lib: 69 tests).
Unused `ulid` dep removed. Docs updated: design brief §3 → Vault.process, CLAUDE.md,
architecture, lib README (usage + window-key + id-format contracts). All verification
green in both repos (independently re-run by reviewer). Follow-ups: 4 tickets
(id-lib-*.md in docs/tickets/).
