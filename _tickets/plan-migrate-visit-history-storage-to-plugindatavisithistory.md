---
closed_iso: 2026-08-12T23:23:29Z
id: nid_i6zq59oey3pbggvog9kj3dj8x_e
title: "PLAN: migrate visit history storage to .plugin_data/visit_history"
status: closed
deps: []
links: [nid_3dy6j77ekkmv2nmgsnqu959ks_e, nid_9ebr4ouaipn4dtylfo0puycoo_e, nid_fdlst01268tcjvtfs4aga34ov_e, nid_7hpz3mw6bg68k41eomug4nt0j_e, nid_f7ky5v4q6cz1uc1xs66bylkli_e]
created_iso: 2026-08-12T23:22:12Z
status_updated_iso: 2026-08-12T23:23:29Z
type: epic
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [migration_to_plugin_data_dir]
---

# High-level plan: move VH storage from `__visit_history/` to `.plugin_data/visit_history/`

Origin ticket: nid_f7ky5v4q6cz1uc1xs66bylkli_e (_tickets/plan-to-move-to-fully-hidden-place.md).
Any follow-up tickets on this topic MUST be tagged `migration_to_plugin_data_dir`.

## Motivation
Some plugins activate on folder creation; the visible `__visit_history/` folder triggers them. Move all VH data to a fully hidden location: `$VAULT/.plugin_data/visit_history/`.

## KNOWN TRADEOFF (has its own decide ticket)
`__visit_history` is deliberately NOT dot-hidden because **Obsidian Sync does not sync dot-folders** (see comment + forum URL at src/core/service/visitHistoryService/user/VhUserPaths.ts:19-23). Under `.plugin_data/` visit history will NO LONGER sync across devices via Obsidian Sync. The per-user/per-device layout stays (still correct for other sync tools, e.g. git/Syncthing, and future-proof). A `decide`-tagged ticket gates implementation on human confirmation.

## Requirements
1. **New location**: change `VhUserPaths.TOP_DIR` from `__visit_history` to `.plugin_data/visit_history`. All path composition (VhUserPaths, VhV3Paths, UserNameProvider/Prompt user-dir listing, VhV3DurationStore cross-user reads, README writer) flows through this constant — verify no other hard-coded `__visit_history` strings remain in src/.
2. **Migration** (new one-shot service, e.g. `VhPluginDataMoveMigrationService` in src/core/service/migration/):
   - Trigger: `__visit_history/` directory EXISTS.
   - Recursively walk `__visit_history/`; move ONLY files with extension `.vh_v3` and files named exactly `README__generated__vh_v3_format.md`, preserving the relative path under the top dir (e.g. `__visit_history/user/<u>/v3/focus_duration_per_device/<d>/<id>.vh_v3` -> `.plugin_data/visit_history/user/<u>/v3/focus_duration_per_device/<d>/<id>.vh_v3`).
   - SIMPLE per-file move: if a file already exists at the destination path, SKIP that file (no overwrite, no content merge). Skipped files stay in place.
   - Cleanup: after moving, delete directories under `__visit_history/` (and `__visit_history` itself) ONLY when completely empty (no files, no subfolders), bottom-up post-order. Leftover v2/other files keep their dirs (and ancestors) alive — intended: legacy v2 content stays untouched per prior owner decision.
   - Never throws out of onload: wrap invocation in try/catch + console.error, same as existing migrations.
3. **Ordering in main.ts onload**: (a) existing `VhTopDirRenameMigrationService` (`.visit_history` -> `__visit_history`) stays FIRST and unchanged — chaining means an ancient `.visit_history` vault migrates through both steps; (b) NEW plugin-data move runs immediately after (name-independent, BEFORE onLayoutReady/user-name modal, so the modal lists existing users from the NEW location); (c) existing `VhUserScopeMigrationService` keeps running post-pin — it operates on `VhUserPaths.TOP_DIR` so it automatically works on the new location.
4. **HiddenFileUtil prerequisites**: it lacks file listing and directory deletion. Add `listFileNames(folderPath)` and `removeFolderIfEmpty(folderPath)` (DataAdapter `list()` -> {files, folders}; `rmdir(path, recursive=false)`), plus FakeHiddenFileUtil support.
5. **No IsTrackedProvider change needed for the new dir**: dot-hidden dirs are invisible to the Vault API, so heatmap/tracking cannot see `.plugin_data`. KEEP the existing `__visit_history` + `_visit_history` exclusions while legacy leftovers may exist.
6. **README text**: `VhV3ReadmeWriter` body hard-codes the old layout + the "why not dot-hidden" rationale — rewrite for the new path and the new tradeoff explanation (it is rewritten on every activation, so it self-heals).
7. **Tests/docs**: unit tests for the new service + HiddenFileUtil additions; update path expectations in existing tests; update e2e (`e2e/constants.ts` VH_TOP_DIR + specs asserting on-disk layout), docs/ (architecture, visit-history-format, e2e-testing), and CLAUDE.md.
8. **Atomicity of release**: the TOP_DIR constant change and the migration service MUST ship in the same release (constant change alone orphans data; migration alone moves data the plugin no longer writes to).

## Ticket breakdown
1. decide ticket — confirm Obsidian Sync loss (tags: decide).
2. HiddenFileUtil: file listing + empty-dir removal.
3. Core: TOP_DIR change + migration service + wiring + unit tests + README text (deps: 1, 2).
4. e2e + docs + CLAUDE.md updates (deps: 3).

## Acceptance Criteria

Plan reviewed; implementation tickets exist and reference this plan; all tagged migration_to_plugin_data_dir.

