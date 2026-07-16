# DETAILED PLAN — Unfocus grace period ("pending close") in `FocusDurationTracker`

Role: PLANNER (DETAILED_PLANNING). Inputs: `EXPLORATION_PUBLIC.md`, `CLARIFICATION__PUBLIC.md`
(HUMAN-approved decisions — FIXED). Date: 2026-07-16.

---

## 1. Problem understanding

Canvas "add rectangle/note" UI fires a transient `active-leaf-change(null|untracked)` →
`FocusTracker` dispatches unfocus → `FocusDurationTracker.onDocUnfocused()` closes the V3
session immediately → the refocus milliseconds-to-seconds later opens a NEW session. Result:
two `.vh_v3` lines instead of one and the gap is lost focus time.

**Approved fix (FIXED requirements):** grace period inside `FocusDurationTracker` only.
- `onDocUnfocused` marks the open session **pending-close** (remembering the unfocus
  timestamp) and arms a grace timer — fixed named constant, **10 seconds**, mirroring the
  existing idle-timer pattern in the same class.
- Refocus of the **SAME doc** within grace → cancel pending close; session continues; the gap
  counts as focus time.
- Focus of a **DIFFERENT doc**, or **grace expiry** → close at the **ORIGINAL unfocus
  timestamp** (no duration inflation).
- `FocusTracker`, `VhV3FocusDurationListener`, all other listeners, and the store: untouched.
  No user setting. No write-time merge.
- Accepted tradeoffs: sink write (and heatmap last-visit visibility) delayed ≤ 10 s after a
  real navigation-away; in-canvas picker time within grace counts as focus.

**Files changed (complete list):**
- `src/core/focusDuration/FocusDurationTracker.ts` (implementation)
- `src/core/focusDuration/FocusDurationTracker.test.ts` (new + adjusted tests)
- `CLAUDE.md`, `docs/architecture.md`, `docs/visit-history-format.md` (succinct doc edits)

No wiring changes (`PluginFactory` already injects the tracker; `dispose` already called on
unload). No changes to `WindowActivityMonitor`, `VhV3DurationRecorder`, or the store.

---

## 2. Design

### 2.1 Core idea and invariants

While a close is pending, the session object **stays open** (`session !== null`) and
`currentDoc` stays set — only a new `pendingClose` marker (plus a one-shot grace timer)
records that an unfocus happened and WHEN. Finalizing emits exactly the record that an
immediate close at the unfocus moment would have emitted today; cancelling leaves the session
exactly as if the unfocus never happened.

**Invariants (state them as WHY comments in code):**
- I1 — `pendingClose !== null` ⇒ `session !== null`. Pending is created only on unfocus of an
  open session; every close path with a pending goes through `finalizePendingClose()`, which
  clears both.
- I2 — `graceTimer !== null` ⇔ `pendingClose !== null`.
- I3 — **Monotonicity / no inflation**: a finalized close ends at `pendingClose.cappedEndMs`,
  which is ≤ the unfocus wall-clock time and never moves later, no matter how late the timer
  fires or what happens during grace.
- I4 — A finalized pending close is byte-identical to what today's immediate close at the
  unfocus moment would have recorded (the idle/sleep cutoff is resolved AT unfocus time —
  see 2.2).

### 2.2 New state and constant

```ts
/**
 * Grace before an unfocus becomes a session close. In-canvas UI (card picker,
 * "add note") fires a transient active-leaf-change(null|untracked) → unfocus →
 * refocus; a same-doc refocus within this window continues the session instead
 * of splitting it. A close that does happen is stamped at the ORIGINAL unfocus
 * moment, so the grace can never inflate a duration. Fixed (no user setting —
 * owner decision).
 */
export const UNFOCUS_GRACE_MS = 10_000;

interface PendingClose {
  /** Wall-clock arrival of the unfocus — gates grace expiry (timers can fire late after OS sleep). */
  unfocusedAtMs: number;
  /**
   * Session end to record if the close finalizes: the unfocus time, already
   * idle/sleep-capped. Resolved AT unfocus time so activity during grace
   * cannot erase a pre-unfocus sleep gap (ref sleep invariant in class doc).
   */
  cappedEndMs: number;
}
```

Fields on the class: `private pendingClose: PendingClose | null = null;` and
`private graceTimer: ReturnType<typeof setTimeout> | null = null;`.

