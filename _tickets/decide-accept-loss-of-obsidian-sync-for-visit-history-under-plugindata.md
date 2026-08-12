---
closed_iso: 2026-08-12T23:25:16Z
id: nid_3dy6j77ekkmv2nmgsnqu959ks_e
title: "Decide: accept loss of Obsidian Sync for visit history under .plugin_data"
status: closed
deps: []
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e, nid_9ebr4ouaipn4dtylfo0puycoo_e, nid_fdlst01268tcjvtfs4aga34ov_e, nid_7hpz3mw6bg68k41eomug4nt0j_e]
created_iso: 2026-08-12T23:22:25Z
status_updated_iso: 2026-08-12T23:25:16Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [decide, migration_to_plugin_data_dir]
---

Gates the `.plugin_data/visit_history` migration (plan: nid_i6zq59oey3pbggvog9kj3dj8x_e). Follow-ups on this topic: tag `migration_to_plugin_data_dir`.

## Decision needed
The current top dir `__visit_history/` is deliberately NOT dot-hidden because **Obsidian Sync does not sync dot-hidden folders** — see the WHY comment + forum URL at src/core/service/visitHistoryService/user/VhUserPaths.ts:19-23. The per-user/per-device V3 layout exists specifically so multiple devices/users syncing one vault keep histories apart.

Moving to `$VAULT/.plugin_data/visit_history/` (dot-hidden) means: **visit history will no longer sync across devices via Obsidian Sync**. Each device keeps only its locally recorded history; the heatmap "last visited" will reflect only local sessions (plus whatever was migrated locally). Third-party sync (git, Syncthing, iCloud drive of the vault folder) is unaffected.

## Options
1. **Accept** (assumed by the origin ticket nid_f7ky5v4q6cz1uc1xs66bylkli_e, which explicitly chose `.plugin_data`): close this ticket -> implementation unblocks.
2. **Reject/adjust**: e.g. keep a non-dot but less trigger-happy name, or make location configurable. Then update/close the implementation tickets accordingly.

To accept: `ticket close <this-id>`.

## Acceptance Criteria

Human explicitly confirmed the sync tradeoff (close = accept) or redirected the approach.


## Notes

**2026-08-12T23:25:16Z**

ACCEPTED by owner (2026-08-12): fine with hiding under .plugin_data — questionable whether the __visit_history (non-dot) approach would have worked for Obsidian Sync anyway. Implementation unblocked.
