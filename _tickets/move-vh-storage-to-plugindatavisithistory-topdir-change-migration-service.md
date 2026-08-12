---
id: nid_fdlst01268tcjvtfs4aga34ov_e
title: "Move VH storage to .plugin_data/visit_history: TOP_DIR change + migration service"
status: open
deps: [nid_9ebr4ouaipn4dtylfo0puycoo_e, nid_3dy6j77ekkmv2nmgsnqu959ks_e]
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e, nid_3dy6j77ekkmv2nmgsnqu959ks_e, nid_9ebr4ouaipn4dtylfo0puycoo_e, nid_7hpz3mw6bg68k41eomug4nt0j_e]
created_iso: 2026-08-12T23:23:04Z
status_updated_iso: 2026-08-12T23:23:04Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [migration_to_plugin_data_dir]
---

Core implementation. Plan: nid_i6zq59oey3pbggvog9kj3dj8x_e. Deps: HiddenFileUtil APIs (nid_9ebr4ouaipn4dtylfo0puycoo_e) + decide ticket (nid_3dy6j77ekkmv2nmgsnqu959ks_e). Follow-ups on this topic: tag `migration_to_plugin_data_dir`.

## 1. Path change
- `src/core/service/visitHistoryService/user/VhUserPaths.ts`: change `TOP_DIR` from `__visit_history` to `.plugin_data/visit_history`. Rewrite the WHY comment at lines 19-23: the dir is now deliberately dot-hidden (avoids plugins that activate on visible-folder creation; Obsidian Sync loss accepted per nid_3dy6j77ekkmv2nmgsnqu959ks_e — keep the old forum URL as WHY-NOT context).
- Everything composes off TOP_DIR (`VhV3Paths`, `UserNameProvider`/`UserNamePrompt` user listing, `VhV3DurationStore` cross-user reads, `VhV3ReadmeWriter`). Grep src/ for any remaining hard-coded `__visit_history` outside the migration services and fix. Update user-facing prompt text in `src/core/service/visitHistoryService/user/UserNamePrompt.ts` if it names the path.
- `src/core/util/vault/IsTrackedProvider.ts`: KEEP `__visit_history` + `_visit_history` exclusions (legacy leftovers, e.g. unmigrated v2, may remain visible). No exclusion needed for `.plugin_data` — dot-dirs are invisible to the Vault API — but ADD a unit test documenting that assumption if practical.
- `VhV3ReadmeWriter` body text hard-codes the old layout + not-dot-hidden rationale — rewrite for the new path (README is rewritten on every activation, so it self-heals in-place).

## 2. New migration service `src/core/service/migration/VhPluginDataMoveMigrationService.ts`
Follow the pattern of the two existing services in that dir (one-shot, ctor-injected HiddenFileUtil (+ UserNotifier if useful), `migrateIfLegacyPresent()`, `TODO(cleanup)` note — cleanup after 2027-February).
- Trigger: `hiddenFileUtil.exists('__visit_history')` (keep the legacy name as a private const in the service; it must NOT reference VhUserPaths.TOP_DIR, which now points at the new location).
- Recursively walk `__visit_history/` (listSubfolderNames + new listFileNames). Move ONLY files ending in `.vh_v3` and files named exactly `README__generated__vh_v3_format.md`, preserving relative path: `__visit_history/<rel>` -> `.plugin_data/visit_history/<rel>` (destination top dir via `VhUserPaths.TOP_DIR`). Per-file `hiddenFileUtil.rename`; if destination exists, SKIP the file (leave source; no overwrite/merge — rename already throws on existing dest, so pre-check with exists()).
- Cleanup: post-order over the walked tree, `removeFolderIfEmpty` on each dir under `__visit_history` and finally `__visit_history` itself. Dirs holding leftover files (v2, skipped conflicts, foreign files) survive — intended.
- Whole invocation wrapped in try/catch + console.error in main.ts (never break onload); per-file failures should console.error and continue, not abort the walk.

## 3. Wiring order in `src/main.ts` onload
1. existing `VhTopDirRenameMigrationService` (`.visit_history` -> `__visit_history`) — UNCHANGED, stays first (ancient vaults chain through both migrations);
2. NEW `VhPluginDataMoveMigrationService.migrateIfLegacyPresent()` — immediately after, name-independent, BEFORE `onLayoutReady`, so the user-name modal lists existing users from the NEW location;
3. existing post-pin `VhUserScopeMigrationService` — UNCHANGED; it operates on `VhUserPaths.TOP_DIR` so it now moves pre-user-scoped `v3/` (already relocated by step 2, since those dirs contain .vh_v3 files) under `user/<name>/`. NOTE: pre-user-scoped `v2/` will remain stranded in `__visit_history/v2` (not moved — only .vh_v3+README migrate) — acceptable, v2 is never read.

## 4. Tests (vitest; start from failing tests)
Mirrored `VhPluginDataMoveMigrationService.test.ts` using FakeHiddenFileUtil, covering at least: absent `__visit_history` = no-op; nested .vh_v3 files moved with structure preserved; README moved; non-matching files (e.g. v2 payloads, stray .md) left in place; destination-exists conflict = source kept, no overwrite; empty dirs (incl. top) removed; dirs with leftovers kept; per-file error does not abort remaining moves. Update existing tests that assert `__visit_history` paths (`VhV3Paths.test.ts`, `VhV3DurationStore.test.ts`, `VhV3DurationRecorder.test.ts`, `UserNameProvider.test.ts`, `IsTrackedProvider.test.ts`, `VaultUtil.test.ts`, migration tests).

## Release note
TOP_DIR change and migration MUST ship in the same release. `npm test`, `npm run lint`, `npm run build` clean.

## Acceptance Criteria

TOP_DIR points at .plugin_data/visit_history; migration moves .vh_v3+README, skips conflicts, prunes only empty dirs incl. __visit_history; wiring order per body; all tests/lint/build green.

