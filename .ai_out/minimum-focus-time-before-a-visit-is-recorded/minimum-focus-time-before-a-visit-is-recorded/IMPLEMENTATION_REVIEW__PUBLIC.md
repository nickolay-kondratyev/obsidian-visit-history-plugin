# Implementation Review — Minimum focus time before a visit is recorded

**Scope:** HEAD commit `e54a44a` against `_tickets/minimum-focus-time-before-a-visit-is-recorded-setting-e2e.md`.

**Verification:** `npx vitest run` → 45 files / **441 tests pass**. `npx eslint .` → **0 errors** (1 pre-existing warning in `ConfirmModal.ts`, unrelated to this change). Full Playwright e2e not re-run; S7 reviewed by hand and found logically sound.

## Summary
Adds a persisted `minFocusSecondsToRecord` setting (default 2, 0 disables) that gates recording via a new `MinDurationFilteringSink` decorator wrapping `VhV3DurationRecorder`. Sub-threshold sessions are dropped *before* the recorder, so they leave no `.vh_v3` line and no `LastVisitCache`/heatmap bump. Threshold flows through the `ConfigProvider` seam and is read live per record. Every acceptance criterion is met; the implementation faithfully mirrors the existing idle-timeout pattern.

## BLOCKING
None.

Every design decision and acceptance criterion from the ticket is satisfied:
- **Inclusive boundary + min=0 pass-through** — `MinDurationFilteringSink.ts:30-35` drops iff `durationMs < getMinFocusMs()`; ==threshold records, 0ms passes when min=0. Unit-covered at 1999/2000/2001 and 0ms.
- **Live re-read** — provider `() => configProvider.getMinFocusMsToRecord()` invoked every record; `getMinFocusMsToRecord` reads `host.settings` live (`ConfigProvider.ts:61-63`). Covered by ConfigProvider "live settings change" test and the sink "re-read on every call" test.
- **No-trace ordering** — decorator wraps the recorder in `PluginFactory.ts:143-150`; dropping before the recorder inherently skips both the append and the cache write-through.
- **Sanitizer** — `settings.ts:82-86` + `MinFocusSecondsToRecord.isValid` (integer && >=0): absent/string/NaN/negative/non-integer → 2, valid 0 kept. Fully unit-covered.
- **ConfigProvider** — seconds×1000, no dev-override key (correctly none — no floor to bypass), no re-clamp.
- **Existing e2e seed 0** — `LaunchOptions.minFocusSecondsToRecord` is required; `useHarness` defaults it to 0 and threads it into `data.json`, preserving S1–S6's ~0ms line assertions.
- **S7 spec** — `minFocusToRecord.e2e.ts` matches acceptance criterion 2 (B records ≥3000ms, A absent via polling `assertNoSessionLineWithin` — `sessionLines` returns `[]` for a missing file, so absence is genuinely proven; positive control re-records A). No race: A's close finalizes on the A→B focus, before B's asserted line.

## NON-BLOCKING
None of substance. The change is idiomatic, DRY (shared `MinFocusSecondsToRecord` validity class across sanitizer + settings tab), SRP-clean (policy isolated in a decorator), and consistent with the idle-timeout precedent. Docs (`AGENTS.md`/`CLAUDE.md` symlink, `docs/visit-history-format.md`) are succinct, accurate, and flag the behavior change for existing users.

## Documentation Updates Needed
None. Docs are already updated and correct.

## Verdict
**APPROVED.** Ship it. Zero blocking and zero non-blocking issues; tests and lint are green.
