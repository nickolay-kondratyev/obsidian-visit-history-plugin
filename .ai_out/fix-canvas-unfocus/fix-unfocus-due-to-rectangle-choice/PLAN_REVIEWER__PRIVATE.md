# PLAN_REVIEWER private memory (rehydration)

Session 1 (2026-07-16): full review DONE. Verdict READY, iteration skippable.
Review file: `DETAILED_PLAN_REVIEW__PUBLIC.md` (same dir). 0 BLOCKING, 0 IMPORTANT,
2 SUGGESTION (S1 blur-before-unfocus ordering out of scope; S2 refocus-into-blurred-window
optional extra test). 3 minor inline edits made to `DETAILED_PLANNING__PUBLIC.md`.

## What I verified (do not redo)
- Read in full: FocusDurationTracker.ts (200 lines), its test (414 lines, 30 tests),
  FocusTracker.ts, VhV3FocusDurationListener.ts.
- Decision table §2.4: every row traced. Key line refs: reopen guard :108 (session===null →
  pending blocks reopen, I1 holds); onUserActivity retro check :115 BEFORE lastActivityMs=now
  :121; endSession backstop :159-161; onWindowBlurred close condition :99.
- Double-unfocus provenance: FocusTracker.ts:100-104 nulls lastFocusEvent after unfocus →
  second onDocUnfocused only via listener id-failure path (VhV3FocusDurationListener.ts:35-40).
  Plan's parenthetical claim TRUE.
- 13-test expireGrace list VERIFIED exact (line refs all match current file). Hand-simulated
  :84 (A→B→A — different-doc focus finalizes synchronously at original unfocus → 'A:100,
  B:200,A:300' preserved) and :382 (sleep cap — cappedEndMs snapshot = 45s, same expectation).
  16-entry unchanged list also correct.
- Idle-fire vs grace-fire ordering: order-independent (both finalize at pinned cappedEndMs).
  D3 simulated: idle 12s fires at T0+12s inside grace → finalize at T0+5000 → 5000. Same if
  grace fired first.
- E1/E2 wall-clock guard simulated incl. stale timers under vi fake timers (setSystemTime
  does not fire timers — existing sleepMs comment relies on this).
- E3 simulated: retro branch fires at first post-sleep during-grace activity BEFORE
  lastActivityMs update → would be correct even WITHOUT snapshot. Hence inline edit 1.

## Inline edits I made to the plan (already done)
1. §2.2 snapshot WHY rewritten (original scenario intercepted by own D-row retro finalize;
   real value = I4 locally true, deterministic under live timeout change).
2. "provably idempotent no-op" → no-op under stable timeout; live shrink can only pull end
   earlier (I3 holds). Also snippet comment in finalizePendingClose.
3. §3.2: hoist sleepMs (nested in describe at test:352) to file scope for E-tests.

## Residual corner cases judged acceptable (do not re-flag)
- Blur-first-then-unfocus blip: grace never engages (no pending at blur) — approved scope
  leaves blur semantics untouched. S1 suggestion = follow-up ticket if observed.
- Same-doc refocus into still-blurred window during grace: session stays open in blurred
  window until idle close at lastActivityMs (≤ blur time; no input while all windows
  blurred) — bounded, within approved tradeoff. S2 optional extra test.
- Mid-grace idle-timeout settings shrink: end can move earlier via backstop — never later.
- pending + onDocUnfocused when session===null: unreachable with pending (I1); without
  pending keeps today's behavior (currentDoc=null) — test :316 stays unchanged.

## If asked to re-review after implementation
Check: exported UNFOCUS_GRACE_MS used in tests (no mirrored 10_000); eslint-disable lines on
new timer calls; finalize clears pending BEFORE clearGraceTimer (fine); dispose finalizes
first; acceptance criterion 6 diff-scope (5 files only).
