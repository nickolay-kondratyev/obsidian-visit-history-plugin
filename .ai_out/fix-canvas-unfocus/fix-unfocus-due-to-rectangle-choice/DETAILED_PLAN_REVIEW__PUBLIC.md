# DETAILED PLAN REVIEW — Unfocus grace period in `FocusDurationTracker`

Role: PLAN_REVIEWER (DETAILED_PLAN_REVIEW). Reviewed: `DETAILED_PLANNING__PUBLIC.md`
against ACTUAL source. Date: 2026-07-16.

## Verdict

**READY** — **PLAN_ITERATION CAN BE SKIPPED.** Proceed to implementation.

- BLOCKING: 0
- IMPORTANT: 0
- SUGGESTION: 2
- Minor inline adjustments made by reviewer: 3 (logged below)

## Verification performed (against real code, not the plan's claims)

Sources read in full: `src/core/focusDuration/FocusDurationTracker.ts`,
`src/core/focusDuration/FocusDurationTracker.test.ts`,
`src/core/focusTracker/FocusTracker.ts`,
`src/core/focusTracker/listener/VhV3FocusDurationListener.ts`.

1. **Decision table (§2.4) — traced every row against the current implementation.**
   All rows are consistent with the real state machine (`session`/`currentDoc`/
   `focusedWindows`/`lastActivityMs`/`idleTimer`):
   - `onWindowFocused` "no code change needed" claim: TRUE — the reopen guard at
     `FocusDurationTracker.ts:108` requires `session === null`, and pending ⇒ session open
     (I1); post-finalize `currentDoc === null` blocks revival.
   - `onUserActivity` retro branch: verified the retro check at `:115` runs BEFORE
     `lastActivityMs = now` (`:121`) — the plan's E3/E4 semantics hold.
   - Idle-fire-during-grace vs grace-fire ordering is order-INDEPENDENT (both finalize at the
     pinned `cappedEndMs`) — a strong property the plan gets for free from the snapshot;
     hand-simulated D3 (idle 12 s < grace-expiry point) confirms duration 5000 either way.
   - Double-unfocus provenance claim: TRUE — `FocusTracker.ts:100-104` nulls
     `lastFocusEvent` after dispatching unfocus, so a second `onDocUnfocused()` while pending
     can only come from `VhV3FocusDurationListener.ts:35-40` (id-failure/untrackable focus).
     The no-op row then yields correct behavior (close at original time, write deferred ≤10 s).
2. **Timestamp integrity (I3/I4).** End is pinned at unfocus (`cappedEndMs =
   idleCappedEndMs(unfocusedAtMs)`); every finalize path passes it to `endSession`, whose
   re-cap can only pull the end earlier, never later. Late timer fire after OS sleep is
   covered by the wall-clock guard in `onDocFocused` (E1/E2) and by the pinned end on a late
   `onGraceTimerFired`. No inflation path found.
3. **"13 existing tests need only `expireGrace()`, zero expectation changes" — VERIFIED
   TRUE.** All 13 line refs (`:52,:72,:84,:112,:134,:157,:184,:211,:228,:282,:295,:369,:382`)
   match the current test file, each ends in an unfocus whose record is merely deferred.
   Hand-simulated the two risky ones:
   - `:84` A→B→A: each different-doc focus finalizes the pending synchronously at the
     ORIGINAL unfocus time → still exactly `['A:100','B:200','A:300']`.
   - `:382` sleep-then-unfocus: `cappedEndMs` = last interaction (45 s) at unfocus; grace
     expiry finalizes with the same value → duration 45 000 unchanged.
   The 16-entry "unchanged" list is also correct (no open session at the unfocus, or close is
   blur/idle-triggered — no pending involved; e.g. `:316`, `:146`, `:396`).
4. **Failing-test-first**: present and real — A1 fails today (two records + lost gap).
   Phase ordering (constant first, no behavior change; A1 red; mechanics; test adjustments;
   guards test-first per group) is sound.
