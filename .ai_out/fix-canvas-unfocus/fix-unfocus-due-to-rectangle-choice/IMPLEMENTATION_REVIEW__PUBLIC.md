# IMPLEMENTATION REVIEW — Unfocus grace period in `FocusDurationTracker`

Role: IMPLEMENTATION_REVIEWER. Date: 2026-07-16. Branch: `fix-unfocus-due-to-rectangle-choice`.
Range reviewed: `49eda09..791752b` (diffed against base `49e64a3`).

## Verdict: **READY**

No BLOCKING findings. No IMPORTANT findings. 2 suggestions (non-gating).
No `#QUESTION_FOR_HUMAN` items.

---

## Summary

The change adds a 10 s unfocus grace period ("pending close") entirely inside
`src/core/focusDuration/FocusDurationTracker.ts`, exactly per the approved plan:
`onDocUnfocused` on an open session now pins the close end (`PendingClose.cappedEndMs`,
idle/sleep-capped AT unfocus time) and arms a grace timer instead of closing immediately.
Same-doc refocus within grace cancels the close (gap counts as focus — owner decision);
different-doc focus, grace expiry, idle confirmation, retroactive idle, or `dispose()`
finalize at the ORIGINAL unfocus timestamp. Only source file touched: the tracker. Tests
(+20 new, 13 existing gain only `expireGrace()`), 2 listener/monitor tests gain only a
timer advance, and 3 docs updated.

## Gates — independently re-run (not taken on faith)

| Gate | Claimed | Verified |
|---|---|---|
| `npm test` | 305 passed / 35 files | **CONFIRMED**: 305 passed (35 files); tracker suite 50/50 |
| `npm run lint` | 0 errors, 2 pre-existing warnings | **CONFIRMED**: 0 errors; 2 warnings, both `obsidianmd/prefer-active-doc` in untouched `src/main.ts` |
| `npm run build` | clean | **CONFIRMED**: `tsc -noEmit -skipLibCheck` exit 0 + esbuild production exit 0 |

(Env note: `npm`/`node` via the shell profile are broken in this review sandbox — the
profile's nvm shim exits 1 before running anything. Gates were run via
`/usr/local/bin/node node_modules/{vitest,eslint,typescript}/...` directly, which is the
same toolchain `npm run` invokes. Follow-up-worthy env issue, unrelated to this change.)

## Claims verified vs taken on faith

**Verified (hands-on):**
1. **Failing-test-first is REAL**: checked out commit `49eda09` in a throwaway worktree and
   ran the tracker suite — A1 fails there with exactly the predicted wrong behavior
   (2 records instead of 1 spanning session; 29/30 others pass), and `49eda09`'s source
   diff adds ONLY the exported constant (no behavior change). Passes at HEAD.
2. **Zero pinned-expectation changes**: read the full test diff. All 13 existing
   `FocusDurationTracker.test.ts` updates are `expireGrace()` additions (plus GWT comment
   wording); every `expect(...)` (docId/start/duration) is byte-identical. The 3
   deviation-1 tests (`VhV3FocusDurationListener.test.ts` ×2, `WindowActivityMonitor.test.ts`
   ×1) gain only `vi.advanceTimersByTime(UNFOCUS_GRACE_MS)`; expected records unchanged.
   No test removed anywhere in the range.
3. **Change surface**: `git diff --stat` — the ONLY `src/` non-test change is
   `FocusDurationTracker.ts`. `FocusTracker`, listeners, monitor, recorder, store,
   settings, wiring: untouched (requirement "no listener-semantics/store changes" holds).
4. **Requirements conformance** (CLARIFICATION decisions 1–3): blip → ONE session with gap
   counted (A1/A4 pin 10 000/15 000); different-doc and grace-expiry close at ORIGINAL
   unfocus time (B1/A2 pin 5000); 10 s is the exported named constant `UNFOCUS_GRACE_MS`,
   imported by all test files — no mirrored magic number, no user setting.