Export `UNFOCUS_GRACE_MS` so tests import it (no mirrored magic number in the test file).

**Why `cappedEndMs` is snapshotted at unfocus (not computed at finalize):** the retroactive
idle cutoff compares against `lastActivityMs`, which legitimately keeps advancing during grace
(the user is clicking around a modal). Scenario that breaks a compute-at-finalize design:
activity at `t_a`, OS sleep 8 h, wake, unfocus at `t1` (correct end = `t_a`, sleep gap
excluded), user activity during grace pushes `lastActivityMs` past `t1` → a finalize-time
cutoff check would see no idle gap and record end `t1`, counting 8 h of sleep. The snapshot
pins `t_a`. Existing test `should cap the duration at the last interaction when the doc is
unfocused right after waking` continues to pass unchanged because of this.

Extract the (now twice-needed) cutoff expression into one private helper — DRY:

```ts
/** Retroactive idle/sleep cutoff: an end past the idle timeout since the last
 *  interaction is pulled back to that interaction (sleep gaps never count). */
private idleCappedEndMs(endMs: number): number {
  return endMs - this.lastActivityMs >= this.getIdleTimeoutMs() ? this.lastActivityMs : endMs;
}
```

`endSession` keeps its existing check by calling this helper (its re-application to an
already-capped `cappedEndMs` is a provably idempotent no-op — safe backstop).

### 2.3 New private methods (mirror the idle-timer trio)

- `armGraceTimer()` / `clearGraceTimer()` — copies of `armIdleTimer`/`clearIdleTimer` incl.
  the `eslint-disable obsidianmd/prefer-window-timers` lines (`-- see armIdleTimer` on the
  short ones, matching the existing pattern at `clearIdleTimer`). Do NOT extract a shared
  `OneShotTimer` class — two instances, YAGNI; mirroring is the approved instruction.
