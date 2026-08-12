---
id: nid_f7ky5v4q6cz1uc1xs66bylkli_e
title: "Plan to move to fully hidden place"
status: open
deps: []
links: []
created_iso: 2026-08-12T23:11:10Z
status_updated_iso: 2026-08-12T23:11:10Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [migration_to_plugin_data_dir]
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
















