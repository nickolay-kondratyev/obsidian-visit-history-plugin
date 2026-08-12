---
id: nid_7hpz3mw6bg68k41eomug4nt0j_e
title: "Update e2e, docs, and CLAUDE.md for .plugin_data/visit_history"
status: open
deps: [nid_fdlst01268tcjvtfs4aga34ov_e]
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e, nid_3dy6j77ekkmv2nmgsnqu959ks_e, nid_9ebr4ouaipn4dtylfo0puycoo_e, nid_fdlst01268tcjvtfs4aga34ov_e]
created_iso: 2026-08-12T23:23:17Z
status_updated_iso: 2026-08-12T23:23:17Z
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