- `onGraceTimerFired()` — `graceTimer = null;` then `finalizePendingClose()` (guarded no-op
  if pending was already cancelled — defensive, mirrors `onIdleTimerFired`'s null guard).
- `finalizePendingClose()`:
  ```ts
  private finalizePendingClose(): void {
    if (this.pendingClose === null) return;
    const { cappedEndMs } = this.pendingClose;
    this.pendingClose = null;
    this.clearGraceTimer();
    this.endSession(cappedEndMs); // re-cap inside endSession is an idempotent backstop
    this.currentDoc = null;       // the doc really is gone — no window-refocus revival
  }
  ```
- `cancelPendingClose()` — clears `pendingClose` + grace timer; no-op when none.

### 2.4 Event × pending-state decision table (the behavioral spec)

| Event | `pendingClose === null` (today's behavior) | `pendingClose !== null` |
|---|---|---|
| `onDocUnfocused`, session open | NEW: create `{ unfocusedAtMs: now, cappedEndMs: idleCappedEndMs(now) }`, arm grace timer. Session AND `currentDoc` stay set. | **No-op** — the FIRST unfocus timestamp stays authoritative (a second unfocus can only arrive via `VhV3FocusDurationListener`'s id-failure path after focusing an untrackable doc; grace expiry will close at the original time anyway). |
| `onDocFocused(SAME docId)` | unchanged (adopt window, return) | Wall-clock guard first (see below). Within grace: `cancelPendingClose()`, adopt window, return — session continues, gap counts as focus. |
| `onDocFocused(DIFFERENT docId)` | unchanged (defense-in-depth `endSession(now)`, start new) | `finalizePendingClose()` FIRST (old session closes at `cappedEndMs`, i.e. the original unfocus time), then the unchanged new-focus flow. New session starts at ITS focus time. |
| `onWindowBlurred(handle)` | unchanged | Only `focusedWindows.delete(handle)`, then **return early** — do NOT close. The end is already pinned so a blur can't inflate anything, and finalizing here would defeat grace for blips that also blur the window (native-OS-surface variants of the same bug). The grace timer decides. |
| `onWindowFocused(handle)` | unchanged | No code change needed: the reopen guard requires `session === null`, and pending ⇒ session open (I1). After a finalize, `currentDoc === null` blocks revival. |
| `onUserActivity` | unchanged | Retroactive-idle branch fires → `finalizePendingClose()` instead of `endSession(lastActivityMs)` (pinned end wins; it's already idle-capped as of unfocus). Otherwise just `lastActivityMs = now` (harmless: if later cancelled the activity was genuine; if finalized the end is pinned). Never reopens: session open blocks the reopen branch; post-finalize `currentDoc === null` blocks it. |
| `onIdleTimerFired`, idle confirmed | unchanged (`endSession(lastActivityMs)`) | `finalizePendingClose()` — close at `cappedEndMs`. Rationale: if `lastActivityMs` predates the unfocus, the gap was < timeout at unfocus time (or `cappedEndMs` already equals it), so ending at the unfocus moment matches today's immediate-close semantics; if activity happened DURING grace, it was on an unfocused doc and must not extend the end. Not-yet-idle branch (re-arm) unchanged. |
| `dispose` | unchanged | `finalizePendingClose()` first — plugin unload flushes the session at the ORIGINAL unfocus time; the pending session is never lost. Then the existing `endSession(Date.now())` no-ops. |

**Wall-clock guard at the top of `onDocFocused`** (before the same-doc check):

```ts
// Timers can fire late (OS sleep suspends them): a pending close whose grace
// already expired in WALL-CLOCK time must never be cancelled — finalize it
// first so a post-sleep refocus starts a FRESH session instead of resurrecting
// one that would span the sleep gap.
if (this.pendingClose !== null
    && Date.now() - this.pendingClose.unfocusedAtMs >= UNFOCUS_GRACE_MS) {
  this.finalizePendingClose();
}
```

Without this, unfocus → 8 h sleep → wake → same-doc refocus (before the suspended timer
fires) would cancel the pending close and produce a session spanning the sleep — violating
the "a session can never include a sleep/idle gap" invariant.

`onDocUnfocused` when `session === null` keeps today's behavior exactly
(`currentDoc = null`, nothing recorded, no pending created).

### 2.5 Edge cases — explicit answers (required by task)

1. **pending + window blur / window refocus** — blur during grace neither closes nor cancels
   (early return; end pinned, so no inflation possible). Window refocus adds to
   `focusedWindows` only (session still open). Net effect: a blip that ALSO blurs/refocuses
   the window still merges. Worst case cost: user leaves the app right after a transient
   unfocus and comes back to the same doc within 10 s → the away-gap counts as focus —
   same magnitude as the approved "picker time counts" tradeoff.
2. **pending + idle timer firing / retroactive cutoff** — YES, the idle cutoff still applies
   to the ORIGINAL unfocus timestamp: `cappedEndMs = idleCappedEndMs(unfocusedAtMs)` is
   computed at unfocus. Idle-confirmed fire during grace finalizes at `cappedEndMs` (see
   table). Emergent: an idle timeout configured BELOW 10 s (min is 5 s) effectively shortens
   grace when the user is inactive — acceptable; the user opted into aggressive splitting.
3. **pending + `onUserActivity`** — activity does NOT reopen and does NOT extend the pinned
   end; it only updates `lastActivityMs` (correct for the cancel outcome, harmless for the
   finalize outcome). The retroactive-idle branch finalizes at the pinned end.
4. **pending + unload flush** — `dispose()` finalizes first: the session is recorded, ending
   at the original unfocus timestamp, never lost, never inflated to `Date.now()`.
5. **pending + focus of DIFFERENT doc** — immediate synchronous finalize at the original
   unfocus timestamp, then the new session starts at its own focus time. Per-doc-file
   append order stays ascending (any same-doc focus resolves the pending first, so a doc's
   next session always starts after its previous session's recorded end).
6. **pending + same doc from a DIFFERENT window handle** — cancel + adopt the new window
   (existing tab-drag semantics); no `focusedWindows` check added (the existing same-doc
   branch has none — consistency).
7. **double unfocus while pending** — no-op; first unfocus timestamp wins (table row 1).
8. **timestamp monotonicity** — guaranteed by I3: the recorded end is `cappedEndMs`
   (≤ unfocus time), regardless of when the timer actually fires.
9. **`VhV3FocusDurationListener`** — NO changes. It only forwards focus/unfocus; the grace
   lives entirely inside the tracker. Its id-failure path (`onFocus` of an untrackable doc →
   `onDocUnfocused`) lands in the double-unfocus no-op row: the previous doc still closes at
   its original unfocus time (write merely deferred ≤ 10 s). Verified against the listener
   source; state this in the PR/commit message.

### 2.6 Documentation comments in code

- Class doc (`FocusDurationTracker` header): amend the "CLOSES on the first of" list — the
  navigation-away bullet gains: "…after a fixed `UNFOCUS_GRACE_MS` grace: a same-doc refocus
  within grace continues the session (transient canvas-UI blips don't split it); an actual
  close is stamped at the ORIGINAL unfocus moment, so grace never inflates a duration."
- `onDocUnfocused` doc comment: no longer "immediate close" — describes pending-close.
- WHY comments per CLAUDE.md policy at: the wall-clock guard, the blur early-return, the
  `cappedEndMs` snapshot, the double-unfocus no-op, `finalizePendingClose`'s
  `currentDoc = null`.

---

## 3. Testing strategy

All in `src/core/focusDuration/FocusDurationTracker.test.ts` (mirrored-file convention),
existing style: vitest fake timers, `RecordingSink`, GIVEN/WHEN/THEN, one assert per test.
Import `UNFOCUS_GRACE_MS` from the class file. Add one tiny helper next to `advanceMs`:

```ts
/** Lets a pending unfocus close resolve (grace expiry). */
function expireGrace(): void { advanceMs(UNFOCUS_GRACE_MS); }
```

### 3.1 THE failing test first (bug capture — written and run BEFORE any impl change)

New `describe('unfocus grace period')`:

- **A1** `should record ONE session spanning the blip when the same doc refocuses within grace`
  — GIVEN A focused 5 s; WHEN unfocus, 2 s pass, A refocuses, 3 s pass, unfocus, grace
  expires; THEN exactly `[{ docId: 'A', focusStartEpochMs: T0, durationMs: 10_000 }]`.
  Today this fails with two records and a lost 2 s gap — the canvas blip scenario.

### 3.2 New tests (full list)

Core:
- **A2** `should close at the ORIGINAL unfocus time when grace expires without a refocus` —
  A 5 s → unfocus → `expireGrace()` → one record, duration 5000 (not 5000 + grace).
- **A3** `should not emit the record before the grace resolves` — unfocus →
  `advanceMs(UNFOCUS_GRACE_MS - 1)` → `records` empty (pins the delayed-write tradeoff).
- **A4** `should keep a single session across multiple blips within grace` — two
  unfocus/refocus blips → one spanning record.
- **A5** `should ignore a redundant second unfocus while a close is pending (first unfocus time wins)`
  — unfocus at t1, second `onDocUnfocused()` 3 s later, expire → duration ends at t1.

Different doc:
- **B1** `should close the previous session at its original unfocus time when a DIFFERENT doc focuses during grace`
  — A 5 s → unfocus → 2 s → focus B → `records[0]` = `{A, T0, 5000}` (written immediately,
  no grace wait).
- **B2** `should start the new doc's session at its own focus time after a pending close`
  — continue B1: B runs 4 s, unfocus, expire → `records[1].focusStartEpochMs = T0 + 7000`.

Windows:
- **C1** `should keep the pinned unfocus end when the hosting window blurs during grace` —
  A 5 s → unfocus → 1 s → `onWindowBlurred(MAIN_WIN)` → expire → exactly
  `[{A, T0, 5000}]` (no double record, no end drift).
- **C2** `should survive a blip that also blurs and refocuses the window` — unfocus + blur,
  2 s, focus window + refocus A, 3 s, unfocus, expire → one spanning record (native-surface
  variant of the bug).
- **C3** `should not revive the doc on window refocus after the grace close finalized` —
  unfocus → expire → blur + focus MAIN → still exactly one record (pins
  `currentDoc = null` in finalize).
- **C4** `should adopt the new window when the same doc refocuses from a DIFFERENT window within grace`
  — A in MAIN → unfocus → refocus A with POPOUT_1 (popout focused) → MAIN blurs → 2 s →
  unfocus + expire → ONE continuous record (mirrors the tab-drag test).

Activity / idle:
- **D1** `should not extend the pinned end when user activity occurs during grace` —
  unfocus at t1 → activity at t1+2 s → expire → duration ends at t1.
- **D2** `should not start a session from user activity after the grace close finalized` —
  unfocus → expire → activity → advance → `dispose()` → still one record.
- **D3** `should finalize the pending close at the original unfocus time when the idle timeout fires during grace`
  — `idleTimeoutMs = 12_000`; A focused at T0, no activity, unfocus at T0+5 s; idle fires at
  T0+12 s (inside grace) → record duration 5000.
- **D4** `should start a NEW session on same-doc refocus after the idle close finalized the pending close`
  — continue D3: refocus A at T0+13 s, 3 s, unfocus, expire → `records[1]` starts T0+13 s.

OS sleep (uses the existing `sleepMs` helper):
- **E1** `should finalize at the original unfocus time when the same doc refocuses after a sleep longer than grace`
  — A 5 s → unfocus → sleep 8 h → refocus A → `records[0]` = `{A, T0, 5000}` (wall-clock
  guard; no session spans the sleep).
- **E2** `should start a fresh session at the post-sleep refocus` — continue E1: 3 s,
  unfocus, expire → `records[1].focusStartEpochMs` = wake time.
- **E3** `should preserve the pre-unfocus sleep cutoff even when activity occurs during grace`
  — activity at T0+60 s → sleep 8 h → unfocus at wake → activity 1 s later (during grace) →
  expire → duration 60_000 (justifies the `cappedEndMs` snapshot; the sleep gap never counts).
- **E4** `should finalize the pending close on the first post-wake interaction (retroactive idle)`
  — A 5 s → unfocus → sleep 8 h → `onUserActivity()` → exactly `[{A, T0, 5000}]` (no reopen).

Dispose:
- **F1** `should flush the pending close at the original unfocus time on dispose` —
  A 5 s → unfocus → 3 s → `dispose()` → duration 5000 (not 8000; session not lost).

### 3.3 Existing tests — impact table

**No existing test is removed and no expected duration/start/record changes.** The grace only
defers WHEN the unfocus-triggered record is emitted, and the end stays pinned at the original
unfocus time — so every assertion survives once the test lets the grace resolve. Change per
test: append `expireGrace()` after the final `onDocUnfocused()` (before the assert).
Human-approved rationale (per CLAUDE.md "respect existing tests"): the approved grace
behavior itself — unfocus no longer closes immediately; emission is deferred ≤ 10 s.

Tests needing ONLY the added `expireGrace()` (current line refs):
- `:52` "record the duration when the doc is unfocused"
- `:72` "NOT fragment the session on duplicate focus events"
- `:84` "A -> B -> A as three separate sessions" — **semantics preserved**: B and the second A
  are DIFFERENT-doc focuses, which finalize the pending closes synchronously at the original
  unfocus times, so it is still exactly `['A:100', 'B:200', 'A:300']`; only the trailing
  flush needs `expireGrace()`. (Exploration flagged this test as at-risk; it is not.)
- `:112` "start a NEW session for the same doc when the window regains focus" (final unfocus)
- `:134` "ignore a duplicate window-focus event"
- `:157` "start the session at window refocus for a doc focused while blurred"
- `:184` "NOT revive the old doc when an unrelated window gains focus" (Y's unfocus)
- `:211` "reopen the session when the doc's OWN popout regains focus" (final unfocus)
- `:228` "keep the session running when the doc is MOVED to another window"
- `:282` "keep the session alive while the user keeps interacting"
- `:295` "start a NEW session when the user interacts again after an idle auto-close"
- `:369` "start a NEW session at the wake interaction"
- `:382` "cap the duration at the last interaction when the doc is unfocused right after
  waking" — passes with the same expectation thanks to the `cappedEndMs` snapshot.

Unchanged (no unfocus at the assert point, or unfocus with no open session): `:62`, `:102`,
`:126`, `:146`, `:172`, `:199`, `:243`, `:254`, `:271`, `:307`, `:316`, `:326`, `:336`,
`:356`, `:396`, `:406`.

Note: "window blur = new session" (`:112`) does NOT change semantics — blur-close has no
grace (pending is only created by `onDocUnfocused`); blur still closes immediately.

Other suites (`FocusTracker.test.ts`, `VhV3FocusDurationListener.test.ts`,
`WindowActivityMonitor.test.ts`): untouched — the classes they cover are untouched.

---

## 4. Implementation phases (failing test first)

1. **Phase 1 — failing bug test.** Add `describe('unfocus grace period')` with A1 only
   (import `UNFOCUS_GRACE_MS` — add the exported constant to `FocusDurationTracker.ts` now,
   NO behavior change yet). Run: A1 must FAIL (two records today). Verification:
   `npx vitest run src/core/focusDuration/FocusDurationTracker.test.ts > .tmp/t1 2>&1`.
2. **Phase 2 — core grace mechanics.** `PendingClose`, `pendingClose`/`graceTimer` fields,
   `idleCappedEndMs` helper (refactor `endSession` to use it), new `onDocUnfocused`,
   `onDocFocused` (wall-clock guard + cancel + finalize-on-different-doc),
   `finalizePendingClose`/`cancelPendingClose`/grace-timer trio. Verification: A1 passes;
   the 13 listed existing tests now fail for the expected reason (record deferred).
3. **Phase 3 — adjust existing tests.** Add `expireGrace()` helper + the 13 one-line
   additions from §3.3. Verification: full file green except not-yet-written edge guards.
4. **Phase 4 — interplay guards, test-first per group.** Add tests then code, group by
   group: A2–A5 (mostly already green — pin them), B (different doc), C (windows: blur
   early-return), D (activity/idle: finalize in `onUserActivity` retro branch and
   `onIdleTimerFired`), E (sleep: verifies the guard + snapshot), F (`dispose` finalize).
5. **Phase 5 — code docs.** Class doc close-conditions list, method docs, WHY comments (§2.6).
6. **Phase 6 — project docs** (§5 below).
7. **Phase 7 — full gate.** `npm test`, `npm run lint`, `npm run build` (redirect outputs to
   `.tmp/`). Commit at milestones (Phase 1, Phase 3/4 boundary, final).

---

## 5. Documentation updates (succinct)

- **CLAUDE.md** — in the "VH V3 (focus durations)" bullet, amend the close list:
  `FocusDurationTracker` closes a session on navigation away "(after a fixed 10 s unfocus
  grace — a same-doc refocus within grace continues the session so transient canvas-UI blips
  don't split it; the close is stamped at the ORIGINAL unfocus time, never inflating the
  duration)", …rest unchanged.
- **docs/architecture.md** (~:91 "session CLOSES on" box) — change "navigate away" to
  "navigate away (10 s grace: same-doc refocus within it continues the session; close is
  stamped at the original unfocus time)".
- **docs/visit-history-format.md** (:58 close-conditions bullet) — same qualifier on
  "navigation away from the doc"; note the record is appended when the close FINALIZES
  (≤ 10 s after the unfocus), end stamped at the unfocus moment.

---

## 6. Acceptance criteria (automated)

1. A1 (canvas blip) exists, was observed failing pre-fix, passes post-fix.
2. All new tests A2–A5, B1–B2, C1–C4, D1–D4, E1–E4, F1 pass.
3. All pre-existing `FocusDurationTracker` tests pass with ONLY the documented
  `expireGrace()` additions — zero changes to expected records (docId/start/duration).
4. `FocusTracker.test.ts`, `VhV3FocusDurationListener.test.ts`,
   `WindowActivityMonitor.test.ts` pass UNMODIFIED.
5. `npm test` green; `npm run lint` zero errors; `npm run build` clean.
6. `git diff` touches only: `FocusDurationTracker.ts`, `FocusDurationTracker.test.ts`,
   `CLAUDE.md`, `docs/architecture.md`, `docs/visit-history-format.md`.
7. No magic numbers: grace referenced only via exported `UNFOCUS_GRACE_MS`.

---

## 7. Planner decisions within the approved approach (called out for review)

The approved decisions left four interaction details open; chosen semantics (rationale in
§2.4/§2.5): (a) window blur during grace does not close/cancel — the pinned end makes it
inflation-free and it extends the fix to native-surface blips; (b) a second unfocus while
pending is a no-op (first timestamp wins); (c) an idle-confirmed timer fire during grace
finalizes at the pinned end; (d) a wall-clock grace-expiry guard on same-doc refocus prevents
sleep-spanning resurrections. None deviates from the HUMAN-approved decisions; all preserve
"close at the ORIGINAL unfocus timestamp" and the sleep-never-counts invariant.

No `#QUESTION_FOR_HUMAN` — no blocker or materially simpler alternative found.
