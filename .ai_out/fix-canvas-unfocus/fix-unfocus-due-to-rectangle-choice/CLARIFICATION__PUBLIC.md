# CLARIFICATION — resolved with HUMAN (2026-07-16)

## Task
Canvas "add rectangle/note" interactions fire a transient `active-leaf-change(null|untracked)`
→ FocusTracker unfocus → FocusDurationTracker closes the V3 session → refocus starts a new one.
Fix so the duration session survives such transient unfocus→same-doc-refocus blips.

## Decisions (HUMAN-approved)
1. **Approach APPROVED**: grace period inside `FocusDurationTracker` ("pending close").
   - `onDocUnfocused` → mark session pending-close (remember unfocus timestamp), arm grace timer
     (mirror the existing idle-timer pattern).
   - Refocus of SAME doc within grace → cancel pending close; session continues (gap counts as
     focus time; idle timeout + retroactive idle cutoff still apply).
   - Focus of a DIFFERENT doc, or grace expiry → close session at the ORIGINAL unfocus timestamp
     (no duration inflation).
   - `FocusTracker` semantics and other listeners untouched. No write-time merge.
2. **Grace period**: fixed named constant, **10 seconds**. No user setting (over-engineering).
3. **Gaps longer than grace still split — by design.** Accepted.

## Known accepted tradeoffs
- Sink write (and heatmap "last visited" visibility) delayed by up to 10 s after a real
  navigation-away.
- Time spent in an in-canvas picker/modal within grace counts as focus time on the canvas.

## Context
Full exploration: `EXPLORATION_PUBLIC.md` (same dir). Root cause = candidate fix direction #1.
