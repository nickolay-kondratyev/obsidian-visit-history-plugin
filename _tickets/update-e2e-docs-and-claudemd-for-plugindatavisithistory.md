---
closed_iso: 2026-08-13T00:07:57Z
session_ids: [{"a": "claude", "type": "execution", "id": "b427599e-06ba-407b-9295-fa8045438a6e"}, {"a": "claude", "type": "review", "id": "40a5e352-0210-44d4-b9c3-5526fd7e740b"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_7hpz3mw6bg68k41eomug4nt0j_e
title: "Update e2e, docs, and CLAUDE.md for .plugin_data/visit_history"
status: closed
deps: [nid_fdlst01268tcjvtfs4aga34ov_e]
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e, nid_3dy6j77ekkmv2nmgsnqu959ks_e, nid_9ebr4ouaipn4dtylfo0puycoo_e, nid_fdlst01268tcjvtfs4aga34ov_e]
created_iso: 2026-08-12T23:23:17Z
status_updated_iso: 2026-08-13T00:07:57Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [migration_to_plugin_data_dir]
---

Follow-through for the storage move. Plan: nid_i6zq59oey3pbggvog9kj3dj8x_e. Deps: core change nid_fdlst01268tcjvtfs4aga34ov_e. Follow-ups on this topic: tag `migration_to_plugin_data_dir`.

## e2e (`e2e/`)
- `e2e/constants.ts:21` `VH_TOP_DIR = '__visit_history'` -> `.plugin_data/visit_history`; sweep all specs asserting the on-disk `.vh_v3` layout.
- ADD an e2e (or extend one) covering the migration: seed a vault with a pre-existing `__visit_history/user/<u>/v3/focus_duration_per_device/<d>/<id>.vh_v3` + README + a non-matching leftover file, start Obsidian, assert files moved to `.plugin_data/visit_history/...`, leftover stayed, empty dirs (incl. `__visit_history` when fully emptied) removed. See docs/e2e-testing.md for the harness.

## docs
- `docs/architecture.md`, `docs/visit-history-format.md`, `docs/e2e-testing.md`, `docs/README.md`: replace `__visit_history` layout with `.plugin_data/visit_history`; document the third migration (`__visit_history` -> `.plugin_data/visit_history`, .vh_v3+README only, skip-on-conflict, empty-dir cleanup) alongside the existing two.

## CLAUDE.md (keep SUCCINCT)
- Update the header paragraph + "VH V3" / "User scoping" / migration bullets: new top dir, note it IS dot-hidden now (Obsidian Sync no longer syncs VH — accepted, decide ticket nid_3dy6j77ekkmv2nmgsnqu959ks_e), IsTrackedProvider keeps legacy exclusions only, migration cleanup date for the new service.

## Acceptance Criteria

e2e constants+specs updated with a migration e2e; docs and CLAUDE.md reflect new layout; npm run test:e2e green.

## Resolution (2026-08-12)

Most of the docs/constants surface was already migrated by the sibling sync
ticket `nid_r4om42zb3uw161wzgkf2h69zo_e` (merged into the `migration` parent
branch): `e2e/constants.ts` `VH_TOP_DIR` already `.plugin_data/visit_history`,
all specs already read via `vhFilePath`/`VH_TOP_DIR` (no hardcoded old dir), and
`CLAUDE.md` + `docs/architecture.md|visit-history-format.md|README.md` already
document the new layout AND all three migrations (incl. cleanup dates:
rename+user-scope after 2026-October, plugin-data move after 2027-February). So
the CLAUDE.md/docs bullets of this ticket were already satisfied and verified —
no further edits needed there.

The remaining, real deliverable was the **migration e2e**, plus a doc note:

- **`e2e/obsidianHarness.ts`** — added `SeedFile { path, content }` and
  `LaunchOptions.seedFiles`: vault-relative files written into the fresh copy
  BEFORE the plugin is enabled, so onload migrations observe them on disk. Inert
  when absent (byte-for-byte the seed vault).
- **`e2e/constants.ts`** — added `VH_LEGACY_INTERIM_TOP_DIR = '__visit_history'`
  and `VH_README_FILENAME` (sync-pointer comments to
  `VhPluginDataMoveMigrationService.LEGACY_TOP_DIR` / `VhV3Paths.README_FILENAME`).
- **`e2e/vhAssert.ts`** — added `pollUntil(predicate, description, opts)` for
  bounded waits on on-disk end-states (file appears at destination / legacy dir
  pruned); no fixed sleeps.
- **`e2e/pluginDataMoveMigration.e2e.ts`** (NEW, labeled S8 — S7 was already
  taken by `minFocusToRecord`): two tests. (1) seeds
  `__visit_history/user/migrateduser/v3/…/<id>.vh_v3` + README + a top-level
  `leftover.txt`, asserts both payloads moved under `.plugin_data/visit_history/`
  with byte-identical content, leftover stayed, now-empty legacy subdirs pruned,
  `__visit_history/` survives (holds leftover). (2) same seeds WITHOUT the
  leftover → `__visit_history/` removed entirely. Uses a DISTINCT seeded user
  (`migrateduser`) so the pinned `e2e_user`'s own README write (VhStartupTasks)
  can never overwrite the asserted bytes.
- **`docs/e2e-testing.md`** — intro scenario list now names the migration spec;
  added a "Seeding legacy layouts (migration specs)" section documenting
  `seedFiles` + `pollUntil`.

Full `npm run test:e2e` green: 9/9 (7 pre-existing + 2 new).

