---
closed_iso: 2026-08-12T23:59:14Z
session_ids: [{"a": "claude", "type": "execution", "id": "fcacf5e4-a0d3-41d2-92e2-2c8ce34b4f66"}]
working_dir: nickolay-kondratyev_obsidian-visit-history-plugin
id: nid_r4om42zb3uw161wzgkf2h69zo_e
title: "Sync docs + CLAUDE.md to .plugin_data/visit_history TOP_DIR change"
status: closed
deps: [nid_fdlst01268tcjvtfs4aga34ov_e]
links: [nid_fdlst01268tcjvtfs4aga34ov_e]
created_iso: 2026-08-12T23:48:55Z
status_updated_iso: 2026-08-12T23:59:14Z
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

---

## Resolution (2026-08-12)

No new changes were required — the prose was already synced by the time this
ticket was executed:

- **CLAUDE.md** — identical to `master`; the top summary paragraph and the VH
  V3 / user-scoping / IsTrackedProvider Key-design bullets already describe the
  dot-hidden `.plugin_data/visit_history/` TOP_DIR, carry the WHY-NOT (Obsidian
  Sync skips dot-folders → per-device, does NOT sync — accepted owner
  decision), and name both chained migrations. Was updated upstream (on the
  `migration` parent branch), so it did not appear in this branch's diff.
- **docs/visit-history-format.md, docs/architecture.md, docs/README.md,
  docs/e2e-testing.md** — updated on THIS branch by commit `a562d73`
  ("Fix stale docs: VH top dir is now dot-hidden .plugin_data/visit_history").

Verification performed (no edits needed):
- Grepped all five files for `__visit_history`, "not dot-hidden", and the old
  "visible so Sync syncs it" rationale. Every surviving `__visit_history`
  reference is correct legacy/interim-migration context (the constant, the
  rename target, the tracking exclusion). The lone "visible so Sync syncs it"
  string is the INTENDED historical note in visit-history-format.md line 33
  ("a deliberate reversal of the earlier ... stance"), not stale rationale.
- Confirmed `.plugin_data/visit_history/` is used in the e2e path example and
  the layout tree; both migrations (rename + plugin-data move) are documented;
  the WHY-NOT cost is preserved.
- Docs-only ticket: no code/build/lint/test impact. Working tree clean.

