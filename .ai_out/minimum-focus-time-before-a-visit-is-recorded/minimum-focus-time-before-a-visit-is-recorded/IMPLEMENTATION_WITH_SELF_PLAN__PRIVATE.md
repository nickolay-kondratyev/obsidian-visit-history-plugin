# PRIVATE — min-focus-to-record implementation (COMPLETE)

## Status: DONE. All verification green.

## Verification results (exact)
- `npm test` → EXIT 0. 45 files, 441 tests passed. (log: .tmp/test.out)
- `npm run lint` → EXIT 0, 0 errors, 1 pre-existing warning (ConfirmModal.ts setWarning deprecation, unrelated). (log: .tmp/lint2.out)
- `npm run build` → EXIT 0 (tsc -noEmit + esbuild). (log: .tmp/build.out)
- `npx tsc -p e2e/tsconfig.json` → EXIT 0.
- `npm run test:e2e` → EXIT 0. 7 tests passed (S1-S7). New S7 minFocusToRecord passed (~11.8s). (logs: .tmp/e2e-minfocus.out, .tmp/e2e-full.out)

## What was implemented (all per ticket)
1. src/settings.ts: DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD=2; class MinFocusSecondsToRecord.isValid = Number.isInteger(s)&&s>=0; field minFocusSecondsToRecord added to VisitHistoryPluginSettings; SettingsSanitizer.sanitizeMinFocusSecondsToRecord (invalid/absent->2, valid 0 kept). Mirrors IdleTimeoutSeconds.
2. src/settings.test.ts: MinFocusSecondsToRecord.isValid block (0 accepted, negative/non-integer rejected, positive accepted) + 8 sanitizer tests (null->2, valid kept, 0 kept, string->2, NaN->2, negative->2, non-integer->2, missing-key->2).
3. src/core/config/ConfigProvider.ts: getMinFocusMsToRecord() = settings.minFocusSecondsToRecord*1000; ConfigSettingsHost widened. NO dev override (documented WHY). No re-clamp. + ConfigProvider.test.ts makeHost widened (default 2) + getMinFocusMsToRecord block (seconds*1000, 0, live-change).
4. src/core/focusDuration/MinDurationFilteringSink.ts: FocusDurationSink decorator; drops when durationMs < getMinFocusMs() (>= inclusive); provider read live per call. + full GIVEN/WHEN/THEN test (delegate >min, ==min, drop <min, min=0 passes 0ms, live re-read, args verbatim).
5. src/core/init/PluginFactory.ts: recorder wrapped in MinDurationFilteringSink(recorder, () => configProvider.getMinFocusMsToRecord()); import added.
6. src/settingsTab/VisitHistorySettingTab.ts: MIN_FOCUS_NAME/DESC/ERROR consts; declarative control entry (key minFocusSecondsToRecord, min 0, step 1, validate MinFocusSecondsToRecord.isValid) inserted at index [1]; imperative displayMinFocusSetting() added + called from display(); setControlValue comment de-hardcoded (key-generic). VisitHistorySettingTab.test.ts updated: backfillGroup moved to [2], minFocusControl() helper at [1], + 6 mirrored tests.
7. e2e: obsidianHarness LaunchOptions.minFocusSecondsToRecord (required) written into data.json; harnessFixture useHarness 3rd param minFocusSecondsToRecord=0 (default 0 = filter OFF for existing specs); vhAssert.assertNoSessionLineWithin() bounded-absence helper; new e2e/minFocusToRecord.e2e.ts (S7).
8. Docs: docs/visit-history-format.md (min-focus bullet, replaced the D:0 "recorded truthfully" line); AGENTS.md (== CLAUDE.md symlink): settings.ts line, focusDuration listing (MinDurationFilteringSink), V3 key-design bullet.

## Key decisions / deviations
- Floor = 0 (0 disables). isValid = Number.isInteger && >=0.
- No dev-override key for min-focus (no hard floor to bypass) — matches ticket.
- LaunchOptions.minFocusSecondsToRecord made REQUIRED; useHarness supplies default 0 via its 3rd param → every existing spec seeds 0 automatically (S5/S6 ~0ms lines preserved).
- Sink named `MinDurationFilteringSink` (ticket's chosen name), not exploration's tentative `MinFocusDurationSink`.
- EXPLORATION said "no settings tab unit test file" — WRONG, VisitHistorySettingTab.test.ts exists and indexes definitions positionally; updated indices + added coverage.
- CLAUDE.md is a symlink to AGENTS.md; edited AGENTS.md (real target).
- S7 spec: minFocus=3, idle=180. open A / 1s / open B (A dropped) / 4s / open A (B recorded >=3000ms, A reopened) → assert B line exists>=3000, assert A no line within 1500ms window, then 4s dwell / open B (A recorded) → assert A line exists>=3000. Uses assertNoSessionLineWithin for the absence proof.

## Not done (owner of those tasks = TOP_LEVEL_AGENT)
- CHANGELOG entry — NOT written (per instructions).
- No commit made (per instructions).
