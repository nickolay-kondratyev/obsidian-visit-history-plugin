# IMPLEMENTATION_REVIEWER — PRIVATE memory (user-name-confirm-modal)

Review of `git diff f1f6309..HEAD` (commits 1154b64 impl, 6cbcd51 docs, b4f1ff6 artifacts).
Verdict: **NEEDS_ITERATION** (1 BLOCKING, 1 SHOULD-FIX, 2 suggestions).

## Checks actually run (all from repo root)
- `./node_modules/.bin/vitest run` → **37 files / 347 tests, all pass** (matches implementer claim).
- `./node_modules/.bin/eslint .` → 0 errors, 2 pre-existing `prefer-active-doc` warnings (main.ts:119,123).
- `./node_modules/.bin/tsc -noEmit -skipLibCheck` → clean.
- `/usr/local/bin/node esbuild.config.mjs production` → clean (regenerates tracked `main.js`? no — main.js untracked; only TOP_LEVEL_AGENT.md dirty pre-existing). No `sanity_check.sh` in repo.
- Env note confirmed: bare `npm`/`node` shadowed; use `./node_modules/.bin/*` + `/usr/local/bin/node`.

## What I verified (do not re-verify blindly, but spot-check on iteration)
- Req 1 (modal, prefill, live validation): `UserNameSafety` (strict `/^[a-z0-9_-][a-z0-9._-]{0,198}[a-z0-9_-]$|^[a-z0-9_-]$/`, sanitize collapses whitespace→`_`, strips disallowed + boundary dots, cap 200 THEN strips exposed trailing dot — has test). Modal pre-fills sanitized OS name, lowercases live, Confirm disabled + error text while invalid, Enter guarded by validity. Mobile: `OsUserNameLookup` null → defaultName null; no mint anywhere (grep `mobile-user|randomUUID` — only `DeviceNameProvider` mints `mobile-` DEVICE names, intentionally kept).
- Req 2 (pin semantics): pin only via `cache.set` after explicit non-null prompt answer + validation; key `obsidian-vh-user-name` unchanged; cached → early return, never prompts (tests cover). Dismiss → null, nothing pinned, re-prompt next start (test covers 2 calls → promptCount 2).
- Req 3 (load without name): factory ctor wires only name-independent graph (heatmap read via name-free `VhV3DurationStore`, DocIdFocusListener, backfill, view stores). `activateUserScopedRecording(userName)` builds tracker+recorder+monitor, late-registers V3 listener (order after DocId preserved by push), kicks README task. `dispose()` null-safe (`focusDurationTracker?.dispose()`); onunload OK. Double-activation guard present (console.error + return).
- Req 4 (DIP): `UserNamePrompt` interface OK; `ModalUserNamePrompt` thin — validation delegated to `UserNameSafety`; one-shot via `resolved` flag in `onClose`; documented as intentionally untested (obsidianMock has no Modal/Setting) — consistent with existing "known untested seam" policy in AGENTS.md.
- Store refactor: `appendFocusDuration(userName,…)`/`readSessions(userName,…)` per-call; only prod caller of append = `VhV3DurationRecorder` (holds PINNED name via new ctor param, only constructed post-pin). Aggregate read `getLastFocusStartMsAcrossUsersAndDevices` unchanged, spans all users. `readSessionsForUser` private helper folded into public `readSessions` — no dupe.
- Existing-dir bypass ("joining") is SOUND: `existingNames` comes from `HiddenFileUtil.listSubfolderNames` (real dir basenames — no traversal possible), membership check `existingNames.includes(chosenName)` before skipping charset validation; anything else re-validated (defense-in-depth vs untested modal). Test covers `Nickolay` join.
- Deletions match CLARIFICATION exactly (desktop auto-answer, mobile single-dir adoption, random mint + their 3 tests, rewritten to 13 modal-flow tests). No orphaned code/comments (migration service comments updated; README writer text updated).
- Ticket `onload-fails-if-user-name-resolution-throws`: resolution LEGITIMATE — `getUserName` now inside try/catch in `pinUserNameAndStartRecording` off the onload path; degrades to console.error + no recording.
- Docs (AGENTS.md + architecture.md + visit-history-format.md) accurate vs code.
- WindowActivityMonitor constructed post-pin: still seeds `hasFocus()` windows + discovers pre-existing popouts via leaf enumeration — window-focus state fine at ANY construction time.

## Findings

### BLOCKING B1 — pinned-device startup session regression (main.ts:52-56 / PluginFactory.activateUserScopedRecording)
Before: V3 duration listener registered synchronously during `onload`, which completes BEFORE Obsidian restores the workspace layout → the restore-time `active-leaf-change` for the initially-open note was captured → its session opened immediately.
Now: registration happens in the `onLayoutReady` callback AFTER `await getUserName()` + `await migrateIfLegacyPresent()` — strictly after layout restore. `FocusTracker` (registered at onload) dispatches the restore-time focus only to `DocIdFocusListener` and stores it in `lastFocusEvent`; the late V3 listener never gets `onFocus`. `FocusDurationTracker.currentDoc` stays null, so even the seeded `onWindowFocused` can't open a session. Result: on EVERY app start of an ALREADY-PINNED device, focus time on the restored note is unrecorded until the next leaf-change. Human only accepted "pre-confirm sessions lost" for UNPINNED devices — this is unapproved loss for pinned ones (explicit review requirement).
Fix direction: after registering the V3 listener in `activateUserScopedRecording`, replay `FocusTracker.lastFocusEvent` to the late listener THROUGH the serialized dispatch chain (e.g. `focusTracker.replayLastFocusTo(listener)` that enqueues on `dispatchChain` — preserves in-order guarantee). Alternatively re-derive from `workspace.activeLeaf` at activation, but tracker-side replay is cleaner + testable. Same mechanism also (bonus) records the doc focused while the modal was open, superseding the accepted loss.
Alternative resolution: explicit human acceptance of the loss — hence #QUESTION_FOR_HUMAN in PUBLIC.

