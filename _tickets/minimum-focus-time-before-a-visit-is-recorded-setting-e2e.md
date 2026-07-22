---
closed_iso: 2026-07-22T17:21:06Z
id: nid_nhoy7fkz6sy9vkfr40pzk3qwa_e
title: "Minimum focus time before a visit is recorded (setting + e2e)"
status: closed
deps: []
links: []
created_iso: 2026-07-22T17:02:10Z
status_updated_iso: 2026-07-22T17:21:06Z
type: feature
priority: 1
assignee: CC_WITH-nickolaykondratyev
---

## Goal
Quick in-and-out jumps into a note must NOT record a visit. Add a persisted setting "minimum focus seconds to record" (owner decisions: DEFAULT = 2 seconds; 0 = disabled/record everything; a sub-threshold session leaves NO trace at all — no .vh_v3 line AND no heatmap last-visit bump).

## Context (current pipeline)
- `src/core/focusDuration/FocusDurationTracker.ts` — session state machine; on close calls `FocusDurationSink.recordFocusDuration(docId, focusStartEpochMs, durationMs)`.
- `src/core/focusDuration/VhV3DurationRecorder.ts` — the only `FocusDurationSink` impl: serialized append to `.vh_v3` + `LastVisitCache` write-through.
- `src/core/config/ConfigProvider.ts` — the effective-config seam (`getIdleTimeoutMs()`), live-read so settings changes apply without reload.
- `src/settings.ts` — `VisitHistoryPluginSettings` + `SettingsSanitizer` (data.json boundary) + shared validity rule class (`IdleTimeoutSeconds`) consumed by both sanitizer and settings tab.
- `src/settingsTab/VisitHistorySettingTab.ts` — declarative (Obsidian 1.13+) + imperative fallback rendering; shared copy constants.
- `src/core/init/PluginFactory.ts` `activateUserScopedRecording()` — wires `FocusDurationTracker(new VhV3DurationRecorder(...), () => configProvider.getIdleTimeoutMs(), mainWindow)`.
- e2e: `e2e/obsidianHarness.ts` writes per-test `data.json` (`{ idleTimeoutSeconds }`) before enabling the plugin; `e2e/harnessFixture.ts` `useHarness(idleTimeoutSeconds, devConfigOverrides?)`; assertions in `e2e/vhAssert.ts`.

## Design decision — WHERE to filter
New decorator sink `src/core/focusDuration/MinDurationFilteringSink.ts` implementing `FocusDurationSink`, wrapping `VhV3DurationRecorder`:
- `recordFocusDuration(...)`: delegate iff `durationMs >= minMs` (inclusive boundary: exactly-threshold records); otherwise silently drop.
- Threshold injected as `MinRecordDurationMsProvider` (`() => number`), read at EVERY record → settings change applies live, matching the idle-timeout pattern.
- WHY decorator, not inside `FocusDurationTracker`: tracker SRP = session boundaries only; recording policy is a separate concern (OCP via composition). WHY not inside `VhV3DurationRecorder`: recorder SRP = persistence mechanics (serialized chain + cache write-through). Dropping BEFORE the recorder automatically satisfies "no trace at all" — no append, no LastVisitCache write.

## Implementation steps (failing tests first per repo rules)
1. `src/settings.ts`:
   - `DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD = 2` (owner decision).
   - `class MinFocusSecondsToRecord { static isValid(s): boolean }` → `Number.isInteger(s) && s >= 0` (0 = disabled; single source of truth for sanitizer + settings tab, mirroring `IdleTimeoutSeconds`).
   - Add `minFocusSecondsToRecord: number` to `VisitHistoryPluginSettings`; sanitize in `SettingsSanitizer` (invalid/absent → default 2). Unit tests in `src/settings.test.ts`: absent, negative, non-integer, NaN, string → 2; valid 0 stays 0.
