# IMPLEMENTATION_REVIEW — PUBLIC (user-name confirmation modal)

Diff reviewed: `git diff f1f6309..HEAD` (commits 1154b64, 6cbcd51, b4f1ff6), branch `user-name-confirm-modal`.

## Verdict: **NEEDS_ITERATION**

One BLOCKING regression on the already-pinned-device path (an explicit review requirement), one SHOULD-FIX lifecycle leak. Everything else — modal flow, pin semantics, name-free store refactor, deletions, DIP shape, tests, docs, ticket resolution — verified correct and conforming.

## Actual check results (run by reviewer)

| Check | Result |
|---|---|
| `./node_modules/.bin/vitest run` | 37 files / **347 tests, all pass** |
| `./node_modules/.bin/eslint .` | **0 errors**; 2 pre-existing warnings (main.ts:119,123 `prefer-active-doc`, untouched status-bar lines) |
| `./node_modules/.bin/tsc -noEmit -skipLibCheck` | clean |
| `/usr/local/bin/node esbuild.config.mjs production` | clean |
| `sanity_check.sh` | not present in repo |

Implementer's claimed numbers match exactly.

## Findings

| # | Severity | Location | Issue | Suggested direction |
|---|---|---|---|---|
| B1 | **BLOCKING** | `src/main.ts:52-56` + `src/core/init/PluginFactory.ts` `activateUserScopedRecording` | **Pinned-device startup session lost.** Previously the V3 duration listener registered during `onload`, which completes BEFORE workspace-layout restore, so the restore-time `active-leaf-change` for the initially-open note opened its session immediately. Now registration happens inside the `onLayoutReady` callback after two awaits — strictly AFTER those events. `FocusTracker` stores the missed event in `lastFocusEvent` but the late listener never receives `onFocus`; `FocusDurationTracker.currentDoc` stays null, so the seeded window-focus can't open a session either. On EVERY app start of an already-pinned device, focus time on the restored note goes unrecorded until the next leaf-change. Human approval covered only "pre-confirm sessions lost" on UNPINNED devices — this loss on pinned devices is unapproved. | After registering the V3 listener in `activateUserScopedRecording`, replay the tracker's `lastFocusEvent` to the late listener through the serialized dispatch chain (e.g. `FocusTracker.replayLastFocusTo(listener)` enqueued on `dispatchChain`, preserving in-order delivery + testable with a fake). Bonus: the same replay also records the doc focused while the modal was open. Alternatively: explicit human acceptance (see question below). |
| S1 | SHOULD-FIX | `src/main.ts` `pinUserNameAndStartRecording` / `ModalUserNamePrompt` | **Modal + activation can outlive plugin unload.** The modal waits indefinitely for a human and is not tied to the plugin lifecycle. If the plugin is disabled/updated while the modal is open, it stays on screen; a later Confirm pins the name and then runs `activateUserScopedRecording` on an UNLOADED plugin — `registerEvent`/`registerDomEvent` on an already-unloaded Component are never released, leaking workspace `window-open`/`window-close` handlers and DOM listeners on every window, plus a stray README write. | Track unload in `main.ts` (flag or keep a prompt handle): close the prompt in `onunload` and/or bail out of `pinUserNameAndStartRecording` before activation when unloaded. |
| G1 | Suggestion | `src/core/service/visitHistoryService/user/UserNameProvider.ts:88-112` | Cross-vault first-pin race: two unpinned vaults open on the same device both show the modal; the second Confirm overwrites the shared device-scoped localStorage pin while the first session keeps recording under the first name — "first pin wins" briefly violated. | Re-check `cache.get()` after the prompt resolves and prefer an existing pin. One line, true first-pin-wins. |
| G2 | Suggestion | `src/core/service/visitHistoryService/user/impl/ModalUserNamePrompt.ts:112-116` | `resolveAndClose` has no `if (this.resolved) return;` guard — a rapid double-click on "Use this name" can invoke `onResolve` twice (harmless today: Promise resolution is idempotent). | Add the early-return for symmetry with the `onClose` guard. |

## Verified against requirements (code, not claims)