### SHOULD-FIX S1 — modal/activation flow can outlive plugin unload (main.ts pinUserNameAndStartRecording; ModalUserNamePrompt)
The modal is not tied to plugin lifecycle. Disable/update the plugin while the modal is open (indefinite window — it waits for a human): modal stays on screen; Confirm then pins (acceptable) AND runs `activateUserScopedRecording` on an UNLOADED plugin — `registerEvent`/`registerDomEvent` on an already-unloaded Component are never released (unload already ran) → leaked workspace `window-open`/`window-close` handlers + DOM listeners on every window + stray README write.
Fix: track unload in main.ts (flag or keep modal handle); `onunload` closes the prompt and/or `pinUserNameAndStartRecording` bails before `activateUserScopedRecording` when unloaded.

### Suggestions
- G1: cross-vault first-pin race — two unpinned vaults of the same device both prompt; second Confirm overwrites shared device-scoped localStorage while first session records under the first name. Cheap: re-check `cache.get()` after the prompt resolves; prefer existing pin (true first-pin-wins).
- G2: `UserNamePromptModal.resolveAndClose` lacks `if (this.resolved) return;` — double-click on "Use this name" can call `onResolve` twice (harmless: Promise resolve idempotent) — add for symmetry with onClose guard.

## Things I decided NOT to flag
- `console.error` with `userName=[${x}]` embedded value — matches existing codebase pattern.
- `readSessions` staying public — pre-existing API shape.
- Modal live-lowercase caret jump — implementer flagged, PARETO-accepted.
- Enter-key vs Confirm-click duplicated validity check inside adapter — trivial.
- `if (cached)` truthiness (empty-string pin impossible via validation).

---

# Round 2 memory (re-review of iteration 4e00515, artifacts aa838f0)

## Checks actually run (round 2)
- `./node_modules/.bin/vitest run` → 37 files / **355 tests, all pass** (+8 vs round 1: 6 FocusTracker replay-suite tests incl. the no-implicit-catch-up pin, 2 UserNameProvider G1 tests).
- `./node_modules/.bin/eslint .` → 0 errors, same 2 pre-existing `prefer-active-doc` warnings (main.ts now 128/132).
- `./node_modules/.bin/tsc -noEmit -skipLibCheck` → clean.
- `/usr/local/bin/node esbuild.config.mjs production` → clean.
- No `sanity_check.sh` (re-confirmed). CLAUDE.md is a SYMLINK to AGENTS.md — doc updates propagate, no drift.

## Verification detail (code-level, not claims)
- **B1 FIXED**: `FocusTracker.replayLastFocusTo` (src/core/focusTracker/FocusTracker.ts:90-104) appends to `dispatchChain`; `lastFocusEvent` read INSIDE the chained callback (no stale capture — proven by the gated-listener test which asserts the replay delivers focus:b.md, the post-queue value). Delivery to ONLY the given listener; error isolation mirrors `dispatch()`. PluginFactory order: WindowActivityMonitor constructed → listener registered → replay — seeded window state in place. Tests behaviorally capture the regression (late listener + no replay = `[]` pinned by the no-catch-up test; with replay = `['focus:a.md']`).
- **Double-delivery edge analyzed, NOT flagged**: if a leaf-change is queued between (sync) registration and replay execution, the late listener gets the live focus AND the replayed same event. Benign by existing contract — FocusTracker deliberately re-dispatches duplicate same-file focus (fresh ownerDocument), and `FocusDurationTracker.onDocFocused` is same-doc idempotent (session?.docId === docId → continue). No record duplication possible.
- **S1 FIXED (with one residual noted as suggestion N1)**: `unloaded=true` is the FIRST statement of onunload; bail check after getUserName await (before migration) AND after migration await (before activation) — no `registerEvent`/`registerDomEvent`/README path survives. `PluginFactory.dispose()` → `modalUserNamePrompt.closeOpenPrompt()` → `Modal.close()` → `onClose` resolves null (guarded), nothing pinned. Residual N1: no `unloaded` check at TOP of `pinUserNameAndStartRecording` — unload BEFORE `onLayoutReady` fires (workspace API, not Component-tied) opens the modal post-unload; consequence limited to a stray modal + possible localStorage pin (activation still blocked). Suggestion, not blocking.
- **G1 FIXED**: post-prompt `cache.get()` re-check returns existing pin, never writes prompt answer; null answer still returns null (dismissal semantics intact). Both tests assert return value AND non-clobbered cache. `FakeUserNamePrompt.onPrompt` hook is a clean mid-prompt side-effect model.
- **G2 FIXED**: `if (this.resolved) return;` in resolveAndClose; onClose guard unchanged; orderings hold: confirm→close (resolved set before close), Esc/X/Cancel→onClose resolves null once, double-click→second call no-ops, unload-close→null once.
- **Docs**: AGENTS.md user-scoping bullet + architecture.md activation paragraph accurately describe the replay; succinct.

## Verdict round 2
READY. All four findings applied as directed; no regressions found in the iteration diff; #QUESTION_FOR_HUMAN from round 1 moot (replay implemented — no behavior loss needs acceptance).
