# TOP_LEVEL_AGENT — user-name-confirm-modal

## Task
Replace silent user-name auto-resolution with a confirmation MODAL on devices with no
pinned name: pick an existing `__visit_history/user/` name OR enter a new one
(filename-safe). Desktop pre-populated with OS login name; mobile never mints
`mobile-user-<random8>` anymore. Pin stays in device-scoped localStorage (non-synced).

## HUMAN-approved requirements (from flow-1 conversation, 2026-07-16/17)
1. Dismissed modal → NO pin, NO VH recording that session, re-prompt on EVERY start until pinned.
2. No VH recording until name pinned (pre-confirm sessions lost — accepted).
3. Devices with an already-pinned name NEVER see the modal.
4. Rename flow (flow 1) merged first (84fc53f); this is a fresh flow on branch `user-name-confirm-modal`.

## Flow (straightforward-flow)
EXPLORATION → CLARIFICATION(if needed) → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Status log
- [x] Flow 1 (rename-visit-history-dir) merged to master: 84fc53f
- [x] Branch `user-name-confirm-modal` created
- [~] EXPLORATION: Explore sub-agent running in background → EXPLORATION_PUBLIC.md
- [ ] CLARIFICATION (only if genuine ambiguities)
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Final: change log entry (single), tickets, callouts