1. **Modal / charset / pre-fill** — `UserNameSafety` strict lowercase pattern with boundary-dot + 200-cap rules; sanitize handles whitespace runs, disallowed strip, and the trailing-dot-exposed-by-truncation edge (all unit-tested, 22 tests). Modal: live lowercase, Confirm disabled + error while invalid, Enter guarded, mobile has no pre-fill. No `mobile-user-<random8>` mint anywhere (grep-verified; `DeviceNameProvider`'s `mobile-` DEVICE name intentionally remains — different concern).
2. **Pin semantics** — pin only on explicit confirm via unchanged key `obsidian-vh-user-name`; cached pin short-circuits (never prompts, test-covered); dismissal pins nothing and re-prompts (test-covered).
3. **Load without name** — factory ctor wires only name-independent graph (name-free `VhV3DurationStore`; heatmap aggregate read spans all users unchanged; doc-id listener eager). Recording, user-scope migration, README all strictly post-pin, migration BEFORE activation. `dispose()` null-safe for onunload. Double-activation guarded.
4. **DIP / thin adapter** — `UserNamePrompt` interface + `FakeUserNamePrompt`; modal delegates all validation to `UserNameSafety`, resolves exactly once via `resolved` flag in `onClose`; decision/pin logic unit-tested (13 resolver tests). Untestable seams (Modal adapter, factory wiring) are documented in code + AGENTS.md, consistent with the existing "known untested seam" policy.
- **Existing-dir bypass is SOUND**: `existingNames` are real dir basenames from `listSubfolderNames` (no traversal vector); membership is checked before skipping charset validation; any other prompt output is re-validated (defense in depth). Join case test-covered (`Nickolay`).
- **Deletions match CLARIFICATION exactly**; the 3 removed tests encoded the approved-deleted behaviors and were replaced by the modal-flow suite; no orphaned code or stale comments found (migration comments and generated README text updated).
- **Ticket `onload-fails-if-user-name-resolution-throws` resolution is legitimate**: resolution moved off `onload` into try/caught `pinUserNameAndStartRecording`; plugin always loads.
- **Docs** (AGENTS.md, architecture.md, visit-history-format.md) accurately reflect the new flow; succinct.

## #QUESTION_FOR_HUMAN:
B1: On already-pinned devices, is losing the restored/initially-open note's focus session at every app start (until the first navigation) acceptable, or should the late-registered V3 listener get a replay of the last focus event (recommended — also covers the doc focused while the modal was open)?

## Round 2 — re-review of iteration fixes (commit 4e00515)

Fresh reviewer instance; verified in code, not from claims. Diff reviewed: `b4f1ff6..4e00515` (10 files, +206/−9).

### Per-finding verdicts

| # | Verdict | Evidence (code-level) |
|---|---|---|
| B1 | **FIXED** | `FocusTracker.replayLastFocusTo` (`src/core/focusTracker/FocusTracker.ts:90-104`): enqueued on the serialized `dispatchChain`; `lastFocusEvent` is read INSIDE the chained callback, so pending leaf-changes settle first — the gated-listener test proves the replay delivers the post-queue focus (`focus:b.md`), never the stale one. Delivery goes ONLY to the given listener (no re-delivery to registered listeners — test-pinned). Invoked in `PluginFactory.activateUserScopedRecording` AFTER `WindowActivityMonitor` construction and listener registration, so the seeded window-focus state lets the replayed focus open the session. Regression is behaviorally captured: the `no implicit catch-up` test pins that plain registration misses the event; the replay tests would fail without the fix. Unfocused-before-replay and never-focused cases deliver nothing (tests). |
| S1 | **FIXED** | `unloaded = true` is the first statement of `onunload`; `pinUserNameAndStartRecording` bails after the `getUserName` await (BEFORE migration) and again after the migration await (BEFORE activation) — no path to `registerEvent`/`registerDomEvent`/README-write on a dead Component remains. `PluginFactory.dispose()` closes a still-open modal via `ModalUserNamePrompt.closeOpenPrompt()` → `onClose` resolves null (nothing pinned). One narrow residual noted as N1 below (suggestion, not a leak). |
| G1 | **FIXED** | `UserNameProviderDefault.getUserName` re-checks `cache.get()` after a non-null prompt answer: existing pin returned, prompt result NOT written (both asserted by the two new tests via the `FakeUserNamePrompt.onPrompt` mid-prompt hook). Dismissal (null) semantics unchanged. |
| G2 | **FIXED** | `if (this.resolved) return;` added to `resolveAndClose`, symmetric with the `onClose` guard. Resolve-once holds across confirm→close, Esc/X/Cancel→onClose(null), double-click (second call no-ops), and unload-close orderings. |

### New findings (iteration diff scan)

| # | Severity | Location | Issue |
|---|---|---|---|
| N1 | Suggestion | `src/main.ts` `pinUserNameAndStartRecording` | No `this.unloaded` check BEFORE the `getUserName()` call. `workspace.onLayoutReady` is not Component-tied: if the plugin is disabled after `onload` but before layout-ready fires (narrow app-startup window), the callback still runs and the modal opens on an unloaded plugin — `dispose()` already ran, so `closeOpenPrompt()` can't catch it. Consequence is limited to a stray modal + a possible localStorage pin (both post-await `unloaded` checks still block migration/activation — no listener leak). One-line fix: early-return on `this.unloaded` at the top. |

Analyzed and deliberately NOT flagged: a leaf-change queued between listener registration and replay execution makes the late listener receive the live focus AND the replayed same event — benign by existing contract (FocusTracker already re-dispatches duplicate same-file focus for fresh `ownerDocument`; `FocusDurationTracker.onDocFocused` is same-doc idempotent — no session fragmentation, no duplicate record).

Docs: AGENTS.md + `docs/architecture.md` replay notes are accurate and succinct; repo `CLAUDE.md` is a symlink to AGENTS.md (no drift).

### Actual check results (round 2)

| Check | Result |
|---|---|
| `./node_modules/.bin/vitest run` | 37 files / **355 tests, all pass** (+8 vs round 1) |
| `./node_modules/.bin/eslint .` | **0 errors**, 2 pre-existing `prefer-active-doc` warnings (main.ts:128,132) |
| `./node_modules/.bin/tsc -noEmit -skipLibCheck` | clean |
| `/usr/local/bin/node esbuild.config.mjs production` | clean |

### Convergence

All round-1 findings are addressed (4/4 FIXED, none rejected). The round-1 `#QUESTION_FOR_HUMAN` on B1 is moot — the recommended replay was implemented, so no behavior loss requires human acceptance. N1 is optional polish and does not block.

## Signal: READY
