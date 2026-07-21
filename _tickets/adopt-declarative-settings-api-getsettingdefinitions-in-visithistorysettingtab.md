---
closed_iso: 2026-07-21T01:37:44Z
id: nid_apqgkqd35dmxuk6jqk6l7body_E
title: "Adopt declarative settings API (getSettingDefinitions) in VisitHistorySettingTab"
status: closed
deps: []
links: []
created_iso: 2026-07-21T01:06:01Z
status_updated_iso: 2026-07-21T01:37:44Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [obsidian-review, settings]
---

Obsidian plugin review: "This PluginSettingTab does not implement getSettingDefinitions(); its settings will not appear in Obsidian's settings search for users on 1.13.0 or later. Consider adopting the declarative settings API." Target: src/settingsTab/VisitHistorySettingTab.ts:12 (class VisitHistorySettingTab extends PluginSettingTab).

Current tab renders imperatively in display(): the persisted "Idle timeout (seconds)" setting (see src/settings.ts, DEFAULT_IDLE_TIMEOUT_SECONDS / MIN_IDLE_TIMEOUT_SECONDS) plus a "File modifying actions" doc-id backfill action behind a ConfirmModal (src/settingsTab/ConfirmModal.ts, DocIdBackfillService).

FIX DIRECTION: implement getSettingDefinitions() so the searchable settings (at minimum the idle-timeout numeric setting) are declared and discoverable in Obsidian 1.13+ settings search, without regressing the existing imperative UI/behavior (the backfill action + live-apply of idle timeout must keep working). Research the current declarative settings API shape before implementing (obsidian 1.13). Keep sentence-case UI text. Note per CLAUDE.md the PluginFactory wiring seam is intentionally untested; add unit coverage where practical for the declarative definitions.

VERIFY: `npm run build` + `npm run lint` + `npm test` green; setting appears in settings search (manual check acceptable).

## Acceptance Criteria

VisitHistorySettingTab implements getSettingDefinitions(); idle-timeout setting is declared/searchable on 1.13+; existing imperative settings + backfill action unchanged; lint+build+test green.


## Notes

**2026-07-21T01:37:44Z**

Resolved on branch adopt-declarative-settings-api (commits 8482814 + 2f8734a).

Implemented getSettingDefinitions() on VisitHistorySettingTab: idle-timeout number control (key idleTimeoutSeconds, min 5, default 180, validate) + File modifying actions group with backfill button via the render escape hatch; setControlValue routes through saveSettings(). Bumped obsidian dev dep to ^1.13.1 for the 1.13 types. Kept display() as the pre-1.13 fallback and left manifest minAppVersion at 1.5.7 (bumping it = out-of-scope product decision). DRY: IdleTimeoutSeconds.isValid is the single source of truth shared by SettingsSanitizer + the tab. Added mock stubs + focused tests. Gates: build PASS, lint 0 errors, 381 tests pass. Searchability on 1.13+ is a manual check.
