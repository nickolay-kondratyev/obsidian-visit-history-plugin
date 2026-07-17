# PARETO_COMPLEXITY_ANALYSIS — Unfocus grace period (pending close)

Role: PARETO_COMPLEXITY_ANALYSIS. Date: 2026-07-16.
Range analyzed: `49e64a3..791752b` (branch `fix-unfocus-due-to-rectangle-choice`).
Inputs: `CLARIFICATION__PUBLIC.md`, `1_IMPLEMENTATION_FROM_PLAN__PUBLIC.md`,
`IMPLEMENTATION_REVIEW__PUBLIC.md`, plus direct read of the source diff.

## Pareto Assessment: **PROCEED** — verdict **JUSTIFIED**

**Value Delivered:** Canvas "add note/rectangle" UI blips no longer split V3
focus-duration sessions. This hits the plugin's CORE product promise (accurate
per-doc focus durations) on a first-class doc type, on a HIGH-frequency action —
every canvas edit gesture previously produced a fragmented pair of sessions plus
a lost gap. Data-quality fix, not a cosmetic one.

**Complexity Cost:** Confined to ONE source file (`src/core/focusDuration/FocusDurationTracker.ts`).

**Ratio:** **High** (value clearly exceeds complexity; complexity is requirement-driven, not speculative).

---

## Quantification

| Dimension | Number |
|---|---|
| Source files touched (non-test) | **1** (`FocusDurationTracker.ts`) |
| Source lines added | +146 (of which **67 are comment lines** → ~79 code/blank); −7 removed |
| Test lines added | ~361 (`FocusDurationTracker.test.ts` +342; listener/monitor suites +19 timer-advance-only) |
| Test:source code ratio | ~2.5 : 1 |
| New tests | 20 (19 planned matrix + 1 reviewer pin); 0 expectation changes in 16 touched existing tests |
| New state | 1 logical state dimension: `pendingClose` (+ coupled `graceTimer`, invariant `graceTimer ≠ null ⇔ pendingClose ≠ null`) |
| New decision points | ~7 `pendingClose`-branches across 6 of 7 event handlers + 2 null-guards in helpers |
| New helpers | 5 (`idleCappedEndMs` is a DRY extraction of an EXISTING expression; finalize/cancel + 3-method timer trio mirrors existing idle-timer pattern) |
| New abstractions/interfaces/config | **0** — no setting, no new class, no wiring change |
| Docs | 3 files, ~13 lines |

## Was the complexity forced or chosen?

Mostly **forced by human-fixed requirements** plus pre-existing correctness invariants:

1. **"Close at the ORIGINAL unfocus timestamp" (human decision)** ⇒ the end must be
   pinned at unfocus (`PendingClose.cappedEndMs`). A naive `setTimeout(endSession, 10s)`
   (~20 LOC) would stamp the close 10 s late — duration inflation, violating the
   requirement outright. Not a viable 80% option; it's a wrong answer.
2. **Existing invariant "sleep/idle gaps never count"** ⇒ the wall-clock expiry guard in
   `onDocFocused`, the idle-capped snapshot at unfocus, and the pending-aware branches in
   `onUserActivity`/`onIdleTimerFired`. Dropping any of these silently reintroduces
   sleep-gap inflation — a regression of behavior the tracker already guaranteed.
3. **Blips that also blur the window (native-surface pickers)** ⇒ the `onWindowBlurred`
   early-return. Without it the grace would not actually fix a real subclass of the bug.
4. **`dispose()` finalize** ⇒ 1 line; without it a pending session is lost on unload.

I.e. of the ~7 event-handler branches, none is speculative "might need later" work —
each is traceable to a requirement or an already-shipped invariant. The change adds
**zero** configuration, zero new public API surface beyond one exported constant, and
zero cross-module cascade (recorder/store/listeners/wiring untouched).

## Simpler-alternative check (honest)

- **Debounce at `FocusTracker`**: touches semantics for ALL listeners (incl. doc-id
  assignment) — larger blast radius, not simpler in effect. Rejected during
  clarification; agreed.
- **Write-time merge in the recorder**: fewer states in the tracker but pushes
  complexity into the on-disk format path (read-before-append / last-record memory) and
  was explicitly ruled out by the human ("No write-time merge").
- **Grace without pinning/interplay branches**: ~60% less code but violates the
  fixed close-at-original-timestamp requirement and the sleep invariant. Delivers
  *negative* value (corrupts durations).

Conclusion: no materially simpler implementation delivers even ~80% of the value under
the approved requirements. The Pareto trim already happened at CLARIFICATION time:
fixed 10 s constant instead of a user setting, gaps > grace still split by design.

## Scope-creep / premature-abstraction scan

- **No scope creep**: diff surface exactly matches the clarified task.
- **No premature abstraction**: `OneShotTimer` extraction was considered and correctly
  REJECTED (YAGNI at 2 instances); the mirrored trio costs ~14 duplicated lines — the
  cheaper side of the tradeoff today.
- Comment density (67/146 lines) is high but each comment is a WHY on a genuinely
  non-obvious invariant — consistent with project doc rules; not noise.
- Test growth (20 tests) matches the real event × pending-state matrix; per project
  testing rules ("logical coverage over line coverage") this is expected, and the
  reviewer verified zero pinned-expectation changes.

## Trim NOW

**None.** Nothing in the diff is removable without either violating an approved
requirement or re-opening a sleep/idle correctness hole. (Verdict is therefore
JUSTIFIED, not JUSTIFIED_WITH_TRIMS.)

## Follow-up ticket recommendations (recommend only — none created)

1. **Blur-before-unfocus event-ordering edge** (carried from plan review): window blur
   arriving BEFORE the doc-unfocus for the same gesture closes the session pre-grace.
   Low frequency; worth a ticket so the ordering assumption is tracked.
2. **Sandbox dev-env**: shell profile's nvm shim breaks bare `npm`/`node` (exit 1)
   in the review sandbox; reviewer worked around via absolute binary paths. Per
   "Dev-Environment is your BATTLE STATION" this deserves its own env ticket.
3. **(Conditional, low priority)** If a THIRD one-shot timer ever appears in
   `FocusDurationTracker`, extract `OneShotTimer` wholesale (reviewer S1). Not
   actionable now — record as a note on ticket 1 or skip.

No `#QUESTION_FOR_HUMAN` items.
