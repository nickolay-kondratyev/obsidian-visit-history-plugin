---
closed_iso: 2026-07-21T00:01:29Z
id: nid_gp11a3df4aeftcoqwjlmf6c2i_E
title: "sonar-002: React — add explicit button type attribute"
status: closed
deps: []
links: []
created_iso: 2026-07-20T23:33:36Z
status_updated_iso: 2026-07-21T00:01:29Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [sonar, react]
---

Fix SonarQube MAJOR rule typescript:S9011 (add explicit `type` attribute to `<button>`). Default button type submits inside a form; be explicit (`type="button"`).

Locations:
- src/view/components/Header.tsx:51, :66, :76, :84, :93
- src/view/components/TreemapViz.tsx:331
- src/view/components/header/FilterGroup.tsx:27, :48

Acceptance: every flagged `<button>` gets an explicit `type` (`button` unless it genuinely submits). npm run lint + npm test stay green.

Sonar keys: AZ9xApV14nb-_Ul_-S6E/F/G/H/I, AZ9xApWN4nb-_Ul_-S6J, AZ9xApVB4nb-_Ul_-S6C/D

