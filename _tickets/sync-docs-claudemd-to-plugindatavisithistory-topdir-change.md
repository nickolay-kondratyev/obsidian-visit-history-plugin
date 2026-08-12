---
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_r4om42zb3uw161wzgkf2h69zo_e
title: "Sync docs + CLAUDE.md to .plugin_data/visit_history TOP_DIR change"
status: in_progress
deps: [nid_fdlst01268tcjvtfs4aga34ov_e]
links: [nid_fdlst01268tcjvtfs4aga34ov_e]
created_iso: 2026-08-12T23:48:55Z
status_updated_iso: 2026-08-12T23:57:17Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [migration_to_plugin_data_dir]
---

Follow-up to nid_fdlst01268tcjvtfs4aga34ov_e (TOP_DIR moved from the visible `__visit_history` to the dot-hidden `.plugin_data/visit_history`, with new VhPluginDataMoveMigrationService).

The CODE, unit tests, e2e constants, lint and build are all updated + green. What remains is PROSE that still describes the OLD "deliberately NOT dot-hidden so Obsidian Sync syncs it" rationale, which is now reversed (dot-hidden accepted; Obsidian Sync loss accepted per nid_3dy6j77ekkmv2nmgsnqu959ks_e).

Update the following (grep each for `__visit_history` and "not dot-hidden"):
- /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin/CLAUDE.md (6 hits: top summary paragraph + Key design decisions bullets on VH V3 path, user scoping, IsTrackedProvider exclusion)
- docs/visit-history-format.md (9 hits: layout tree + rationale)
- docs/architecture.md (7 hits)
- docs/README.md (2 hits)
- docs/e2e-testing.md (1 hit)

Keep the WHY-NOT (Obsidian Sync does not sync dot-folders — the accepted cost) as documented in src/core/service/visitHistoryService/user/VhUserPaths.ts, and mention the two chained migrations (VhTopDirRenameMigrationService: `.visit_history`->`__visit_history`; VhPluginDataMoveMigrationService: `__visit_history` .vh_v3+README -> `.plugin_data/visit_history`). Note `__visit_history` survives as the LEGACY_VISIBLE_VISIT_HISTORY_TOP_DIR constant (Constants.ts), still excluded from tracking by IsTrackedProvider.

