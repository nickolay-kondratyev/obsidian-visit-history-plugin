# PLANNER PRIVATE MEMORY — grace-period plan (fix-unfocus-due-to-rectangle-choice)

State: DETAILED_PLANNING complete. `DETAILED_PLANNING__PUBLIC.md` written (same dir).
Rehydration target: PLAN_ITERATION. Read public plan first; this file holds reasoning that
did not fit / justifications a reviewer may probe.

## What I read (grounding)
- `EXPLORATION_PUBLIC.md`, `CLARIFICATION__PUBLIC.md` (approved: 10 s fixed grace inside
  FocusDurationTracker only; close at ORIGINAL unfocus ts; no setting; gaps > grace split).
- `src/core/focusDuration/FocusDurationTracker.ts` (full, 200 lines) — line refs:
  onDocFocused :72, onDocUnfocused :90, onWindowBlurred :95, onWindowFocused :104,
  onUserActivity :113, dispose :134, startSession :142, endSession :150 (retro cutoff
  :159-161), armIdleTimer :167 (eslint-disable prefer-window-timers), onIdleTimerFired :184.
- `src/core/focusDuration/FocusDurationTracker.test.ts` (full, 415 lines, 30 tests) —
  I walked EVERY test against the new semantics; classification is in public §3.3 and was
  derived test-by-test, not pattern-matched. Key confirmations below.
- `src/core/focusTracker/listener/VhV3FocusDurationListener.ts` — forwards only; id-failure
  path calls onDocUnfocused (source of possible double-unfocus while pending).
- docs/architecture.md :80-115 (close-conditions box), visit-history-format.md :54-71.

## Core design reasoning (the WHYs behind the public spec)

1. **Session stays OPEN during pending** (not "close eagerly + merge later"): merging would
   need store rewrites (rejected in clarification) or sink buffering (new seam). Keeping the
   session open reuses everything; cancel = literally nothing happened.

2. **`PendingClose { unfocusedAtMs, cappedEndMs }` — why TWO fields:**
   - `cappedEndMs` snapshot: retro idle cutoff must be resolved AT unfocus. Killer scenario:
     activity t_a → sleep 8 h → wake → unfocus t1 (true end t_a) → activity during grace
     bumps lastActivityMs > t1 → a finalize-time cutoff sees no gap → records end t1 →
     8 h sleep counted. Snapshot pins t_a. This is ALSO what keeps existing test :382
     ("unfocused right after waking") passing unchanged — strong evidence the snapshot is
     the right shape.
   - `unfocusedAtMs` for the wall-clock guard in onDocFocused: timer suspended by sleep →
     same-doc refocus post-wake would CANCEL pending → session spans sleep; later close
     wouldn't cut it because post-wake activity refreshes lastActivityMs. Guard:
     `now - unfocusedAtMs >= UNFOCUS_GRACE_MS → finalize first`. Only needed in
     onDocFocused; onUserActivity is covered by its retro-idle branch (E4) and the
     late-firing grace timer.
   - Double-application of cutoff in endSession(cappedEndMs) is idempotent: if lastActivity
     advanced during grace, `cappedEndMs - lastActivity` is negative < timeout → keeps
     cappedEndMs; if unchanged, same result as at unfocus. Verified all branches.

3. **Blur-during-grace = early return (option b)** vs finalize-on-blur (option a):
   (a) never over-counts away-time but re-breaks the fix for native-surface blips
   (exploration H3: OS-level canvas surfaces blur the window). (b) is inflation-free anyway
   because end is pinned; worst case counts ≤ 10 s of same-doc-return away time — same
   magnitude as the approved "picker time counts" tradeoff. Chose (b); flagged in public §7.
   If reviewer/human prefers (a): change = onWindowBlurred calls finalizePendingClose()
   when `currentDoc.windowHandle === handle || size === 0`; drop test C2, adjust C1.

