---
closed_iso: 2026-08-12T23:23:51Z
id: nid_f7ky5v4q6cz1uc1xs66bylkli_e
title: Plan to move to fully hidden place
status: closed
deps: []
links: [nid_i6zq59oey3pbggvog9kj3dj8x_e]
created_iso: '2026-08-12T23:11:10Z'
status_updated_iso: 2026-08-12T23:23:51Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [migration_to_plugin_data_dir]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-visit-history-plugin
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve.
  IF there are multiple tickets that we want to create 
    THEN put the high level plan into a new ticket and `close` it 
         AND create focused implementation tickets that reference the closed plan.
    ELSE put the plan into a new `open` ticket
  After we are done close this ticket.

--------------------------------------------------------------------------------


Right now the visit history is stored in `__visit_history` folder.

This has become an issue with some plugins activating on folder creation.

Let's change the placement of where visit history is FROM `$VAULT/__visit_history` to be under `$VAULT/.plugin_data/visit_history` 

This will require migration. We will only want to migrate the files with `.vh_v3` extension as well as 'README__generated__vh_v3_format.md' THEN we will want to auto clean up directories under `__visit_history` (and `__visit_history` included) ONLY when they are EMPTY and do not contain any files. So the clean up will be scoped to `__visit_history` AND emtpy directories, after we have moved the files to the new path `$VAULT/.plugin_data/visit_history`

Lets tag all the created tickets with migration_to_plugin_data_dir, and in those tickets say if any follow up on this topic are created tag them with migration_to_plugin_data_dir as well. 

The migration should trigger when we see that there is `__visit_history` directory present.

Also lets keep migration SIMPLE and not override the files if there is a file with the same id in the destination directory. The migration is a simple move if there is no destination file at the matching id.

--------------------------------------------------------------------------------

# RESOLUTION (2026-08-12)

Planning completed. Codebase explored (paths, migrations, HiddenFileUtil capabilities, onload order); detailed plan written and split into focused tickets, all tagged `migration_to_plugin_data_dir`:

- **nid_i6zq59oey3pbggvog9kj3dj8x_e** — PLAN epic (CLOSED, holds the full high-level plan: requirements, migration mechanics, onload ordering, cleanup semantics, release-atomicity note).
- **nid_3dy6j77ekkmv2nmgsnqu959ks_e** — `decide`-tagged human gate: `.plugin_data` is dot-hidden, so **Obsidian Sync will stop syncing visit history** (the current non-dot name exists exactly for that reason — see `src/core/service/visitHistoryService/user/VhUserPaths.ts:19-23`). Close it to accept; it blocks the core ticket.
- **nid_9ebr4ouaipn4dtylfo0puycoo_e** — prerequisite: `HiddenFileUtil` lacks file listing and dir deletion; adds `listFileNames` + `removeFolderIfEmpty` (+ fake + tests).
- **nid_fdlst01268tcjvtfs4aga34ov_e** — core: `VhUserPaths.TOP_DIR` → `.plugin_data/visit_history`, new one-shot `VhPluginDataMoveMigrationService` (trigger: `__visit_history` exists; moves only `.vh_v3` + `README__generated__vh_v3_format.md` preserving relative paths; skip-on-conflict; post-order empty-dir cleanup incl. `__visit_history`), wiring after the existing top-dir rename and before the user-name modal. Deps: the two tickets above.
- **nid_7hpz3mw6bg68k41eomug4nt0j_e** — e2e (`e2e/constants.ts` `VH_TOP_DIR` + migration e2e), docs/, CLAUDE.md. Deps: core ticket.

Key findings baked into the plan: existing `.visit_history`→`__visit_history` rename stays first and chains into the new move; `VhUserScopeMigrationService` keeps working unchanged (operates on TOP_DIR); legacy v2 files are NOT moved so their dirs survive cleanup (intended — v2 untouched per prior owner decision); no `IsTrackedProvider` change needed for the dot-hidden dir (invisible to Vault API), legacy exclusions kept.
