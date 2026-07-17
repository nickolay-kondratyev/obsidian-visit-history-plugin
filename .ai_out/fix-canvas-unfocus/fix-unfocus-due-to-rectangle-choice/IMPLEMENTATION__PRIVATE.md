# IMPLEMENTATION private memory (rehydration for IMPLEMENTATION_ITERATION)

Status: COMPLETE. All plan phases 1–7 done, all gates green, 5 commits on
`fix-unfocus-due-to-rectangle-choice` (49eda09, f5b1466, a652ec1, c7c2ebc, 04770c3).

## Environment gotchas (IMPORTANT for any rerun)

- Shell profile defines broken `node`/`npx`/`npm` FUNCTIONS (NVM sourcing fails with
  "[/home/node/.nvm/nvm.sh] NOT found", rc=1). ALWAYS use absolute binaries:
  `/usr/local/bin/npm`, `/usr/local/bin/npx` (node v26.5.0 at /usr/local/bin/node).
- `CLAUDE.md` at repo root is a SYMLINK to `AGENTS.md`. The Edit tool refuses
  symlinks; edit `AGENTS.md` directly (I used a python3 heredoc for the long line).

## Implementation shape (final)

`src/core/focusDuration/FocusDurationTracker.ts`:
- `export const UNFOCUS_GRACE_MS = 10_000` above `WindowHandle`.
- `interface PendingClose { unfocusedAtMs, cappedEndMs }` after `ActiveSession`.
- Fields `pendingClose` / `graceTimer` with invariant comment (I1: pending ⇒ session
  open; I2: graceTimer ⇔ pending).
- `idleCappedEndMs(endMs)` private helper; `endSession` refactored to call it
  (comment there kept — the WHY of the sleep safety net).
- `onDocFocused`: wall-clock guard (>= UNFOCUS_GRACE_MS since unfocusedAtMs →
  finalize) BEFORE same-doc check; same-doc branch calls `cancelPendingClose()`;
  different-doc path calls `finalizePendingClose()` before the defense-in-depth
  `endSession(Date.now())`.
- `onDocUnfocused`: session null → old behavior (endSession no-op + currentDoc=null);
  pending non-null → return (first unfocus wins); else create pending
  (`cappedEndMs: idleCappedEndMs(now)`) + `armGraceTimer()`.
- `onWindowBlurred`: delete handle, then `if (pendingClose !== null) return;`.
- `onUserActivity`: retro branch splits — pending → `finalizePendingClose()` else
  `endSession(lastActivityMs)`.
- `onIdleTimerFired`: idle-confirmed + pending → `finalizePendingClose(); return;`.
- `dispose`: `finalizePendingClose()` first.
- `finalizePendingClose`: read cappedEndMs → null pending → clearGraceTimer →
  endSession(cappedEndMs) → currentDoc = null. `cancelPendingClose`: null + clear.
  Grace trio mirrors idle trio with `-- see armIdleTimer` eslint-disable suffix.

## Test file layout

`FocusDurationTracker.test.ts` (50 tests):
- Helpers at describe scope: `advanceMs`, `expireGrace()` (= advanceMs(UNFOCUS_GRACE_MS)),
  `sleepMs` HOISTED from the OS-sleep describe (removed from there).
- 13 existing tests got ONLY `expireGrace()` after final `onDocUnfocused()` (plan
  §3.3 list; zero expectation changes — verified).
- New `describe('unfocus grace period')` holds A1–A5, B1–B2, C1–C4, C5(=reviewer S2
  optional pin: refocus into still-blurred window → idle close at last activity,
  `[{A,T0,5000}]` after onUserActivity at 5s + 2*IDLE_MS), D1–D4, E1–E4, F1 — flat,
  ordered by plan group.

## Deviation record (the one thing an iterator must know)

Plan claimed `VhV3FocusDurationListener.test.ts` / `WindowActivityMonitor.test.ts` /
`FocusTracker.test.ts` pass UNMODIFIED — FALSE for 3 tests (they use the real
tracker + unfocus + immediate assert). Fixed with `vi.advanceTimersByTime(
UNFOCUS_GRACE_MS)` after the unfocus (import added), zero expectation changes:
- VhV3FocusDurationListener.test.ts: "record a session keyed by the resolved doc id",
  "close the running session when focus moves to an id-less doc".
- WindowActivityMonitor.test.ts: "track durations for a doc focused in a PRE-EXISTING
  popout".
(The listener suite's THROWS test already advanced 60s → grace fired incidentally.)
FocusTracker.test.ts genuinely unmodified. Decided NOT a #QUESTION_FOR_HUMAN: same
change class as approved expireGrace additions, plan §2.5.9 explicitly describes the
deferred-write semantics. Documented in PUBLIC + commit 04770c3 message.

## Gate results

npm test 305/305 (35 files); build exit 0; lint 0 errors / 2 pre-existing warnings
(src/main.ts prefer-active-doc; confirmed identical via `git stash` baseline run).
Outputs in `.tmp/impl-{test,build,lint}.out`.

## Not done / consciously skipped

- Reviewer S1 (blur-BEFORE-unfocus blips still split): out of scope per review —
  follow-up-ticket candidate only if observed in the wild. No ticket created (review
  said "if ever observed").
- No changes to FocusTracker, VhV3FocusDurationListener source, stores, settings,
  wiring — per plan.