2. `src/core/config/ConfigProvider.ts`: add `getMinFocusMsToRecord(): number` to the interface + `ConfigProviderDefault` (settings seconds × 1000; widen `ConfigSettingsHost` accordingly). NO dev-override key — the setting has no floor to bypass (0..n reachable via data.json); per `DevConfigOverridesReader` doc, keys are added only when a consumer exists. Unit test alongside existing ones.
3. New `src/core/focusDuration/MinDurationFilteringSink.ts` + `MinDurationFilteringSink.test.ts` (GIVEN/WHEN/THEN): delegates when duration > min; delegates when duration == min; drops when duration < min; min=0 delegates everything incl. 0 ms; provider re-read per call (live change takes effect); args passed through verbatim.
4. `src/core/init/PluginFactory.ts` `activateUserScopedRecording()`: wrap — `new FocusDurationTracker(new MinDurationFilteringSink(recorder, () => this.configProvider.getMinFocusMsToRecord()), ...)`.
5. `src/settingsTab/VisitHistorySettingTab.ts`: new number setting "Minimum focus time (seconds)" — desc: sessions shorter than this are not recorded anywhere; 0 records everything; default 2; applies immediately. Both declarative control (key `minFocusSecondsToRecord`, min 0, step 1, `validate` via `MinFocusSecondsToRecord.isValid`) and imperative `display()` fallback (silent reject of invalid input), mirroring the idle-timeout setting.
6. e2e (see acceptance): extend `e2e/obsidianHarness.ts` `LaunchOptions` with `minFocusSecondsToRecord` and write it into data.json; extend `e2e/harnessFixture.ts` `useHarness`; add absence assertion helper to `e2e/vhAssert.ts`; new spec `e2e/minFocusToRecord.e2e.ts`.
7. Docs: update repo `CLAUDE.md` (V3 key-design bullet: min-focus filter, no-trace semantics, default 2/0-disables) and `docs/` (architecture / vh-on-disk page wherever sessions-close semantics are described).

## CRITICAL call-outs
- **Existing e2e MUST seed `minFocusSecondsToRecord: 0`** in data.json (make it an explicit REQUIRED field or defaulted-to-0 in `LaunchOptions` — prefer explicit-with-default-0 documented as "filtering off unless the spec tests it"). E.g. `e2e/idleTimeout.e2e.ts` asserts a session line whose duration is ~0 ms (no input sent) — under the default 2 s threshold that line would be dropped and S5/S6 (and likely S1–S4) would fail.
- **Behavior change for existing users**: with default 2 s, sub-2 s sessions that used to be recorded no longer are (owner-approved).
- A sub-threshold session also skips the LastVisitCache/heatmap last-visit bump — intended ("no trace at all", owner-approved).
- Unload flush (`dispose()`) of a sub-threshold open session is likewise dropped — consistent, no special case.
- Do NOT re-clamp in `ConfigProvider` beyond the sanitizer (mirror idle-timeout: sanitizer is the boundary).

## Design

Decorator FocusDurationSink (MinDurationFilteringSink) between FocusDurationTracker and VhV3DurationRecorder; threshold via ConfigProvider.getMinFocusMsToRecord() read live per record; inclusive boundary (duration >= min records); 0 disables; sanitizer at data.json boundary; settings-tab rule shared via MinFocusSecondsToRecord.isValid. No dev-override key (no floor to bypass).

## Acceptance Criteria

1. Unit: MinDurationFilteringSink drops <min, passes ==min and >min, min=0 passes 0 ms, live provider re-read. SettingsSanitizer: absent/invalid -> 2, valid 0 kept. ConfigProvider returns seconds*1000.
2. e2e S7 (new e2e/minFocusToRecord.e2e.ts, minFocusSecondsToRecord=3, idle high): open A, switch to B within ~1 s, dwell on B >= 4 s, switch back to A -> B's .vh_v3 line EXISTS with duration >= 3000 ms; A's .vh_v3 file DOES NOT EXIST (checked after B's line appears — A's close finalizes immediately on different-doc focus, so no race). Positive control in same spec: dwell on A >= 4 s then switch away -> A's line appears (proves A CAN record; absence earlier was the filter, not a broken path).
3. Existing e2e S1–S6 still green with minFocusSecondsToRecord=0 seeded (0-disables contract covered by the whole existing suite).
4. npm test, npm run lint (zero errors), npm run build, npm run test:e2e all pass.
5. CLAUDE.md + docs/ updated.


## Notes

**2026-07-22T17:21:06Z**

Implemented: minFocusSecondsToRecord setting (default 2, 0 disables) via MinDurationFilteringSink decorator dropping sub-threshold sessions before the recorder (no .vh_v3 line, no LastVisitCache/heatmap bump). Config seam getMinFocusMsToRecord (live-read seconds*1000, no re-clamp, no dev key), sanitizer boundary, settings tab (declarative+imperative), e2e harness threading (existing specs seed 0), new S7 spec. Reviewer APPROVED (0 blocking/0 non-blocking). npm test 441/441, lint 0 errors, build OK, e2e 7/7. Commit e54a44a.