5. **Docs**: `AGENTS.md` (= `CLAUDE.md` symlink target — deviation 2 verified:
   `CLAUDE.md -> AGENTS.md`), `docs/architecture.md` close-conditions box,
   `docs/visit-history-format.md` — all accurate and succinct; the format doc correctly
   notes append happens at FINALIZE (≤10 s later) with the end stamped at the unfocus.
   Per-file ascending append order still holds (a same-doc refocus resolves the pending
   before any new session can exist, so a doc's next start ≥ its previous recorded end).
6. **Listener id-failure reasoning** (plan §2.5.9): read `VhV3FocusDurationListener.ts` —
   its `onDocUnfocused()` call on untrackable focus lands in the double-unfocus no-op row;
   first unfocus timestamp stays authoritative (A5 pins it).

**Taken on faith:** none material. (The "verified identical on stashed baseline" detail for
the 2 lint warnings was re-established directly: they are in `src/main.ts`, untouched in
this range.)

## Correctness deep-dive (event × pending-state matrix)

Traced every row of the plan §2.4 table against the code; all hold:

- **Invariants I1/I2 hold**: every session-close path either has `pendingClose === null`
  or routes through `finalizePendingClose()` (checked: `onDocFocused` both branches,
  `onWindowBlurred` early-return, `onUserActivity` retro branch, `onIdleTimerFired`
  pending branch, `dispose`, `onDocUnfocused` session-null branch). No path ends a session
  leaving a pending set → no stale pending, no orphaned grace timer.
- **No timer leaks**: `finalizePendingClose`/`cancelPendingClose` both clear the grace
  timer; `endSession` always clears the idle timer; `dispose` finalizes first — under I2
  the grace timer cannot survive dispose.
- **No inflation (I3)**: the recorded end is always `cappedEndMs` (≤ unfocus wall time);
  `endSession`'s re-cap can only pull EARLIER (negative-gap check can't trigger "later";
  live idle-timeout shrink mid-grace only shrinks). `Math.max(0, …)` backstops.
- **Sleep safety**: (a) wall-clock guard in `onDocFocused` finalizes a wall-expired
  pending before the same-doc check — post-sleep refocus can't resurrect (E1/E2 pin it);
  (b) `cappedEndMs` snapshot at unfocus preserves a pre-unfocus sleep cutoff even when
  activity during grace advances `lastActivityMs` (E3); (c) subtle case NOT in the plan,
  traced OK: sleep → wake → unfocus → same-doc refocus WITHIN grace cancels the pending
  and the session briefly spans the sleep — but the still-armed idle timer (late-fire) or
  the `onUserActivity` retro branch then closes it at the pre-sleep `lastActivityMs`, so
  the recorded end is correct either way.
- **Double unfocus** → no-op, first timestamp wins (A5). **Blur during grace** → pinned
  end, grace decides (C1/C2). **Post-finalize revival** blocked by `currentDoc = null`
  (C3, D2). **Late grace-timer fire after a wall-clock finalize** → timer already cleared;
  the `onGraceTimerFired` null-guard is defense-in-depth only.
- **Serialized-dispatch context**: tracker methods are fully synchronous; timer callbacks
  are atomic between dispatched events — no interleaving hazard introduced.

## Deviations from plan — assessment

1. **Acceptance criterion 4 ("other suites pass UNMODIFIED") was unsatisfiable** — 3 tests
   drive the real tracker through an unfocus and assert immediately. Fix = timer advance
   only, expectations byte-identical (verified). This is the same approved change class as
   §3.3 and consistent with §2.5.9's "write merely deferred ≤ 10 s". **Accepted** — no
   behavior pin was altered, transparently reported and committed separately (`04770c3`).
2. **Doc edit landed in `AGENTS.md`** — `CLAUDE.md` is a symlink to it (verified).
   **Accepted.**

## 💡 Suggestions (non-gating)

1. **S1 — duplicated one-shot-timer trios.** `armGraceTimer`/`clearGraceTimer`/
   `onGraceTimerFired` are near-literal mirrors of the idle-timer trio (incl. 3 more
   eslint-disable lines) — `FocusDurationTracker.ts:249-264` vs `:320-332`. The plan
   explicitly rejected a `OneShotTimer` extraction (YAGNI at two instances) and mirroring
   was the approved instruction, so this is NOT a defect — but if a THIRD timer ever
   appears, extract `OneShotTimer` wholesale then.
2. **S2 — scope note for the owner (no action).** The grace merges ANY same-doc return
   within 10 s — e.g. a quick trip to Graph view/settings and back now counts as continuous
   focus, not only in-canvas blips. This follows unconditionally from approved decision 1
   ("refocus of SAME doc within grace → session continues; gap counts") and is the
   documented tradeoff's twin; flagged purely so the behavior isn't a surprise later.

## Documentation Updates Needed

None — CLAUDE.md/architecture/format updates shipped in-range and were verified accurate.

## Follow-up (outside this change's scope)

- Review-sandbox env: the shell profile's nvm shim breaks bare `npm`/`node` invocations
  (exit 1 before running). Worked around with absolute binary paths; worth an env ticket
  per "Dev-Environment is your BATTLE STATION".