4. **Idle fire during pending → finalize at cappedEndMs**: analyzed the three sub-cases:
   - lastActivity < t1, gap-at-t1 < timeout → today's immediate close would record t1 → same.
   - lastActivity < t1, gap-at-t1 ≥ timeout → cappedEndMs already = lastActivity → same as
     idle close.
   - lastActivity during grace (only possible when timeout < grace, min timeout 5 s) → end
     pinned t1; activity on an unfocused doc excluded. Emergent: timeout < 10 s shortens
     effective grace when inactive — documented as acceptable, NOT worked around (KISS).

5. **Double unfocus no-op** (vs finalize-on-second): second unfocus only arrives via
   listener id-failure path (focus of untrackable doc). No-op still closes at t1 (grace
   expiry), record identical, only write deferred ≤ 10 s; finalize-on-second would lose
   grace for canvas→untrackable-blip→canvas. Bug scenario itself dispatches exactly ONE
   unfocus (FocusTracker nulls lastFocusEvent; untracked view ⇒ no onFocus ⇒ no second call).

6. **Invariants**: pending ⇒ session open (I1) — verified every endSession call site is
   either inside finalize or preceded by finalize/early-return: onDocFocused (finalize
   first), onWindowBlurred (early return), onUserActivity (finalize branch),
   onIdleTimerFired (finalize branch), dispose (finalize first), endSession-in-finalize.
   graceTimer ⇔ pending (I2). currentDoc stays SET during pending (needed nowhere critical,
   but least-surprise: doc is still the session's doc); nulled only at finalize —
   this is what blocks onWindowFocused/onUserActivity revival after finalize (tests C3, D2).

7. **Append-order invariant of .vh_v3 preserved**: per doc file, next session start ≥
   previous recorded end because any same-doc focus resolves pending synchronously first;
   grace-timer finalize for doc X while doc Y's session runs writes to a DIFFERENT file.

## Existing-test walkthrough (full, for PLAN_ITERATION defense)
Needs expireGrace() only (13): :52, :72, :84, :112, :134, :157, :184, :211, :228, :282,
:295, :369, :382. Unchanged (17): :62 (direct A→B focus, no pending → defense-in-depth
endSession(now) unchanged), :102/:172/:199/:243 (blur closes, no unfocus), :126, :146
(unfocus with session null → no pending), :254, :271/:307/:326/:336 (idle closes), :316
(unfocus after idle close, session null), :356 (activity-triggered retro), :396/:406
(dispose, no unfocus). Special: :84 A→B→A stays THREE sessions with identical durations —
different-doc focus finalizes at original unfocus time synchronously; exploration's worry
was unfounded. :112 "blur = new session" unaffected (grace only via onDocUnfocused).
Advancing 10 s in expireGrace never triggers idle side-records (grace timer fires first at
+10 s; idle armed for ≥ 180 s in those tests except D3-style custom ones which are new).

## Naming decisions
- `UNFOCUS_GRACE_MS = 10_000` exported from FocusDurationTracker.ts (tests import it — no
  mirrored constant; test file's IDLE_MS mirror pattern exists but export is DRYer here).
- `PendingClose`, `pendingClose`, `graceTimer`, `finalizePendingClose`, `cancelPendingClose`,
  `armGraceTimer`, `clearGraceTimer`, `onGraceTimerFired`, `idleCappedEndMs(endMs)`.
- Deliberately NOT extracting a OneShotTimer class (2 instances, YAGNI; instruction says
  "mirror the idle-timer pattern"); eslint-disable comments reference armIdleTimer like
  clearIdleTimer already does.

## Open threads for PLAN_ITERATION
- The four §7 planner decisions (blur early-return is the most debatable) — alternatives
  sketched above under (3).
- File sizes post-change: impl ~270 lines (fine), test ~600 lines — kept in ONE file for the
  mirrored-test convention; if reviewer objects, splitting a
  `FocusDurationTracker.grace.test.ts` is mechanical.
- Considered and rejected: grace check inside onUserActivity wall-clock (redundant — retro
  branch + late timer cover it); making endSession pending-aware (spreads pending knowledge;
  centralizing in finalize is cleaner); re-arming grace on second unfocus (would extend
  grace beyond first unfocus — violates "original timestamp" spirit).
- No #QUESTION_FOR_HUMAN raised. No blocker found. Approved approach implements cleanly.
