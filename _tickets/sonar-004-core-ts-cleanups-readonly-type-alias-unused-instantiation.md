---
closed_iso: 2026-07-21T00:10:56Z
id: nid_yvbeg8trv72ueqz66q10rcvsf_E
title: "sonar-004: Core TS cleanups — readonly, type alias, unused instantiation"
status: closed
deps: []
links: []
created_iso: 2026-07-20T23:34:06Z
status_updated_iso: 2026-07-21T00:10:56Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [sonar, typescript]
---

Fix three SonarQube MAJOR findings in core TS. Grouped as small type-safety cleanups.

- src/core/init/PluginFactory.ts:130 (typescript:S1848, type BUG): "Either remove this useless object instantiation of WindowActivityMonitor or use it." INVESTIGATE FIRST -- a discarded new WindowActivityMonitor(...) may be a real wiring bug (monitor never registered, so popout window activity is not tracked). Determine intended behavior before removing.
- src/core/focusTracker/FocusTracker.ts:44 (typescript:S2933): mark member listeners (never reassigned) as readonly.
- src/core/focusDuration/FocusDurationTracker.ts:44 (typescript:S6564): remove redundant type alias, replace its occurrences with unknown.

Acceptance: npm run lint + npm test green; if the PluginFactory finding is a real bug, add a failing test first per repo rules.

Sonar keys: AZ-BodplMil7_ra2uygn, AZ9xApMC4nb-_Ul_-S5_, AZ-Bodv_Mil7_ra2uygo

