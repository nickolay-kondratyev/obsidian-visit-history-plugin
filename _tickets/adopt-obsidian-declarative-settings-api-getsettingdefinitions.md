---
id: nid_qgs5j7z3hx07bor1w790xzbjn_E
title: "Adopt Obsidian declarative settings API (getSettingDefinitions)"
status: open
deps: []
links: []
created_iso: 2026-07-20T22:34:28Z
status_updated_iso: 2026-07-20T22:34:28Z
type: feature
priority: 3
assignee: CC_fable5_WITH-nickolaykondratyev
external-ref: obsidian-review-warnings
tags: [obsidian-review, settings]
---

Obsidian review bot warning at src/settingsTab/VisitHistorySettingTab.ts:12 — PluginSettingTab does not implement getSettingDefinitions(); settings will not appear in Obsidian settings search for users on 1.13.0+.

WHY DEFERRED (low value / high risk now): The declarative settings API was added in Obsidian 1.13.0. This plugin manifest minAppVersion=1.5.7, and the local obsidian devDep is 1.12.3 (API absent). Obsidian docs explicitly sanction imperative display() as the fallback for plugins supporting <1.13.0, so the current code is not a defect. A faithful port is a feature-parity rewrite: the tab has an async doc-id-backfill onClick behind a ConfirmModal and idleTimeoutSeconds min/integer validation — the declarative DSL (SettingDefinitionItem[], getControlValue/setControlValue, update/refreshDomState) would need to reproduce all of that, and either bump minAppVersion to 1.13.0 (compatibility-narrowing product decision) or maintain display() + getSettingDefinitions() in parallel.

## Acceptance Criteria

Decision needed: (a) raise minAppVersion to 1.13.0 and port fully to getSettingDefinitions(), or (b) keep display() + add getSettingDefinitions() in parallel for search integration. Either way preserve backfill confirm-modal flow and idle-timeout validation; bump obsidian devDep to >=1.13.0 first.


## Owner decision (2026-07-20)
Keep supporting older Obsidian for now — 1.13.0 is catalyst (insider) only, not a
general release yet. BLOCKED: do not action until 1.13.0 is broadly released and
minAppVersion is deliberately raised. Current imperative `display()` / `setWarning()`
are the correct, sanctioned choices meanwhile.
