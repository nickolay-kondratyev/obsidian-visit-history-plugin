---
id: nid_8lj046abp2q27ahfeqw0fi3nr_E
title: "Migrate ConfirmModal setWarning() to setDestructive() when minAppVersion reaches 1.13.0"
status: open
deps: []
links: []
created_iso: 2026-07-21T01:28:14Z
status_updated_iso: 2026-07-21T01:28:14Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

obsidian 1.13.1 deprecates ButtonComponent.setWarning() in favor of setDestructive() (@since 1.13.0).

src/settingsTab/ConfirmModal.ts keeps setWarning() with an eslint-disable (@typescript-eslint/no-deprecated) because manifest.json minAppVersion is 1.5.7 and setDestructive() would crash the confirm dialog on Obsidian <1.13.

Same trigger as dropping display() in src/settingsTab/VisitHistorySettingTab.ts: when the runtime floor is raised to 1.13.0, switch to setDestructive() (or setDestructive().setCta()) and remove the eslint-disable comment.

