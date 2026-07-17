# IMPLEMENTATION_ITERATION — PUBLIC (user-name confirmation modal, review fixes)

Iteration applying the four accepted findings from `IMPLEMENTATION_REVIEW__PUBLIC.md` (B1, S1, G1, G2). Branch `user-name-confirm-modal`.

## Per-finding

### B1 (BLOCKING) — replay last focus event to the late-registered V3 listener — APPLIED
- Followed the reviewer's suggested direction exactly: new `FocusTracker.replayLastFocusTo(listener)` (`src/core/focusTracker/FocusTracker.ts`). It enqueues delivery on the SERIALIZED `dispatchChain`; the stored `lastFocusEvent` is read INSIDE the chained callback, so pending leaf-changes settle first and the listener can never receive a stale focus (in-order delivery invariant preserved). Delivery goes ONLY to the given listener; errors are isolated (`console.error`), matching `dispatch()` semantics.
- Invoked from `PluginFactory.activateUserScopedRecording` immediately after registering `VhV3FocusDurationListener` (and after `WindowActivityMonitor` construction, so the seeded window state is in place when the replayed `onDocFocused` opens the session).
- Restores: on already-pinned devices the startup-restored note's session opens; on newly-pinned devices the doc focused while the modal was open is recorded.
- TDD: 5 new failing-first tests in `FocusTracker.test.ts` `describe('replayLastFocusTo')` — late listener receives replayed focus; nothing when no event stored; nothing when the doc was unfocused before replay; no double-delivery to already-registered listeners; replay serialized behind queued leaf-changes (gated-listener test → receives the CURRENT focus, never the stale one). Plus 1 test pinning that plain `registerListener` does NOT implicitly catch up.

### S1 (SHOULD-FIX) — modal/activation must not outlive plugin unload — APPLIED
- `ModalUserNamePrompt` now tracks its open modal and exposes `closeOpenPrompt()` (closes → resolves null via the existing `onClose` path, nothing pinned).
- `PluginFactory` holds the concrete `ModalUserNamePrompt` (interface `UserNamePrompt` unchanged — `dispose()` is factory wiring, the factory's job) and `dispose()` closes any open prompt; `main.ts#onunload` already calls `dispose()`.
- `main.ts` tracks `private unloaded = false`, set first thing in `onunload`; `pinUserNameAndStartRecording` bails after the `getUserName` await and again after the migration await — so an unload mid-await can never `registerEvent` on a dead Component nor trigger the stray README write.
- Testing: the Modal adapter and `main.ts`/factory wiring are the documented untestable seams (the `obsidian` test stand-in has no `Modal`; no full App mock — consistent with the pre-existing "known untested seam" policy). No new unit tests were possible without violating that policy; logic added there is trivial (flag checks + null-safe close).

### G1 — true first-pin-wins across vaults — APPLIED
- `UserNameProviderDefault.getUserName`: after the prompt resolves non-null, re-checks `cache.get()` and returns the existing pin without overwriting it. A dismissed prompt (null) still returns null (owner semantics: dismissal = no recording this session).
- TDD: 2 new failing-first tests (prompt answers `alice` while cache is pinned `bob` mid-prompt → returns `bob`; cache stays `bob`). `FakeUserNamePrompt` gained an optional `onPrompt` hook to model mid-prompt side effects.

### G2 — `resolveAndClose` double-resolve guard — APPLIED
- `if (this.resolved) return;` early-return added, symmetric with the `onClose` guard. (Untestable Modal adapter seam; trivial.)

## Docs
- `AGENTS.md` user-scoping bullet + `docs/architecture.md` activation paragraph: one succinct note each that activation replays the last focus event to the late-registered duration listener (serialized) so the already-focused doc's session opens.

## Actual check results

| Check | Result |
|---|---|
| `./node_modules/.bin/vitest run` | 37 files / **355 tests, all pass** (was 347; +8 new) |
| `./node_modules/.bin/eslint .` | **0 errors**; same 2 pre-existing warnings (main.ts `prefer-active-doc`, untouched status-bar lines — now at 128/132 after the flag insertion) |
| `./node_modules/.bin/tsc -noEmit -skipLibCheck` | clean |
| `/usr/local/bin/node esbuild.config.mjs production` | clean |

All new tests were verified FAILING before the fixes (7 runtime failures observed; the no-implicit-catch-up test passed by design as a behavior pin).

## Commits
- `4e00515` — code + tests + docs (10 files, +206/-9) on `user-name-confirm-modal`; artifacts committed separately (see git log).

## Readiness
**READY for re-review.** All four findings applied as directed; no scope expansion; no deviations. The reviewer's `#QUESTION_FOR_HUMAN` on B1 is moot — the recommended replay was implemented, so no behavior loss needs human acceptance.

No `#QUESTION_FOR_HUMAN`.
