---
id: nid_2y32yckpy1plq9c5i06yq73yw_E
title: "sonar-005: UserNameSafety regex — remove super-linear backtracking"
status: open
deps: []
links: []
created_iso: 2026-07-20T23:33:47Z
status_updated_iso: 2026-07-20T23:33:47Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sonar, performance, regex]
---

Fix SonarQube MAJOR rule typescript:S8786 (regex has super-linear performance due to backtracking).

- src/core/service/visitHistoryService/user/UserNameSafety.ts:41

UserNameSafety enforces the lowercase filename-safe charset (a-z0-9._-). Simplify the regex to be linear (avoid nested/overlapping quantifiers) WITHOUT changing which names are accepted/rejected.

Acceptance: start with tests capturing current accept/reject behavior (valid names, invalid chars, empty, boundary), then simplify regex; UserNameSafety.test.ts green.

Sonar key: AZ9xOA-LJI5IiFqUsA6F