5. **Requirements conformance (CLARIFICATION — all FIXED items honored)**: 10 s exported
   named constant `UNFOCUS_GRACE_MS` (no magic numbers, incl. in tests); no user setting;
   `FocusTracker`/listeners/store/recorder untouched; gap-counts-as-focus (A1/A4);
   >grace splits (A2/D4/E2); close at ORIGINAL unfocus timestamp everywhere.
6. **KISS/SRP/DRY**: state addition is minimal (2-field `PendingClose` + one timer handle);
   `idleCappedEndMs` extraction removes the about-to-be-duplicated cutoff expression;
   declining a shared `OneShotTimer` abstraction (2 call sites) is the right YAGNI call.
   `cappedEndMs` + `unfocusedAtMs` are NOT knowledge duplication — one gates grace expiry
   (wall clock), the other is the record end (idle-capped); they legitimately differ after a
   pre-unfocus sleep. Docs plan (§5) is succinct and correctly scoped.

## Feedback points

### SUGGESTION — S1: blur-BEFORE-unfocus blips remain split (out of scope; consider a follow-up note)
If a native surface blurs the window BEFORE the transient unfocus arrives, the blur still
closes the session immediately (no pending exists yet) and the grace never engages. The plan
correctly leaves blur semantics untouched (approved scope) and its C2 covers the
unfocus-then-blur ordering. No plan change requested — if this ordering is ever observed in
the wild, it should become a follow-up ticket, not scope creep here.

### SUGGESTION — S2: same-doc refocus into a still-blurred window keeps the session open in a blurred window
Sequence: unfocus (pending) → window blur (early return) → same-doc refocus while the window
is still blurred → cancel + adopt. The session then runs in a blurred window until the idle
timer closes it at `lastActivityMs` (≈ blur time at the latest, since no input events arrive
while all windows are blurred) — bounded, never inflating past real activity, and within the
approved "gap counts as focus" tradeoff magnitude (§2.5.1 acknowledges the family). No change
requested; if the implementer wants one extra pin, a test asserting the idle close after this
sequence would document it. Optional.

## Minor inline adjustments made (logged per empowerment rules)

1. **§2.2 snapshot rationale corrected.** The original "scenario that breaks
   compute-at-finalize" is actually intercepted by the plan's OWN `onUserActivity` retro-idle
   row (retro check precedes the `lastActivityMs` update — `FocusDurationTracker.ts:115-121`),
   so the claim as written was inaccurate. Rewritten: the snapshot's real value is making I4
   LOCALLY true (no cross-row coupling; deterministic under live mid-grace idle-timeout
   changes). Design unchanged — the snapshot stays; only the WHY is now truthful.
2. **§2.2/§2.3 "provably idempotent no-op" softened.** Re-capping inside `endSession` is a
   no-op only under a stable idle timeout; a live mid-grace timeout shrink can pull the end
   EARLIER (never later — I3 holds). Wording fixed in both the prose and the
   `finalizePendingClose` snippet comment.
3. **§3.2 `sleepMs` scoping note added.** The helper is nested inside the existing
   `describe('OS sleep …')` block (`FocusDurationTracker.test.ts:352`); the E-tests need it —
   plan now says to hoist it (unchanged) to file scope next to `advanceMs`.

## Strengths

- Decision table + invariants I1–I4 form a genuine behavioral spec; every table row maps to a
  named test — logical coverage of the state machine, per project testing standards.
- Order-independence of idle-fire vs grace-fire (both finalize at the pinned end) falls out of
  the design rather than being patched case-by-case.
- The existing-test impact analysis is honest and, on verification, exactly right — including
  correctly overturning the exploration's flag on the A→B→A test.
- Planner decisions (§7) are all inside the approved envelope and each preserves the two
  non-negotiable invariants (original-unfocus end; sleep never counts).

No `#QUESTION_FOR_HUMAN` items.
