# IMPLEMENTATION_ITERATION — PRIVATE

## State: COMPLETE (all four findings applied, all checks green)

## What changed (files)
- `src/core/focusTracker/FocusTracker.ts` — `replayLastFocusTo(listener)`: chains onto `dispatchChain`; reads `lastFocusEvent` INSIDE the chained callback (captured to a local `event` const — TS narrowing across await); try/catch mirrors `dispatch()` error isolation; trailing `.catch` keeps the chain never-rejected.
- `src/core/focusTracker/FocusTracker.test.ts` — new `describe('replayLastFocusTo')` (5 tests) + 1 pin test in event-dispatch describe ("NOT deliver past events ... no implicit catch-up").
  - GOTCHA hit: in the "unfocused before replay" test I initially registered the late listener while the two leaf-changes were still QUEUED → dispatch reads `this.listeners` live, so the late listener received them. Fixed with `await tracker.whenIdle()` before late registration.
  - GOTCHA avoided: in the serialization test the late listener is deliberately NOT registered (replay delivers directly to the param) — registering would let it see the queued b-event live and muddy the assertion.
- `src/core/init/PluginFactory.ts` — duration listener into a local, `registerListener` + `replayLastFocusTo`; new field `modalUserNamePrompt` (concrete handle), constructed once and passed to `UserNameProviderDefault`; `dispose()` calls `closeOpenPrompt()` first.
- `src/core/service/visitHistoryService/user/impl/ModalUserNamePrompt.ts` — `openModal` field; resolve callback wrapper nulls it; `closeOpenPrompt()`; G2 `if (this.resolved) return;` in `resolveAndClose`.
- `src/core/service/visitHistoryService/user/UserNameProvider.ts` — post-prompt `pinnedWhilePromptOpen = this.cache.get()` re-check AFTER the null-return (dismissal still → null even if another vault pinned meanwhile — deliberate, kept owner dismissal semantics), BEFORE validation/set.
- `src/testSupport/FakeUserNamePrompt.ts` — optional `onPrompt: (() => void) | null` hook, invoked in `promptForUserName`.
- `src/core/service/visitHistoryService/user/UserNameProvider.test.ts` — 2 G1 tests using `prompt.onPrompt = () => cache.set('bob')`.
- `src/main.ts` — `private unloaded = false`; set in `onunload` before `dispose()`; bail `if (userName === null || this.unloaded)` after getUserName await; second `if (this.unloaded) return;` after migration await, before `activateUserScopedRecording`.
- Docs: `AGENTS.md` (CLAUDE.md is a symlink to it — edit AGENTS.md only) user-scoping bullet clause; `docs/architecture.md` activation paragraph sentence.

## Key design notes
- Replay ordering invariant: reading lastFocusEvent in-chain is the whole trick — replay enqueued while events are pending delivers the post-drain focus, never stale.
- Replay happens AFTER WindowActivityMonitor construction in activateUserScopedRecording (monitor seeds window state synchronously; replay delivery is async on the chain) → `onDocFocused` can open the session.
- S1: interface `UserNamePrompt` deliberately NOT widened with close — factory holds the concretion (it wires concretions per DIP policy). FakeUserNamePrompt untouched by S1.
- Untestable seams unchanged per policy: Modal subclass, main.ts wiring, factory wiring.

## Verification (all in .tmp/)
- vitest: 37 files / 355 tests pass (`.tmp/vitest-full2.txt`); before-fix failing run in `.tmp/vitest-failing.txt` (7 failures).
- eslint: 0 errors, 2 pre-existing `prefer-active-doc` warnings now at main.ts:128,132 (`.tmp/eslint.txt`).
- tsc -noEmit -skipLibCheck: clean. esbuild production: clean.

## Commits
- `4e00515` code+tests+docs; artifacts follow-up commit.

## Not-my-files in worktree (left alone)
- Modified `TOP_LEVEL_AGENT.md` + untracked `IMPLEMENTATION_REVIEW__PUBLIC.md`/`IMPLEMENTATION_REVIEWER__PRIVATE.md` were already dirty pre-iteration (reviewer/parent artifacts) — NOT committed by me.
