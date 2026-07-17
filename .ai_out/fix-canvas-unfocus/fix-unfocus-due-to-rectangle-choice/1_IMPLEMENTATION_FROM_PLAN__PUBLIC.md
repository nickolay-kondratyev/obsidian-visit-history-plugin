# IMPLEMENTATION (from plan) — Unfocus grace period in `FocusDurationTracker`

Role: IMPLEMENTATION. Input plan: `DETAILED_PLANNING__PUBLIC.md` (approved, READY).
Date: 2026-07-16. Branch: `fix-unfocus-due-to-rectangle-choice`.

## What was implemented

Exactly the plan's design — grace period ("pending close") entirely inside
`FocusDurationTracker`:

- Exported `UNFOCUS_GRACE_MS = 10_000` (named constant; tests import it — no
  mirrored magic number anywhere).
- `PendingClose { unfocusedAtMs, cappedEndMs }` — end snapshotted at unfocus via the
  new `idleCappedEndMs()` helper (also used by `endSession` — DRY, cutoff expression
  exists once).
- Full decision table (§2.4) implemented:
  - `onDocUnfocused` (session open, no pending) → create pending + arm grace timer;
    session and `currentDoc` stay set. Second unfocus while pending → no-op (first
    unfocus time wins). No-session path unchanged.
  - `onDocFocused`: wall-clock grace-expiry guard FIRST (post-sleep refocus can never
    resurrect a session across the sleep gap); same-doc → `cancelPendingClose()` +
    adopt window; different-doc → `finalizePendingClose()` then unchanged new-focus
    flow.
  - `onWindowBlurred` while pending → delete handle + early return (grace timer
    decides; end already pinned — covers native-surface blur blips).
  - `onWindowFocused` — no code change (reopen guard needs `session === null`;
    pending ⇒ session open; post-finalize `currentDoc === null` blocks revival).
  - `onUserActivity` retroactive-idle branch while pending → finalize at pinned end.
  - `onIdleTimerFired` idle-confirmed while pending → finalize at pinned end.
  - `dispose()` → `finalizePendingClose()` first (pending session flushed at the
    ORIGINAL unfocus time, never lost, never inflated).
- `finalizePendingClose()` / `cancelPendingClose()` / grace-timer trio mirroring the
  idle-timer trio (incl. the eslint-disable pattern). Invariants I1/I2 stated as a
  WHY comment on the fields; all §2.6 WHY comments and class-doc amendment in place.

## Tests

- **Failing-test-first honored**: A1 (canvas blip → ONE spanning session) was written
  and run BEFORE any behavior change — observed failing for the right reason (two
  records `5000` + second session instead of one `10000`); commit `49eda09`.
- All planned tests added (plan §3.1–3.2): A1–A5, B1–B2, C1–C4, D1–D4, E1–E4, F1
  (19), PLUS the reviewer's optional S2 pin ("same-doc refocus into a still-blurred
  window idle-closes at last real activity") = 20 new tests.
- 13 existing `FocusDurationTracker` tests updated with ONLY the planned
  `expireGrace()` advance — **zero expectation changes** (docId/start/duration all
  identical), exactly per plan §3.3. `sleepMs` hoisted to file scope unchanged (plan
  note). Tracker suite: 50/50 green.

## Deviations from plan (2, both transparent, neither changes pinned behavior)

1. **Plan acceptance criterion 4 ("other suites pass UNMODIFIED") was factually
   wrong.** Three tests in `VhV3FocusDurationListener.test.ts` (2) and
   `WindowActivityMonitor.test.ts` (1) drive the REAL `FocusDurationTracker` through
   an unfocus and asserted immediately — they now see the record deferred by the
   grace. Fix applied: add a `vi.advanceTimersByTime(UNFOCUS_GRACE_MS)` after the
   unfocus — the SAME approved change class as the `expireGrace()` additions, with
   **zero expectation changes** (expected records byte-identical). This matches the
   plan's own §2.5.9 semantics ("write merely deferred ≤ 10 s"). NOT escalated as
   `#QUESTION_FOR_HUMAN` because no pinned expectation changed — only when the
   already-approved deferral resolves in test time. Commit `04770c3` documents it.
   Consequence: acceptance criterion 6's file list gains these two test files.
2. **CLAUDE.md is a symlink to AGENTS.md** — the doc edit landed in `AGENTS.md`
   (the symlink's target; same content).

No other deviations. `FocusTracker`, `VhV3FocusDurationListener` (source),
`WindowActivityMonitor` (source), stores, recorder, settings, wiring: untouched.

## Verification results (exact)

| Gate | Result |
|---|---|
| `npm test` | **305 passed / 0 failed** (35 files) — `.tmp/impl-test.out` |
| `npm run build` | clean (tsc + esbuild, exit 0) — `.tmp/impl-build.out` |
| `npm run lint` | **0 errors**, 2 warnings — both PRE-EXISTING in untouched `src/main.ts` (verified identical on stashed baseline) — `.tmp/impl-lint.out` |

`FocusDurationTracker.test.ts`: 50 tests (30 pre-existing incl. A1 + 19 planned new
+ 1 optional S2 pin).

## Files touched

- `src/core/focusDuration/FocusDurationTracker.ts`
- `src/core/focusDuration/FocusDurationTracker.test.ts`
- `src/core/focusTracker/listener/VhV3FocusDurationListener.test.ts` (deviation 1)
- `src/core/focusDuration/WindowActivityMonitor.test.ts` (deviation 1)
- `AGENTS.md` (= `CLAUDE.md` symlink target), `docs/architecture.md`,
  `docs/visit-history-format.md`

## Commits

- `49eda09` failing test for canvas-blip session split (A1 red)
- `f5b1466` 10s unfocus grace period (pending close) + 13 `expireGrace()` additions
- `a652ec1` full grace-period interplay test suite
- `c7c2ebc` docs: 10s unfocus grace in close-conditions
- `04770c3` tests: grace-expiry advances in listener + monitor suites

No `#QUESTION_FOR_HUMAN` items.
