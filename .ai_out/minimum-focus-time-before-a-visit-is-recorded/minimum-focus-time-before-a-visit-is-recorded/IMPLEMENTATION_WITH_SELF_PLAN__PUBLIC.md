# Minimum focus time before a visit is recorded — Implementation Summary

Implements ticket `_tickets/minimum-focus-time-before-a-visit-is-recorded-setting-e2e.md`.

## What was built
A persisted setting **"Minimum focus time (seconds)"** (`minFocusSecondsToRecord`,
default **2**, min **0**; **0 disables**). Focus sessions shorter than the threshold
are dropped BEFORE the recorder, leaving **no trace at all** — no `.vh_v3` line and no
heatmap last-visit bump — so quick in-and-out jumps into a note are not counted as visits.

Filtering lives in a new `FocusDurationSink` decorator (`MinDurationFilteringSink`) between
`FocusDurationTracker` and `VhV3DurationRecorder`. Threshold is read live per record via
the config seam (`ConfigProvider.getMinFocusMsToRecord()`), so a settings change applies
without reload. Inclusive boundary (`durationMs >= minMs` records). No dev-override key
(no hard floor to bypass). Sanitizer at the data.json boundary is the only clamp.

## Files changed
Source:
- `src/settings.ts` — default const, `MinFocusSecondsToRecord.isValid`, settings field, sanitizer.
- `src/core/config/ConfigProvider.ts` — `getMinFocusMsToRecord()`, widened `ConfigSettingsHost`.
- `src/core/focusDuration/MinDurationFilteringSink.ts` — NEW decorator sink.
- `src/core/init/PluginFactory.ts` — wraps the recorder in the decorator.
- `src/settingsTab/VisitHistorySettingTab.ts` — declarative + imperative setting; generic `setControlValue`.

Tests:
- `src/settings.test.ts`, `src/core/config/ConfigProvider.test.ts`,
  `src/core/focusDuration/MinDurationFilteringSink.test.ts` (NEW),
  `src/settingsTab/VisitHistorySettingTab.test.ts` (index shift + 6 new cases).

E2E:
- `e2e/obsidianHarness.ts` (LaunchOptions + data.json), `e2e/harnessFixture.ts` (3rd param, default 0),
  `e2e/vhAssert.ts` (`assertNoSessionLineWithin` bounded-absence helper),
  `e2e/minFocusToRecord.e2e.ts` (NEW, S7).

Docs:
- `docs/visit-history-format.md`, `AGENTS.md` (== `CLAUDE.md` symlink target).

## Verification (all PASS)
| Check | Result |
|-------|--------|
| `npm test` | PASS — 441 tests, 45 files |
| `npm run lint` | PASS — 0 errors (1 pre-existing unrelated warning in ConfirmModal.ts) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 7/7 (S1-S6 green with seeded `minFocusSecondsToRecord: 0`, new S7 green) |

## Key decisions for reviewers
- **Min-focus floor is 0** (0 = record everything); no state-machine reason for a higher floor unlike idle timeout.
- **No dev-override key** — the setting has no hard floor to bypass; `getMinFocusMsToRecord()` reads settings directly.
- **All existing e2e specs seed `minFocusSecondsToRecord: 0`** via `useHarness`'s default-0 third param — REQUIRED so the ~0 ms session-line assertions in S5/S6 (and S1-S4) are not dropped under the default 2 s.
- **Behavior change (owner-approved)**: with default 2 s, sub-2 s sessions (including former `D:0` pass-throughs) are no longer recorded. Documented in `docs/visit-history-format.md` and `AGENTS.md`.
- `MinDurationFilteringSink` drops before the recorder → automatically covers "no LastVisitCache/heatmap bump" and the unload-flush case, with no special-casing.

## Callouts / open questions
- None. No `#QUESTION_FOR_HUMAN`.
- Not done by design (TOP_LEVEL_AGENT owns): CHANGELOG entry, git commit.
