# FocusDurationTracker: blur-before-unfocus event-ordering edge

**Status**: OPEN (found during `fix-canvas-unfocus` plan review, 2026-07-16)

## Problem
If a canvas affordance ever opens a NATIVE/OS-level surface, the event order could be
`window blur` → `active-leaf-change(null)` → refocus, instead of the leaf-change-only
order the 10 s unfocus grace period was designed for. In that order the blur closes the
session first (blur path self-heals via `currentDoc`), and the subsequent unfocus/refocus
interplay with the pending-close grace state has not been observed in the wild.

## Impact
Speculative — no reproduction observed. Worst case is a split session (pre-fix behavior),
never data corruption: durations remain capped at the original unfocus/blur time.

## Action
Only if observed: reproduce with temporary logging in `FocusTracker.handleLeafChange` +
`WindowActivityMonitor`, then extend the decision table in
`src/core/focusDuration/FocusDurationTracker.ts` (see `FocusDurationTracker.test.ts`
grace-interplay group for the test pattern).

## Origin
`.ai_out/fix-canvas-unfocus/fix-unfocus-due-to-rectangle-choice/DETAILED_PLAN_REVIEW__PUBLIC.md` (SUGGESTION S1).
